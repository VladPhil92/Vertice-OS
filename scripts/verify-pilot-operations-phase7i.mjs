import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'

const files = {
  schema: 'apps/api/src/modules/pilot/pilot.schema.ts',
  service: 'apps/api/src/modules/pilot/pilot.service.ts',
  routes: 'apps/api/src/modules/pilot/pilot.routes.ts',
  tests: 'apps/api/src/modules/pilot/__tests__/pilot.service.test.ts',
  app: 'apps/api/src/app.ts',
  web: 'apps/web/app/dashboard/pilot/page.tsx',
  engineering: 'docs/engineering/PILOT_OPERATIONS_OBSERVABILITY_PHASE7I.md',
  runbook: 'docs/operations/CLOSED_PILOT_OBSERVABILITY_RUNBOOK.md',
  workflow: '.github/workflows/pilot-operations-observability.yml',
}

const content = Object.fromEntries(await Promise.all(
  Object.entries(files).map(async ([key, path]) => [key, await readFile(path, 'utf8')]),
))

function requireText(key, needle, message = `${key} missing ${needle}`) {
  if (!content[key].includes(needle)) throw new Error(message)
}

function rejectText(key, needle, message = `${key} must not contain ${needle}`) {
  if (content[key].includes(needle)) throw new Error(message)
}

const expectedSha = process.env.VERTICE_EXPECTED_SHA?.trim()
if (expectedSha) {
  const actualSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  if (actualSha !== expectedSha) {
    throw new Error(`Phase 7I exact SHA gate failed: expected ${expectedSha}, got ${actualSha}`)
  }
  console.log(`PILOT_OPERATIONS_EXACT_SHA=${actualSha}`)
}

for (const event of [
  'session_started',
  'onboarding_completed',
  'territory_selected',
  'community_loaded',
  'report_submitted',
  'moderation_report_submitted',
  'account_deletion_completed',
]) requireText('schema', `'${event}'`)

requireText('schema', ').strict()')
requireText('schema', 'message: z.string().trim().min(1).max(500)')
requireText('service', 'PILOT_TELEMETRY_PEPPER')
requireText('service', "createHmac('sha256'")
requireText('service', "slice(0, 24)")
requireText('service', 'RETENTION_SECONDS = 30 * 24 * 60 * 60')
requireText('service', 'TELEMETRY_MAXLEN = 10_000')
requireText('service', 'FEEDBACK_MAXLEN = 2_000')
requireText('service', 'INCIDENT_MAXLEN = 500')
requireText('service', '[redacted-email]')
requireText('service', '[redacted-phone]')
requireText('service', '[redacted-number]')
requireText('service', '/^[0-9a-f]{40}$/i')
rejectText('service', 'IDENTITY_PEPPER', 'Pilot telemetry must use a dedicated cryptographic domain')

requireText('routes', 'requireConfiguredPilot')
requireText('routes', 'getClosedPilotAccessState()')
requireText('routes', 'getPilotObservabilityState()')
requireText('routes', 'PILOT_OBSERVABILITY_NOT_CONFIGURED')
requireText('routes', "app.post('/telemetry'")
requireText('routes', "app.post('/feedback'")
requireText('routes', "app.get('/admin/summary'")
requireText('routes', "app.post('/admin/incidents'")
requireText('routes', 'requirePilotOperator')
requireText('routes', 'requirePilotAdmin')
requireText('app', "app.register(pilotRoutes, { prefix: '/pilot' })")

requireText('tests', 'rejects arbitrary telemetry payload fields')
requireText('tests', 'redacts common personal identifiers')
requireText('tests', 'requires a dedicated telemetry pepper')
requireText('tests', 'accepts only immutable full commit SHAs')
requireText('web', "apiFetch<PilotStatus>('/pilot/status')")
requireText('web', "apiFetch('/pilot/feedback'")
requireText('web', 'No incluyas contraseñas')
requireText('engineering', 'Redis is an **ephemeral operational plane**')
requireText('engineering', 'OPERATIONAL')
requireText('runbook', 'STOP conditions')
requireText('runbook', '30-day TTL')
requireText('workflow', 'Verify Phase 7I exact-SHA source contract')

for (const forbiddenImport of ["../billing", "../crowdfunding", "../governance/governance.service"]) {
  rejectText('routes', forbiddenImport)
  rejectText('service', forbiddenImport)
}

console.log('PILOT_OPERATIONS_SOURCE_GATE=PASS')
console.log('PILOT_OPERATIONS_CODE_STATUS=READY_FOR_RUNTIME_VALIDATION')
console.log('PILOT_OPERATIONS_RUNTIME_STATUS=REQUIRES_ACTIVE_CLOSED_PILOT')
