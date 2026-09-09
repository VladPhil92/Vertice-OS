import fs from 'node:fs'

const required = [
  'apps/api/prisma/migrations/20260909113000_national_citizen_activation_phase7c/migration.sql',
  'apps/api/src/modules/territories/territories.public.ts',
  'apps/api/src/modules/territories/territories.activation.ts',
  'apps/api/src/modules/territories/territories.public.routes.ts',
  'apps/api/src/modules/territories/territories.activation.routes.ts',
  'apps/api/src/modules/territories/territories.routes.ts',
  'apps/web/app/cities/page.tsx',
  'apps/web/app/cities/[code]/page.tsx',
  'apps/web/app/dashboard/territory/activate/page.tsx',
  'apps/web/app/dashboard/admin/national/activation/page.tsx',
  'docs/engineering/NATIONAL_CITIZEN_ACTIVATION_PHASE7C.md',
]

for (const file of required) {
  if (!fs.existsSync(file)) throw new Error(`Phase 7C missing required artifact: ${file}`)
}

const migration = fs.readFileSync(required[0], 'utf8')
const publicProjection = fs.readFileSync(required[1], 'utf8')
const activation = fs.readFileSync(required[2], 'utf8')
const activationRoutes = fs.readFileSync(required[4], 'utf8')
const routes = fs.readFileSync(required[5], 'utf8')
const publicCity = fs.readFileSync(required[7], 'utf8')
const citizenJourney = fs.readFileSync(required[8], 'utf8')

for (const token of [
  'territory_activation_interests',
  "interest_role IN ('ambassador','organizer','observer')",
  "status IN ('pending','approved','declined','withdrawn')",
]) {
  if (!migration.includes(token)) throw new Error(`Phase 7C migration missing contract token: ${token}`)
}

for (const token of [
  "authority_effect: 'none'",
  "cohort_assignment_effect: 'none_without_separate_superadmin_action'",
  'ACTIVATION_INTEREST_TERRITORY_MISMATCH',
]) {
  if (!activation.includes(token)) throw new Error(`Activation service missing fail-closed boundary: ${token}`)
}

if (activation.includes('citizen_role_grants') || activation.includes('reputation_events') || activation.includes('proposal_voter_roll')) {
  throw new Error('Citizen activation interest workflow must not mutate authorization, reputation, or voter-roll state')
}

for (const token of ['public_discovery_only', 'voluntary_interest_grants_no_authority']) {
  if (!publicProjection.includes(token)) throw new Error(`Public projection missing authority boundary: ${token}`)
}
for (const sensitive of ['target_moderators', 'target_local_leaders', 'notes, updated_by']) {
  if (publicProjection.includes(sensitive)) throw new Error(`Public city projection leaks internal launch-plan field: ${sensitive}`)
}
for (const signal of ['payments', 'donations', 'payouts', 'subscription', 'kyc_kyb', 'ideology']) {
  if (!publicProjection.includes(signal)) throw new Error(`Public city projection must explicitly exclude ${signal}`)
}

if (!activationRoutes.includes('requireAuth')) throw new Error('Citizen interest mutations require authenticated citizenship account')
if (!activationRoutes.includes('requireSuperadmin')) throw new Error('Interest review mutation requires live superadmin authority')
if (!routes.includes("prefix: '/public'")) throw new Error('Public city projection is not mounted')
if (!routes.includes("prefix: '/activation'")) throw new Error('Citizen activation workflow is not mounted')
if (!publicCity.includes('/territories/public/')) throw new Error('Public city page is not wired to canonical API projection')
if (!citizenJourney.includes('/territories/activation/')) throw new Error('Citizen activation journey is not wired to canonical API')

console.log('National Citizen Activation Phase 7C source contract: PASS')
