import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { getMyTerritory, getTerritory, type TerritoryRow } from './territories.service'

export const TERRITORY_CONTEXT_SOURCES = ['manual', 'gps'] as const
export type TerritoryContextSource = typeof TERRITORY_CONTEXT_SOURCES[number]

export interface ActiveTerritoryContext {
  territory_code: string
  territory_name: string
  territory_level: 'municipality' | 'district'
  department_code: string | null
  department_name: string | null
  source: TerritoryContextSource | 'home_fallback'
  updated_at: Date | null
  is_home_fallback: boolean
}

interface ActiveContextRow {
  territory_code: string
  territory_name: string
  territory_level: 'municipality' | 'district'
  department_code: string | null
  department_name: string | null
  source: TerritoryContextSource
  updated_at: Date
}

function territoryError(message: string, code: string) {
  return Object.assign(new Error(message), { statusCode: 400, code })
}

export async function assertColombianMunicipalTerritory(code: string): Promise<TerritoryRow> {
  const territory = await getTerritory(code)
  if (territory.country_code !== 'CO') {
    throw territoryError('Vértice sólo admite territorios de Colombia para contribuciones cívicas.', 'TERRITORY_OUTSIDE_COLOMBIA')
  }
  if (territory.level !== 'municipality' && territory.level !== 'district') {
    throw territoryError('Selecciona un municipio o distrito colombiano.', 'TERRITORY_MUNICIPAL_LEVEL_REQUIRED')
  }
  return territory
}

/**
 * Coarse country envelope used only as a defensive sanity check for explicit
 * report targets. It includes the Colombian islands used by civilian devices;
 * it is not a substitute for DANE municipal polygons.
 */
export function isWithinColombiaEnvelope(lat: number, lng: number): boolean {
  return Number.isFinite(lat)
    && Number.isFinite(lng)
    && lat >= -4.5
    && lat <= 13.7
    && lng >= -82.2
    && lng <= -66.7
}

export async function getCitizenTerritoryContext(citizenId: string) {
  const home = await getMyTerritory(citizenId)
  const rows = await prisma.$queryRaw<ActiveContextRow[]>(Prisma.sql`
    SELECT
      ctx.active_territory_code AS territory_code,
      t.name AS territory_name,
      t.level AS territory_level,
      d.code AS department_code,
      d.name AS department_name,
      ctx.source,
      ctx.updated_at
    FROM citizen_territory_contexts ctx
    JOIN territories t ON t.code = ctx.active_territory_code
    LEFT JOIN territories d ON d.code = t.parent_code AND d.level = 'department'
    WHERE ctx.citizen_id = ${citizenId}::uuid
    LIMIT 1
  `)

  let active: ActiveTerritoryContext | null = rows[0]
    ? { ...rows[0], is_home_fallback: false }
    : null

  if (!active && home.territory_code && home.territory_name
      && (home.territory_level === 'municipality' || home.territory_level === 'district')) {
    active = {
      territory_code: home.territory_code,
      territory_name: home.territory_name,
      territory_level: home.territory_level,
      department_code: home.department_code,
      department_name: home.department_name,
      source: 'home_fallback',
      updated_at: null,
      is_home_fallback: true,
    }
  }

  return {
    home: {
      ...home,
      context_role: 'home' as const,
    },
    active,
    policy: {
      home_changes_on_travel: false,
      active_context_grants_governance_authority: false,
      contribution_target_may_differ_from_home: true,
      raw_gps_persisted_in_context: false,
    },
  }
}

export async function setActiveTerritoryContext(
  citizenId: string,
  territoryCode: string,
  source: TerritoryContextSource,
) {
  const territory = await assertColombianMunicipalTerritory(territoryCode)
  await prisma.$queryRaw(Prisma.sql`
    INSERT INTO citizen_territory_contexts (
      citizen_id, active_territory_code, source, updated_at
    ) VALUES (
      ${citizenId}::uuid, ${territory.code}, ${source}, NOW()
    )
    ON CONFLICT (citizen_id) DO UPDATE SET
      active_territory_code = EXCLUDED.active_territory_code,
      source = EXCLUDED.source,
      updated_at = NOW()
    RETURNING citizen_id
  `)
  return getCitizenTerritoryContext(citizenId)
}
