import { createHash } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { isWithinColombiaEnvelope } from './territory-context.service'
import { syncDivipolaCatalog } from './territories.service'

const DANE_BOUNDARY_SOURCE = 'dane_mgn'
const DANE_BOUNDARY_VERSION = 'MGN_2025'
const DANE_MUNICIPALITY_BOUNDARY_URL = 'https://geoportal.dane.gov.co/mparcgis/rest/services/Divipola/Serv_DIVIPOLA_MGN_2025/FeatureServer/317/query?where=1%3D1&outFields=DPTO_CCDGO%2CDPTO_CNMBRE%2CMPIO_CDPMP%2CMPIO_CNMBRE%2CMPIO_TIPO%2CMPIO_NANO&returnGeometry=true&outSR=4326&geometryPrecision=6&maxAllowableOffset=0.00003&orderByFields=MPIO_CDPMP&f=geojson'
const BOUNDARY_SYNC_TIMEOUT_MS = 60_000
const BOUNDARY_SYNC_FRESH_MS = 7 * 24 * 60 * 60 * 1000
export const DEFAULT_BORDER_TOLERANCE_METERS = 150

interface GeoJsonGeometry {
  type: string
  coordinates: unknown
}

interface GeoJsonFeature {
  type?: string
  properties?: Record<string, unknown> | null
  geometry?: GeoJsonGeometry | null
}

interface GeoJsonFeatureCollection {
  type?: string
  features?: GeoJsonFeature[]
}

export interface TerritoryBoundaryCandidate {
  code: string
  external_code: string | null
  name: string
  level: 'municipality' | 'district'
  parent_code: string | null
  country_code: string
  activation_status: string
  department_code: string | null
  department_name: string | null
  distance_meters: number
}

export type TerritoryPointResolution =
  | {
      status: 'matched' | 'near_border'
      territory: TerritoryBoundaryCandidate
      boundary_source_version: string
      distance_meters: number
    }
  | {
      status: 'ambiguous_border'
      candidates: TerritoryBoundaryCandidate[]
      boundary_source_version: string | null
    }
  | { status: 'outside_colombia' }
  | { status: 'catalog_unavailable' }
  | { status: 'unresolved' }

export type TerritoryPointVerification =
  | { status: 'polygon_verified'; source_version: string; distance_meters: 0 }
  | { status: 'border_tolerance'; source_version: string; distance_meters: number }
  | { status: 'catalog_unavailable'; source_version: null; distance_meters: null }
  | { status: 'mismatch'; source_version: string; distance_meters: number }

interface BoundaryRow {
  territory_code: string
  external_code: string | null
  territory_name: string
  territory_level: 'municipality' | 'district'
  parent_code: string | null
  country_code: string
  activation_status: string
  department_code: string | null
  department_name: string | null
  source_version: string
  distance_meters: number
}

function propertyValue(properties: Record<string, unknown>, key: string): unknown {
  return properties[key] ?? properties[key.toLowerCase()]
}

function normalizeBoundaryFeature(feature: GeoJsonFeature) {
  const properties = feature.properties ?? {}
  const municipalityCode = String(propertyValue(properties, 'MPIO_CDPMP') ?? '').padStart(5, '0')
  const geometry = feature.geometry
  if (!/^\d{5}$/.test(municipalityCode)) return null
  if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type)) return null
  if (!Array.isArray(geometry.coordinates)) return null

  return {
    territoryCode: `CO-MP-${municipalityCode}`,
    geometryJson: JSON.stringify(geometry),
  }
}

function toCandidate(row: BoundaryRow): TerritoryBoundaryCandidate {
  return {
    code: row.territory_code,
    external_code: row.external_code,
    name: row.territory_name,
    level: row.territory_level,
    parent_code: row.parent_code,
    country_code: row.country_code,
    activation_status: row.activation_status,
    department_code: row.department_code,
    department_name: row.department_name,
    distance_meters: Number(row.distance_meters),
  }
}

async function upsertBoundary(territoryCode: string, geometryJson: string): Promise<number> {
  const checksum = createHash('sha256').update(geometryJson).digest('hex')
  return prisma.$executeRaw(Prisma.sql`
    WITH prepared AS (
      SELECT ST_Multi(
        ST_CollectionExtract(
          ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(${geometryJson}), 4326)),
          3
        )
      )::geometry(MultiPolygon, 4326) AS geom
    )
    INSERT INTO territory_boundaries (
      territory_code,
      geometry,
      source,
      source_version,
      source_checksum,
      area_sq_km,
      synced_at
    )
    SELECT
      t.code,
      p.geom,
      ${DANE_BOUNDARY_SOURCE},
      ${DANE_BOUNDARY_VERSION},
      ${checksum},
      (ST_Area(p.geom::geography) / 1000000.0)::numeric(14, 3),
      NOW()
    FROM territories t
    CROSS JOIN prepared p
    WHERE t.code = ${territoryCode}
      AND t.country_code = 'CO'
      AND t.level IN ('municipality', 'district')
      AND NOT ST_IsEmpty(p.geom)
    ON CONFLICT (territory_code) DO UPDATE SET
      geometry = EXCLUDED.geometry,
      source = EXCLUDED.source,
      source_version = EXCLUDED.source_version,
      source_checksum = EXCLUDED.source_checksum,
      area_sq_km = EXCLUDED.area_sq_km,
      synced_at = NOW()
  `)
}

export async function getBoundaryCatalogStatus() {
  const rows = await prisma.$queryRaw<Array<{
    boundary_count: bigint
    source_version: string | null
    last_synced_at: Date | null
  }>>(Prisma.sql`
    SELECT
      COUNT(*) AS boundary_count,
      MAX(source_version) AS source_version,
      MAX(synced_at) AS last_synced_at
    FROM territory_boundaries
  `)
  const row = rows[0]
  return {
    boundary_count: Number(row?.boundary_count ?? 0),
    source: DANE_BOUNDARY_SOURCE,
    source_version: row?.source_version ?? null,
    last_synced_at: row?.last_synced_at ?? null,
    point_in_polygon_ready: Number(row?.boundary_count ?? 0) >= 500,
    default_border_tolerance_meters: DEFAULT_BORDER_TOLERANCE_METERS,
  }
}

export async function syncDaneMunicipalBoundaries(options: { force?: boolean } = {}) {
  if (!options.force) {
    const recent = await prisma.$queryRaw<Array<{ completed_at: Date }>>(Prisma.sql`
      SELECT completed_at
      FROM territory_boundary_sync_runs
      WHERE provider = ${DANE_BOUNDARY_SOURCE}
        AND status = 'succeeded'
        AND completed_at IS NOT NULL
      ORDER BY completed_at DESC
      LIMIT 1
    `)
    if (recent[0]?.completed_at
      && Date.now() - recent[0].completed_at.getTime() < BOUNDARY_SYNC_FRESH_MS) {
      return {
        skipped: true,
        reason: 'fresh_boundaries',
        last_synced_at: recent[0].completed_at,
        ...(await getBoundaryCatalogStatus()),
      }
    }
  }

  // Ensure canonical DIVIPOLA nodes exist before attaching geometries.
  await syncDivipolaCatalog({ force: false })

  const runRows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    INSERT INTO territory_boundary_sync_runs (provider, source_version, status)
    VALUES (${DANE_BOUNDARY_SOURCE}, ${DANE_BOUNDARY_VERSION}, 'running')
    RETURNING id::text
  `)
  const runId = runRows[0]?.id
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), BOUNDARY_SYNC_TIMEOUT_MS)

  try {
    const response = await fetch(DANE_MUNICIPALITY_BOUNDARY_URL, {
      headers: {
        accept: 'application/geo+json, application/json',
        'user-agent': 'vertice-os-boundary-sync/1.0',
      },
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`DANE municipal boundary service responded ${response.status}`)

    const payload = await response.json() as GeoJsonFeatureCollection
    if (payload.type !== 'FeatureCollection' || !Array.isArray(payload.features)) {
      throw new Error('DANE boundary payload is not a GeoJSON FeatureCollection')
    }
    if (payload.features.length < 500) {
      throw new Error(`DANE boundary payload is unexpectedly small (${payload.features.length})`)
    }

    const normalized = payload.features
      .map(normalizeBoundaryFeature)
      .filter((feature): feature is NonNullable<typeof feature> => feature !== null)

    let upserted = 0
    let skipped = payload.features.length - normalized.length
    const batchSize = 10
    for (let index = 0; index < normalized.length; index += batchSize) {
      const batch = normalized.slice(index, index + batchSize)
      const results = await Promise.allSettled(batch.map((feature) =>
        upsertBoundary(feature.territoryCode, feature.geometryJson),
      ))
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value > 0) upserted += result.value
        else skipped += 1
      }
    }

    if (upserted < 500) {
      throw new Error(`Only ${upserted} municipal boundaries were persisted; refusing to certify the catalog`)
    }

    if (runId) {
      await prisma.$executeRaw(Prisma.sql`
        UPDATE territory_boundary_sync_runs
        SET status = 'succeeded',
            features_seen = ${payload.features.length},
            features_upserted = ${upserted},
            features_skipped = ${skipped},
            completed_at = NOW()
        WHERE id = ${runId}::uuid
      `)
    }

    return {
      skipped: false,
      features_seen: payload.features.length,
      features_upserted: upserted,
      features_skipped: skipped,
      ...(await getBoundaryCatalogStatus()),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (runId) {
      await prisma.$executeRaw(Prisma.sql`
        UPDATE territory_boundary_sync_runs
        SET status = 'failed', error = ${message.slice(0, 4000)}, completed_at = NOW()
        WHERE id = ${runId}::uuid
      `).catch(() => undefined)
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

export async function verifyTerritoryPoint(
  territoryCode: string,
  lat: number,
  lng: number,
  toleranceMeters = DEFAULT_BORDER_TOLERANCE_METERS,
): Promise<TerritoryPointVerification> {
  const rows = await prisma.$queryRaw<Array<{
    source_version: string
    inside: boolean
    distance_meters: number
  }>>(Prisma.sql`
    WITH point AS (
      SELECT ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326) AS geom
    )
    SELECT
      b.source_version,
      ST_Covers(b.geometry, p.geom) AS inside,
      ST_Distance(b.geometry::geography, p.geom::geography)::float8 AS distance_meters
    FROM territory_boundaries b
    CROSS JOIN point p
    WHERE b.territory_code = ${territoryCode}
    LIMIT 1
  `)

  const row = rows[0]
  if (!row) return { status: 'catalog_unavailable', source_version: null, distance_meters: null }
  if (row.inside) return { status: 'polygon_verified', source_version: row.source_version, distance_meters: 0 }

  const distance = Number(row.distance_meters)
  if (distance <= toleranceMeters) {
    return { status: 'border_tolerance', source_version: row.source_version, distance_meters: distance }
  }
  return { status: 'mismatch', source_version: row.source_version, distance_meters: distance }
}

export async function resolveTerritoryByPoint(
  lat: number,
  lng: number,
  toleranceMeters = DEFAULT_BORDER_TOLERANCE_METERS,
): Promise<TerritoryPointResolution> {
  if (!isWithinColombiaEnvelope(lat, lng)) return { status: 'outside_colombia' }

  const exactRows = await prisma.$queryRaw<BoundaryRow[]>(Prisma.sql`
    WITH point AS (
      SELECT ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326) AS geom
    )
    SELECT
      b.territory_code,
      t.external_code,
      t.name AS territory_name,
      t.level AS territory_level,
      t.parent_code,
      t.country_code,
      t.activation_status,
      d.code AS department_code,
      d.name AS department_name,
      b.source_version,
      0::float8 AS distance_meters
    FROM territory_boundaries b
    JOIN territories t ON t.code = b.territory_code
    LEFT JOIN territories d ON d.code = t.parent_code AND d.level = 'department'
    CROSS JOIN point p
    WHERE ST_Covers(b.geometry, p.geom)
      AND t.country_code = 'CO'
      AND t.level IN ('municipality', 'district')
    ORDER BY ST_Area(b.geometry::geography) ASC
    LIMIT 3
  `)

  if (exactRows.length === 1) {
    return {
      status: 'matched',
      territory: toCandidate(exactRows[0]),
      boundary_source_version: exactRows[0].source_version,
      distance_meters: 0,
    }
  }
  if (exactRows.length > 1) {
    return {
      status: 'ambiguous_border',
      candidates: exactRows.map(toCandidate),
      boundary_source_version: exactRows[0]?.source_version ?? null,
    }
  }

  const nearbyRows = await prisma.$queryRaw<BoundaryRow[]>(Prisma.sql`
    WITH point AS (
      SELECT ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326) AS geom
    )
    SELECT
      b.territory_code,
      t.external_code,
      t.name AS territory_name,
      t.level AS territory_level,
      t.parent_code,
      t.country_code,
      t.activation_status,
      d.code AS department_code,
      d.name AS department_name,
      b.source_version,
      ST_Distance(b.geometry::geography, p.geom::geography)::float8 AS distance_meters
    FROM territory_boundaries b
    JOIN territories t ON t.code = b.territory_code
    LEFT JOIN territories d ON d.code = t.parent_code AND d.level = 'department'
    CROSS JOIN point p
    WHERE ST_DWithin(b.geometry::geography, p.geom::geography, ${toleranceMeters})
      AND t.country_code = 'CO'
      AND t.level IN ('municipality', 'district')
    ORDER BY distance_meters ASC, t.code ASC
    LIMIT 4
  `)

  if (nearbyRows.length === 1) {
    const row = nearbyRows[0]
    return {
      status: 'near_border',
      territory: toCandidate(row),
      boundary_source_version: row.source_version,
      distance_meters: Number(row.distance_meters),
    }
  }
  if (nearbyRows.length > 1) {
    return {
      status: 'ambiguous_border',
      candidates: nearbyRows.map(toCandidate),
      boundary_source_version: nearbyRows[0]?.source_version ?? null,
    }
  }

  const availability = await prisma.$queryRaw<Array<{ available: boolean }>>(Prisma.sql`
    SELECT EXISTS (SELECT 1 FROM territory_boundaries LIMIT 1) AS available
  `)
  if (!availability[0]?.available) return { status: 'catalog_unavailable' }
  return { status: 'unresolved' }
}
