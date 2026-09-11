import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../..')

const surfaces = [
  ['notifications', 'apps/mobile/app/notifications.tsx', "from '../theme/vertice'"],
  ['account deletion', 'apps/mobile/app/account-deletion.tsx', "from '../theme/vertice'"],
  ['identity assurance', 'apps/mobile/app/identity/index.tsx', "from '../../theme/vertice'"],
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

const failures = []

for (const [label, relativePath, themeImport] of surfaces) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8')

  if (!source.includes(themeImport)) failures.push(`${label}: missing canonical theme adapter`)
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

const iconAdapter = fs.readFileSync(path.join(root, 'apps/mobile/components/VerticeIcon.tsx'), 'utf8')
for (const semanticIcon of ['back', 'notifications', 'verified', 'checkCircle', 'circle', 'delete']) {
  if (!iconAdapter.includes(`${semanticIcon}:`)) failures.push(`icon adapter: missing semantic icon ${semanticIcon}`)
}

if (failures.length) {
  for (const failure of failures) console.error(`[critical-secondary-surfaces] FAIL: ${failure}`)
  process.exitCode = 1
} else {
  console.log('[critical-secondary-surfaces] OK: notifications, privacy deletion and identity assurance use canonical VÉRTICE color, bundled typography, imagery and Lucide semantics.')
}
