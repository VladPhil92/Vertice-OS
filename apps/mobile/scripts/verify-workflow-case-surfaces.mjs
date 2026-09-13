import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const mobileRoot = path.resolve(here, '..')

const surfaces = [
  {
    name: 'workflow case list',
    path: 'app/workflows/index.tsx',
    required: [
      '/workflows/cases?limit=50',
      'router.push(`/workflows/${item.id}`)',
      'El backend conserva la autoridad sobre el estado administrativo',
      'Ver trazabilidad',
    ],
  },
  {
    name: 'workflow case detail',
    path: 'app/workflows/[id].tsx',
    required: [
      '/workflows/cases/${encodeURIComponent(id)}',
      'El backend conserva la autoridad sobre el estado administrativo',
      'ARTEFACTOS PERSISTIDOS',
      'Última actualización registrada',
      'VISIBILIDAD DEL EXPEDIENTE',
      'Su ausencia no significa que sean requisitos previos ni pasos pendientes en una secuencia obligatoria.',
      'Esta lectura es informativa: la ausencia de un artefacto no implica orden secuencial ni autoriza una transición administrativa.',
      'router.push(`/report/${item.report.id}`)',
    ],
  },
]

const failures = []
const forbiddenGlyphs = ['←', '→', '✓', '○']
const forbiddenMutationTokens = ["apiMutation", "method: 'POST'", 'method: "POST"', '/analyze', '/proposal', '/control']

for (const surface of surfaces) {
  const absolute = path.join(mobileRoot, surface.path)
  const source = fs.readFileSync(absolute, 'utf8')

  if (!source.includes("from '../../theme/vertice'")) {
    failures.push(`${surface.name}: must consume the canonical native theme adapter`)
  }
  if (!source.includes('VerticeBrand')) {
    failures.push(`${surface.name}: must render the canonical VÉRTICE brand boundary`)
  }
  if (!source.includes('VerticeIcon')) {
    failures.push(`${surface.name}: must use the semantic VÉRTICE icon boundary`)
  }
  if (/from ['"]lucide-react-native['"]/.test(source)) {
    failures.push(`${surface.name}: product screens cannot import Lucide directly`)
  }
  if (/#[0-9a-fA-F]{3,8}\b/.test(source)) {
    failures.push(`${surface.name}: local hexadecimal colors are forbidden`)
  }
  if (/fontFamily:\s*['"]/.test(source)) {
    failures.push(`${surface.name}: raw font-family strings are forbidden`)
  }
  for (const glyph of forbiddenGlyphs) {
    if (source.includes(glyph)) failures.push(`${surface.name}: Unicode glyph ${glyph} cannot substitute semantic icons`)
  }
  for (const token of surface.required) {
    if (!source.includes(token)) failures.push(`${surface.name}: missing workflow authority/traceability token: ${token}`)
  }
  for (const token of forbiddenMutationTokens) {
    if (source.includes(token)) failures.push(`${surface.name}: workflow convergence is read-only and cannot introduce client-side transition token: ${token}`)
  }
}

const iconAdapter = fs.readFileSync(path.join(mobileRoot, 'components/VerticeIcon.tsx'), 'utf8')
for (const icon of ['workflow', 'case', 'history', 'document', 'pending', 'required']) {
  if (!iconAdapter.includes(`${icon}:`)) failures.push(`VerticeIcon: missing semantic workflow icon alias ${icon}`)
}

if (failures.length) {
  for (const failure of failures) console.error(`[workflow-case-surfaces] FAIL: ${failure}`)
  process.exitCode = 1
} else {
  console.log('[workflow-case-surfaces] OK: workflow list/detail preserve canonical visuals, traceability, non-sequential artifacts and backend transition authority.')
}
