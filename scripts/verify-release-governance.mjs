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
  'docs/engineering/GOLDEN_E2E_PHASE1.md',
  'docs/engineering/TERRITORIAL_GOVERNANCE_ELIGIBILITY_PHASE7G2.md',
  '.github/workflows/ci.yml',
  '.github/workflows/dashboard-release-gate.yml',
  '.github/workflows/frontend-runtime-contract.yml',
  '.github/workflows/railway-runtime-contract.yml',
  '.github/workflows/identity-provider-certification.yml',
  '.github/workflows/semgrep-community.yml',
  '.github/workflows/golden-e2e-journeys.yml',
  'apps/api/prisma/migrations/20260910184500_territorial_governance_eligibility_phase7g2/migration.sql',
  'apps/api/src/modules/governance/governance.eligibility.ts',
  'apps/api/src/modules/governance/governance.service.ts',
  'apps/api/src/__tests__/golden-journeys.integration.test.ts',
  'apps/api/src/__tests__/golden-governance.integration.test.ts',
  'apps/web/e2e/golden-safety.spec.ts',
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

requireTokens('.github/workflows/golden-e2e-journeys.yml', [
  'name: Golden Browser Journeys',
  'name: Golden API Journeys',
  "GOLDEN_API_JOURNEYS: '1'",
  'e2e:golden',
  '20260910184500_territorial_governance_eligibility_phase7g2',
]);

requireTokens('docs/engineering/GOLDEN_E2E_PHASE1.md', [
  'Browser contract',
  'Integration journey',
  'Staging/provider certification',
  'GJ-01 Auth/session lifecycle',
  'GJ-02 Citizen action + evidence',
]);

requireTokens('docs/engineering/TERRITORIAL_GOVERNANCE_ELIGIBILITY_PHASE7G2.md', [
  '365 days',
  '30 days',
  'ELIGIBLE_FROZEN_ELECTORATE',
  'TERRITORY_ASSURANCE_EXPIRED',
  'immutable frozen voter roll',
]);

requireTokens('apps/api/prisma/migrations/20260910184500_territorial_governance_eligibility_phase7g2/migration.sql', [
  'territory_assurance_request_id',
  'territory_assurance_expires_at',
  'identity_proof_id',
  'protect_frozen_voter_roll()',
  "INTERVAL '365 days'",
]);

requireTokens('apps/api/src/modules/governance/governance.eligibility.ts', [
  'getGovernanceEligibilityPreflight',
  'ELIGIBLE_CURRENT_ASSURANCE',
  'ELIGIBLE_FROZEN_ELECTORATE',
  'TERRITORY_SCOPE_MISMATCH',
  'VOTER_ROLL_UNAVAILABLE',
]);

requireTokens('apps/api/src/modules/governance/governance.service.ts', [
  'territory_assurance_requests',
  'territory_assurance_request_id',
  'identity_proof_id',
  'identity_proof.provider',
  'national_identity_assured',
]);

const packageJson = JSON.parse(read('package.json') || '{}');
if (packageJson.scripts?.['governance:verify'] !== 'node scripts/verify-release-governance.mjs') {
  failures.push(
    'package.json: scripts.governance:verify must equal "node scripts/verify-release-governance.mjs"',
  );
}

const webPackageJson = JSON.parse(read('apps/web/package.json') || '{}');
if (!String(webPackageJson.scripts?.['e2e:golden'] ?? '').includes('golden-safety.spec.ts')) {
  failures.push('apps/web/package.json: scripts.e2e:golden must include golden-safety.spec.ts');
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
console.log('   Golden E2E: browser contracts + real API integration journeys are durable release gates.');
console.log('   Phase 7G.2: current proof admission -> immutable frozen identity/residence provenance.');
