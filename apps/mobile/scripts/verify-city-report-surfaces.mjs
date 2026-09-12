import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../..')

const surfaces = [
  ['public city node', 'apps/mobile/app/city/[code].tsx'],
  ['territorial report detail', 'apps/mobile/app/report/[id].tsx'],
]

const roleFamilies = {
  hero: 'displayExtraBoldFamily',
  title: 'displayExtraBoldFamily',
  subtitle: 'bodyFamily',
  body: 'bodyFamily',
  label: 'bodyExtraBoldFamily',
  button: 'bodyExtraBoldFamily',
  caption: 'bodySemiboldFamily',
  mono: 'monoFamily',
}

const failures = []

for (const [label, relativePath] of surfaces) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8')

  if (!source.includes("from '../../theme/vertice'")) failures.push(`${label}: missing canonical theme adapter`)
  if (!source.includes('VerticeBrand')) failures.push(`${label}: missing canonical VÉRTICE brand asset boundary`)
  if (!source.includes('VerticeIcon')) failures.push(`${label}: missing canonical Lucide icon boundary`)
  if (!source.includes('name="back"')) failures.push(`${label}: back navigation must use the semantic Lucide adapter`)
  if (/#[0-9A-Fa-f]{6}/.test(source)) failures.push(`${label}: local hex color found; use canonical design tokens`)
  if (/[←✓○]/.test(source)) failures.push(`${label}: legacy text-glyph icon found; use VerticeIcon`)
  if (/fontFamily:\s*['"]/.test(source)) failures.push(`${label}: raw font family found; use canonical typography aliases`)

  for (const [role, family] of Object.entries(roleFamilies)) {
    const rolePattern = new RegExp(`\\{[^{}]*\\.\\.\\.typography\\.roles\\.${role}[^{}]*\\}`, 'g')
    for (const match of source.matchAll(rolePattern)) {
      if (!match[0].includes(`fontFamily: typography.${family}`)) {
        failures.push(`${label}: typography.roles.${role} must bind to typography.${family}`)
      }
    }
  }
}

const city = fs.readFileSync(path.join(root, 'apps/mobile/app/city/[code].tsx'), 'utf8')
if (!city.includes('/territories/public/')) failures.push('public city node: public territory overview contract missing')
if (!city.includes('{ public: true }')) failures.push('public city node: public-read boundary missing')
if (!city.includes("pathname: '/report/[id]'")) failures.push('public city node: report activity must deep-link to canonical report detail')
if (!city.includes('Math.min(100, Math.max(2, overview.activation.momentum_score))')) failures.push('public city node: momentum visualization must clamp to the 0-100 visual contract')

const report = fs.readFileSync(path.join(root, 'apps/mobile/app/report/[id].tsx'), 'utf8')
if (!report.includes('/territorial/reports/')) failures.push('territorial report detail: public report contract missing')
if (!report.includes('{ public: true }')) failures.push('territorial report detail: public-read boundary missing')
if (!report.includes('Linking.openURL')) failures.push('territorial report detail: external map handoff missing')
if (!report.includes('typography.monoFamily')) failures.push('territorial report detail: coordinates must use bundled DM Mono alias')

const iconAdapter = fs.readFileSync(path.join(root, 'apps/mobile/components/VerticeIcon.tsx'), 'utf8')
for (const semanticIcon of ['report', 'map', 'evidence', 'timeline', 'refresh', 'signal']) {
  if (!iconAdapter.includes(`${semanticIcon}:`)) failures.push(`icon adapter: missing semantic icon ${semanticIcon}`)
}

if (failures.length) {
  for (const failure of failures) console.error(`[city-report-surfaces] FAIL: ${failure}`)
  process.exitCode = 1
} else {
  console.log('[city-report-surfaces] OK: public city discovery and territorial report detail use canonical VÉRTICE color, bundled typography, imagery, Lucide semantics and public-read authority boundaries.')
}
