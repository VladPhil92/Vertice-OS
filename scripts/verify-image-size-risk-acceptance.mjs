import { spawnSync } from 'node:child_process'

const EXPIRES_ON = '2026-10-07'
const PACKAGE = 'image-size'
const MOBILE_WORKSPACE = '@vertice/mobile'
const OTHER_WORKSPACES = [
  '@vertice/web',
  '@vertice/api',
  '@vertice/ai',
  '@vertice/ui',
  '@vertice/types',
  '@vertice/config',
  '@vertice/contracts',
]
const EXPECTED_CHAIN_MARKERS = [
  'image-size',
  'metro',
  'metro-config',
  '@react-native/metro-config',
  'react-native-worklets',
  'expo-modules-core',
  'expo',
]

function fail(message) {
  console.error(`ERROR: ${message}`)
  process.exit(1)
}

const today = new Date().toISOString().slice(0, 10)
if (today >= EXPIRES_ON) {
  fail(
    `temporary ${PACKAGE} risk acceptance expired on ${EXPIRES_ON}; re-review GHSA-w3rx-r6r6-pgpr and GHSA-5p2g-fcmc-qvqq before continuing`,
  )
}

function why(workspace) {
  const result = spawnSync(
    'pnpm',
    ['--filter', workspace, 'why', PACKAGE, '--json'],
    { encoding: 'utf8' },
  )

  if (result.error) {
    fail(`could not execute pnpm why for ${workspace}: ${result.error.message}`)
  }

  if (result.status !== 0) {
    fail(
      `pnpm why failed for ${workspace} with exit code ${result.status}: ${result.stderr || result.stdout}`,
    )
  }

  return result.stdout.trim()
}

const mobileWhy = why(MOBILE_WORKSPACE)
for (const marker of EXPECTED_CHAIN_MARKERS) {
  if (!mobileWhy.includes(marker)) {
    fail(
      `${PACKAGE} no longer matches the accepted Expo/Metro dependency chain; missing marker: ${marker}`,
    )
  }
}

for (const workspace of OTHER_WORKSPACES) {
  const report = why(workspace)
  if (report.includes('"image-size"')) {
    fail(
      `${PACKAGE} is now reachable from ${workspace}; the temporary exception is restricted to ${MOBILE_WORKSPACE}`,
    )
  }
}

console.log(
  `Temporary ${PACKAGE} risk acceptance is in scope for ${MOBILE_WORKSPACE} only and remains valid until ${EXPIRES_ON}.`,
)
