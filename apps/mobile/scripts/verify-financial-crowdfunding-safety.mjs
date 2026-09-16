import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const mobileRoot = path.resolve(here, '..')
const screenPath = path.join(mobileRoot, 'app/crowdfunding/index.tsx')
const source = fs.readFileSync(screenPath, 'utf8')
const failures = []

// Campaign *creation* is real and allowed (see apps/web/app/dashboard/
// crowdfunding/new/page.tsx for the canonical contract this mirrors). What
// stays forbidden on mobile until Mercado Pago/Wompi are certified is
// *collection*: activation, contributions, checkout and payouts.
const required = [
  "COLLECTION_LAUNCH_MONTH = 'octubre de 2026'",
  'El recaudo, los pagos, KYC/KYB y los desembolsos nunca modifican tu reputación, ranking, voto ni autoridad cívica.',
  'La campaña queda en borrador y deberá superar revisión de cumplimiento antes de recibir aportes.',
]

const forbiddenCollectionTokens = [
  "'/crowdfunding/contributions'",
  '"/crowdfunding/contributions"',
  "'/crowdfunding/checkout'",
  '"/crowdfunding/checkout"',
  '/activate',
  '/payout-destination',
  '/payouts',
  'platform_fee_cop =',
  'reputation_score =',
  'verification_level =',
]

const ALLOWED_MUTATION_PATH = '/crowdfunding/campaigns'

if (!source.includes("from '../../theme/vertice'")) {
  failures.push('crowdfunding safety surface must consume the canonical native theme adapter')
}
if (!source.includes('VerticeBrand')) {
  failures.push('crowdfunding safety surface must render the canonical VÉRTICE brand boundary')
}
if (!source.includes('VerticeIcon')) {
  failures.push('crowdfunding safety surface must use the semantic VÉRTICE icon boundary')
}
if (/from ['"]lucide-react-native['"]/.test(source)) {
  failures.push('crowdfunding safety surface cannot import Lucide directly')
}
if (/#[0-9a-fA-F]{3,8}\b/.test(source)) {
  failures.push('crowdfunding safety surface cannot reintroduce local hexadecimal colors')
}
if (/fontFamily:\s*['"]/.test(source)) {
  failures.push('crowdfunding safety surface cannot use raw font-family strings')
}
for (const glyph of ['←', '→', '✓', '○']) {
  if (source.includes(glyph)) failures.push(`crowdfunding safety surface cannot substitute semantic icons with Unicode glyph ${glyph}`)
}
for (const token of required) {
  if (!source.includes(token)) failures.push(`crowdfunding safety surface missing financial authority/readiness token: ${token}`)
}
for (const token of forbiddenCollectionTokens) {
  if (source.includes(token)) failures.push(`crowdfunding safety convergence forbids collection/settlement capability on mobile: ${token}`)
}

// apiMutation is allowed here now, but only ever pointed at campaign
// creation — any other mutation target would be a collection capability
// sneaking in without a matching literal in forbiddenCollectionTokens above.
// Every invocation is inspected individually (not just "does at least one
// typed call exist") so a second, untyped or dynamic-target call can't hide
// next to a legitimate one and still pass this gate.
const mutationInvocations = [...source.matchAll(/\bapiMutation(?:<[^>]*>)?\(\s*([^,]+),/g)]
if (mutationInvocations.length === 0) {
  failures.push('crowdfunding safety surface must call apiMutation to create campaign drafts (the announcement-only contract is gone)')
}
for (const [, rawArg] of mutationInvocations) {
  const literal = /^(['"])([^'"]+)\1$/.exec(rawArg.trim())
  if (!literal) {
    failures.push(`crowdfunding safety convergence requires a literal apiMutation path so this gate can verify it; found non-literal target: ${rawArg.trim()}`)
    continue
  }
  if (literal[2] !== ALLOWED_MUTATION_PATH) {
    failures.push(`crowdfunding safety convergence only allows apiMutation against ${ALLOWED_MUTATION_PATH}, found: ${literal[2]}`)
  }
}

if (/router\.push\(['"]\/dashboard\//.test(source)) {
  failures.push('crowdfunding mobile cannot translate dashboard web routes into local financial permissions')
}

if (failures.length) {
  for (const failure of failures) console.error(`[financial-crowdfunding-safety] FAIL: ${failure}`)
  process.exitCode = 1
} else {
  console.log('[financial-crowdfunding-safety] OK: crowdfunding mobile can create campaign drafts, preserves canonical visuals and introduces no collection/settlement capability.')
}
