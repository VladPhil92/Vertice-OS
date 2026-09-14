import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const mobileRoot = path.resolve(here, '..')
const screenPath = path.join(mobileRoot, 'app/crowdfunding/index.tsx')
const source = fs.readFileSync(screenPath, 'utf8')
const failures = []

const required = [
  "apiFetch<CrowdfundingReadiness>('/crowdfunding/me/readiness')",
  "apiFetch<OwnCampaignsResponse>('/crowdfunding/me/campaigns')",
  'El backend y sus proveedores certificados conservan la autoridad',
  'Esta pantalla es de lectura y no ejecuta checkout ni desembolsos.',
  'no equivale a settlement, transferencia bancaria ni payout ejecutado.',
  'Monto registrado por API; no constituye prueba local de settlement bancario.',
  'Pagos, donaciones, KYC/KYB, suscripciones, settlement y payouts no modifican reputación, ranking, voto ni autoridad cívica.',
  'Math.max(0, Math.min(100',
  "router.push('/identity')",
  "campaignReadiness?.status === 'active'",
]

const forbiddenMutationTokens = [
  "method: 'POST'",
  'method: "POST"',
  "'/crowdfunding/contributions'",
  '"/crowdfunding/contributions"',
  "'/crowdfunding/checkout'",
  '"/crowdfunding/checkout"',
  "'/crowdfunding/payouts/execute'",
  '"/crowdfunding/payouts/execute"',
]

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
if (/\bapiMutation\b/.test(source)) {
  failures.push('crowdfunding safety convergence is read-only and cannot introduce the apiMutation helper, including generic or whitespace variants')
}
for (const glyph of ['←', '→', '✓', '○']) {
  if (source.includes(glyph)) failures.push(`crowdfunding safety surface cannot substitute semantic icons with Unicode glyph ${glyph}`)
}
for (const token of required) {
  if (!source.includes(token)) failures.push(`crowdfunding safety surface missing financial authority/readiness token: ${token}`)
}
for (const token of forbiddenMutationTokens) {
  if (source.includes(token)) failures.push(`crowdfunding safety convergence is read-only and cannot introduce monetary mutation token: ${token}`)
}
if (/router\.push\(['"]\/dashboard\//.test(source)) {
  failures.push('crowdfunding mobile cannot translate dashboard web routes into local financial permissions')
}

if (failures.length) {
  for (const failure of failures) console.error(`[financial-crowdfunding-safety] FAIL: ${failure}`)
  process.exitCode = 1
} else {
  console.log('[financial-crowdfunding-safety] OK: crowdfunding mobile preserves canonical visuals, server readiness authority and the read-only money boundary.')
}
