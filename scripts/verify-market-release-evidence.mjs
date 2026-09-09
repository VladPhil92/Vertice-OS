import fs from 'node:fs'
import path from 'node:path'

const REQUIRED = new Map([
  ['production_web_api_sha_match', 'passed'],
  ['health_live', 'passed'],
  ['health_ready', 'passed'],
  ['health_release', 'passed'],
  ['same_sha_runtime_canary', 'passed'],
  ['android_signed_physical_smoke', 'passed'],
  ['ios_signed_physical_smoke', 'passed'],
  ['account_deletion_physical_smoke', 'passed'],
  ['veriff_external_canary', 'passed'],
  ['cloudflare_images_canary', 'passed'],
  ['cloudflare_deletion_purge_canary', 'passed'],
  ['mercadopago_bounded_canary', 'passed'],
  ['wompi_breb_payout_canary', 'passed'],
  ['backup_restore_drill', 'passed'],
  ['legal_approval', 'approved'],
  ['app_store_release_approval', 'approved'],
  ['google_play_release_approval', 'approved'],
])

const ALLOWED_STATUS = new Set(['pending', 'blocked', 'passed', 'approved'])
const ITEM_KEYS = new Set(['id', 'status', 'observed_at', 'evidence_ref', 'operator', 'notes'])
const TOP_LEVEL_KEYS = new Set(['schema_version', 'release_sha', 'generated_at', 'release_candidate', 'evidence'])
const SHA_RE = /^[0-9a-f]{40}$/i
const ZERO_SHA = '0'.repeat(40)
const SUSPICIOUS_SECRET = /(bearer\s+[a-z0-9._-]+|sk_(live|test)_[a-z0-9_-]+|api[_-]?key\s*[:=]|access[_-]?token\s*[:=]|password\s*[:=])/i

function parseArgs(argv) {
  const out = { mode: 'structure', manifest: 'release/evidence/market-release.example.json', releaseSha: null }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--mode') out.mode = argv[++i]
    else if (arg === '--manifest') out.manifest = argv[++i]
    else if (arg === '--release-sha') out.releaseSha = argv[++i]
    else throw new Error(`Unknown argument: ${arg}`)
  }
  if (!['structure', 'strict'].includes(out.mode)) throw new Error(`Invalid --mode: ${out.mode}`)
  return out
}

function assert(condition, message, errors) {
  if (!condition) errors.push(message)
}

function validTimestamp(value) {
  if (typeof value !== 'string' || !value) return false
  return Number.isFinite(Date.parse(value))
}

function validate(manifest, options) {
  const errors = []
  assert(manifest && typeof manifest === 'object' && !Array.isArray(manifest), 'Manifest must be a JSON object.', errors)
  if (errors.length) return errors

  for (const key of Object.keys(manifest)) {
    assert(TOP_LEVEL_KEYS.has(key), `Unexpected top-level field: ${key}`, errors)
  }

  assert(manifest.schema_version === '1.0', 'schema_version must be 1.0.', errors)
  assert(typeof manifest.release_candidate === 'string' && manifest.release_candidate.trim().length >= 3, 'release_candidate is required.', errors)
  assert(validTimestamp(manifest.generated_at), 'generated_at must be an ISO-compatible timestamp.', errors)
  assert(SHA_RE.test(manifest.release_sha ?? ''), 'release_sha must be a 40-character git SHA.', errors)
  assert(Array.isArray(manifest.evidence), 'evidence must be an array.', errors)
  if (!Array.isArray(manifest.evidence)) return errors

  const seen = new Set()
  for (const item of manifest.evidence) {
    assert(item && typeof item === 'object' && !Array.isArray(item), 'Every evidence entry must be an object.', errors)
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue

    for (const key of Object.keys(item)) {
      assert(ITEM_KEYS.has(key), `Unexpected evidence field on ${item.id ?? '<unknown>'}: ${key}`, errors)
    }

    assert(typeof item.id === 'string' && REQUIRED.has(item.id), `Unknown evidence id: ${String(item.id)}`, errors)
    if (typeof item.id !== 'string' || !REQUIRED.has(item.id)) continue
    assert(!seen.has(item.id), `Duplicate evidence id: ${item.id}`, errors)
    seen.add(item.id)

    assert(ALLOWED_STATUS.has(item.status), `${item.id}: invalid status ${String(item.status)}`, errors)
    assert(item.notes == null || (typeof item.notes === 'string' && item.notes.length <= 500), `${item.id}: notes must be <= 500 chars.`, errors)

    const textForSecretScan = [item.evidence_ref, item.operator, item.notes]
      .filter((value) => typeof value === 'string')
      .join('\n')
    assert(!SUSPICIOUS_SECRET.test(textForSecretScan), `${item.id}: evidence metadata appears to contain a secret; store only references, never credentials.`, errors)

    if (options.mode === 'strict') {
      const expected = REQUIRED.get(item.id)
      assert(item.status === expected, `${item.id}: expected ${expected}, got ${item.status}.`, errors)
      assert(validTimestamp(item.observed_at), `${item.id}: observed_at is required in strict mode.`, errors)
      assert(typeof item.evidence_ref === 'string' && item.evidence_ref.trim().length >= 3, `${item.id}: evidence_ref is required in strict mode.`, errors)
      assert(typeof item.operator === 'string' && item.operator.trim().length >= 2, `${item.id}: operator/reviewer is required in strict mode.`, errors)
      if (validTimestamp(item.observed_at)) {
        assert(Date.parse(item.observed_at) <= Date.now() + 5 * 60_000, `${item.id}: observed_at cannot be in the future.`, errors)
      }
    }
  }

  for (const id of REQUIRED.keys()) {
    assert(seen.has(id), `Missing required evidence id: ${id}`, errors)
  }

  if (options.mode === 'strict') {
    assert(manifest.release_sha !== ZERO_SHA, 'Strict evidence validation cannot use the placeholder zero SHA.', errors)
    if (validTimestamp(manifest.generated_at)) {
      assert(Date.parse(manifest.generated_at) <= Date.now() + 5 * 60_000, 'generated_at cannot be in the future in strict mode.', errors)
    }
    if (options.releaseSha) {
      assert(SHA_RE.test(options.releaseSha), '--release-sha must be a 40-character git SHA.', errors)
      assert(manifest.release_sha === options.releaseSha, `Manifest release_sha ${manifest.release_sha} does not match requested release SHA ${options.releaseSha}.`, errors)
    }
  }

  return errors
}

function main() {
  let options
  try {
    options = parseArgs(process.argv.slice(2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(2)
  }

  const filePath = path.resolve(process.cwd(), options.manifest)
  let manifest
  try {
    manifest = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (error) {
    console.error(`Unable to read evidence manifest ${options.manifest}: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(2)
  }

  const errors = validate(manifest, options)
  if (errors.length) {
    console.error(`Market release evidence verification FAILED (${options.mode}).`)
    for (const error of errors) console.error(`- ${error}`)
    process.exit(1)
  }

  if (options.mode === 'strict') {
    console.log(`VÉRTICE external/operator evidence bundle: COMPLETE for ${manifest.release_sha}`)
    console.log('This result is NOT by itself a market-release certification; exact-SHA automated gates must also be green.')
  } else {
    console.log('VÉRTICE market release evidence contract: PASS (structure only; NOT CERTIFIED)')
  }
}

main()
