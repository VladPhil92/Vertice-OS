import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const files = {
  current: 'docs/CURRENT_STATE.md',
  completion: 'docs/engineering/MARKET_RELEASE_COMPLETION.md',
  certification: 'docs/engineering/MARKET_RELEASE_CERTIFICATION.md',
  productIndex: 'docs/product/README.md',
  phase: 'docs/product/PHASE_RELEASE_CANDIDATE_HARDENING_EVIDENCE_SYNC.md',
  workflow: '.github/workflows/market-release-certification.yml',
  manifest: 'release/evidence/market-release.example.json',
}

const ZERO_SHA = '0'.repeat(40)
const SYNC_RE = /Evidence sync:\s*\*\*(\d{4}-\d{2}-\d{2})\*\*/
const failures = []

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function requireText(source, token, label) {
  if (!source.includes(token)) failures.push(`${label}: missing required token: ${token}`)
}

function requireMatch(source, pattern, label, message) {
  if (!pattern.test(source)) failures.push(`${label}: ${message}`)
}

function syncDate(source, label) {
  const match = source.match(SYNC_RE)
  if (!match) {
    failures.push(`${label}: missing machine-readable Evidence sync YYYY-MM-DD marker`)
    return null
  }
  if (!Number.isFinite(Date.parse(`${match[1]}T00:00:00Z`))) {
    failures.push(`${label}: invalid Evidence sync date ${match[1]}`)
    return null
  }
  return match[1]
}

let current
let completion
let certification
let productIndex
let phase
let workflow
let manifest

try {
  current = read(files.current)
  completion = read(files.completion)
  certification = read(files.certification)
  productIndex = read(files.productIndex)
  phase = read(files.phase)
  workflow = read(files.workflow)
  manifest = JSON.parse(read(files.manifest))
} catch (error) {
  console.error(`[release-candidate-state] FAIL: unable to read synchronized release state: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}

const releaseSyncDates = [
  ['CURRENT_STATE', syncDate(current, 'CURRENT_STATE')],
  ['MARKET_RELEASE_COMPLETION', syncDate(completion, 'MARKET_RELEASE_COMPLETION')],
  ['MARKET_RELEASE_CERTIFICATION', syncDate(certification, 'MARKET_RELEASE_CERTIFICATION')],
]
const presentSyncDates = releaseSyncDates.map(([, value]) => value).filter(Boolean)
if (new Set(presentSyncDates).size > 1) {
  failures.push(`release docs: Evidence sync markers diverge (${releaseSyncDates.map(([label, value]) => `${label}=${value ?? 'missing'}`).join(', ')})`)
}
syncDate(phase, 'RC phase')

requireMatch(current, /Current market-release status:\s*NOT CERTIFIED\./, 'CURRENT_STATE', 'must explicitly report NOT CERTIFIED')
requireText(current, 'Un estado `ready` no equivale a una transferencia o payout ejecutado.', 'CURRENT_STATE')
requireText(current, 'No se declara un budget de performance o bundle arbitrario en esta fase', 'CURRENT_STATE')

const pendingCompletionTokens = [
  '- [ ] Create/link the real EAS project',
  '- [ ] install signed preview/release build;',
  '- [ ] production account/contract;',
  '- [ ] production merchant account/credentials;',
  '- [ ] Pagos a Terceros production access;',
  '- [ ] Execute a documented backup/restore drill',
  '- [ ] Terms of Service;',
  '- [ ] App Store Connect listing/privacy labels/screenshots/content declarations;',
  '- [ ] Google Play Data Safety/content rating/store listing;',
]
for (const token of pendingCompletionTokens) requireText(completion, token, 'MARKET_RELEASE_COMPLETION')
requireMatch(completion, /Current market-release status:\s*\*\*NOT CERTIFIED\*\*\./, 'MARKET_RELEASE_COMPLETION', 'must explicitly report NOT CERTIFIED')
requireText(completion, 'Release Candidate State Sync contract', 'MARKET_RELEASE_COMPLETION')

requireText(certification, 'No evidence reference, no certification.', 'MARKET_RELEASE_CERTIFICATION')
requireMatch(certification, /Current market-release status:\s*\*\*NOT CERTIFIED\*\*\./, 'MARKET_RELEASE_CERTIFICATION', 'must explicitly report NOT CERTIFIED')
requireText(certification, 'scripts/verify-release-candidate-state.mjs', 'MARKET_RELEASE_CERTIFICATION')
requireText(certification, 'exact 40-character release commit', 'MARKET_RELEASE_CERTIFICATION')
requireText(certification, 'A production-like Expo export or simulator result is not signed physical-device evidence.', 'MARKET_RELEASE_CERTIFICATION')

requireText(productIndex, 'PHASE_RELEASE_CANDIDATE_HARDENING_EVIDENCE_SYNC.md', 'product index')
requireText(phase, 'NOT CERTIFIED FOR MARKET RELEASE', 'RC phase')
requireText(phase, 'No arbitrary performance claim', 'RC phase')
requireText(phase, 'No simulated external certification', 'RC phase')

requireText(workflow, "'docs/CURRENT_STATE.md'", 'market-release workflow')
requireText(workflow, "'docs/product/README.md'", 'market-release workflow')
requireText(workflow, "'docs/product/PHASE_RELEASE_CANDIDATE_HARDENING_EVIDENCE_SYNC.md'", 'market-release workflow')
requireText(workflow, "'scripts/verify-release-candidate-state.mjs'", 'market-release workflow')
requireText(workflow, 'node scripts/verify-release-candidate-state.mjs', 'market-release workflow')
requireText(workflow, 'node scripts/verify-market-release-evidence.mjs --mode structure', 'market-release workflow')

if (manifest.release_sha !== ZERO_SHA) {
  failures.push('example manifest: release_sha must remain the all-zero placeholder SHA')
}
if (!Array.isArray(manifest.evidence) || manifest.evidence.length === 0) {
  failures.push('example manifest: evidence must be a non-empty array')
} else {
  for (const item of manifest.evidence) {
    if (item.status !== 'pending') failures.push(`example manifest: ${item.id ?? '<unknown>'} must remain pending`)
    if (item.observed_at !== null) failures.push(`example manifest: ${item.id ?? '<unknown>'} observed_at must remain null`)
    if (item.evidence_ref !== null) failures.push(`example manifest: ${item.id ?? '<unknown>'} evidence_ref must remain null`)
    if (item.operator !== null) failures.push(`example manifest: ${item.id ?? '<unknown>'} operator must remain null`)
  }
}

if (failures.length) {
  for (const failure of failures) console.error(`[release-candidate-state] FAIL: ${failure}`)
  process.exit(1)
}

console.log(`[release-candidate-state] PASS: release documents are synchronized at ${presentSyncDates[0] ?? 'unknown date'} and the placeholder external evidence remains fail-closed.`)
console.log('[release-candidate-state] Market-release status: NOT CERTIFIED. External/operator evidence remains mandatory.')
