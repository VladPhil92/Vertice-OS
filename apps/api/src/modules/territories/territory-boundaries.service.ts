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
const MIN_EXPECTED_MUNICIPAL_BOUNDARIES = 500
const STAGING_BATCH_SIZE = 25
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

interface NormalizedBoundaryFeature {
  territory_code: string
  geometry_json: string
  source_checksum: string
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

function normalizeBoundaryFeature(feature: GeoJsonFeature): NormalizedBoundaryFeature | null {
  const properties = feature.properties ?? {}
  const municipalityCode = String(propertyValue(properties, 'MPIO_CDPMP') ?? '').padStart(5, '0')
  const geometry = feature.geometry
  if (!/^\d{5}$/.test(municipalityCode)) return null
  if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type)) return null
  if (!Array.isArray(geometry.coordinates)) return null

  const geometryJson = JSON.stringify(geometry)
  return {
    territory_code: `CO-MP-${municipalityCode}`,
    geometry_json: geometryJson,
    source_checksum: createHash('sha256').update(geometryJson).digest('hex'),
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

async function stageBoundaryBatch(
  tx: Prisma.TransactionClient,
  batch: NormalizedBoundaryFeature[],
): Promise<void> {
  const payload = JSON.stringify(batch)
  await tx.$executeRaw(Prisma.sql`
    WITH input AS (
      SELECT *
      FROM jsonb_to_recordset(${payload}::jsonb) AS x(
        territory_code text,
        geometry_json text,
        source_checksum text
      )
    ), prepared AS (
      SELECT
        i.territory_code,
        i.source_checksum,
        ST_Multi(
          ST_CollectionExtract(
            ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(i.geometry_json), 4326)),
            3
          )
        )::geometry(MultiPolygon, 4326) AS geometry
      FROM input i
    )
    INSERT INTO territory_boundary_stage (
      territory_code, geometry, source_checksum, area_sq_km
    )
    SELECT
      p.territory_code,
      p.geometry,
      p.source_checksum,
      (ST_Area(p.geometry::geography) / 1000000.0)::numeric(14, 3)
    FROM prepared p
    JOIN territories t ON t.code = p.territory_code
    WHERE t.country_code = 'CO'
      AND t.level IN ('municipality', 'district')
      AND NOT ST_IsEmpty(p.geometry)
    ON CONFLICT (territory_code) DO UPDATE SET
      geometry = EXCLUDED.geometry,
      source_checksum = EXCLUDED.source_checksum,
      area_sq_km = EXCLUDED.area_sq_km
  `)
}

export async function getBoundaryCatalogStatus() {
  const rows = await prisma.$queryRaw<Array<{
    boundary_count: bigint
    source_version: string | null
    last_synced_at: Date | null
    latest_features_seen: number | null
    latest_features_upserted: number | null
    latest_completed_at: Date | null
  }>>(Prisma.sql`
    WITH boundary_stats AS (
      SELECT
        COUNT(*) AS boundary_count,
        MAX(source_version) AS source_version,
        MAX(synced_at) AS last_synced_at
      FROM territory_boundaries
      WHERE source = ${DANE_BOUNDARY_SOURCE}
    ), latest_success AS (
      SELECT features_seen, features_upserted, completed_at
      FROM territory_boundary_sync_runs
      WHERE provider = ${DANE_BOUNDARY_SOURCE}
        AND status = 'succeeded'
        AND completed_at IS NOT NULL
      ORDER BY completed_at DESC
      LIMIT 1
    )
    SELECT
      bs.boundary_count,
      bs.source_version,
      bs.last_synced_at,
      ls.features_seen AS latest_features_seen,
      ls.features_upserted AS latest_features_upserted,
      ls.completed_at AS latest_completed_at
    FROM boundary_stats bs
    LEFT JOIN latest_success ls ON TRUE
  `)
  const row = rows[0]
  const boundaryCount = Number(row?.boundary_count ?? 0)
  const seen = Number(row?.latest_features_seen ?? 0)
  const upserted = Number(row?.latest_features_upserted ?? 0)
  const complete = seen >= MIN_EXPECTED_MUNICIPAL_BOUNDARIES
    && upserted === seen
    && boundaryCount === seen

  return {
    boundary_count: boundaryCount,
    source: DANE_BOUNDARY_SOURCE,
    source_version: row?.source_version ?? null,
    last_synced_at: row?.last_synced_at ?? null,
    latest_completed_at: row?.latest_completed_at ?? null,
    expected_feature_count: seen || null,
    point_in_polygon_ready: complete,
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
      const status = await getBoundaryCatalogStatus()
      if (status.point_in_polygon_ready) {
        return { skipped: true, reason: 'fresh_boundaries', ...status }
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
    if (payload.features.length < MIN_EXPECTED_MUNICIPAL_BOUNDARIES) {
      throw new Error(`DANE boundary payload is unexpectedly small (${payload.features.length})`)
    }

    const normalizedWithNulls = payload.features.map(normalizeBoundaryFeature)
    const invalidCount = normalizedWithNulls.filter((feature) => feature === null).length
    if (invalidCount > 0) {
      throw new Error(`DANE boundary payload contains ${invalidCount} invalid municipal geometries`)
    }
    const normalized = normalizedWithNulls.filter(
      (feature): feature is NormalizedBoundaryFeature => feature !== null,
    )
    const uniqueCodes = new Set(normalized.map((feature) => feature.territory_code))
    if (uniqueCodes.size !== normalized.length) {
      throw new Error('DANE boundary payload contains duplicate municipality codes')
    }

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`
        CREATE TEMP TABLE territory_boundary_stage (
          territory_code VARCHAR(32) PRIMARY KEY,
          geometry geometry(MultiPolygon, 4326) NOT NULL,
          source_checksum CHAR(64) NOT NULL,
          area_sq_km NUMERIC(14, 3)
        ) ON COMMIT DROP
      `)

      for (let index = 0; index < normalized.length; index += STAGING_BATCH_SIZE) {
        await stageBoundaryBatch(tx, normalized.slice(index, index + STAGING_BATCH_SIZE))
      }

      const stagedRows = await tx.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
        SELECT COUNT(*) AS count FROM territory_boundary_stage
      `)
      const stagedCount = Number(stagedRows[0]?.count ?? 0)
      if (stagedCount !== normalized.length) {
        throw new Error(
          `Boundary staging coverage mismatch: expected ${normalized.length}, staged ${stagedCount}`,
        )
      }

      // Publication is atomic: readers see either the previous complete catalog
      // or the new complete catalog, never a half-updated national boundary set.
      await tx.$executeRaw(Prisma.sql`
        DELETE FROM territory_boundaries b
        WHERE b.source = ${DANE_BOUNDARY_SOURCE}
          AND NOT EXISTS (
            SELECT 1 FROM territory_boundary_stage s
            WHERE s.territory_code = b.territory_code
          )
      `)
      await tx.$executeRaw(Prisma.sql`
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
          s.territory_code,
          s.geometry,
          ${DANE_BOUNDARY_SOURCE},
          ${DANE_BOUNDARY_VERSION},
          s.source_checksum,
          s.area_sq_km,
          NOW()
        FROM territory_boundary_stage s
        ON CONFLICT (territory_code) DO UPDATE SET
          geometry = EXCLUDED.geometry,
          source = EXCLUDED.source,
          source_version = EXCLUDED.source_version,
          source_checksum = EXCLUDED.source_checksum,
          area_sq_km = EXCLUDED.area_sq_km,
          synced_at = NOW()
      `)

      const publishedRows = await tx.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
        SELECT COUNT(*) AS count
        FROM territory_boundaries
        WHERE source = ${DANE_BOUNDARY_SOURCE}
      `)
      const publishedCount = Number(publishedRows[0]?.count ?? 0)
      if (publishedCount !== normalized.length) {
        throw new Error(
          `Boundary publication coverage mismatch: expected ${normalized.length}, published ${publishedCount}`,
        )
      }

      if (runId) {
        await tx.$executeRaw(Prisma.sql`
          UPDATE territory_boundary_sync_runs
          SET status = 'succeeded',
              features_seen = ${payload.features?.length ?? normalized.length},
              features_upserted = ${publishedCount},
              features_skipped = 0,
              completed_at = NOW()
          WHERE id = ${runId}::uuid
        `)
      }
    }, { maxWait: 10_000, timeout: 120_000 })

    return {
      skipped: false,
      features_seen: payload.features.length,
      features_upserted: normalized.length,
      features_skipped: 0,
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

  const catalogStatus = await getBoundaryCatalogStatus()
  if (!catalogStatus.point_in_polygon_ready) return { status: 'catalog_unavailable' }
  return { status: 'unresolved' }
}
