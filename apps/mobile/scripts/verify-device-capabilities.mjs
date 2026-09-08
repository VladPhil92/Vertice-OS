import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const mobileRoot = path.resolve(scriptDir, '..')

const packageJson = JSON.parse(await readFile(path.join(mobileRoot, 'package.json'), 'utf8'))
const appJson = JSON.parse(await readFile(path.join(mobileRoot, 'app.json'), 'utf8'))
const rootLayout = await readFile(path.join(mobileRoot, 'app', '_layout.tsx'), 'utf8')
const reportsScreen = await readFile(path.join(mobileRoot, 'app', '(tabs)', 'reports.tsx'), 'utf8')
const reportDevice = await readFile(path.join(mobileRoot, 'lib', 'report-device.ts'), 'utf8')

const failures = []
const assert = (condition, message) => {
  if (!condition) failures.push(message)
}

assert(packageJson.dependencies?.['expo-location'] === '~57.0.16', 'expo-location must stay pinned to ~57.0.16 for Expo SDK 57')
assert(packageJson.dependencies?.['expo-image-picker'] === '~57.0.16', 'expo-image-picker must stay pinned to ~57.0.16 for Expo SDK 57')

const plugins = appJson.expo?.plugins ?? []
const locationPlugin = plugins.find((entry) => Array.isArray(entry) && entry[0] === 'expo-location')
const imagePickerPlugin = plugins.find((entry) => Array.isArray(entry) && entry[0] === 'expo-image-picker')

assert(Boolean(locationPlugin), 'expo-location config plugin is required')
assert(Boolean(imagePickerPlugin), 'expo-image-picker config plugin is required')
assert(typeof locationPlugin?.[1]?.locationWhenInUsePermission === 'string', 'foreground location permission copy is required')
assert(typeof imagePickerPlugin?.[1]?.cameraPermission === 'string', 'camera permission copy is required')
assert(typeof imagePickerPlugin?.[1]?.photosPermission === 'string', 'photo library permission copy is required')
assert(imagePickerPlugin?.[1]?.microphonePermission === false, 'microphone permission must remain disabled for image-only evidence')
assert(appJson.expo?.scheme === 'vertice', 'vertice deep-link scheme must remain configured')

assert(rootLayout.includes('report/[id]'), 'root stack must register report/[id]')
assert(reportsScreen.includes('/territorial/reports/nearby'), 'territorial screen must consume nearby reports API')
assert(reportsScreen.includes('uploadAndConfirmReportEvidence'), 'territorial composer must use confirmed media workflow')
assert(reportDevice.includes('requestForegroundPermissionsAsync'), 'location access must remain foreground/on-demand')
assert(!reportDevice.includes('requestBackgroundPermissionsAsync'), 'background location permission is forbidden in Phase 2B')
assert(reportDevice.includes('/territorial/media/upload-intent'), 'media workflow must request a server upload intent')
assert(reportDevice.includes('/territorial/media/confirm'), 'media workflow must confirm provider upload server-side')

if (failures.length) {
  console.error('Mobile Device Capabilities Contract: FAIL')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Mobile Device Capabilities Contract: PASS')
console.log('Foreground GPS, camera/library evidence, provider confirmation and report deep links are structurally present.')
console.log('This contract does not certify physical-device permissions, Cloudflare production credentials, push delivery or store signing.')
