import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'

const files = {
  policy: 'apps/api/src/modules/territories/territory-assurance-certification.ts',
  policyTest: 'apps/api/src/modules/territories/territory-assurance-certification.test.ts',
  service: 'apps/api/src/modules/territories/territory-assurance.service.ts',
  routes: 'apps/api/src/modules/territories/territories.routes.ts',
  eligibility: 'apps/api/src/modules/governance/governance.eligibility.ts',
  assurancePolicyTest: 'apps/api/src/modules/governance/__tests__/governance.assurance-policy.test.ts',
  eligibilityTest: 'apps/api/src/modules/governance/__tests__/governance.eligibility.test.ts',
  golden: 'apps/api/src/__tests__/golden-territorial-assurance-certification.integration.test.ts',
  migration: 'apps/api/prisma/migrations/20260910184500_territorial_governance_eligibility_phase7g2/migration.sql',
  webTerritory: 'apps/web/app/dashboard/territory/page.tsx',
  webGovernance: 'apps/web/app/dashboard/governance/page.tsx',
  mobileAssurance: 'apps/mobile/app/territory/assurance.tsx',
  mobileGovernance: 'apps/mobile/app/(tabs)/governance.tsx',
  phase7g3: 'docs/engineering/TERRITORIAL_CITIZEN_EXPERIENCE_PHASE7G3.md',
  phase7g4: 'docs/engineering/TERRITORIAL_ASSURANCE_CERTIFICATION_PHASE7G4.md',
}

const content = Object.fromEntries(await Promise.all(
  Object.entries(files).map(async ([key, path]) => [key, await readFile(path, 'utf8')]),
))

function requireText(key, needle, message = `${key} missing ${needle}`) {
  if (!content[key].includes(needle)) throw new Error(message)
}

function forbidText(key, needle, message = `${key} must not include ${needle}`) {
  if (content[key].includes(needle)) throw new Error(message)
}

const expectedSha = process.env.VERTICE_EXPECTED_SHA?.trim()
if (expectedSha) {
  const actualSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  if (actualSha !== expectedSha) {
    throw new Error(`exact SHA certification failed: expected ${expectedSha}, got ${actualSha}`)
  }
  console.log(`TERRITORIAL_ASSURANCE_EXACT_SHA=${actualSha}`)
}

for (const control of [
  'provider_production_canary',
  'operator_reviewer_separation',
  'privacy_legal_approval',
  'revocation_drill',
  'expiry_renewal_drill',
  'scope_mismatch_drill',
  'frozen_electorate_drill',
]) {
  requireText('policy', control)
}
requireText('policy', "'blocked_external_evidence'")
requireText('policy', "'ready_for_operator_release_review'")
requireText('policy', 'automatic_production_certification: false')
forbidText('policy', "production_readiness: 'certified'", 'CI policy must never manufacture production certification')
requireText('policyTest', 'candidate_sha_mismatch')
requireText('policyTest', 'external_evidence_missing')
requireText('policyTest', 'external_evidence_reference_invalid')

requireText('service', 'TERRITORY_ASSURANCE_VALIDITY_DAYS = 365')
requireText('service', 'TERRITORY_ASSURANCE_RENEWAL_WINDOW_DAYS = 30')
requireText('service', 'TERRITORY_ASSURANCE_SELF_REVIEW_FORBIDDEN')
requireText('routes', "!/^https?:\\/\\//i.test(value)")
requireText('routes', "rateLimit: { max: 4, timeWindow: '1 day' }")
requireText('routes', 'requireSuperadmin')

for (const reason of [
  'ELIGIBLE_CURRENT_ASSURANCE',
  'ELIGIBLE_FROZEN_ELECTORATE',
  'TERRITORY_ASSURANCE_REQUIRED',
  'TERRITORY_ASSURANCE_EXPIRED',
  'TERRITORY_SCOPE_MISMATCH',
  'VOTER_ROLL_UNAVAILABLE',
  'NOT_IN_FROZEN_ELECTORATE',
]) {
  requireText('eligibility', reason)
}
requireText('eligibility', "authority: (eligible ? 'frozen_electorate' : 'none')")
requireText('eligibilityTest', 'switches authority to the frozen electorate after voting opens')
requireText('eligibilityTest', 'rejects a citizen absent from the frozen electorate')
requireText('assurancePolicyTest', 'territory_assurance_requests')
requireText('assurancePolicyTest', 'proposal_voter_roll')

requireText('migration', 'enforce_current_territory_assurance_binding')
requireText('migration', 'enforce_voter_roll_territory')
requireText('migration', 'protect_frozen_voter_roll')
requireText('migration', 'territory_assurance_request_id')
requireText('migration', 'identity_proof_id')

for (const marker of [
  'TERRITORY_SCOPE_MISMATCH',
  'TERRITORY_ASSURANCE_EXPIRED',
  'ELIGIBLE_FROZEN_ELECTORATE',
  'NOT_IN_FROZEN_ELECTORATE',
]) {
  requireText('golden', marker)
}
requireText('golden', 'frozenAfterChanges')

requireText('webTerritory', '/territories/assurance/me')
requireText('webGovernance', '/eligibility')
requireText('mobileAssurance', '/territories/assurance/me')
requireText('mobileGovernance', '/eligibility')

requireText('phase7g3', 'server eligibility reason -> citizen explanation -> bounded remediation')
requireText('phase7g4', 'CODE_CERTIFIED')
requireText('phase7g4', 'BLOCKED_EXTERNAL_EVIDENCE')
requireText('phase7g4', 'ready_for_operator_release_review')
requireText('phase7g4', 'never means production election CERTIFIED')

console.log('TERRITORIAL_ASSURANCE_SOURCE_CERTIFICATION=PASS')
console.log('TERRITORIAL_ASSURANCE_CODE_STATUS=CODE_CERTIFIED')
console.log('TERRITORIAL_ASSURANCE_PRODUCTION_STATUS=BLOCKED_EXTERNAL_EVIDENCE')
