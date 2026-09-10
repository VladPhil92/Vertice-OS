import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { createRequire } from 'node:module'

const root = process.cwd()
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const requireToken = (content, token, label, failures) => {
  if (!content.includes(token)) failures.push(`${label}: missing ${token}`)
}
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const require = createRequire(import.meta.url)
const { parsePublicHttpsUrl, isLocalOrPrivateHostname } = require(path.join(root, 'apps/mobile/config/release-network.js'))

const failures = []
const packageJson = JSON.parse(read('apps/mobile/package.json'))
const appJson = JSON.parse(read('apps/mobile/app.json'))
const easJson = JSON.parse(read('apps/mobile/eas.json'))
const push = read('apps/mobile/lib/push-notifications.ts')
const apiClient = read('apps/mobile/lib/api.ts')
const bridge = read('apps/mobile/components/NotificationBridge.tsx')
const map = read('apps/mobile/components/TerritorialMap.tsx')
const reports = read('apps/mobile/app/(tabs)/reports.tsx')
const profile = read('apps/mobile/app/(tabs)/profile.tsx')
const rootLayout = read('apps/mobile/app/_layout.tsx')
const apiRoutes = read('apps/api/src/modules/notifications/notifications.routes.ts')
const apiService = read('apps/api/src/modules/notifications/notifications.service.ts')
const migration = read('apps/api/prisma/migrations/20260908232500_mobile_push_devices/migration.sql')
const dynamicConfig = read('apps/mobile/app.config.js')
const releaseNetwork = read('apps/mobile/config/release-network.js')

const expo = appJson.expo ?? {}
const iosBundleId = expo.ios?.bundleIdentifier
const androidPackage = expo.android?.package

if (expo.slug !== 'vertice-os') failures.push('Expo slug must remain canonical: vertice-os')
if (expo.scheme !== 'vertice') failures.push('Expo deep-link scheme must remain canonical: vertice')
if (!/^\d+\.\d+\.\d+$/.test(expo.version ?? '')) failures.push('Expo version must be semantic x.y.z')
if (iosBundleId !== 'com.ctgone.verticeos') failures.push('iOS bundleIdentifier must remain canonical: com.ctgone.verticeos')
if (androidPackage !== 'com.ctgone.verticeos') failures.push('Android package must remain canonical: com.ctgone.verticeos')
if (iosBundleId !== androidPackage) failures.push('iOS bundleIdentifier and Android package must remain aligned')

if (packageJson.dependencies['react-native-maps'] !== '1.27.2') {
  failures.push('react-native-maps must remain pinned to Expo SDK 57 recommended 1.27.2')
}
if (packageJson.dependencies['expo-notifications'] !== '~57.0.17') {
  failures.push('expo-notifications must remain pinned to ~57.0.17')
}

const pluginText = JSON.stringify(expo.plugins)
requireToken(pluginText, 'expo-notifications', 'app.json', failures)
if (pluginText.includes('enableBackgroundRemoteNotifications":true')) {
  failures.push('background remote notifications must stay disabled until separately reviewed')
}

requireToken(map, 'react-native-maps', 'territorial map', failures)
requireToken(map, '<Marker', 'territorial map', failures)
requireToken(reports, '<TerritorialMap', 'reports workspace', failures)
requireToken(push, 'requestPermissionsAsync', 'push opt-in', failures)
requireToken(push, 'getExpoPushTokenAsync', 'push token acquisition', failures)
requireToken(push, "'/notifications/devices'", 'push API registration', failures)
requireToken(push, 'clearLastNotificationResponse', 'push deep-link replay guard', failures)
requireToken(push, 'Constants.easConfig?.projectId', 'push EAS project resolution', failures)
requireToken(profile, 'enablePushNotifications', 'profile opt-in UI', failures)
requireToken(bridge, 'addNotificationResponseReceivedListener', 'notification response bridge', failures)
requireToken(rootLayout, '<NotificationBridge />', 'root notification bridge', failures)
requireToken(rootLayout, 'name="notifications"', 'native notification inbox route', failures)
requireToken(apiClient, 'EXPO_PUBLIC_API_URL', 'mobile API runtime config', failures)

requireToken(apiRoutes, "app.post('/devices'", 'API device registration', failures)
requireToken(apiRoutes, "app.delete('/devices'", 'API device unregister', failures)
requireToken(apiService, 'ON CONFLICT (expo_push_token)', 'cross-account token reassignment', failures)
requireToken(apiService, 'DeviceNotRegistered', 'invalid token disablement', failures)
requireToken(apiService, 'AbortSignal.timeout(2500)', 'bounded push provider latency', failures)
requireToken(migration, 'mobile_push_devices', 'push device migration', failures)
requireToken(migration, 'ON DELETE CASCADE', 'push device ownership cleanup', failures)

if (easJson.cli?.requireCommit !== true) failures.push('EAS CLI must require a committed source state before building')
if (easJson.cli?.appVersionSource !== 'remote') failures.push('EAS appVersionSource must remain remote')
if (easJson.build?.development?.environment !== 'development') failures.push('EAS development profile must bind development environment')
if (easJson.build?.preview?.distribution !== 'internal') failures.push('EAS preview must use internal distribution')
if (easJson.build?.preview?.environment !== 'preview') failures.push('EAS preview must bind preview environment')
if (easJson.build?.preview?.android?.buildType !== 'apk') failures.push('EAS preview Android must produce an installable APK')
if (easJson.build?.preview?.env?.APP_VARIANT !== 'preview') failures.push('EAS preview must declare APP_VARIANT=preview')
if (easJson.build?.['preview-simulator']?.ios?.simulator !== true) failures.push('EAS preview-simulator must produce an iOS simulator build')
if (easJson.build?.production?.distribution !== 'store') failures.push('EAS production must explicitly use store distribution')
if (easJson.build?.production?.environment !== 'production') failures.push('EAS production must bind production environment')
if (easJson.build?.production?.autoIncrement !== true) failures.push('EAS production must auto-increment remote native build versions')
if (easJson.build?.production?.android?.buildType !== 'app-bundle') failures.push('EAS production Android must produce an app bundle')
if (easJson.build?.production?.env?.APP_VARIANT !== 'production') failures.push('EAS production must declare APP_VARIANT=production')
if (!easJson.submit?.production) failures.push('EAS production submit profile must exist')

requireToken(dynamicConfig, 'EXPO_PUBLIC_API_URL', 'dynamic release API validation', failures)
requireToken(dynamicConfig, 'GOOGLE_MAPS_ANDROID_API_KEY', 'dynamic Google Maps config', failures)
requireToken(dynamicConfig, 'EAS_PROJECT_ID', 'dynamic EAS project config', failures)
requireToken(dynamicConfig, 'parsePublicHttpsUrl', 'release network validation', failures)
requireToken(releaseNetwork, 'isPrivateIpv4', 'release IPv4 policy', failures)
requireToken(releaseNetwork, 'isPrivateIpv6', 'release IPv6 policy', failures)
requireToken(releaseNetwork, 'must use a public, non-local hostname', 'release public-host policy', failures)

for (const blockedHost of ['localhost', 'api.localhost', '127.0.0.1', '10.0.2.2', '10.0.0.1', '100.64.0.1', '169.254.1.1', '172.16.0.1', '172.31.255.254', '192.168.1.5', '::1', 'fc00::1', 'fd12::1', 'fe80::1']) {
  if (!isLocalOrPrivateHostname(blockedHost)) failures.push(`release network policy must reject ${blockedHost}`)
}
for (const allowedHost of ['api.vertice.example', '203.0.113.10', '2001:db8::1']) {
  if (isLocalOrPrivateHostname(allowedHost)) failures.push(`release network policy unexpectedly rejects ${allowedHost}`)
}

const repoConfigText = [dynamicConfig, releaseNetwork, read('apps/mobile/app.json'), read('apps/mobile/eas.json')].join('\n')
if (/AIza[0-9A-Za-z_-]{20,}/.test(repoConfigText)) failures.push('Google Maps API key must never be hard-coded in repository config')

let resolvedConfig
try {
  const appConfigFactory = require(path.join(root, 'apps/mobile/app.config.js'))
  resolvedConfig = appConfigFactory({ config: expo })
} catch (error) {
  failures.push(`dynamic Expo config failed to resolve: ${error instanceof Error ? error.message : String(error)}`)
}

const variant = (process.env.APP_VARIANT || process.env.EXPO_PUBLIC_RELEASE_CHANNEL || 'development').trim().toLowerCase()
const releaseLike = variant === 'preview' || variant === 'production'

if (resolvedConfig?.extra?.releaseChannel !== variant) failures.push(`resolved releaseChannel must match ${variant}`)

if (releaseLike) {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim() ?? ''
  const easProjectId = process.env.EAS_PROJECT_ID?.trim() ?? ''
  const mapsKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim() ?? ''

  try {
    parsePublicHttpsUrl(apiUrl, `${variant} API URL`)
  } catch (error) {
    failures.push(error instanceof Error ? error.message : `${variant} API URL is invalid`)
  }

  if (!UUID_RE.test(easProjectId)) failures.push(`${variant} EAS_PROJECT_ID must be a UUID`)
  if (!mapsKey) failures.push(`${variant} GOOGLE_MAPS_ANDROID_API_KEY must be present`)
  if (resolvedConfig?.extra?.eas?.projectId !== easProjectId) failures.push('resolved Expo config must expose the exact EAS project id')
  if (resolvedConfig?.android?.config?.googleMaps?.apiKey !== mapsKey) failures.push('resolved Android config must receive the Maps API key')
  if (resolvedConfig?.extra?.releaseCapabilities?.apiHttpsConfigured !== true) failures.push('release capability must report API configuration')
  if (resolvedConfig?.extra?.releaseCapabilities?.easProjectConfigured !== true) failures.push('release capability must report EAS project linkage')
  if (resolvedConfig?.extra?.releaseCapabilities?.androidGoogleMapsConfigured !== true) failures.push('release capability must report Android Maps configuration')
}

if (failures.length > 0) {
  console.error(`Mobile production release contract: FAIL (${variant})`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`Mobile production release contract: PASS (${variant})`)
console.log('Code/config state: IMPLEMENTED + exportable')
console.log(`Android Google Maps credential present in this runner: ${Boolean(process.env.GOOGLE_MAPS_ANDROID_API_KEY)}`)
console.log(`EAS project id present in this runner: ${Boolean(process.env.EAS_PROJECT_ID)}`)
console.log('This gate does NOT certify signing credentials, provider restrictions, installation, push delivery, physical-device smoke, or store approval.')
