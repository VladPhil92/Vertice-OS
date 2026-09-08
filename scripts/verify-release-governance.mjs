import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const failures = [];

function read(path) {
  const absolute = resolve(root, path);
  if (!existsSync(absolute)) {
    failures.push(`missing required file: ${path}`);
    return '';
  }
  return readFileSync(absolute, 'utf8');
}

function requireTokens(path, tokens) {
  const content = read(path);
  for (const token of tokens) {
    if (!content.includes(token)) {
      failures.push(`${path}: missing governance token: ${token}`);
    }
  }
}

const requiredFiles = [
  '.github/CODEOWNERS',
  '.github/pull_request_template.md',
  'docs/engineering/RELEASE_GOVERNANCE.md',
  '.github/workflows/ci.yml',
  '.github/workflows/dashboard-release-gate.yml',
  '.github/workflows/frontend-runtime-contract.yml',
  '.github/workflows/railway-runtime-contract.yml',
  '.github/workflows/identity-provider-certification.yml',
  '.github/workflows/semgrep-community.yml',
];

for (const file of requiredFiles) read(file);

requireTokens('.github/CODEOWNERS', [
  '* @VladPhil92',
  '/.github/workflows/ @VladPhil92',
]);

requireTokens('.github/pull_request_template.md', [
  '## Risk class',
  '## Release evidence',
  '## Rollback',
  'Código presente no equivale a release certificado',
]);

requireTokens('docs/engineering/RELEASE_GOVERNANCE.md', [
  '`IMPLEMENTED`',
  '`DEPLOYED`',
  '`READY`',
  '`CERTIFIED`',
  'Golden Main Governance Contract',
  'Bloquear force-push',
  'Bloquear borrado de `main`',
]);

requireTokens('.github/workflows/ci.yml', [
  'name: Calidad de Código',
  'name: Tests',
  'name: Security Scan',
  'name: Build',
  'pnpm install --frozen-lockfile',
]);

const packageJson = JSON.parse(read('package.json') || '{}');
if (packageJson.scripts?.['governance:verify'] !== 'node scripts/verify-release-governance.mjs') {
  failures.push(
    'package.json: scripts.governance:verify must equal "node scripts/verify-release-governance.mjs"',
  );
}

if (failures.length > 0) {
  console.error('❌ Golden Main governance contract failed:\n');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log('✅ Golden Main governance contract satisfied.');
console.log(`   Required governance files: ${requiredFiles.length}`);
console.log('   Risk model: R0/R1/R2/R3');
console.log('   Release states: IMPLEMENTED → INTEGRATED → DEPLOYED → READY → CERTIFIED');
