import fs from 'node:fs'
import process from 'node:process'

const args = process.argv.slice(2)
const valueAfter = (flag, fallback = null) => {
  const index = args.indexOf(flag)
  return index >= 0 ? args[index + 1] ?? fallback : fallback
}

const mode = valueAfter('--mode', 'structure')
const manifestPath = valueAfter('--manifest', 'release/store/store-submission.example.json')
const expectedReleaseSha = valueAfter('--release-sha')

if (!['structure', 'strict'].includes(mode)) {
  console.error('Store submission readiness: FAIL')
  console.error(`- unsupported mode: ${mode}`)
  process.exit(1)
}

let manifest
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
} catch (error) {
  console.error('Store submission readiness: FAIL')
  console.error(`- cannot parse ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}

const failures = []
const requireValue = (condition, message) => {
  if (!condition) failures.push(message)
}

const SHA_RE = /^[0-9a-f]{40}$/i
const ZERO_SHA = '0'.repeat(40)
const PLACEHOLDER_RE = /(?:replace\.example|example\.invalid|localhost|127\.0\.0\.1|PENDING_|CHANGE_ME|REPLACE_ME)/i
const APPROVED = 'approved'
const allowedReviewStatuses = new Set(['pending', 'blocked', 'approved'])

const canonicalApp = {
  name: 'Vértice OS',
  expo_slug: 'vertice-os',
  scheme: 'vertice',
  ios_bundle_id: 'com.ctgone.verticeos',
  android_package: 'com.ctgone.verticeos',
}

requireValue(manifest.schema_version === 1, 'schema_version must be 1')
requireValue(manifest.app && typeof manifest.app === 'object', 'app object is required')
for (const [key, expected] of Object.entries(canonicalApp)) {
  requireValue(manifest.app?.[key] === expected, `app.${key} must remain ${expected}`)
}

const parseHttpsUrl = (value, label) => {
  try {
    const url = new URL(value)
    requireValue(url.protocol === 'https:', `${label} must use HTTPS`)
    requireValue(!url.username && !url.password, `${label} must not embed credentials`)
    return url
  } catch {
    failures.push(`${label} must be a valid absolute URL`)
    return null
  }
}

requireValue(manifest.public_urls && typeof manifest.public_urls === 'object', 'public_urls object is required')
const privacyUrl = parseHttpsUrl(manifest.public_urls?.privacy_policy, 'public_urls.privacy_policy')
const deletionUrl = parseHttpsUrl(manifest.public_urls?.account_deletion, 'public_urls.account_deletion')
const supportUrl = parseHttpsUrl(manifest.public_urls?.support, 'public_urls.support')
if (deletionUrl) {
  requireValue(deletionUrl.hostname === 'vertice.ctgone.com', 'account deletion resource must use vertice.ctgone.com')
  requireValue(deletionUrl.pathname.replace(/\/+$/, '') === '/account-deletion', 'account deletion resource must resolve to /account-deletion')
}

const requiredPermissions = new Map([
  ['location_foreground', 'implemented'],
  ['camera', 'implemented'],
  ['photo_library', 'implemented'],
  ['notifications', 'implemented'],
  ['microphone', 'not_collected'],
])
const permissionItems = Array.isArray(manifest.permissions) ? manifest.permissions : []
const permissionById = new Map()
for (const item of permissionItems) {
  if (!item || typeof item.id !== 'string') {
    failures.push('every permission item must have a string id')
    continue
  }
  if (permissionById.has(item.id)) failures.push(`duplicate permission id: ${item.id}`)
  permissionById.set(item.id, item)
  requireValue(typeof item.purpose === 'string' && item.purpose.trim().length >= 8, `${item.id}: purpose is required`)
}
for (const [id, expectedStatus] of requiredPermissions) {
  requireValue(permissionById.has(id), `missing permission inventory item: ${id}`)
  requireValue(permissionById.get(id)?.status === expectedStatus, `${id}: status must be ${expectedStatus}`)
}

const requiredDataIds = new Set([
  'account_contact',
  'account_identifiers',
  'precise_location',
  'user_content',
  'identity_assurance',
  'transaction_history',
])
const dataItems = Array.isArray(manifest.data_inventory) ? manifest.data_inventory : []
const dataById = new Map()
for (const item of dataItems) {
  if (!item || typeof item.id !== 'string') {
    failures.push('every data_inventory item must have a string id')
    continue
  }
  if (dataById.has(item.id)) failures.push(`duplicate data inventory id: ${item.id}`)
  dataById.set(item.id, item)
  requireValue(typeof item.store_category === 'string' && item.store_category.length > 0, `${item.id}: store_category is required`)
  requireValue(Array.isArray(item.examples) && item.examples.length > 0, `${item.id}: at least one example is required`)
  requireValue(Array.isArray(item.purposes) && item.purposes.length > 0, `${item.id}: at least one purpose is required`)
  requireValue(typeof item.linked_to_identity === 'boolean', `${item.id}: linked_to_identity must be boolean`)
  requireValue(item.tracking === false, `${item.id}: tracking must remain false unless a separately reviewed tracking architecture is introduced`)
  requireValue(['review_required', 'approved'].includes(item.review_status), `${item.id}: review_status must be review_required or approved`)
}
for (const id of requiredDataIds) requireValue(dataById.has(id), `missing data inventory item: ${id}`)

const requiredReviewIds = [
  'apple_app_privacy',
  'google_data_safety',
  'privacy_policy_legal_approval',
  'reviewer_access_plan',
  'store_metadata_copy',
]
const reviews = manifest.store_reviews && typeof manifest.store_reviews === 'object' ? manifest.store_reviews : {}
for (const id of requiredReviewIds) {
  const review = reviews[id]
  requireValue(review && typeof review === 'object', `missing store review item: ${id}`)
  if (!review) continue
  requireValue(allowedReviewStatuses.has(review.status), `${id}: status must be pending, blocked, or approved`)
}

const releaseSha = manifest.release_sha
requireValue(typeof releaseSha === 'string' && SHA_RE.test(releaseSha), 'release_sha must be a 40-character Git SHA')
if (expectedReleaseSha) {
  requireValue(SHA_RE.test(expectedReleaseSha), '--release-sha must be a 40-character Git SHA')
  requireValue(releaseSha === expectedReleaseSha, 'manifest release_sha must match --release-sha')
}

if (mode === 'strict') {
  requireValue(releaseSha !== ZERO_SHA, 'strict mode forbids the zero/template release SHA')

  for (const [label, url] of [
    ['privacy_policy', privacyUrl],
    ['account_deletion', deletionUrl],
    ['support', supportUrl],
  ]) {
    if (url) requireValue(!PLACEHOLDER_RE.test(url.href), `${label}: placeholder/local URL is forbidden in strict mode`)
  }

  requireValue(
    typeof manifest.legal_identity?.developer_name === 'string'
      && manifest.legal_identity.developer_name.trim().length >= 3
      && !PLACEHOLDER_RE.test(manifest.legal_identity.developer_name),
    'legal_identity.developer_name must be finalized in strict mode',
  )
  requireValue(
    typeof manifest.legal_identity?.privacy_contact === 'string'
      && manifest.legal_identity.privacy_contact.trim().length >= 5
      && !PLACEHOLDER_RE.test(manifest.legal_identity.privacy_contact),
    'legal_identity.privacy_contact must be finalized in strict mode',
  )

  for (const id of requiredDataIds) {
    requireValue(dataById.get(id)?.review_status === APPROVED, `${id}: data disclosure mapping must be approved in strict mode`)
  }

  const now = Date.now()
  for (const id of requiredReviewIds) {
    const review = reviews[id]
    if (!review) continue
    requireValue(review.status === APPROVED, `${id}: status must be approved in strict mode`)
    requireValue(typeof review.evidence_ref === 'string' && review.evidence_ref.trim().length >= 3, `${id}: evidence_ref is required in strict mode`)
    requireValue(typeof review.operator === 'string' && review.operator.trim().length >= 2, `${id}: operator is required in strict mode`)
    const observedAt = Date.parse(review.observed_at)
    requireValue(Number.isFinite(observedAt), `${id}: observed_at must be an ISO-compatible timestamp in strict mode`)
    if (Number.isFinite(observedAt)) requireValue(observedAt <= now + 5 * 60 * 1000, `${id}: observed_at cannot be materially in the future`)
  }
}

if (failures.length) {
  console.error('Store submission readiness: FAIL')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

if (mode === 'strict') {
  console.log(`Store submission package: READY for ${releaseSha}`)
  console.log('This certifies the internal disclosure/metadata package only; it does NOT certify Apple/Google review approval or market release.')
} else {
  console.log('Store submission package structure: PASS')
  console.log('Template/structure validation only — NOT READY for submission and NOT CERTIFIED for market release.')
}
