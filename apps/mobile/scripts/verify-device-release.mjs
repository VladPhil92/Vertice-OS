import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const requireToken = (content, token, label, failures) => {
  if (!content.includes(token)) failures.push(`${label}: missing ${token}`)
}

const failures = []
const packageJson = JSON.parse(read('apps/mobile/package.json'))
const appJson = JSON.parse(read('apps/mobile/app.json'))
const easJson = JSON.parse(read('apps/mobile/eas.json'))
const push = read('apps/mobile/lib/push-notifications.ts')
const bridge = read('apps/mobile/components/NotificationBridge.tsx')
const map = read('apps/mobile/components/TerritorialMap.tsx')
const reports = read('apps/mobile/app/(tabs)/reports.tsx')
const profile = read('apps/mobile/app/(tabs)/profile.tsx')
const rootLayout = read('apps/mobile/app/_layout.tsx')
const apiRoutes = read('apps/api/src/modules/notifications/notifications.routes.ts')
const apiService = read('apps/api/src/modules/notifications/notifications.service.ts')
const migration = read('apps/api/prisma/migrations/20260908232500_mobile_push_devices/migration.sql')
const dynamicConfig = read('apps/mobile/app.config.js')

if (packageJson.dependencies['react-native-maps'] !== '1.27.2') {
  failures.push('react-native-maps must remain pinned to Expo SDK 57 recommended 1.27.2')
}
if (packageJson.dependencies['expo-notifications'] !== '~57.0.17') {
  failures.push('expo-notifications must remain pinned to ~57.0.17')
}

const pluginText = JSON.stringify(appJson.expo.plugins)
requireToken(pluginText, 'expo-notifications', 'app.json', failures)
if (pluginText.includes('enableBackgroundRemoteNotifications":true')) {
  failures.push('background remote notifications must stay disabled in Phase 2C')
}

requireToken(map, 'react-native-maps', 'territorial map', failures)
requireToken(map, '<Marker', 'territorial map', failures)
requireToken(reports, '<TerritorialMap', 'reports workspace', failures)
requireToken(push, 'requestPermissionsAsync', 'push opt-in', failures)
requireToken(push, 'getExpoPushTokenAsync', 'push token acquisition', failures)
requireToken(push, "'/notifications/devices'", 'push API registration', failures)
requireToken(push, 'clearLastNotificationResponse', 'push deep-link replay guard', failures)
requireToken(profile, 'enablePushNotifications', 'profile opt-in UI', failures)
requireToken(bridge, 'addNotificationResponseReceivedListener', 'notification response bridge', failures)
requireToken(rootLayout, '<NotificationBridge />', 'root notification bridge', failures)
requireToken(rootLayout, 'name="notifications"', 'native notification inbox route', failures)

requireToken(apiRoutes, "app.post('/devices'", 'API device registration', failures)
requireToken(apiRoutes, "app.delete('/devices'", 'API device unregister', failures)
requireToken(apiService, 'ON CONFLICT (expo_push_token)', 'cross-account token reassignment', failures)
requireToken(apiService, 'DeviceNotRegistered', 'invalid token disablement', failures)
requireToken(apiService, 'AbortSignal.timeout(2500)', 'bounded push provider latency', failures)
requireToken(migration, 'mobile_push_devices', 'push device migration', failures)
requireToken(migration, 'ON DELETE CASCADE', 'push device ownership cleanup', failures)

if (easJson.build?.preview?.distribution !== 'internal') {
  failures.push('EAS preview must use internal distribution')
}
if (easJson.build?.preview?.android?.buildType !== 'apk') {
  failures.push('EAS preview Android must produce an installable APK')
}
if (easJson.build?.['preview-simulator']?.ios?.simulator !== true) {
  failures.push('EAS preview-simulator must produce an iOS simulator build')
}

requireToken(dynamicConfig, 'GOOGLE_MAPS_ANDROID_API_KEY', 'dynamic Google Maps config', failures)
requireToken(dynamicConfig, 'EAS_PROJECT_ID', 'dynamic EAS project config', failures)
if (/AIza[0-9A-Za-z_-]{20,}/.test(dynamicConfig) || /AIza[0-9A-Za-z_-]{20,}/.test(read('apps/mobile/app.json'))) {
  failures.push('Google Maps API key must never be hard-coded in repository config')
}

if (failures.length > 0) {
  console.error('Mobile Phase 2C release contract: FAIL')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Mobile Phase 2C release contract: PASS')
console.log('Code state: IMPLEMENTED + exportable')
console.log(`Android Google Maps credential present in this runner: ${Boolean(process.env.GOOGLE_MAPS_ANDROID_API_KEY)}`)
console.log(`EAS project id present in this runner: ${Boolean(process.env.EAS_PROJECT_ID)}`)
console.log('External device credentials/smoke evidence are intentionally not certified by this static gate.')
