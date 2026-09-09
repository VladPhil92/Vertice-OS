import fs from 'node:fs'

const required = [
  'apps/mobile/app/city/[code].tsx',
  'apps/mobile/app/territory/select.tsx',
  'apps/mobile/app/territory/activate.tsx',
  'apps/mobile/app/(auth)/sign-in.tsx',
  'apps/mobile/app/(tabs)/index.tsx',
  'apps/mobile/app/(tabs)/profile.tsx',
  'apps/mobile/app/_layout.tsx',
  'apps/mobile/types/api.ts',
  'apps/api/src/modules/territories/territories.public.routes.ts',
  'apps/api/src/modules/territories/territories.activation.routes.ts',
  'docs/engineering/MOBILE_NATIONAL_ACTIVATION_PHASE7D.md',
]

for (const file of required) {
  if (!fs.existsSync(file)) throw new Error(`Phase 7D missing required artifact: ${file}`)
}

const city = fs.readFileSync(required[0], 'utf8')
const selector = fs.readFileSync(required[1], 'utf8')
const activation = fs.readFileSync(required[2], 'utf8')
const signIn = fs.readFileSync(required[3], 'utf8')
const home = fs.readFileSync(required[4], 'utf8')
const profile = fs.readFileSync(required[5], 'utf8')
const layout = fs.readFileSync(required[6], 'utf8')
const types = fs.readFileSync(required[7], 'utf8')
const publicRoutes = fs.readFileSync(required[8], 'utf8')
const activationRoutes = fs.readFileSync(required[9], 'utf8')

for (const token of [
  '/territories/public/',
  'public: true',
  'momentum_score',
  'active_cohort_members',
  'pending_interest_count',
  'Pagos, donaciones, payouts, suscripciones, KYC/KYB',
]) {
  if (!city.includes(token)) throw new Error(`Mobile public city screen missing canonical boundary: ${token}`)
}

for (const token of [
  'useAuth',
  "next: 'territory-activate'",
  "pathname: '/(auth)/sign-in'",
]) {
  if (!city.includes(token)) throw new Error(`Public city activation CTA missing auth-preserving boundary: ${token}`)
}

for (const token of [
  '/territories?q=',
  '/territories/me',
  "method: 'PUT'",
  'autodeclarada',
  'no prueba residencia',
]) {
  if (!selector.includes(token)) throw new Error(`Mobile territory selector missing self-asserted boundary: ${token}`)
}

for (const token of [
  'useAuth',
  '/territories/me',
  '/territories/activation/me/interests',
  '/territories/activation/',
  "method: 'POST'",
  "method: 'DELETE'",
  'maxLength={500}',
  "pathname: '/(auth)/sign-in'",
  "next: 'territory-activate'",
  'no te añade automáticamente a una cohorte',
  'no modifica autenticación, identity assurance, territory assurance, reputación, ranking, voto, autoridad cívica ni alcance orgánico',
]) {
  if (!activation.includes(token)) throw new Error(`Mobile activation journey missing canonical contract token: ${token}`)
}

const blockingPredicate = /blockingInterestForSelectedRole[\s\S]{0,700}interest\.status === 'pending'[\s\S]{0,160}interest\.status === 'approved'/
if (!blockingPredicate.test(activation)) {
  throw new Error('Only pending/approved activation interests may block a new mobile submission; declined must remain resubmittable')
}

for (const token of [
  'useLocalSearchParams',
  "requestedNext === 'territory-activate'",
  "router.replace(requestedNext === 'territory-activate' ? '/territory/activate' : '/(tabs)')",
]) {
  if (!signIn.includes(token)) throw new Error(`Mobile sign-in must preserve the activation destination safely: ${token}`)
}

for (const route of ['city/[code]', 'territory/select', 'territory/activate']) {
  if (!layout.includes(route)) throw new Error(`Expo Router root is missing Phase 7D route: ${route}`)
}

if (!home.includes("pathname: '/city/[code]'")) throw new Error('Citizen home is not linked to the canonical public city route')
if (!home.includes("router.push('/territory/activate')")) throw new Error('Citizen home is not linked to activation journey')
if (!profile.includes("router.push('/territory/activate')")) throw new Error('Citizen profile is not linked to activation journey')

for (const token of [
  'TerritoryActivationStatus',
  'TerritoryLaunchState',
  'TerritoryInterestRole',
  'TerritoryInterestStatus',
  'MyTerritory',
  'TerritoryActivationInterest',
  'PublicCityOverview',
]) {
  if (!types.includes(token)) throw new Error(`Mobile API contract missing type: ${token}`)
}

if (!publicRoutes.includes('getPublicCityOverview')) throw new Error('Phase 7D must reuse the Phase 7C public projection')
if (!activationRoutes.includes('requireAuth')) throw new Error('Phase 7D activation mutations must remain authenticated')
if (!activationRoutes.includes('requireSuperadmin')) throw new Error('Phase 7D must preserve separate superadmin review authority')

const mobileSurfaces = [city, selector, activation, signIn, home, profile].join('\n')
for (const forbidden of [
  'citizen_role_grants',
  'reputation_events',
  'proposal_voter_roll',
  'requestForegroundPermissionsAsync',
  'requestPermissionsAsync',
]) {
  if (mobileSurfaces.includes(forbidden)) throw new Error(`Phase 7D mobile surface must not introduce authority or device permission side effects: ${forbidden}`)
}

console.log('Mobile National Activation Phase 7D source contract: PASS')
