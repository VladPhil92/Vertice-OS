import { writeFile } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'

const REPORT_PATH = process.env.PILOT_REPORT_PATH || 'pilot-canary-report.json'
const BASE_URL = (process.env.PILOT_API_BASE_URL || '').replace(/\/$/, '')
const EXPECTED_REVISION = process.env.PILOT_EXPECTED_REVISION || ''
const MAX_WAIT_MS = Number(process.env.PILOT_MAX_WAIT_MS || 600_000)
const POLL_INTERVAL_MS = Number(process.env.PILOT_POLL_INTERVAL_MS || 10_000)
const ROUNDS = Number(process.env.PILOT_ROUNDS || 3)
const MAX_RESPONSE_MS = Number(process.env.PILOT_MAX_RESPONSE_MS || 4_000)
const REQUEST_TIMEOUT_MS = Number(process.env.PILOT_REQUEST_TIMEOUT_MS || 5_000)

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function validateConfiguration() {
  assert(BASE_URL, 'PILOT_API_BASE_URL is required')
  const parsed = new URL(BASE_URL)
  assert(parsed.protocol === 'https:', 'Pilot canary requires an HTTPS base URL')
  assert(/^[a-f0-9]{7,64}$/i.test(EXPECTED_REVISION), 'PILOT_EXPECTED_REVISION must be a Git SHA')
  assert(Number.isFinite(MAX_WAIT_MS) && MAX_WAIT_MS >= 10_000, 'PILOT_MAX_WAIT_MS is invalid')
  assert(Number.isFinite(POLL_INTERVAL_MS) && POLL_INTERVAL_MS >= 1_000, 'PILOT_POLL_INTERVAL_MS is invalid')
  assert(Number.isInteger(ROUNDS) && ROUNDS >= 1 && ROUNDS <= 10, 'PILOT_ROUNDS must be between 1 and 10')
  assert(Number.isFinite(MAX_RESPONSE_MS) && MAX_RESPONSE_MS >= 250, 'PILOT_MAX_RESPONSE_MS is invalid')
}

async function fetchJson(path) {
  const started = performance.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'user-agent': 'vertice-cartagena-pilot-canary/1.0',
      },
      redirect: 'error',
      signal: controller.signal,
    })
    const latencyMs = Math.round((performance.now() - started) * 100) / 100
    const text = await response.text()
    let body
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      throw new Error(`${path} returned non-JSON content`)
    }

    return { path, statusCode: response.status, latencyMs, body }
  } finally {
    clearTimeout(timer)
  }
}

function assertLatency(sample) {
  assert(sample.latencyMs <= MAX_RESPONSE_MS, `${sample.path} exceeded ${MAX_RESPONSE_MS}ms (${sample.latencyMs}ms)`)
}

function assertSameRevision(sample) {
  assert(sample.body?.revision === EXPECTED_REVISION, `${sample.path} revision mismatch: expected ${EXPECTED_REVISION}, got ${sample.body?.revision ?? 'missing'}`)
}

function validateLive(sample) {
  assert(sample.statusCode === 200, `/health/live returned ${sample.statusCode}`)
  assert(sample.body?.status === 'ok', '/health/live is not ok')
  assertSameRevision(sample)
  assertLatency(sample)
}

function validateReady(sample) {
  assert(sample.statusCode === 200, `/health/ready returned ${sample.statusCode}`)
  assert(['ok', 'degraded'].includes(sample.body?.status), `/health/ready status is ${sample.body?.status ?? 'missing'}`)
  assert(sample.body?.checks?.database === 'ok', '/health/ready database check is not ok')
  assert(sample.body?.checks?.redis === 'ok', '/health/ready redis check is not ok')
  assertSameRevision(sample)
  assertLatency(sample)
}

function validateRelease(sample) {
  assert(sample.statusCode === 200, `/health/release returned ${sample.statusCode}`)
  assert(sample.body?.status === 'ready', `/health/release status is ${sample.body?.status ?? 'missing'}`)
  assert(Array.isArray(sample.body?.blockers), '/health/release blockers is missing')
  assert(sample.body.blockers.length === 0, `/health/release blockers: ${sample.body.blockers.join(', ')}`)
  assert(sample.body?.checks?.database === 'ok', '/health/release database check is not ok')
  assert(sample.body?.checks?.redis === 'ok', '/health/release redis check is not ok')
  assertSameRevision(sample)
  assertLatency(sample)
}

function validatePublicList(sample, label) {
  assert(sample.statusCode === 200, `${label} returned ${sample.statusCode}`)
  assert(Array.isArray(sample.body?.data), `${label} data is not an array`)
  assert(typeof sample.body?.count === 'number', `${label} count is missing`)
  assertLatency(sample)
}

function summarize(sample) {
  const summary = {
    path: sample.path,
    statusCode: sample.statusCode,
    latencyMs: sample.latencyMs,
  }

  if (sample.path.startsWith('/health/')) {
    summary.status = sample.body?.status
    summary.revision = sample.body?.revision
    if (sample.body?.checks) summary.checks = sample.body.checks
    if (Array.isArray(sample.body?.blockers)) summary.blockers = sample.body.blockers
    if (sample.body?.capabilities) summary.capabilities = sample.body.capabilities
  } else {
    summary.count = sample.body?.count
  }

  return summary
}

async function waitForExpectedRevision() {
  const deadline = Date.now() + MAX_WAIT_MS
  let lastObserved = 'unreachable'

  while (Date.now() < deadline) {
    try {
      const sample = await fetchJson('/health/live')
      lastObserved = sample.body?.revision ?? `http-${sample.statusCode}`
      if (sample.statusCode === 200 && sample.body?.status === 'ok' && sample.body?.revision === EXPECTED_REVISION) {
        assertLatency(sample)
        return summarize(sample)
      }
    } catch (error) {
      lastObserved = error instanceof Error ? error.message : String(error)
    }
    await sleep(POLL_INTERVAL_MS)
  }

  throw new Error(`Timed out waiting for deployed revision ${EXPECTED_REVISION}; last observed: ${lastObserved}`)
}

async function runRound(round) {
  const samples = []

  const live = await fetchJson('/health/live')
  validateLive(live)
  samples.push(summarize(live))

  const ready = await fetchJson('/health/ready')
  validateReady(ready)
  samples.push(summarize(ready))

  const release = await fetchJson('/health/release')
  validateRelease(release)
  samples.push(summarize(release))

  const territorial = await fetchJson('/territorial/reports?limit=1')
  validatePublicList(territorial, 'territorial reports')
  samples.push(summarize(territorial))

  const governance = await fetchJson('/governance/proposals?limit=1')
  validatePublicList(governance, 'governance proposals')
  samples.push(summarize(governance))

  return { round, samples }
}

async function persist(report) {
  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
}

async function main() {
  validateConfiguration()
  const startedAt = new Date().toISOString()
  const deploymentObservation = await waitForExpectedRevision()
  const rounds = []

  for (let round = 1; round <= ROUNDS; round += 1) {
    rounds.push(await runRound(round))
    if (round < ROUNDS) await sleep(1_000)
  }

  const latencies = rounds.flatMap((entry) => entry.samples.map((sample) => sample.latencyMs)).sort((a, b) => a - b)
  const p95Index = Math.max(0, Math.ceil(latencies.length * 0.95) - 1)
  const report = {
    decision: 'GO',
    scope: 'cartagena-controlled-pilot-runtime',
    expectedRevision: EXPECTED_REVISION,
    baseUrl: BASE_URL,
    startedAt,
    completedAt: new Date().toISOString(),
    rounds: ROUNDS,
    maxResponseMs: MAX_RESPONSE_MS,
    p95LatencyMs: latencies[p95Index] ?? null,
    deploymentObservation,
    evidence: rounds,
    certificationBoundary: 'Runtime GO for the controlled Cartagena pilot only. External providers, financial rails and GA remain separately certified.',
  }

  await persist(report)
  console.log(`CARTAGENA_PILOT_DECISION=${report.decision}`)
  console.log(`CARTAGENA_PILOT_REVISION=${EXPECTED_REVISION}`)
  console.log(`CARTAGENA_PILOT_P95_MS=${report.p95LatencyMs}`)
}

main().catch(async (error) => {
  const message = error instanceof Error ? error.message : String(error)
  await persist({
    decision: 'NO_GO',
    scope: 'cartagena-controlled-pilot-runtime',
    expectedRevision: EXPECTED_REVISION || null,
    baseUrl: BASE_URL || null,
    completedAt: new Date().toISOString(),
    reason: message,
  }).catch(() => undefined)
  console.error(`CARTAGENA_PILOT_DECISION=NO_GO: ${message}`)
  process.exit(1)
})
