import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const mobileRoot = path.resolve(scriptDir, '..')

const packageJson = JSON.parse(await readFile(path.join(mobileRoot, 'package.json'), 'utf8'))
const appJson = JSON.parse(await readFile(path.join(mobileRoot, 'app.json'), 'utf8'))
const easJson = JSON.parse(await readFile(path.join(mobileRoot, 'eas.json'), 'utf8'))
const appConfig = await readFile(path.join(mobileRoot, 'app.config.js'), 'utf8')
const rootLayout = await readFile(path.join(mobileRoot, 'app', '_layout.tsx'), 'utf8')
const reportsScreen = await readFile(path.join(mobileRoot, 'app', '(tabs)', 'reports.tsx'), 'utf8')
const reportDevice = await readFile(path.join(mobileRoot, 'lib', 'report-device.ts'), 'utf8')
const pushEngagement = await readFile(path.join(mobileRoot, 'lib', 'push-engagement.ts'), 'utf8')
const engagementBridge = await readFile(path.join(mobileRoot, 'providers', 'EngagementBridge.tsx'), 'utf8')
const notificationsScreen = await readFile(path.join(mobileRoot, 'app', 'notifications.tsx'), 'utf8')

const failures = []
const assert = (condition, message) => {
  if (!condition) failures.push(message)
}

assert(packageJson.dependencies?.['expo-location'] === '~57.0.16', 'expo-location must stay pinned to ~57.0.16 for Expo SDK 57')
assert(packageJson.dependencies?.['expo-image-picker'] === '~57.0.16', 'expo-image-picker must stay pinned to ~57.0.16 for Expo SDK 57')
assert(packageJson.dependencies?.['expo-device'] === '~57.0.1', 'expo-device must stay pinned to ~57.0.1 for Expo SDK 57')
assert(packageJson.dependencies?.['expo-notifications'] === '~57.0.17', 'expo-notifications must stay pinned to ~57.0.17 for Expo SDK 57')
assert(packageJson.dependencies?.['react-native-maps'] === '1.27.2', 'react-native-maps must remain on the certified Expo SDK 57 version')

const plugins = appJson.expo?.plugins ?? []
const locationPlugin = plugins.find((entry) => Array.isArray(entry) && entry[0] === 'expo-location')
const imagePickerPlugin = plugins.find((entry) => Array.isArray(entry) && entry[0] === 'expo-image-picker')
const notificationsPlugin = plugins.find((entry) => Array.isArray(entry) && entry[0] === 'expo-notifications')

assert(Boolean(locationPlugin), 'expo-location config plugin is required')
assert(Boolean(imagePickerPlugin), 'expo-image-picker config plugin is required')
assert(Boolean(notificationsPlugin), 'expo-notifications config plugin is required')
assert(typeof locationPlugin?.[1]?.locationWhenInUsePermission === 'string', 'foreground location permission copy is required')
assert(typeof imagePickerPlugin?.[1]?.cameraPermission === 'string', 'camera permission copy is required')
assert(typeof imagePickerPlugin?.[1]?.photosPermission === 'string', 'photo library permission copy is required')
assert(imagePickerPlugin?.[1]?.microphonePermission === false, 'microphone permission must remain disabled for image-only evidence')
assert(notificationsPlugin?.[1]?.defaultChannel === 'civic-updates', 'notifications must use the civic-updates Android channel')
assert(appJson.expo?.scheme === 'vertice', 'vertice deep-link scheme must remain configured')

assert(rootLayout.includes('report/[id]'), 'root stack must register report/[id]')
assert(rootLayout.includes('notifications'), 'root stack must register native notification center')
assert(rootLayout.includes('EngagementBridge'), 'root layout must mount authenticated engagement bridge')

assert(reportsScreen.includes('/territorial/reports/nearby'), 'territorial screen must consume nearby reports API')
assert(reportsScreen.includes('uploadAndConfirmReportEvidence'), 'territorial composer must use confirmed media workflow')
assert(reportsScreen.includes("from 'react-native-maps'"), 'territorial surface must use the embedded native map library')
assert(reportsScreen.includes('<MapView'), 'territorial surface must render an embedded native map')
assert(reportsScreen.includes('<Marker'), 'territorial surface must render report markers')

assert(reportDevice.includes('requestForegroundPermissionsAsync'), 'location access must remain foreground/on-demand')
assert(!reportDevice.includes('requestBackgroundPermissionsAsync'), 'background location permission is forbidden')
assert(reportDevice.includes('/territorial/media/upload-intent'), 'media workflow must request a server upload intent')
assert(reportDevice.includes('/territorial/media/confirm'), 'media workflow must confirm provider upload server-side')

assert(pushEngagement.includes('getExpoPushTokenAsync'), 'push registration must obtain an Expo installation token')
assert(pushEngagement.includes('/notifications/push-devices'), 'push registration must bind through the authenticated backend')
assert(pushEngagement.includes("path.startsWith('//')"), 'notification href parsing must reject protocol-relative redirects')
assert(pushEngagement.includes("path.includes('://')"), 'notification href parsing must reject external schemes')
assert(pushEngagement.includes('Device.isDevice'), 'remote push registration must distinguish physical devices from simulators')
assert(engagementBridge.includes('addNotificationResponseReceivedListener'), 'engagement bridge must handle notification taps')
assert(engagementBridge.includes('getLastNotificationResponseAsync'), 'engagement bridge must handle cold-start notification taps')
assert(notificationsScreen.includes('/notifications/read-all'), 'native inbox must support canonical mark-all-read')

assert(appConfig.includes('EAS_PROJECT_ID'), 'dynamic mobile config must accept EAS project id from environment')
assert(appConfig.includes('GOOGLE_MAPS_API_KEY'), 'dynamic mobile config must accept Android Google Maps key from environment')
assert(easJson.build?.preview?.distribution === 'internal', 'EAS preview must remain an internal distribution')
assert(easJson.build?.preview?.android?.buildType === 'apk', 'Android preview must produce an installable APK')
assert(easJson.build?.['preview-simulator']?.ios?.simulator === true, 'iOS simulator preview profile is required')

if (failures.length) {
  console.error('Mobile Device & Engagement Contract: FAIL')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Mobile Device & Engagement Contract: PASS')
console.log('Foreground GPS, evidence, embedded maps, safe notification routing, inbox and EAS preview profiles are structurally present.')
console.log('This contract does not certify physical-device prompts, APNs/FCM delivery, Google Maps production credentials, signed EAS builds or store review.')
