import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'

const files = {
  policy: 'apps/api/src/lib/closed-pilot-readiness.ts',
  policyTest: 'apps/api/src/lib/__tests__/closed-pilot-readiness.test.ts',
  access: 'apps/api/src/lib/closed-pilot-access.ts',
  accessTest: 'apps/api/src/lib/__tests__/closed-pilot-access.test.ts',
  app: 'apps/api/src/app.ts',
  authService: 'apps/api/src/modules/auth/auth.service.ts',
  federationService: 'apps/api/src/modules/auth/federation.service.ts',
  capabilities: 'apps/api/src/lib/feature-secrets.ts',
  engineering: 'docs/engineering/CLOSED_PILOT_READINESS_PHASE7H.md',
  runbook: 'docs/operations/CLOSED_PILOT_RUNBOOK.md',
  workflow: '.github/workflows/closed-pilot-readiness.yml',
}

const content = Object.fromEntries(await Promise.all(
  Object.entries(files).map(async ([key, path]) => [key, await readFile(path, 'utf8')]),
))

function requireText(key, needle, message = `${key} missing ${needle}`) {
  if (!content[key].includes(needle)) throw new Error(message)
}

const expectedSha = process.env.VERTICE_EXPECTED_SHA?.trim()
if (expectedSha) {
  const actualSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  if (actualSha !== expectedSha) {
    throw new Error(`closed-pilot exact SHA gate failed: expected ${expectedSha}, got ${actualSha}`)
  }
  console.log(`CLOSED_PILOT_EXACT_SHA=${actualSha}`)
}

for (const dependency of ['database', 'redis', 'neo4j']) requireText('policy', `'${dependency}'`)
for (const capability of ['payments', 'crowdfunding_payments', 'payouts', 'crowdfunding_payouts']) {
  requireText('policy', `'${capability}'`)
  requireText('capabilities', `${capability}:`)
}

for (const safeguard of [
  "access: 'closed_invite_only'",
  "governance: 'consultative_only'",
  "monetary_operations: 'disabled'",
  "account_deletion: 'required'",
  "moderation: 'required'",
]) requireText('policy', safeguard)

requireText('access', 'CLOSED_PILOT_MODE')
requireText('access', 'CLOSED_PILOT_EMAIL_ALLOWLIST')
requireText('access', 'MAX_CLOSED_PILOT_COHORT = 30')
requireText('access', 'CLOSED_PILOT_INVITE_REQUIRED')
requireText('accessTest', 'rejects non-invited identities')
requireText('policy', 'pilot:access_control_not_ready')
requireText('policyTest', 'pilot:access_control_not_ready')

requireText('authService', 'assertClosedPilotEmailAllowed(input.email)')
requireText('authService', 'assertClosedPilotEmailAllowed(session.citizen.email)')
requireText('federationService', 'assertClosedPilotEmailAllowed(identity.email)')
requireText('app', "app.get('/health/pilot'")
requireText('app', 'getClosedPilotAccessState()')
requireText('app', 'access_control: access')
requireText('app', 'release_ready: assessment.releaseReady')
requireText('policyTest', 'dependency:neo4j')
requireText('policyTest', 'pilot:monetary_capability:')
requireText('policyTest', 'runtime:revision_unknown')
requireText('engineering', 'READY_FOR_CLOSED_PILOT')
requireText('engineering', 'BLOCKED')
requireText('engineering', '10–30')
requireText('runbook', '/health/pilot')
requireText('runbook', 'same SHA')
requireText('runbook', 'STOP')
requireText('workflow', 'Verify exact-SHA closed pilot source contract')

console.log('CLOSED_PILOT_SOURCE_GATE=PASS')
console.log('CLOSED_PILOT_CODE_STATUS=READY_FOR_RUNTIME_VALIDATION')
console.log('CLOSED_PILOT_RUNTIME_STATUS=REQUIRES_EXACT_SHA_PRODUCTION_EVIDENCE')
