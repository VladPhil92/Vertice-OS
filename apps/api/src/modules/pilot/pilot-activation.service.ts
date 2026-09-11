import crypto from 'node:crypto'
import { redis } from '../../lib/redis'
import { getClosedPilotAccessState } from '../../lib/closed-pilot-access'
import { assessClosedPilotReadiness } from '../../lib/closed-pilot-readiness'
import { getFeatureCapabilities } from '../../lib/feature-secrets'
import { probeRuntimeDependencies } from '../../lib/runtime-probe'
import { deployedPilotRevision, getPilotObservabilityState } from './pilot.service'

const ACTIVATION_KEY = 'vertice:pilot:v1:activation'
const PAUSE_EPOCH_KEY = 'vertice:pilot:v1:activation:pause_epoch'
const FULL_GIT_COMMIT_SHA = /^[0-9a-f]{40}$/i

const CONDITIONAL_ACTIVATION_SCRIPT = `
local current_epoch = redis.call('GET', KEYS[1]) or '0'
if current_epoch ~= ARGV[1] then
  return 0
end
redis.call('SET', KEYS[2], ARGV[2])
return 1
`

export interface PilotActivationRecord {
  state: 'active' | 'paused'
  revision: string
  cohort_fingerprint: string | null
  cohort_size: number
  changed_at: string
}

export interface PilotActivationState {
  state: 'active' | 'paused'
  current: boolean
  revision: string
  cohort_fingerprint: string | null
  cohort_size: number
  blockers: string[]
  changed_at: string | null
}

type PilotActivationContext = {
  revision: string
  cohort_fingerprint: string | null
  cohort_size: number
  access_configured: boolean
  observability_configured: boolean
}

function normalizedAllowlist(env: NodeJS.ProcessEnv = process.env): string[] {
  return Array.from(new Set(
    (env.CLOSED_PILOT_EMAIL_ALLOWLIST ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  )).sort()
}

export function pilotCohortFingerprint(env: NodeJS.ProcessEnv = process.env): string | null {
  const pepper = env.PILOT_TELEMETRY_PEPPER?.trim()
  const allowlist = normalizedAllowlist(env)
  if (!pepper || pepper.length < 32 || allowlist.length === 0) return null

  return crypto
    .createHmac('sha256', pepper)
    .update(allowlist.join('\n'))
    .digest('hex')
    .slice(0, 24)
}

export function assessPilotActivationCurrent(
  record: PilotActivationRecord | null,
  context: PilotActivationContext,
): PilotActivationState {
  const blockers: string[] = []

  if (!context.access_configured) blockers.push('pilot:access_control_not_ready')
  if (!context.observability_configured) blockers.push('pilot:observability_not_ready')
  if (!FULL_GIT_COMMIT_SHA.test(context.revision)) blockers.push('runtime:revision_invalid')
  if (!context.cohort_fingerprint) blockers.push('pilot:cohort_fingerprint_unavailable')

  if (!record) {
    blockers.push('pilot:runtime_activation_missing')
  } else {
    if (record.state !== 'active') blockers.push('pilot:runtime_activation_paused')
    if (record.revision !== context.revision) blockers.push('pilot:runtime_activation_revision_drift')
    if (record.cohort_fingerprint !== context.cohort_fingerprint) {
      blockers.push('pilot:runtime_activation_cohort_drift')
    }
    if (record.cohort_size !== context.cohort_size) {
      blockers.push('pilot:runtime_activation_cohort_size_drift')
    }
  }

  const uniqueBlockers = Array.from(new Set(blockers)).sort()
  return {
    state: record?.state ?? 'paused',
    current: uniqueBlockers.length === 0,
    revision: context.revision,
    cohort_fingerprint: context.cohort_fingerprint,
    cohort_size: context.cohort_size,
    blockers: uniqueBlockers,
    changed_at: record?.changed_at ?? null,
  }
}

async function readActivationRecord(): Promise<PilotActivationRecord | null> {
  const raw = await redis.get(ACTIVATION_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<PilotActivationRecord>
    if (
      (parsed.state === 'active' || parsed.state === 'paused')
      && typeof parsed.revision === 'string'
      && (typeof parsed.cohort_fingerprint === 'string' || parsed.cohort_fingerprint === null)
      && typeof parsed.cohort_size === 'number'
      && typeof parsed.changed_at === 'string'
    ) {
      return parsed as PilotActivationRecord
    }
  } catch {
    // Corrupt or legacy activation state fails closed below.
  }

  return null
}

function currentContext(): PilotActivationContext {
  const access = getClosedPilotAccessState()
  const observability = getPilotObservabilityState()
  return {
    revision: deployedPilotRevision(),
    cohort_fingerprint: pilotCohortFingerprint(),
    cohort_size: access.cohort_size,
    access_configured: access.enabled && access.configured && access.mode === 'closed_invite_only',
    observability_configured: observability.configured,
  }
}

async function assessLivePilotSafety(context: PilotActivationContext): Promise<string[]> {
  const { checks } = await probeRuntimeDependencies()
  const capabilities = getFeatureCapabilities()
  const access = getClosedPilotAccessState()
  const readiness = assessClosedPilotReadiness({
    checks,
    capabilities,
    access,
    revision: context.revision,
    production: process.env.NODE_ENV === 'production',
  })

  const blockers = [...readiness.blockers]
  if (!context.observability_configured) blockers.push('pilot:observability_not_ready')
  if (!context.cohort_fingerprint) blockers.push('pilot:cohort_fingerprint_unavailable')
  return Array.from(new Set(blockers)).sort()
}

export async function getPilotActivationState(): Promise<PilotActivationState> {
  return assessPilotActivationCurrent(await readActivationRecord(), currentContext())
}

export async function assertPilotActivationCurrent(): Promise<void> {
  const beforeContext = currentContext()
  const beforeRecord = await readActivationRecord()
  const beforeState = assessPilotActivationCurrent(beforeRecord, beforeContext)

  if (!beforeState.current) {
    throw Object.assign(new Error('El cohorte del piloto requiere activación operativa'), {
      statusCode: 503,
      code: 'PILOT_RUNTIME_ACTIVATION_REQUIRED',
      blockers: beforeState.blockers,
    })
  }

  // A stored activation is necessary but never sufficient. Re-evaluate live
  // dependencies and feature capabilities on every participant entry point so
  // Neo4j outages or same-SHA runtime configuration changes (including money)
  // immediately fail closed instead of inheriting a stale activation decision.
  const liveBlockers = await assessLivePilotSafety(beforeContext)
  if (liveBlockers.length > 0) {
    throw Object.assign(new Error('El runtime del piloto ya no cumple las garantías de seguridad'), {
      statusCode: 503,
      code: 'PILOT_RUNTIME_SAFETY_BLOCKED',
      blockers: liveBlockers,
    })
  }

  // Re-read after bounded probes so an emergency pause, deploy or cohort change
  // racing this request also takes effect before participant execution begins.
  const afterState = assessPilotActivationCurrent(await readActivationRecord(), currentContext())
  if (!afterState.current) {
    throw Object.assign(new Error('La activación del piloto cambió durante la validación'), {
      statusCode: 503,
      code: 'PILOT_RUNTIME_ACTIVATION_CHANGED',
      blockers: afterState.blockers,
    })
  }
}

export async function activatePilotCohort(expectedRevision: string): Promise<PilotActivationState> {
  const context = currentContext()
  if (expectedRevision !== context.revision) {
    throw Object.assign(new Error('El SHA esperado no coincide con el runtime desplegado'), {
      statusCode: 409,
      code: 'PILOT_ACTIVATION_REVISION_MISMATCH',
      blockers: ['pilot:expected_revision_mismatch'],
    })
  }

  // Snapshot the emergency-stop generation before any slow dependency probe.
  // A concurrent pause increments this epoch atomically; the final activation
  // write is rejected if that happened while the request was in flight.
  const pauseEpoch = (await redis.get(PAUSE_EPOCH_KEY)) ?? '0'
  const blockers = await assessLivePilotSafety(context)

  const latestContext = currentContext()
  if (
    latestContext.revision !== context.revision
    || latestContext.cohort_fingerprint !== context.cohort_fingerprint
    || latestContext.cohort_size !== context.cohort_size
  ) {
    blockers.push('pilot:activation_context_drift')
  }

  const uniqueBlockers = Array.from(new Set(blockers)).sort()
  if (uniqueBlockers.length > 0) {
    throw Object.assign(new Error('El piloto no supera el preflight de activación'), {
      statusCode: 503,
      code: 'PILOT_ACTIVATION_BLOCKED',
      blockers: uniqueBlockers,
    })
  }

  const record: PilotActivationRecord = {
    state: 'active',
    revision: context.revision,
    cohort_fingerprint: context.cohort_fingerprint,
    cohort_size: context.cohort_size,
    changed_at: new Date().toISOString(),
  }

  const applied = await redis.eval(
    CONDITIONAL_ACTIVATION_SCRIPT,
    2,
    PAUSE_EPOCH_KEY,
    ACTIVATION_KEY,
    pauseEpoch,
    JSON.stringify(record),
  )

  if (Number(applied) !== 1) {
    throw Object.assign(new Error('La activación fue cancelada por una pausa administrativa concurrente'), {
      statusCode: 409,
      code: 'PILOT_ACTIVATION_SUPERSEDED_BY_PAUSE',
      blockers: ['pilot:emergency_pause_won_race'],
    })
  }

  return getPilotActivationState()
}

export async function pausePilotCohort(): Promise<PilotActivationState> {
  const context = currentContext()
  const record: PilotActivationRecord = {
    state: 'paused',
    revision: context.revision,
    cohort_fingerprint: context.cohort_fingerprint,
    cohort_size: context.cohort_size,
    changed_at: new Date().toISOString(),
  }

  // Increment + pause-record write execute atomically. Any activation request
  // that started before this transaction must fail its epoch CAS afterward.
  await redis.multi()
    .incr(PAUSE_EPOCH_KEY)
    .set(ACTIVATION_KEY, JSON.stringify(record))
    .exec()

  return getPilotActivationState()
}
