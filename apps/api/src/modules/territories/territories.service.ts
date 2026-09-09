import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { logger } from '../../lib/logger'
import { recordAuditEvent } from '../../lib/audit'

export const TERRITORY_LEVELS = [
  'country', 'department', 'municipality', 'district', 'locality', 'commune', 'neighborhood', 'vereda',
] as const
export const ACTIVATION_STATUSES = [
  'available', 'emerging', 'community_active', 'pilot_ready', 'verified_network',
] as const

export type TerritoryLevel = typeof TERRITORY_LEVELS[number]
export type ActivationStatus = typeof ACTIVATION_STATUSES[number]

export interface TerritoryRow {
  code: string
  external_code: string | null
  name: string
  level: TerritoryLevel
  parent_code: string | null
  country_code: string
  slug: string
  activation_status: ActivationStatus
  source: string
  source_version: string | null
  activated_at: Date | null
}

export interface ActivationMetrics {
  territory_code: string
  registered_citizens: number
  active_citizens_30d: number
  civic_actions_30d: number
  verified_actions_90d: number
  reports_30d: number
  proposals_30d: number
  momentum_score: number
  recommended_status: ActivationStatus
}

const DANE_SOURCE = 'dane_divipola'
const DANE_SOURCE_VERSION = 'MGN_2025'
const DANE_MUNICIPALITY_URL = 'https://geoportal.dane.gov.co/mparcgis/rest/services/Divipola/Serv_DIVIPOLA_MGN_2025/FeatureServer/317/query?where=1%3D1&outFields=DPTO_CCDGO%2CDPTO_CNMBRE%2CMPIO_CDPMP%2CMPIO_CNMBRE%2CMPIO_TIPO%2CMPIO_NANO&returnGeometry=false&orderByFields=MPIO_CDPMP&f=json'
const SYNC_FRESH_MS = 24 * 60 * 60 * 1000
const SYNC_TIMEOUT_MS = 20_000

function makeError(message: string, statusCode: number, code: string): Error {
  return Object.assign(new Error(message), { statusCode, code })
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function recommendation(score: number): ActivationStatus {
  if (score >= 85) return 'verified_network'
  if (score >= 65) return 'pilot_ready'
  if (score >= 40) return 'community_active'
  if (score >= 20) return 'emerging'
  return 'available'
}

function scoreMetrics(input: Omit<ActivationMetrics, 'territory_code' | 'momentum_score' | 'recommended_status'>): number {
  return Math.min(100,
    Math.min(25, input.registered_citizens * 2)
    + Math.min(20, input.active_citizens_30d * 3)
    + Math.min(20, input.civic_actions_30d * 4)
    + Math.min(15, input.verified_actions_90d * 5)
    + Math.min(10, input.reports_30d * 2)
    + Math.min(10, input.proposals_30d * 2),
  )
}

export async function listTerritories(filters: {
  level?: TerritoryLevel
  parent_code?: string
  activation_status?: ActivationStatus
  q?: string
  limit: number
  offset: number
}): Promise<TerritoryRow[]> {
  const conditions: Prisma.Sql[] = []
  if (filters.level) conditions.push(Prisma.sql`t.level = ${filters.level}`)
  if (filters.parent_code) conditions.push(Prisma.sql`t.parent_code = ${filters.parent_code}`)
  if (filters.activation_status) conditions.push(Prisma.sql`t.activation_status = ${filters.activation_status}`)
  if (filters.q) conditions.push(Prisma.sql`(t.name ILIKE ${`%${filters.q}%`} OR t.external_code = ${filters.q})`)
  const where = conditions.length ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}` : Prisma.empty

  return prisma.$queryRaw<TerritoryRow[]>(Prisma.sql`
    SELECT code, external_code, name, level, parent_code, country_code, slug,
           activation_status, source, source_version, activated_at
    FROM territories t
    ${where}
    ORDER BY
      CASE t.activation_status
        WHEN 'verified_network' THEN 5 WHEN 'pilot_ready' THEN 4
        WHEN 'community_active' THEN 3 WHEN 'emerging' THEN 2 ELSE 1 END DESC,
      t.name ASC
    LIMIT ${filters.limit} OFFSET ${filters.offset}
  `)
}

export async function getTerritory(code: string): Promise<TerritoryRow> {
  const rows = await prisma.$queryRaw<TerritoryRow[]>(Prisma.sql`
    SELECT code, external_code, name, level, parent_code, country_code, slug,
           activation_status, source, source_version, activated_at
    FROM territories WHERE code = ${code}
  `)
  if (!rows[0]) throw makeError('Territorio no encontrado', 404, 'TERRITORY_NOT_FOUND')
  return rows[0]
}

export async function getMyTerritory(citizenId: string) {
  const rows = await prisma.$queryRaw<Array<{
    territory_code: string | null
    neighborhood: string | null
    locality_id: number | null
    territory_name: string | null
    territory_level: string | null
    activation_status: string | null
    department_code: string | null
    department_name: string | null
  }>>(Prisma.sql`
    SELECT c.territory_code, c.neighborhood, c.locality_id,
           t.name AS territory_name, t.level AS territory_level,
           t.activation_status,
           d.code AS department_code, d.name AS department_name
    FROM citizens c
    LEFT JOIN territories t ON t.code = c.territory_code
    LEFT JOIN territories d ON d.code = t.parent_code AND d.level = 'department'
    WHERE c.id = ${citizenId}::uuid
  `)
  if (!rows[0]) throw makeError('Ciudadano no encontrado', 404, 'CITIZEN_NOT_FOUND')
  return rows[0]
}

export async function setMyTerritory(citizenId: string, territoryCode: string, neighborhood?: string | null) {
  const territory = await getTerritory(territoryCode)
  if (!['municipality', 'district'].includes(territory.level)) {
    throw makeError('Selecciona un municipio o distrito colombiano', 400, 'PRIMARY_TERRITORY_MUST_BE_MUNICIPAL')
  }
  if (territory.country_code !== 'CO') {
    throw makeError('Phase 7A admite únicamente territorios de Colombia', 400, 'COUNTRY_NOT_SUPPORTED')
  }

  const rows = await prisma.$queryRaw<Array<{
    territory_code: string
    neighborhood: string | null
    locality_id: number | null
  }>>(Prisma.sql`
    UPDATE citizens
    SET territory_code = ${territory.code},
        locality_id = CASE WHEN ${territory.code} = 'CO-MP-13001' THEN locality_id ELSE NULL END,
        neighborhood = ${neighborhood?.trim() || null},
        last_active_at = NOW()
    WHERE id = ${citizenId}::uuid
    RETURNING territory_code, neighborhood, locality_id
  `)
  if (!rows[0]) throw makeError('Ciudadano no encontrado', 404, 'CITIZEN_NOT_FOUND')
  return { ...rows[0], territory }
}

async function rawActivationMetrics(territoryCode: string) {
  const rows = await prisma.$queryRaw<Array<{
    registered_citizens: bigint
    active_citizens_30d: bigint
    civic_actions_30d: bigint
    verified_actions_90d: bigint
    reports_30d: bigint
    proposals_30d: bigint
  }>>(Prisma.sql`
    SELECT
      (SELECT COUNT(*) FROM citizens c WHERE c.territory_code = ${territoryCode}) AS registered_citizens,
      (SELECT COUNT(*) FROM citizens c WHERE c.territory_code = ${territoryCode}
        AND c.is_active = TRUE AND c.last_active_at >= NOW() - INTERVAL '30 days') AS active_citizens_30d,
      (SELECT COUNT(*) FROM civic_actions a WHERE a.territory_code = ${territoryCode}
        AND a.created_at >= NOW() - INTERVAL '30 days' AND a.status <> 'cancelled') AS civic_actions_30d,
      (SELECT COUNT(*) FROM civic_actions a WHERE a.territory_code = ${territoryCode}
        AND a.created_at >= NOW() - INTERVAL '90 days' AND a.status = 'verified') AS verified_actions_90d,
      (SELECT COUNT(*) FROM territorial_reports r WHERE r.territory_code = ${territoryCode}
        AND r.created_at >= NOW() - INTERVAL '30 days') AS reports_30d,
      (SELECT COUNT(*) FROM proposals p WHERE p.territory_code = ${territoryCode}
        AND p.created_at >= NOW() - INTERVAL '30 days' AND p.status <> 'archived') AS proposals_30d
  `)
  const row = rows[0]
  return {
    registered_citizens: Number(row?.registered_citizens ?? 0),
    active_citizens_30d: Number(row?.active_citizens_30d ?? 0),
    civic_actions_30d: Number(row?.civic_actions_30d ?? 0),
    verified_actions_90d: Number(row?.verified_actions_90d ?? 0),
    reports_30d: Number(row?.reports_30d ?? 0),
    proposals_30d: Number(row?.proposals_30d ?? 0),
  }
}

export async function getActivationMetrics(territoryCode: string): Promise<ActivationMetrics> {
  const territory = await getTerritory(territoryCode)
  if (!['municipality', 'district'].includes(territory.level)) {
    throw makeError('El Activation Engine opera a nivel municipal/distrital', 400, 'ACTIVATION_LEVEL_UNSUPPORTED')
  }
  const raw = await rawActivationMetrics(territoryCode)
  const momentumScore = scoreMetrics(raw)
  return {
    territory_code: territoryCode,
    ...raw,
    momentum_score: momentumScore,
    recommended_status: recommendation(momentumScore),
  }
}

export async function getActivationRanking(limit = 25) {
  const territories = await listTerritories({ level: undefined, limit: 2000, offset: 0 })
  const municipalities = territories.filter((territory) => ['municipality', 'district'].includes(territory.level))
  const rows: Array<TerritoryRow & ActivationMetrics> = []
  for (const territory of municipalities) {
    const metrics = await getActivationMetrics(territory.code)
    rows.push({ ...territory, ...metrics })
  }
  return rows
    .sort((a, b) => b.momentum_score - a.momentum_score || a.name.localeCompare(b.name, 'es'))
    .slice(0, Math.max(1, Math.min(limit, 100)))
}

export async function setActivationStatus(params: {
  actorId: string
  territoryCode: string
  status: ActivationStatus
  reason: string
}) {
  const territory = await getTerritory(params.territoryCode)
  if (!['municipality', 'district'].includes(territory.level)) {
    throw makeError('Solo municipios/distritos pueden cambiar de estado de activación', 400, 'ACTIVATION_LEVEL_UNSUPPORTED')
  }
  const metrics = await getActivationMetrics(params.territoryCode)
  const rows = await prisma.$queryRaw<TerritoryRow[]>(Prisma.sql`
    UPDATE territories
    SET activation_status = ${params.status},
        activated_at = CASE WHEN ${params.status} IN ('pilot_ready','verified_network') THEN COALESCE(activated_at, NOW()) ELSE activated_at END,
        updated_at = NOW()
    WHERE code = ${params.territoryCode}
    RETURNING code, external_code, name, level, parent_code, country_code, slug,
              activation_status, source, source_version, activated_at
  `)
  await recordAuditEvent({
    actorId: params.actorId,
    action: 'territory_activation_status_changed',
    targetType: 'territory',
    targetId: params.territoryCode,
    result: params.status,
    reason: params.reason,
    metadata: { previous_status: territory.activation_status, metrics },
  })
  return { territory: rows[0], metrics }
}

interface DaneMunicipalityAttributes {
  DPTO_CCDGO?: string
  DPTO_CNMBRE?: string
  MPIO_CDPMP?: string
  MPIO_CNMBRE?: string
  MPIO_TIPO?: string
  MPIO_NANO?: string | number
}

function validateDaneFeature(attributes: DaneMunicipalityAttributes) {
  const departmentCode = String(attributes.DPTO_CCDGO ?? '').padStart(2, '0')
  const municipalityCode = String(attributes.MPIO_CDPMP ?? '').padStart(5, '0')
  const departmentName = String(attributes.DPTO_CNMBRE ?? '').trim()
  const municipalityName = String(attributes.MPIO_CNMBRE ?? '').trim()
  if (!/^\d{2}$/.test(departmentCode) || !/^\d{5}$/.test(municipalityCode) || !departmentName || !municipalityName) return null
  if (!municipalityCode.startsWith(departmentCode)) return null
  const typeText = String(attributes.MPIO_TIPO ?? '')
  return {
    departmentCode,
    municipalityCode,
    departmentName,
    municipalityName,
    level: /distrit/i.test(typeText) ? 'district' as const : 'municipality' as const,
    sourceYear: attributes.MPIO_NANO ? String(attributes.MPIO_NANO) : null,
    typeText: typeText || null,
  }
}

export async function syncDivipolaCatalog(options: { force?: boolean } = {}) {
  if (!options.force) {
    const recent = await prisma.$queryRaw<Array<{ completed_at: Date }>>(Prisma.sql`
      SELECT completed_at FROM territory_catalog_sync_runs
      WHERE provider = ${DANE_SOURCE} AND status = 'succeeded' AND completed_at IS NOT NULL
      ORDER BY completed_at DESC LIMIT 1
    `)
    if (recent[0]?.completed_at && Date.now() - recent[0].completed_at.getTime() < SYNC_FRESH_MS) {
      return { skipped: true, reason: 'fresh_catalog', last_synced_at: recent[0].completed_at }
    }
  }

  const runRows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    INSERT INTO territory_catalog_sync_runs (provider, source_version, status)
    VALUES (${DANE_SOURCE}, ${DANE_SOURCE_VERSION}, 'running')
    RETURNING id::text
  `)
  const runId = runRows[0]?.id
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS)

  try {
    const response = await fetch(DANE_MUNICIPALITY_URL, {
      headers: { accept: 'application/json', 'user-agent': 'vertice-os-divipola-sync/1.0' },
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`DANE DIVIPOLA responded ${response.status}`)
    const payload = await response.json() as { features?: Array<{ attributes?: DaneMunicipalityAttributes }>; error?: unknown }
    if (!Array.isArray(payload.features)) throw new Error('DANE DIVIPOLA payload has no features array')

    const normalized = payload.features
      .map((feature) => validateDaneFeature(feature.attributes ?? {}))
      .filter((row): row is NonNullable<typeof row> => row !== null)
    if (normalized.length < 500) throw new Error(`DANE DIVIPOLA returned an unexpectedly small catalog (${normalized.length})`)

    const departments = new Map<string, string>()
    normalized.forEach((row) => departments.set(row.departmentCode, row.departmentName))

    for (const [code, name] of departments) {
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO territories (code, external_code, name, level, parent_code, slug, source, source_version)
        VALUES (${`CO-DP-${code}`}, ${code}, ${name}, 'department', 'CO', ${slugify(name)}, ${DANE_SOURCE}, ${DANE_SOURCE_VERSION})
        ON CONFLICT (code) DO UPDATE SET
          external_code = EXCLUDED.external_code,
          name = EXCLUDED.name,
          source = EXCLUDED.source,
          source_version = EXCLUDED.source_version,
          updated_at = NOW()
      `)
    }

    let upserted = 0
    for (const row of normalized) {
      const internalCode = `CO-MP-${row.municipalityCode}`
      const slug = `${slugify(row.municipalityName)}-${row.municipalityCode}`
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO territories (code, external_code, name, level, parent_code, slug, source, source_version, metadata)
        VALUES (
          ${internalCode}, ${row.municipalityCode}, ${row.municipalityName}, ${row.level},
          ${`CO-DP-${row.departmentCode}`}, ${slug}, ${DANE_SOURCE}, ${DANE_SOURCE_VERSION},
          ${JSON.stringify({ dane_type: row.typeText, source_year: row.sourceYear })}::jsonb
        )
        ON CONFLICT (code) DO UPDATE SET
          external_code = EXCLUDED.external_code,
          name = EXCLUDED.name,
          level = EXCLUDED.level,
          parent_code = EXCLUDED.parent_code,
          source = EXCLUDED.source,
          source_version = EXCLUDED.source_version,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
      `)
      upserted += 1
    }

    if (runId) {
      await prisma.$executeRaw(Prisma.sql`
        UPDATE territory_catalog_sync_runs
        SET status = 'succeeded', records_seen = ${payload.features.length}, records_upserted = ${upserted}, completed_at = NOW()
        WHERE id = ${runId}::uuid
      `)
    }
    return { skipped: false, records_seen: payload.features.length, records_upserted: upserted, source_version: DANE_SOURCE_VERSION }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (runId) {
      await prisma.$executeRaw(Prisma.sql`
        UPDATE territory_catalog_sync_runs
        SET status = 'failed', error = ${message.slice(0, 4000)}, completed_at = NOW()
        WHERE id = ${runId}::uuid
      `).catch(() => undefined)
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

export async function refreshDivipolaCatalogBestEffort(): Promise<void> {
  try {
    const result = await syncDivipolaCatalog()
    logger.info('[territories] DIVIPOLA catalog refresh', result)
  } catch (error) {
    logger.warn('[territories] DIVIPOLA refresh unavailable; bootstrap catalog remains active', error)
  }
}
