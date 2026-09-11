import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../..')

const surfaces = [
  ['territory select', 'apps/mobile/app/territory/select.tsx'],
  ['territory activation', 'apps/mobile/app/territory/activate.tsx'],
  ['territory assurance', 'apps/mobile/app/territory/assurance.tsx'],
]

const roleFamilies = {
  hero: 'displayExtraBoldFamily',
  title: 'displayExtraBoldFamily',
  subtitle: 'bodyFamily',
  body: 'bodyFamily',
  label: 'bodyExtraBoldFamily',
  button: 'bodyExtraBoldFamily',
  caption: 'bodySemiboldFamily',
}

const requiredContracts = {
  'territory select': [
    "apiMutation('/territories/me'",
    "router.replace('/territory/activate')",
  ],
  'territory activation': [
    '/territories/activation/me/interests',
    'territory-activation-interest',
    'territory-activation-withdraw',
  ],
  'territory assurance': [
    '/territories/assurance/me',
    '/territories/assurance/requests',
    'territory-assurance-request',
  ],
}

const failures = []

for (const [label, relativePath] of surfaces) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8')

  if (!source.includes("from '../../theme/vertice'")) failures.push(`${label}: missing canonical theme adapter`)
  if (!source.includes('VerticeBrand')) failures.push(`${label}: missing canonical VÉRTICE brand asset boundary`)
  if (!source.includes('VerticeIcon')) failures.push(`${label}: missing canonical Lucide icon boundary`)
  if (!source.includes('name="back"')) failures.push(`${label}: back navigation must use semantic Lucide icon`)
  if (!source.includes('name="territory"') && label !== 'territory activation') failures.push(`${label}: missing territory semantic icon`)
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

  for (const contract of requiredContracts[label]) {
    if (!source.includes(contract)) failures.push(`${label}: functional contract missing: ${contract}`)
  }
}

if (failures.length) {
  for (const failure of failures) console.error(`[territory-trust-surfaces] FAIL: ${failure}`)
  process.exitCode = 1
} else {
  console.log('[territory-trust-surfaces] OK: territory selection, activation and residence assurance use canonical VÉRTICE product language without changing authority contracts.')
}
