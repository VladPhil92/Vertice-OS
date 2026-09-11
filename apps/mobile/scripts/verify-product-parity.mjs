import './verify-font-alias-contract.mjs'
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

const canonicalTokens = read('packages/design-tokens/src/index.ts')
const mobilePackage = read('apps/mobile/package.json')
const theme = read('apps/mobile/theme/vertice.ts')
const nativeFonts = read('apps/mobile/theme/fonts.ts')
const nativeIcons = read('apps/mobile/components/VerticeIcon.tsx')
const signIn = read('apps/mobile/app/(auth)/sign-in.tsx')
const register = read('apps/mobile/app/(auth)/register.tsx')
const tabs = read('apps/mobile/app/(tabs)/_layout.tsx')
const dashboard = read('apps/mobile/app/(tabs)/index.tsx')
const community = read('apps/mobile/app/(tabs)/community.tsx')
const actions = read('apps/mobile/app/(tabs)/actions.tsx')
const reports = read('apps/mobile/app/(tabs)/reports.tsx')
const governance = read('apps/mobile/app/(tabs)/governance.tsx')
const profile = read('apps/mobile/app/(tabs)/profile.tsx')
const rootLayout = read('apps/mobile/app/_layout.tsx')
const callback = read('apps/mobile/app/auth/ctgone/callback.tsx')
const mobileCtgOne = read('apps/mobile/lib/ctgone.ts')
const authProvider = read('apps/mobile/providers/AuthProvider.tsx')
const mobileRoutes = read('apps/api/src/modules/auth/mobile-auth.routes.ts')
const mobileFederation = read('apps/api/src/modules/auth/mobile-federation.service.ts')
const webCallback = read('apps/web/app/auth/ctgone/callback/page.tsx')
const webTheme = read('apps/web/app/globals.css')
const webTailwind = read('apps/web/tailwind.config.ts')

// ── Canonical visual language ───────────────────────────────────────────────
for (const token of ['#F7F9FC', '#0A2A66', '#F5B700', '#D72638', '#4A90E2', '#2BA745']) {
  contains(canonicalTokens.toUpperCase(), token, 'canonical VÉRTICE design tokens')
  contains(webTheme.toUpperCase(), token, 'web VÉRTICE theme')
}
contains(canonicalTokens, "display: 'Montserrat'", 'canonical typography contract')
contains(canonicalTokens, "body: 'Inter'", 'canonical typography contract')
contains(canonicalTokens, "family: 'Lucide'", 'canonical iconography contract')
contains(canonicalTokens, 'strokeWidth: 2', 'canonical iconography contract')
contains(canonicalTokens, "infoBackground: '#EDF4FD'", 'canonical semantic feedback contract')
contains(canonicalTokens, "successBackground: '#EAF7EE'", 'canonical semantic feedback contract')
contains(canonicalTokens, "warningBackground: '#FFF7DF'", 'canonical semantic feedback contract')

contains(theme, "from '../../../packages/design-tokens/src/index'", 'native theme adapter')
contains(theme, "from './fonts'", 'native typography adapter')
contains(theme, 'nativeFontFamilies.displayExtraBold', 'native display font adapter')
contains(theme, 'nativeFontFamilies.bodyRegular', 'native body font adapter')
contains(theme, 'nativeFontFamilies.monoRegular', 'native mono font adapter')
contains(theme, "wordmark: require('../assets/brand/vertice-wordmark.webp')", 'native imagery contract')
contains(webTailwind, "from '../../packages/design-tokens/src/index'", 'web theme adapter')
contains(webTailwind, 'colors.background', 'web canonical color adapter')
contains(webTailwind, 'moduleColors', 'web module-color adapter')

for (const asset of [
  'apps/mobile/assets/brand/vertice-wordmark.webp',
  'apps/mobile/assets/brand/vertice-symbol.webp',
  'apps/mobile/assets/brand/vertice-logo.png',
]) {
  assert(fs.existsSync(path.join(root, asset)), `canonical brand asset is missing: ${asset}`)
}

// ── Native brand runtime certification ─────────────────────────────────────
for (const dependency of [
  '"expo-font"',
  '"@expo-google-fonts/montserrat"',
  '"@expo-google-fonts/inter"',
  '"@expo-google-fonts/dm-mono"',
  '"lucide-react-native"',
  '"react-native-svg"',
]) {
  contains(mobilePackage, dependency, 'mobile brand runtime dependencies')
}

for (const font of [
  'Montserrat_800ExtraBold',
  'Montserrat_400Regular',
  'Inter_400Regular',
  'Inter_600SemiBold',
  'Inter_800ExtraBold',
  'DMMono_400Regular',
]) {
  contains(nativeFonts, font, 'native bundled font contract')
}
contains(rootLayout, "from 'expo-font'", 'native root font bootstrap')
contains(rootLayout, 'useFonts(verticeFontAssets)', 'native root font bootstrap')
contains(rootLayout, "[brand-runtime] canonical VÉRTICE fonts failed to load", 'native root font observability')

contains(nativeIcons, "from 'lucide-react-native'", 'native Lucide adapter')
contains(nativeIcons, 'iconography.strokeWidth', 'native Lucide stroke contract')
contains(nativeIcons, 'iconography.sizes.standard', 'native Lucide size contract')
contains(tabs, 'VerticeIcon', 'mobile tab shell icon contract')
for (const semanticIcon of ['home', 'community', 'actions', 'territory', 'governance', 'profile']) {
  contains(tabs, `name="${semanticIcon}"`, 'mobile tab shell icon contract')
}
contains(signIn, 'VerticeIcon', 'mobile sign-in icon contract')
contains(register, 'VerticeIcon', 'mobile registration icon contract')

const primarySurfaces = [
  ['mobile sign-in', signIn],
  ['mobile registration', register],
  ['mobile tab shell', tabs],
  ['mobile dashboard', dashboard],
  ['mobile community', community],
  ['mobile actions', actions],
  ['mobile territory reports', reports],
  ['mobile governance', governance],
  ['mobile profile', profile],
]

for (const [label, source] of primarySurfaces) {
  for (const legacy of ['#F6F4EE', '#1C3D2E', '#24573E', '#17382A', '#214634']) {
    notContains(source.toUpperCase(), legacy, label)
  }
}

for (const [label, source] of [
  ['mobile sign-in', signIn],
  ['mobile registration', register],
  ['mobile dashboard', dashboard],
  ['mobile community', community],
  ['mobile actions', actions],
  ['mobile territory reports', reports],
  ['mobile governance', governance],
  ['mobile profile', profile],
]) {
  contains(source, "from '../../theme/vertice'", label)
  contains(source, 'VerticeBrand', label)
  assert(!/#[0-9A-Fa-f]{6}/.test(source), `${label} must not declare local hex colors; use canonical theme tokens`)
}

contains(tabs, "from '../../theme/vertice'", 'mobile tab shell')
assert(!/#[0-9A-Fa-f]{6}/.test(tabs), 'mobile tab shell must not declare local hex colors; use canonical theme tokens')

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
  console.log('[product-parity] OK: CTG One federation, canonical VÉRTICE tokens, bundled typography and Lucide runtime are aligned across web/mobile.')
}
