import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../..')

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function assert(condition, message) {
  if (!condition) {
    console.error(`[product-parity] FAIL: ${message}`)
    process.exitCode = 1
  }
}

function contains(source, expected, label) {
  assert(source.includes(expected), `${label} must contain ${JSON.stringify(expected)}`)
}

function notContains(source, forbidden, label) {
  assert(!source.includes(forbidden), `${label} must not contain legacy token ${JSON.stringify(forbidden)}`)
}

const theme = read('apps/mobile/theme/vertice.ts')
const signIn = read('apps/mobile/app/(auth)/sign-in.tsx')
const register = read('apps/mobile/app/(auth)/register.tsx')
const tabs = read('apps/mobile/app/(tabs)/_layout.tsx')
const rootLayout = read('apps/mobile/app/_layout.tsx')
const callback = read('apps/mobile/app/auth/ctgone/callback.tsx')
const mobileCtgOne = read('apps/mobile/lib/ctgone.ts')
const authProvider = read('apps/mobile/providers/AuthProvider.tsx')
const mobileRoutes = read('apps/api/src/modules/auth/mobile-auth.routes.ts')
const mobileFederation = read('apps/api/src/modules/auth/mobile-federation.service.ts')
const webCallback = read('apps/web/app/auth/ctgone/callback/page.tsx')
const webTheme = read('apps/web/app/globals.css')

// ── Canonical visual language ───────────────────────────────────────────────
for (const token of ['#F7F9FC', '#0A2A66', '#F5B700', '#D72638', '#4A90E2', '#2BA745']) {
  contains(theme, token, 'native VÉRTICE theme')
  contains(webTheme.toUpperCase(), token, 'web VÉRTICE theme')
}
contains(theme, "brandDisplayFamily: 'Montserrat'", 'native typography contract')
contains(theme, "brandBodyFamily: 'Inter'", 'native typography contract')
contains(theme, "family: 'Lucide'", 'native iconography contract')
contains(theme, 'strokeWidth: 2', 'native iconography contract')
contains(theme, "wordmark: require('../assets/brand/vertice-wordmark.webp')", 'native imagery contract')

for (const asset of [
  'apps/mobile/assets/brand/vertice-wordmark.webp',
  'apps/mobile/assets/brand/vertice-symbol.webp',
  'apps/mobile/assets/brand/vertice-logo.png',
]) {
  assert(fs.existsSync(path.join(root, asset)), `canonical brand asset is missing: ${asset}`)
}

for (const [label, source] of [
  ['mobile sign-in', signIn],
  ['mobile registration', register],
  ['mobile tab shell', tabs],
]) {
  for (const legacy of ['#F6F4EE', '#1C3D2E', '#24573E', '#17382A', '#214634']) {
    notContains(source.toUpperCase(), legacy, label)
  }
}

contains(signIn, "from '../../theme/vertice'", 'mobile sign-in')
contains(signIn, 'VerticeBrand', 'mobile sign-in')
contains(register, "from '../../theme/vertice'", 'mobile registration')
contains(tabs, "from '../../theme/vertice'", 'mobile tab shell')

// ── One identity across web and native ─────────────────────────────────────
contains(signIn, 'Continuar con CTG One', 'mobile sign-in')
contains(signIn, 'signInWithCtgOne', 'mobile sign-in')
contains(register, 'No crees otra cuenta', 'mobile registration')
contains(register, 'signInWithCtgOne', 'mobile registration')
contains(authProvider, 'completeCtgOneSignIn', 'mobile AuthProvider')
contains(mobileCtgOne, '/auth/mobile/ctgone/start', 'mobile CTG One client')
contains(mobileCtgOne, '/auth/mobile/ctgone/exchange', 'mobile CTG One client')
contains(callback, 'completeCtgOneSignIn', 'native callback screen')
contains(rootLayout, 'auth/ctgone/callback', 'native root router')

// ── Native PKCE/BFF security boundary ─────────────────────────────────────
contains(mobileRoutes, "app.post('/ctgone/start'", 'native auth routes')
contains(mobileRoutes, "app.post('/ctgone/exchange'", 'native auth routes')
contains(mobileFederation, 'exchangeCtgOneFederation', 'native federation service')
contains(mobileFederation, "MOBILE_CALLBACK_SCHEME = 'vertice://auth/ctgone/callback'", 'native federation service')
contains(mobileFederation, "redis.call('DEL', KEYS[1])", 'native federation service')
contains(webCallback, "MOBILE_STATE_PREFIX = 'mobile.'", 'web federation callback')
contains(webCallback, "MOBILE_CALLBACK_URI = 'vertice://auth/ctgone/callback'", 'web federation callback')

if (!process.exitCode) {
  console.log('[product-parity] OK: CTG One identity federation and VÉRTICE visual language are aligned across web/mobile.')
}
