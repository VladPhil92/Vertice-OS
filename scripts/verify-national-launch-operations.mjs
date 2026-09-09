import fs from 'node:fs'

const required = [
  'apps/api/prisma/migrations/20260909072000_national_launch_operations_phase7b/migration.sql',
  'apps/api/src/modules/territories/territories.operations.ts',
  'apps/api/src/modules/territories/territories.operations.ranking.ts',
  'apps/api/src/modules/territories/territories.operations.routes.ts',
  'apps/web/app/dashboard/admin/national/page.tsx',
  'docs/engineering/NATIONAL_LAUNCH_OPERATIONS_PHASE7B.md',
]
for (const file of required) {
  if (!fs.existsSync(file)) throw new Error(`Phase 7B missing required artifact: ${file}`)
}

const migration = fs.readFileSync(required[0], 'utf8')
const service = fs.readFileSync(required[1], 'utf8')
const ranking = fs.readFileSync(required[2], 'utf8')
const routes = fs.readFileSync(required[3], 'utf8')
const page = fs.readFileSync(required[4], 'utf8')

for (const token of ['territory_launch_plans', 'territory_launch_cohort_members', 'territory_launch_events']) {
  if (!migration.includes(token)) throw new Error(`Phase 7B migration missing ${token}`)
}
if (!migration.includes("cohort_role IN ('ambassador','organizer','observer')")) {
  throw new Error('Phase 7B cohort roles must remain operational labels')
}
if (!service.includes("authority_effect: 'none'")) throw new Error('Cohort assignment must declare no authority effect')
if (!service.includes("'LAUNCH_READINESS_BLOCKED'")) throw new Error('Launch must fail closed on readiness blockers')
if (!ranking.includes('WITH citizen_metrics AS')) throw new Error('National launch board must use set-based aggregation')
if (ranking.includes('Promise.all') || ranking.includes('for (const territory')) {
  throw new Error('National launch board must not fan out per city')
}
for (const signal of ['payments', 'donations', 'payouts', 'subscription', 'kyc_kyb', 'ideology']) {
  if (!routes.includes(signal)) throw new Error(`Operations response must explicitly exclude ${signal}`)
}
if (!routes.includes('requireSuperadmin')) throw new Error('Operational mutations require live superadmin authority')
if (!page.includes('National Launch Control Plane')) throw new Error('National operations UI missing')
if (!page.includes('!node.launch_ready')) throw new Error('UI must disable launch when readiness is blocked')

console.log('National Launch Operations Phase 7B source contract: PASS')
