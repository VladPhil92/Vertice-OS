import fs from 'node:fs'

const required = [
  'apps/api/src/modules/auth/auth.routes.ts',
  'apps/api/src/modules/auth/auth.schema.ts',
  'apps/api/src/modules/auth/auth.service.ts',
  'apps/mobile/lib/registration.ts',
  'apps/mobile/providers/AuthProvider.tsx',
  'apps/mobile/app/(auth)/register.tsx',
  'apps/mobile/app/(auth)/sign-in.tsx',
  'apps/mobile/app/territory/select.tsx',
  'apps/web/app/auth/register/page.tsx',
  'apps/web/app/auth/login/page.tsx',
  'apps/web/e2e/auth.spec.ts',
  'docs/engineering/NATIONAL_ACCOUNT_ONBOARDING_PHASE7E.md',
]

for (const file of required) {
  if (!fs.existsSync(file)) throw new Error(`Phase 7E missing required artifact: ${file}`)
}

const authRoutes = fs.readFileSync(required[0], 'utf8')
const authSchema = fs.readFileSync(required[1], 'utf8')
const authService = fs.readFileSync(required[2], 'utf8')
const registration = fs.readFileSync(required[3], 'utf8')
const provider = fs.readFileSync(required[4], 'utf8')
const mobileRegister = fs.readFileSync(required[5], 'utf8')
const mobileSignIn = fs.readFileSync(required[6], 'utf8')
const selector = fs.readFileSync(required[7], 'utf8')
const webRegister = fs.readFileSync(required[8], 'utf8')
const webLogin = fs.readFileSync(required[9], 'utf8')
const authE2e = fs.readFileSync(required[10], 'utf8')

if (!authRoutes.includes("app.post('/register'")) throw new Error('Canonical /auth/register route is missing')
if (!authRoutes.includes('RegisterSchema.safeParse')) throw new Error('Canonical registration must keep RegisterSchema validation')
if (!authSchema.includes('PasswordSchema')) throw new Error('Registration must preserve the shared password policy')
if (!authService.includes('hashCedula(input.cedula)')) throw new Error('Cedula must remain server-side hashed')
if (authService.includes('cedula: input.cedula')) throw new Error('Raw cedula must never be persisted by registration')

for (const token of [
  "'/auth/register'",
  'loginMobile(normalized.email, normalized.password)',
  'PostRegistrationLoginRequiredError',
  "code = 'ACCOUNT_CREATED_LOGIN_REQUIRED'",
]) {
  if (!registration.includes(token)) throw new Error(`Mobile registration must preserve canonical/recovery flow: ${token}`)
}
if (registration.includes('/auth/mobile/register')) throw new Error('Phase 7E must not introduce a second mobile registration endpoint')

for (const token of ['signUp:', 'registerAndLoginMobile', "router.replace('/territory/select')", 'HMAC-SHA-256', 'isPostRegistrationLoginRequiredError', "next: 'territory-select'", "created: '1'"]) {
  const surface = token === 'signUp:' || token === 'registerAndLoginMobile' ? provider : mobileRegister
  if (!surface.includes(token)) throw new Error(`Mobile onboarding missing contract token: ${token}`)
}
if (!mobileSignIn.includes("router.push('/(auth)/register')")) throw new Error('Mobile sign-in must expose account creation')
for (const token of ["requestedNext === 'territory-select'", "router.replace('/territory/select')", 'Tu cuenta ya fue creada']) {
  if (!mobileSignIn.includes(token)) throw new Error(`Mobile sign-in missing post-registration recovery token: ${token}`)
}
if (!selector.includes("'/territories/me'")) throw new Error('Onboarding must continue into canonical territory selection')
if (!selector.includes('autodeclarada')) throw new Error('Territory selection must remain explicitly self-asserted')

for (const forbidden of [
  'Histórica y del Caribe Norte',
  'De la Virgen y Turística',
  'Industrial y de la Bahía',
  'Bayunca',
  'locality_id',
  'register-neighborhood',
]) {
  if (webRegister.includes(forbidden)) throw new Error(`National web registration must not hardcode Cartagena locality context: ${forbidden}`)
}
for (const token of ['/auth/register', 'selector territorial nacional', 'autodeclarada', 'HMAC-SHA-256', 'intent=territory-onboarding']) {
  if (!webRegister.includes(token)) throw new Error(`Web national registration missing contract token: ${token}`)
}

for (const token of [
  "const TERRITORY_ONBOARDING_INTENT = 'territory-onboarding'",
  "searchParams.get('intent') === TERRITORY_ONBOARDING_INTENT",
  "? '/dashboard/territory'",
  ": '/dashboard'",
]) {
  if (!webLogin.includes(token)) throw new Error(`Web login missing allowlisted continuation contract: ${token}`)
}
if (webLogin.includes("window.location.assign(searchParams.get('next')")) {
  throw new Error('Web login must never redirect directly to a user-controlled next URL')
}
for (const token of [
  'ignores a client supplied next target after login',
  'allows only the fixed territorial onboarding intent after login',
  "'/auth/login?intent=territory-onboarding'",
]) {
  if (!authE2e.includes(token)) throw new Error(`Golden auth suite missing safe continuation evidence: ${token}`)
}

const onboardingSurfaces = [registration, provider, mobileRegister, mobileSignIn, webRegister, webLogin].join('\n')
for (const forbidden of [
  'verification_level =',
  'territory_assurance_level =',
  'reputation_events',
  'proposal_voter_roll',
  'citizen_role_grants',
]) {
  if (onboardingSurfaces.includes(forbidden)) throw new Error(`Account onboarding must not mutate civic authority state: ${forbidden}`)
}

console.log('National Account Onboarding Phase 7E source contract: PASS')
