import { readFile } from 'node:fs/promises'

const files = {
  app: 'apps/api/src/app.ts',
  index: 'apps/api/src/index.ts',
  service: 'apps/api/src/modules/territories/territories.service.ts',
  ranking: 'apps/api/src/modules/territories/territories.ranking.ts',
  routes: 'apps/api/src/modules/territories/territories.routes.ts',
  feed: 'apps/api/src/modules/territories/territories.feed.ts',
  migration: 'apps/api/prisma/migrations/20260909033000_national_territory_platform_phase7a/migration.sql',
  assurance: 'apps/api/prisma/migrations/20260909033500_territory_assurance_guard_phase7a/migration.sql',
  reset: 'apps/api/prisma/migrations/20260909033600_territory_selection_assurance_reset/migration.sql',
  voterRoll: 'apps/api/prisma/migrations/20260909033800_national_voter_roll_territory_interlock/migration.sql',
  provider: 'apps/web/components/dashboard/DashboardIdentityProvider.tsx',
  page: 'apps/web/app/dashboard/territory/page.tsx',
  integration: 'scripts/national-platform-integration.sql',
  docs: 'docs/engineering/NATIONAL_PLATFORM_READINESS_PHASE7A.md',
}

const content = Object.fromEntries(await Promise.all(
  Object.entries(files).map(async ([key, path]) => [key, await readFile(path, 'utf8')]),
))

function requireText(key, needle, message = `${key} missing ${needle}`) {
  if (!content[key].includes(needle)) throw new Error(message)
}

function forbidText(key, needle, message = `${key} must not include ${needle}`) {
  if (content[key].includes(needle)) throw new Error(message)
}

requireText('migration', 'CREATE TABLE IF NOT EXISTS territories')
requireText('migration', "('CO-MP-13001','13001','Cartagena de Indias','district'")
requireText('migration', "'CO-MP-11001','11001','Bogotá, D.C.'")
requireText('migration', 'legacy_locality_territories')
requireText('migration', 'snapshot_proposal_territory')
requireText('migration', 'snapshot_report_territory')
requireText('migration', 'snapshot_civic_action_territory')

requireText('assurance', 'territory_assurance_level')
requireText('assurance', "DEFAULT 'self_asserted'")
requireText('reset', 'reset_territory_assurance_on_selection')
requireText('reset', "NEW.territory_assurance_level := 0")
requireText('voterRoll', 'enforce_voter_roll_territory')
requireText('voterRoll', "IF p_scope = 'national' THEN")
requireText('voterRoll', "IF p_scope = 'city' THEN")
requireText('voterRoll', "ELSIF p_scope = 'regional' THEN")
requireText('voterRoll', 'c_assurance < 1')

requireText('app', "import { territoriesRoutes } from './modules/territories/territories.routes'")
requireText('app', "app.register(territoriesRoutes, { prefix: '/territories' })")
requireText('routes', "app.get('/activation/ranking'")
requireText('routes', "app.put('/me'")
requireText('routes', "app.get('/:code/feed'")
requireText('routes', 'requireSuperadmin')
requireText('routes', 'getNationalActivationRanking')

requireText('service', 'geoportal.dane.gov.co')
requireText('service', 'refreshDivipolaCatalogBestEffort')
requireText('service', "reason: 'fresh_catalog'")
requireText('service', "PRIMARY_TERRITORY_MUST_BE_MUNICIPAL")
requireText('index', "if (config.NODE_ENV === 'production')")
requireText('index', 'void refreshDivipolaCatalogBestEffort()')
// DANE is a best-effort catalog source, never a /health dependency.
forbidText('app', 'syncDivipolaCatalog', 'DANE sync must not participate in serving/release health checks')

// National ranking must be set-based. Reintroducing per-city getActivationMetrics
// calls would turn a full DIVIPOLA catalog into thousands of round-trips.
requireText('ranking', 'WITH citizen_metrics AS')
requireText('ranking', 'action_metrics AS')
requireText('ranking', "WHERE t.level IN ('municipality','district')")
forbidText('ranking', 'getActivationMetrics(')

// Activation scoring is intentionally civic/operational and financially neutral.
for (const forbidden of ['payment', 'donation_amount', 'payout', 'subscription_tier', 'kyc_status', 'wallet_balance']) {
  forbidText('ranking', forbidden, `Activation ranking must remain financially neutral (${forbidden})`)
}

requireText('feed', 'FROM civic_actions')
requireText('feed', 'FROM territorial_reports')
requireText('feed', 'FROM proposals')
requireText('provider', "?? 'Selecciona tu municipio'")
forbidText('provider', "?? 'Cartagena de Indias'", 'Dashboard must not invent Cartagena for unbound national users')
requireText('page', 'VÉRTICE está disponible para Colombia')
requireText('page', "apiFetch('/territories/me'")
requireText('page', 'no equivale a verificación de residencia')

for (const marker of ['NP-01', 'NP-02', 'NP-03', 'NP-04', 'NP-05', 'NP-06', 'NATIONAL_PLATFORM_INTEGRATION=PASS']) {
  requireText('integration', marker)
}
requireText('docs', 'VÉRTICE is a national civic platform for Colombia')
requireText('docs', 'CERTIFIED / GA Colombia')

console.log('NATIONAL_PLATFORM_SOURCE_CONTRACT=PASS')
