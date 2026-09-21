const EXPECTED_API_URL = 'https://vertice-os-production.up.railway.app'
const EXPECTED_EAS_PROJECT_ID = '4ee77781-adec-42f6-be19-64a68848f4c7'
const EXPECTED_VARIANT = 'production'

function fail(message) {
  console.error(`::error::${message}`)
  process.exitCode = 1
}

const mapsKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim() || ''
const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '') || ''
const projectId = process.env.EAS_PROJECT_ID?.trim() || ''
const variant = process.env.APP_VARIANT?.trim().toLowerCase() || ''

if (variant !== EXPECTED_VARIANT) {
  fail(`Phase 2 requires APP_VARIANT=${EXPECTED_VARIANT}; received ${variant || 'missing'}.`)
}

if (apiUrl !== EXPECTED_API_URL) {
  fail(`Phase 2 requires EXPO_PUBLIC_API_URL=${EXPECTED_API_URL}; received ${apiUrl || 'missing'}.`)
}

if (projectId !== EXPECTED_EAS_PROJECT_ID) {
  fail(`Phase 2 requires EAS_PROJECT_ID=${EXPECTED_EAS_PROJECT_ID}; received ${projectId || 'missing'}.`)
}

if (!mapsKey) {
  fail(
    'GOOGLE_MAPS_ANDROID_API_KEY is unavailable during local EAS config resolution. ' +
    'Configure it in the EAS production environment with visibility "sensitive" (not "secret"), ' +
    'because EAS CLI cannot read secret-visibility variables while resolving app.config.js.'
  )
} else if (mapsKey === 'replace-with-restricted-build-secret' || mapsKey.length < 20) {
  fail('GOOGLE_MAPS_ANDROID_API_KEY is present but does not look like a real production Android Maps key.')
}

if (process.exitCode) {
  process.exit(process.exitCode)
}

console.log('EAS production config preflight: PASS (credential values redacted).')
