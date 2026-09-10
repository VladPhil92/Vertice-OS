import { readFile } from 'node:fs/promises'

const files = {
  assurance: 'apps/api/src/modules/territories/territory-assurance.service.ts',
  certification: 'apps/api/src/modules/territories/territory-assurance-certification.ts',
  governance: 'apps/api/src/modules/governance/governance.service.ts',
  migration: 'apps/api/prisma/migrations/20260910184500_territorial_governance_eligibility_phase7g2/migration.sql',
  assuranceGolden: 'apps/api/src/__tests__/golden-territory-assurance.integration.test.ts',
  governanceGolden: 'apps/api/src/__tests__/golden-governance.integration.test.ts',
  certificationGolden: 'apps/api/src/__tests__/golden-territorial-assurance-certification.integration.test.ts',
  webTerritory: 'apps/web/app/dashboard/territory/page.tsx',
  webGovernance: 'apps/web/app/dashboard/governance/page.tsx',
  mobileAssurance: 'apps/mobile/app/territory/assurance.tsx',
  mobileGovernance: 'apps/mobile/app/(tabs)/governance.tsx',
  docs: 'docs/engineering/TERRITORIAL_ASSURANCE_CERTIFICATION_PHASE7G4.md',
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

requireText('assurance', 'TERRITORY_ASSURANCE_VALIDITY_DAYS = 365')
requireText('assurance', 'TERRITORY_ASSURANCE_RENEWAL_WINDOW_DAYS = 30')
requireText('assurance', 'TERRITORY_ASSURANCE_SELF_REVIEW_FORBIDDEN')
requireText('assurance', 'TERRITORY_ASSURANCE_HOME_TERRITORY_CHANGED')
requireText('assurance', "createHash('sha256')")
requireText('migration', 'enforce_current_territory_assurance_binding')
requireText('migration', 'enforce_voter_roll_territory')
requireText('migration', 'territory_assurance_request_id')
requireText('migration', 'territory_assurance_expires_at')

for (const reason of [
  'TERRITORY_ASSURANCE_REQUIRED',
  'TERRITORY_ASSURANCE_EXPIRED',
  'TERRITORY_SCOPE_MISMATCH',
  'ELIGIBLE_FROZEN_ELECTORATE',
  'NOT_IN_FROZEN_ELECTORATE',
]) requireText('governance', reason)
for (const forbidden of ['reputation_score', 'subscription_tier', 'wallet_balance', 'donation_amount']) {
  forbidText('governance', forbidden, `Governance eligibility must remain independent from ${forbidden}`)
}

requireText('assuranceGolden', 'territorial residence assurance core')
requireText('assuranceGolden', 'territory_assurance_level: 0')
requireText('governanceGolden', 'territorial governance eligibility')
requireText('governanceGolden', 'territory_assurance_request_id')
requireText('certificationGolden', 'Phase 7G.4 territorial assurance certification')
requireText('certificationGolden', 'TERRITORY_ASSURANCE_SELF_REVIEW_FORBIDDEN')
requireText('certificationGolden', 'TERRITORY_ASSURANCE_EXPIRED')
requireText('certificationGolden', 'TERRITORY_SCOPE_MISMATCH')
requireText('certificationGolden', 'TERRITORY_ASSURANCE_REQUIRED')
requireText('certificationGolden', 'ELIGIBLE_FROZEN_ELECTORATE')
requireText('certificationGolden', 'reputation_score = 100')
requireText('certificationGolden', '/community/safety/policy/accept')
requireText('certificationGolden', "expires_at = NOW() - INTERVAL '1 minute'")
requireText('certificationGolden', "expires_at = NOW() + INTERVAL '20 days'")

requireText('webTerritory', '/territories/assurance/me')
requireText('webTerritory', '/territories/assurance/requests')
requireText('webGovernance', '/eligibility')
requireText('mobileAssurance', '/territories/assurance/me')
requireText('mobileGovernance', '/eligibility')

requireText('certification', "TERRITORIAL_ASSURANCE_CERTIFICATION_VERSION = '7G.4'")
requireText('certification', "'BLOCKED'")
requireText('certification', 'external_evidence_sha_mismatch')
requireText('certification', 'provider_production_canary_missing')
requireText('certification', 'reviewer_separation_not_verified')
requireText('certification', 'revocation_drill_missing')
requireText('certification', 'legal_privacy_review_missing')
requireText('certification', 'eligibility_policy_approval_missing')
requireText('certification', 'PRODUCTION_ELECTION_CERTIFIED')

for (const scenario of [
  'self_review_rejected',
  'expired_assurance_rejected',
  'territory_change_invalidates_assurance',
  'scope_mismatch_rejected',
  'renewal_does_not_rewrite_frozen_roll',
  'revocation_blocks_future_admission',
  'gps_cannot_grant_residence',
  'reputation_cannot_grant_residence',
  'payments_cannot_grant_residence',
  'identity_assurance_cannot_grant_residence',
]) requireText('certification', scenario)

requireText('docs', 'BLOCKED')
requireText('docs', 'REPOSITORY_CONTRACT_READY')
requireText('docs', 'EXTERNAL_EVIDENCE_REQUIRED')
requireText('docs', 'PRODUCTION_ELECTION_CERTIFIED')
requireText('docs', 'must not be committed as a fabricated passing artifact')

console.log('TERRITORIAL_ASSURANCE_CERTIFICATION_SOURCE_CONTRACT=PASS')
console.log('TERRITORIAL_ASSURANCE_RELEASE_BOUNDARY=EXTERNAL_EVIDENCE_REQUIRED')
