import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { getCache, setCache, delCache, TTL } from '../../lib/cache'
import { logger } from '../../lib/logger'
import { recordReputationEvent } from '../reputation/reputation.service'
import { publish } from '../../lib/pubsub'
import type {
  TerritorialReport,
  ReportSummary,
  NearbyReport,
  TerritorialStats,
  ReportRow,
  ReportCategory,
} from './territorial.types'
import type { CreateReportInput, ListReportsInput, NearbyInput, UpdateStatusInput } from './territorial.schema'

// ── Urgencia por defecto según categoría ─────────────────────────────────────

const DEFAULT_URGENCY: Record<ReportCategory, number> = {
  seguridad: 0.8,
  salud: 0.7,
  servicios_publicos: 0.6,
  infraestructura: 0.5,
  medio_ambiente: 0.5,
  transporte: 0.4,
  educacion: 0.3,
  cultura: 0.2,
  otro: 0.4,
}

// ── Transformador de fila DB → tipo API ───────────────────────────────────────

function rowToReport(row: ReportRow): TerritorialReport {
  return {
    id: row.id,
    citizen_id: row.citizen_id,
    category: row.category as TerritorialReport['category'],
    subcategory: row.subcategory,
    title: row.title,
    description: row.description,
    lat: Number(row.lat),
    lng: Number(row.lng),
    neighborhood: row.neighborhood,
    locality_id: row.locality_id !== null ? Number(row.locality_id) : null,
    address_reference: row.address_reference,
    urgency_score: row.urgency_score !== null ? Number(row.urgency_score) : null,
    status: row.status as TerritorialReport['status'],
    media_urls: row.media_urls ?? [],
    created_at: row.created_at,
    updated_at: row.updated_at,
    resolved_at: row.resolved_at,
  }
}

function rowToSummary(row: ReportRow): ReportSummary {
  return {
    id: row.id,
    category: row.category as ReportSummary['category'],
    title: row.title,
    lat: Number(row.lat),
    lng: Number(row.lng),
    neighborhood: row.neighborhood,
    status: row.status as ReportSummary['status'],
    urgency_score: row.urgency_score !== null ? Number(row.urgency_score) : null,
    created_at: row.created_at,
  }
}

// ── Crear reporte ─────────────────────────────────────────────────────────────

export async function createReport(
  citizenId: string,
  input: CreateReportInput
): Promise<TerritorialReport> {
  const urgency = input.urgency_score ?? DEFAULT_URGENCY[input.category]

  const rows = await prisma.$queryRaw<ReportRow[]>(Prisma.sql`
    INSERT INTO territorial_reports (
      citizen_id, category, subcategory, title, description,
      location, neighborhood, locality_id, address_reference,
      urgency_score, media_urls
    ) VALUES (
      ${citizenId}::uuid,
      ${input.category},
      ${input.subcategory ?? null},
      ${input.title},
      ${input.description},
      ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography,
      ${input.neighborhood ?? null},
      ${input.locality_id ?? null}::int,
      ${input.address_reference ?? null},
      ${urgency}::numeric,
      ${input.media_urls}
    )
    RETURNING
      id::text,
      citizen_id::text,
      category,
      subcategory,
      title,
      description,
      ST_X(location::geometry)::float8 AS lng,
      ST_Y(location::geometry)::float8 AS lat,
      neighborhood,
      locality_id,
      address_reference,
      urgency_score::float8,
      status,
      media_urls,
      created_at,
      updated_at,
      NULL::timestamptz AS resolved_at
  `)

  const report = rowToReport(rows[0])
  recordReputationEvent({ citizen_id: citizenId, event_type: 'report_submitted', reference_id: report.id })
    .catch((err: unknown) => logger.error('[territorial] reputation event failed', err))
  publish('territorial', 'report:created', {
    id: report.id, category: report.category, status: report.status,
    neighborhood: report.neighborhood, urgency_score: report.urgency_score,
  }).catch(() => null)
  return report
}

// ── Listar reportes ───────────────────────────────────────────────────────────

export async function listReports(input: ListReportsInput): Promise<ReportSummary[]> {
  const conditions: Prisma.Sql[] = []
  if (input.category) conditions.push(Prisma.sql`category = ${input.category}`)
  if (input.status) conditions.push(Prisma.sql`status = ${input.status}`)
  if (input.locality_id) conditions.push(Prisma.sql`locality_id = ${input.locality_id}`)

  const whereClause =
    conditions.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
      : Prisma.empty

  const rows = await prisma.$queryRaw<ReportRow[]>(Prisma.sql`
    SELECT
      id::text,
      category,
      title,
      ST_X(location::geometry)::float8 AS lng,
      ST_Y(location::geometry)::float8 AS lat,
      neighborhood,
      status,
      urgency_score::float8,
      created_at
    FROM territorial_reports
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT ${input.limit} OFFSET ${input.offset}
  `)

  return rows.map(rowToSummary)
}

// ── Reporte por ID ────────────────────────────────────────────────────────────

export async function getReportById(id: string): Promise<TerritorialReport> {
  const cached = await getCache<TerritorialReport>('report', id)
  if (cached) return cached

  const rows = await prisma.$queryRaw<ReportRow[]>(Prisma.sql`
    SELECT
      id::text,
      citizen_id::text,
      category,
      subcategory,
      title,
      description,
      ST_X(location::geometry)::float8 AS lng,
      ST_Y(location::geometry)::float8 AS lat,
      neighborhood,
      locality_id,
      address_reference,
      urgency_score::float8,
      status,
      media_urls,
      created_at,
      updated_at,
      resolved_at
    FROM territorial_reports
    WHERE id = ${id}::uuid
  `)

  if (rows.length === 0) {
    throw Object.assign(new Error('Reporte no encontrado'), { statusCode: 404, code: 'REPORT_NOT_FOUND' })
  }

  const report = rowToReport(rows[0])
  await setCache('report', id, report, TTL.REPORT)
  return report
}

// ── Reportes cercanos (PostGIS) ────────────────────────────────────────────────

export async function getNearbyReports(input: NearbyInput): Promise<NearbyReport[]> {
  const radiusMeters = input.radius_km * 1000

  const rows = await prisma.$queryRaw<(ReportRow & { distance_meters: number })[]>(Prisma.sql`
    SELECT
      id::text,
      category,
      title,
      description,
      ST_X(location::geometry)::float8 AS lng,
      ST_Y(location::geometry)::float8 AS lat,
      neighborhood,
      status,
      urgency_score::float8,
      created_at,
      ST_Distance(
        location::geography,
        ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography
      )::float8 AS distance_meters
    FROM territorial_reports
    WHERE status NOT IN ('rejected', 'duplicate')
      AND ST_DWithin(
        location::geography,
        ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography,
        ${radiusMeters}
      )
    ORDER BY distance_meters ASC
    LIMIT ${input.limit}
  `)

  return rows.map((row) => ({
    ...rowToSummary(row),
    description: row.description,
    distance_meters: Number(row.distance_meters),
  }))
}

// ── Actualizar estado ─────────────────────────────────────────────────────────

export async function updateReportStatus(
  id: string,
  input: UpdateStatusInput
): Promise<TerritorialReport> {
  const resolvedAt =
    input.status === 'resolved' ? Prisma.sql`NOW()` : Prisma.sql`NULL::timestamptz`

  const rows = await prisma.$queryRaw<ReportRow[]>(Prisma.sql`
    UPDATE territorial_reports
    SET
      status = ${input.status},
      assigned_to = ${input.assigned_to ?? null},
      resolved_at = ${resolvedAt}
    WHERE id = ${id}::uuid
    RETURNING
      id::text,
      citizen_id::text,
      category,
      subcategory,
      title,
      description,
      ST_X(location::geometry)::float8 AS lng,
      ST_Y(location::geometry)::float8 AS lat,
      neighborhood,
      locality_id,
      address_reference,
      urgency_score::float8,
      status,
      media_urls,
      created_at,
      updated_at,
      resolved_at
  `)

  if (rows.length === 0) {
    throw Object.assign(new Error('Reporte no encontrado'), { statusCode: 404, code: 'REPORT_NOT_FOUND' })
  }

  const report = rowToReport(rows[0])
  // Invalidar caché — el estado cambió
  await delCache('report', id)
  await delCache('stats', 'global')
  publish('territorial', 'report:status_changed', {
    id: report.id, status: report.status, category: report.category,
  }).catch(() => null)
  return report
}

// ── Estadísticas territoriales ────────────────────────────────────────────────

export async function getTerritorialStats(): Promise<TerritorialStats> {
  const cached = await getCache<TerritorialStats>('stats', 'global')
  if (cached) return cached

  const rows = await prisma.$queryRaw<{
    category: string
    total: bigint
    open_count: bigint
    resolved_count: bigint
    avg_urgency: number | null
  }[]>(Prisma.sql`
    SELECT
      category,
      COUNT(*)                                           AS total,
      COUNT(*) FILTER (WHERE status = 'open')           AS open_count,
      COUNT(*) FILTER (WHERE status = 'resolved')       AS resolved_count,
      AVG(urgency_score)::float8                        AS avg_urgency
    FROM territorial_reports
    GROUP BY category
    ORDER BY total DESC
  `)

  const byCategory = rows.map((r) => ({
    category: r.category,
    total: Number(r.total),
    open_count: Number(r.open_count),
    resolved_count: Number(r.resolved_count),
    avg_urgency: r.avg_urgency !== null ? Number(r.avg_urgency) : null,
  }))

  const stats: TerritorialStats = {
    by_category: byCategory,
    total_reports: byCategory.reduce((sum, r) => sum + r.total, 0),
    open_reports: byCategory.reduce((sum, r) => sum + r.open_count, 0),
  }

  await setCache('stats', 'global', stats, TTL.STATS)
  return stats
}
