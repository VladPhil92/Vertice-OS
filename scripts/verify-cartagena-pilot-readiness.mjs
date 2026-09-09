import { readFile } from 'node:fs/promises'

const files = {
  package: 'package.json',
  canary: 'scripts/cartagena-pilot-canary.mjs',
  workflow: '.github/workflows/cartagena-pilot-readiness.yml',
  docs: 'docs/deployment/cartagena-pilot-runbook.md',
}

const [pkgRaw, canary, workflow, docs] = await Promise.all([
  readFile(files.package, 'utf8'),
  readFile(files.canary, 'utf8'),
  readFile(files.workflow, 'utf8'),
  readFile(files.docs, 'utf8'),
])
const pkg = JSON.parse(pkgRaw)

const failures = []
const requireText = (source, token, message) => {
  if (!source.includes(token)) failures.push(message)
}

if (pkg.scripts?.['pilot:verify'] !== 'node scripts/verify-cartagena-pilot-readiness.mjs') {
  failures.push('package.json must expose pilot:verify')
}

for (const path of [
  '/health/live',
  '/health/ready',
  '/health/release',
  '/territorial/reports?limit=1',
  '/governance/proposals?limit=1',
]) {
  requireText(canary, path, `canary must probe ${path}`)
}

requireText(canary, 'PILOT_EXPECTED_REVISION', 'canary must require an expected deployment revision')
requireText(canary, "method: 'GET'", 'canary must explicitly use GET')
requireText(canary, "decision: 'NO_GO'", 'canary must emit NO_GO on failure')
requireText(canary, "decision: 'GO'", 'canary must emit GO on success')
requireText(canary, 'blockers.length === 0', 'release readiness must reject runtime blockers')
requireText(canary, "checks?.database === 'ok'", 'database readiness must be asserted')
requireText(canary, "checks?.redis === 'ok'", 'redis readiness must be asserted')

for (const forbidden of ["method: 'POST'", "method: 'PUT'", "method: 'PATCH'", "method: 'DELETE'"]) {
  if (canary.includes(forbidden)) failures.push(`pilot canary must remain non-destructive; found ${forbidden}`)
}

requireText(workflow, "branches: [main]", 'production canary must trigger from main pushes')
requireText(workflow, "github.event_name != 'pull_request'", 'production canary must never run against a PR-only revision')
requireText(workflow, 'github.event.pull_request.head.sha || github.sha', 'PR source validation must checkout the exact submitted SHA')
requireText(workflow, 'vertice-os-production.up.railway.app', 'workflow must define the canonical production API target')
requireText(workflow, 'PILOT_EXPECTED_REVISION', 'workflow must bind the canary to an expected revision')
requireText(workflow, 'actions/upload-artifact@v4', 'workflow must retain pilot evidence as an artifact')
requireText(workflow, 'pilot-canary-report.json', 'workflow must upload the machine-readable canary report')

for (const heading of ['GO criteria', 'NO-GO criteria', 'Rollback', 'Same-SHA', 'Branch protection']) {
  requireText(docs, heading, `pilot runbook must document ${heading}`)
}

if (failures.length > 0) {
  console.error('Cartagena Pilot Readiness contract: FAIL')
  for (const failure of failures) console.error(` - ${failure}`)
  process.exit(1)
}

console.log('Cartagena Pilot Readiness contract: PASS')
console.log('This verifies source-level pilot controls only; production GO requires a same-SHA canary after deployment.')
