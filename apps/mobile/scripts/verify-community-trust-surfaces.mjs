import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const mobileRoot = path.resolve(here, '..')

const surfaces = [
  {
    name: 'community profile',
    path: 'app/community/[citizenId].tsx',
    required: [
      '/community/profiles/${citizenId}',
      '/community/profiles/${citizenId}/follow',
      '/community/profiles/${citizenId}/block',
      "pathname: '/community/report'",
      'Seguir a una persona no es respaldo político',
    ],
  },
  {
    name: 'community leaderboard',
    path: 'app/community/leaderboard.tsx',
    required: [
      '/community/leaderboard?limit=30',
      'excluye seguidores, likes, impresiones y corroboraciones comunitarias',
      'no lo respalda políticamente',
    ],
  },
  {
    name: 'community moderation report',
    path: 'app/community/report.tsx',
    required: [
      '/community/safety/reports',
      'No sanciona automáticamente',
      'Reportar es una señal para revisión, no una sentencia',
      'accessibilityRole="radio"',
    ],
  },
]

const failures = []
const forbiddenGlyphs = ['←', '→', '✓', '○']

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
    if (!source.includes(token)) failures.push(`${surface.name}: missing trust/moderation contract token: ${token}`)
  }
}

const iconAdapter = fs.readFileSync(path.join(mobileRoot, 'components/VerticeIcon.tsx'), 'utf8')
for (const icon of ['userPlus', 'userMinus', 'block', 'unblock', 'flag', 'shield', 'moderation', 'leaderboard']) {
  if (!iconAdapter.includes(`${icon}:`)) failures.push(`VerticeIcon: missing semantic community icon alias ${icon}`)
}

if (failures.length) {
  for (const failure of failures) console.error(`[community-trust-surfaces] FAIL: ${failure}`)
  process.exitCode = 1
} else {
  console.log('[community-trust-surfaces] OK: profile, ranking and moderation preserve canonical visuals and trust boundaries.')
}
