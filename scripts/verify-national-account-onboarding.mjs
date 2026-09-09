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

if (!authRoutes.includes("app.post('/register'")) throw new Error('Canonical /auth/register route is missing')
if (!authRoutes.includes('RegisterSchema.safeParse')) throw new Error('Canonical registration must keep RegisterSchema validation')
if (!authSchema.includes('PasswordSchema')) throw new Error('Registration must preserve the shared password policy')
if (!authService.includes('hashCedula(input.cedula)')) throw new Error('Cedula must remain server-side hashed')
if (authService.includes('cedula: input.cedula')) throw new Error('Raw cedula must never be persisted by registration')

for (const token of ["'/auth/register'", 'loginMobile(normalized.email, normalized.password)']) {
  if (!registration.includes(token)) throw new Error(`Mobile registration must reuse canonical identity/session flow: ${token}`)
}
if (registration.includes('/auth/mobile/register')) throw new Error('Phase 7E must not introduce a second mobile registration endpoint')

for (const token of ['signUp:', 'registerAndLoginMobile', "router.replace('/territory/select')", 'HMAC-SHA-256']) {
  const surface = token === 'signUp:' || token === 'registerAndLoginMobile' ? provider : mobileRegister
  if (!surface.includes(token)) throw new Error(`Mobile onboarding missing contract token: ${token}`)
}
if (!mobileSignIn.includes("router.push('/(auth)/register')")) throw new Error('Mobile sign-in must expose account creation')
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
for (const token of ['/auth/register', 'selector territorial nacional', 'autodeclarada', 'HMAC-SHA-256']) {
  if (!webRegister.includes(token)) throw new Error(`Web national registration missing contract token: ${token}`)
}

const onboardingSurfaces = [registration, provider, mobileRegister, mobileSignIn, webRegister].join('\n')
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
