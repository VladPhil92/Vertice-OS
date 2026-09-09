import fs from 'node:fs'

const required = [
  'apps/mobile/app/workflows/index.tsx',
  'apps/mobile/app/workflows/[id].tsx',
  'apps/mobile/app/identity/index.tsx',
  'apps/mobile/app/crowdfunding/index.tsx',
  'apps/mobile/types/domain-parity.ts',
  'apps/mobile/app/(tabs)/index.tsx',
  'apps/api/src/modules/workflows/workflow.routes.ts',
  'apps/api/src/modules/identity/identity.routes.ts',
  'apps/api/src/modules/identity/identity-provider-session.routes.ts',
  'apps/api/src/modules/crowdfunding/crowdfunding.routes.ts',
  'apps/api/src/modules/crowdfunding/crowdfunding.readiness.service.ts',
  'docs/engineering/MOBILE_DOMAIN_PARITY_PHASE2D2_4.md',
]

for (const file of required) {
  if (!fs.existsSync(file)) throw new Error(`Mobile domain parity missing required artifact: ${file}`)
}

const workflows = fs.readFileSync(required[0], 'utf8')
const workflowDetail = fs.readFileSync(required[1], 'utf8')
const identity = fs.readFileSync(required[2], 'utf8')
const crowdfunding = fs.readFileSync(required[3], 'utf8')
const dashboard = fs.readFileSync(required[5], 'utf8')
const workflowRoutes = fs.readFileSync(required[6], 'utf8')
const identityRoutes = fs.readFileSync(required[7], 'utf8')
const providerRoutes = fs.readFileSync(required[8], 'utf8')
const crowdfundingRoutes = fs.readFileSync(required[9], 'utf8')

for (const token of ["'/workflows/cases", '/workflows/cases/']) {
  const surface = token.includes('cases/') ? workflowDetail : workflows
  if (!surface.includes(token)) throw new Error(`Native workflows missing canonical API token: ${token}`)
}
if (!workflowRoutes.includes("app.get('/cases'")) throw new Error('Canonical workflow case list route is missing')
if (!workflowRoutes.includes("app.get('/cases/:id'")) throw new Error('Canonical workflow case detail route is missing')

for (const token of ["'/identity/assurance'", "'/identity/proofing'", "'/identity/providers/availability'", "'/identity/providers/veriff/session'"]) {
  if (!identity.includes(token)) throw new Error(`Native identity missing canonical API token: ${token}`)
}
if (!identityRoutes.includes("app.get('/assurance'")) throw new Error('Canonical identity assurance route is missing')
if (!identityRoutes.includes("app.get('/proofing'")) throw new Error('Canonical identity proofing route is missing')
if (!providerRoutes.includes("app.get('/availability'")) throw new Error('Canonical provider availability route is missing')
if (!providerRoutes.includes("app.post('/veriff/session'")) throw new Error('Canonical Veriff session route is missing')
if (!identity.includes("url.protocol !== 'https:'")) throw new Error('Native provider handoff must fail closed for non-HTTPS URLs')

for (const token of ["'/crowdfunding/me/readiness'", "'/crowdfunding/me/campaigns'"]) {
  if (!crowdfunding.includes(token)) throw new Error(`Native crowdfunding missing canonical API token: ${token}`)
}
if (!crowdfundingRoutes.includes("app.get('/me/readiness'")) throw new Error('Canonical crowdfunding readiness route is missing')

for (const forbidden of [
  '/contributions/checkout',
  '/activate',
  '/payout-destination',
  '/payouts',
  'platform_fee_cop =',
  'reputation_score =',
  'verification_level =',
]) {
  if (crowdfunding.includes(forbidden)) throw new Error(`Native crowdfunding tracking must not execute financial/authority mutation: ${forbidden}`)
}

for (const route of ["router.push('/workflows')", "router.push('/identity')", "router.push('/crowdfunding')"]) {
  if (!dashboard.includes(route)) throw new Error(`Dashboard must expose domain parity route: ${route}`)
}

const combined = [workflows, workflowDetail, identity, crowdfunding].join('\n')
for (const forbidden of [
  'citizen_role_grants',
  'proposal_voter_roll',
  'territory_assurance_level =',
  'reputation_events',
]) {
  if (combined.includes(forbidden)) throw new Error(`Mobile parity must not manufacture authority state: ${forbidden}`)
}

console.log('Mobile Domain Parity Phase 2D-2/3/4 source contract: PASS')
