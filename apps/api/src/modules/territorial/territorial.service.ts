import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { getCache, setCache, delCache, TTL } from '../../lib/cache'
import { logger } from '../../lib/logger'
import { recordReputationEvent } from '../reputation/reputation.service'
import { publish } from '../../lib/pubsub'
import { createNotification } from '../notifications/notifications.service'
import { verifyTerritoryPoint } from '../territories/territory-boundaries.service'
import { assertColombianMunicipalTerritory, isWithinColombiaEnvelope } from '../territories/territory-context.service'
import {
  attachLockedReportMedia,
  lockConfirmedReportMediaAssets,
} from './report-media.service'
import type {
  TerritorialReport,
  ReportSummary,
  NearbyReport,
  TerritorialStats,
  ReportRow,
  ReportCategory,
  ReportTerritoryValidation,
  StoredReportTerritorySource,
} from './territorial.types'
import type { CreateReportInput, ListReportsInput, NearbyInput, UpdateStatusInput } from './territorial.schema'

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

type QueryClient = Pick<Prisma.TransactionClient, '$queryRaw'>

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
    territory_code: row.territory_code ?? null,
    territory_name: row.territory_name ?? null,
    department_code: row.department_code ?? null,
    department_name: row.department_name ?? null,
    territory_source: (row.territory_source as StoredReportTerritorySource | null | undefined) ?? null,
    territory_validation: (row.territory_validation as ReportTerritoryValidation | null | undefined) ?? null,
    territory_boundary_version: row.territory_boundary_version ?? null,
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
    territory_code: row.territory_code ?? null,
    territory_name: row.territory_name ?? null,
    department_code: row.department_code ?? null,
    department_name: row.department_name ?? null,
    territory_source: (row.territory_source as StoredReportTerritorySource | null | undefined) ?? null,
    territory_validation: (row.territory_validation as ReportTerritoryValidation | null | undefined) ?? null,
    territory_boundary_version: row.territory_boundary_version ?? null,
    media_urls: row.media_urls ?? [],
    created_at: row.created_at,
  }
}

async function insertReportRow(
  db: QueryClient,
  citizenId: string,
  input: CreateReportInput,
  urgency: number,
  mediaUrls: string[],
  territoryValidation: ReportTerritoryValidation,
  boundaryVersion: string | null,
): Promise<ReportRow> {
  const rows = await db.$queryRaw<ReportRow[]>(Prisma.sql`
    WITH inserted AS (
      INSERT INTO territorial_reports (
        citizen_id, category, subcategory, title, description,
        location, neighborhood, locality_id, address_reference,
        urgency_score, territory_code, territory_source,
        territory_validation, territory_boundary_version, media_urls
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
        ${input.territory_code ?? null},
        ${input.territory_code ? (input.territory_source ?? 'manual') : null},
        ${territoryValidation},
        ${boundaryVersion},
        ${mediaUrls}
      )
      RETURNING *
    )
    SELECT
      i.id::text,
      i.citizen_id::text,
      i.category,
      i.subcategory,
      i.title,
      i.description,
      ST_X(i.location::geometry)::float8 AS lng,
      ST_Y(i.location::geometry)::float8 AS lat,
      i.neighborhood,
      i.locality_id,
      i.address_reference,
      i.urgency_score::float8,
      i.status,
      i.territory_code,
      t.name AS territory_name,
      d.code AS department_code,
      d.name AS department_name,
      i.territory_source,
      i.territory_validation,
      i.territory_boundary_version,
      i.media_urls,
      i.created_at,
      i.updated_at,
      i.resolved_at
    FROM inserted i
    LEFT JOIN territories t ON t.code = i.territory_code
    LEFT JOIN territories d ON d.code = t.parent_code AND d.level = 'department'
  `)
  const row = rows[0]
  if (!row) throw new Error('No fue posible persistir el reporte territorial')
  return row
}

export async function createReport(
  citizenId: string,
  input: CreateReportInput,
): Promise<TerritorialReport> {
  const directMediaUrls = input.media_urls ?? []
  const mediaAssetIds = input.media_asset_ids ?? []
  if (directMediaUrls.length > 0) {
    throw Object.assign(new Error('Las evidencias deben cargarse mediante el flujo seguro de archivos.'), {
      statusCode: 400,
      code: 'DIRECT_REPORT_MEDIA_URLS_DISABLED',
    })
  }

  if (input.territory_source && !input.territory_code) {
    throw Object.assign(new Error('El origen territorial requiere un territorio objetivo explícito.'), {
      statusCode: 400,
      code: 'REPORT_TERRITORY_REQUIRED_FOR_SOURCE',
    })
  }

  let territoryValidation: ReportTerritoryValidation = 'legacy_unverified'
  let boundaryVersion: string | null = null
  if (input.territory_code) {
    await assertColombianMunicipalTerritory(input.territory_code)
    if (!isWithinColombiaEnvelope(input.lat, input.lng)) {
      throw Object.assign(new Error('La ubicación del reporte debe corresponder al territorio colombiano.'), {
        statusCode: 400,
        code: 'REPORT_COORDINATES_OUTSIDE_COLOMBIA',
      })
    }

    const verification = await verifyTerritoryPoint(input.territory_code, input.lat, input.lng)
    if (verification.status === 'mismatch') {
      throw Object.assign(new Error('Las coordenadas del reporte no corresponden al municipio o distrito seleccionado.'), {
        statusCode: 400,
        code: 'REPORT_TERRITORY_COORDINATE_MISMATCH',
        distance_meters: Math.round(verification.distance_meters),
        boundary_source_version: verification.source_version,
      })
    }
    territoryValidation = verification.status
    boundaryVersion = verification.source_version
  }

  const urgency = input.urgency_score ?? DEFAULT_URGENCY[input.category]
  let report: TerritorialReport

  // Preserve the historical no-media write path. Evidence-backed creation keeps
  // report + locked media attachment in one atomic transaction.
  if (mediaAssetIds.length === 0) {
    report = rowToReport(await insertReportRow(
      prisma,
      citizenId,
      input,
      urgency,
      [],
      territoryValidation,
      boundaryVersion,
    ))
  } else {
    report = await prisma.$transaction(async (tx) => {
      const assets = await lockConfirmedReportMediaAssets(tx, citizenId, mediaAssetIds)
      const created = rowToReport(await insertReportRow(
        tx,
        citizenId,
        input,
        urgency,
        assets.map((asset) => asset.public_url),
        territoryValidation,
        boundaryVersion,
      ))
      await attachLockedReportMedia(tx, created.id, assets)
      return created
    })
  }

  await delCache('stats', 'global').catch(() => undefined)
  recordReputationEvent({ citizen_id: citizenId, event_type: 'report_submitted', reference_id: report.id })
    .catch((err: unknown) => logger.error('[territorial] reputation event failed', err))
  publish('territorial', 'report:created', {
    id: report.id,
    category: report.category,
    status: report.status,
    neighborhood: report.neighborhood,
    territory_code: report.territory_code,
    territory_validation: report.territory_validation,
    urgency_score: report.urgency_score,
  }).catch(() => null)
  return report
}

export async function listReports(input: ListReportsInput): Promise<ReportSummary[]> {
  const conditions: Prisma.Sql[] = []
  if (input.category) conditions.push(Prisma.sql`r.category = ${input.category}`)
  if (input.status) conditions.push(Prisma.sql`r.status = ${input.status}`)
  if (input.locality_id) conditions.push(Prisma.sql`r.locality_id = ${input.locality_id}`)
  if (input.territory_code) conditions.push(Prisma.sql`r.territory_code = ${input.territory_code}`)

  const whereClause = conditions.length > 0
    ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
    : Prisma.empty

  const rows = await prisma.$queryRaw<ReportRow[]>(Prisma.sql`
    SELECT
      r.id::text,
      r.category,
      r.title,
      ST_X(r.location::geometry)::float8 AS lng,
      ST_Y(r.location::geometry)::float8 AS lat,
      r.neighborhood,
      r.status,
      r.urgency_score::float8,
      r.territory_code,
      t.name AS territory_name,
      d.code AS department_code,
      d.name AS department_name,
      r.territory_source,
      r.territory_validation,
      r.territory_boundary_version,
      r.media_urls,
      r.created_at
    FROM territorial_reports r
    LEFT JOIN territories t ON t.code = r.territory_code
    LEFT JOIN territories d ON d.code = t.parent_code AND d.level = 'department'
    ${whereClause}
    ORDER BY r.created_at DESC
    LIMIT ${input.limit} OFFSET ${input.offset}
  `)

  return rows.map(rowToSummary)
}

export async function getReportById(id: string): Promise<TerritorialReport> {
  const cached = await getCache<TerritorialReport>('report', id)
  if (cached) return cached

  const rows = await prisma.$queryRaw<ReportRow[]>(Prisma.sql`
    SELECT
      r.id::text,
      r.citizen_id::text,
      r.category,
      r.subcategory,
      r.title,
      r.description,
      ST_X(r.location::geometry)::float8 AS lng,
      ST_Y(r.location::geometry)::float8 AS lat,
      r.neighborhood,
      r.locality_id,
      r.address_reference,
      r.urgency_score::float8,
      r.status,
      r.territory_code,
      t.name AS territory_name,
      d.code AS department_code,
      d.name AS department_name,
      r.territory_source,
      r.territory_validation,
      r.territory_boundary_version,
      r.media_urls,
      r.created_at,
      r.updated_at,
      r.resolved_at
    FROM territorial_reports r
    LEFT JOIN territories t ON t.code = r.territory_code
    LEFT JOIN territories d ON d.code = t.parent_code AND d.level = 'department'
    WHERE r.id = ${id}::uuid
  `)

  if (rows.length === 0) {
    throw Object.assign(new Error('Reporte no encontrado'), { statusCode: 404, code: 'REPORT_NOT_FOUND' })
  }

  const report = rowToReport(rows[0])
  await setCache('report', id, report, TTL.REPORT)
  return report
}

export async function getNearbyReports(input: NearbyInput): Promise<NearbyReport[]> {
  const radiusMeters = input.radius_km * 1000

  const rows = await prisma.$queryRaw<(ReportRow & { distance_meters: number })[]>(Prisma.sql`
    SELECT
      r.id::text,
      r.category,
      r.title,
      r.description,
      ST_X(r.location::geometry)::float8 AS lng,
      ST_Y(r.location::geometry)::float8 AS lat,
      r.neighborhood,
      r.status,
      r.urgency_score::float8,
      r.territory_code,
      t.name AS territory_name,
      d.code AS department_code,
      d.name AS department_name,
      r.territory_source,
      r.territory_validation,
      r.territory_boundary_version,
      r.media_urls,
      r.created_at,
      ST_Distance(
        r.location::geography,
        ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography
      )::float8 AS distance_meters
    FROM territorial_reports r
    LEFT JOIN territories t ON t.code = r.territory_code
    LEFT JOIN territories d ON d.code = t.parent_code AND d.level = 'department'
    WHERE r.status NOT IN ('rejected', 'duplicate')
      AND ST_DWithin(
        r.location::geography,
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

export async function updateReportStatus(
  id: string,
  input: UpdateStatusInput,
): Promise<TerritorialReport> {
  const resolvedAt = input.status === 'resolved' ? Prisma.sql`NOW()` : Prisma.sql`NULL::timestamptz`

  const rows = await prisma.$queryRaw<ReportRow[]>(Prisma.sql`
    WITH updated AS (
      UPDATE territorial_reports
      SET
        status = ${input.status},
        assigned_to = ${input.assigned_to ?? null},
        resolved_at = ${resolvedAt}
      WHERE id = ${id}::uuid
      RETURNING *
    )
    SELECT
      u.id::text,
      u.citizen_id::text,
      u.category,
      u.subcategory,
      u.title,
      u.description,
      ST_X(u.location::geometry)::float8 AS lng,
      ST_Y(u.location::geometry)::float8 AS lat,
      u.neighborhood,
      u.locality_id,
      u.address_reference,
      u.urgency_score::float8,
      u.status,
      u.territory_code,
      t.name AS territory_name,
      d.code AS department_code,
      d.name AS department_name,
      u.territory_source,
      u.territory_validation,
      u.territory_boundary_version,
      u.media_urls,
      u.created_at,
      u.updated_at,
      u.resolved_at
    FROM updated u
    LEFT JOIN territories t ON t.code = u.territory_code
    LEFT JOIN territories d ON d.code = t.parent_code AND d.level = 'department'
  `)

  if (rows.length === 0) {
    throw Object.assign(new Error('Reporte no encontrado'), { statusCode: 404, code: 'REPORT_NOT_FOUND' })
  }

  const report = rowToReport(rows[0])
  await delCache('report', id)
  await delCache('stats', 'global')
  publish('territorial', 'report:status_changed', {
    id: report.id, status: report.status, category: report.category,
  }).catch(() => null)

  const STATUS_LABEL: Record<string, string> = {
    in_progress: 'En proceso',
    resolved: 'Resuelto',
    rejected: 'Rechazado',
  }
  if (report.citizen_id && STATUS_LABEL[report.status]) {
    createNotification(
      report.citizen_id,
      'report_status',
      `Reporte actualizado: ${STATUS_LABEL[report.status]}`,
      `Tu reporte "${report.title}" cambió a estado ${STATUS_LABEL[report.status]}.`,
      `/dashboard/reports/${report.id}`,
    ).catch(() => null)
  }

  return report
}

export async function getTerritorialStats(): Promise<TerritorialStats> {
  const cached = await getCache<TerritorialStats>('stats', 'global')
  if (cached) return cached

  const [categoryRows, territoryRows] = await Promise.all([
    prisma.$queryRaw<{
      category: string
      total: bigint
      open_count: bigint
      resolved_count: bigint
      avg_urgency: number | null
    }[]>(Prisma.sql`
      SELECT
        category,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'open') AS open_count,
        COUNT(*) FILTER (WHERE status = 'resolved') AS resolved_count,
        AVG(urgency_score)::float8 AS avg_urgency
      FROM territorial_reports
      GROUP BY category
      ORDER BY total DESC
    `),
    prisma.$queryRaw<{
      territory_code: string
      territory_name: string
      department_code: string | null
      department_name: string | null
      total: bigint
      open_count: bigint
      resolved_count: bigint
      avg_urgency: number | null
    }[]>(Prisma.sql`
      SELECT
        r.territory_code,
        t.name AS territory_name,
        d.code AS department_code,
        d.name AS department_name,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE r.status = 'open') AS open_count,
        COUNT(*) FILTER (WHERE r.status = 'resolved') AS resolved_count,
        AVG(r.urgency_score)::float8 AS avg_urgency
      FROM territorial_reports r
      JOIN territories t ON t.code = r.territory_code
      LEFT JOIN territories d ON d.code = t.parent_code AND d.level = 'department'
      WHERE r.territory_code IS NOT NULL
      GROUP BY r.territory_code, t.name, d.code, d.name
      ORDER BY total DESC, t.name ASC
    `),
  ])

  const byCategory = categoryRows.map((row) => ({
    category: row.category,
    total: Number(row.total),
    open_count: Number(row.open_count),
    resolved_count: Number(row.resolved_count),
    avg_urgency: row.avg_urgency !== null ? Number(row.avg_urgency) : null,
  }))
  const byTerritory = territoryRows.map((row) => ({
    territory_code: row.territory_code,
    territory_name: row.territory_name,
    department_code: row.department_code,
    department_name: row.department_name,
    total: Number(row.total),
    open_count: Number(row.open_count),
    resolved_count: Number(row.resolved_count),
    avg_urgency: row.avg_urgency !== null ? Number(row.avg_urgency) : null,
  }))

  const stats: TerritorialStats = {
    by_category: byCategory,
    by_territory: byTerritory,
    total_reports: byCategory.reduce((sum, row) => sum + row.total, 0),
    open_reports: byCategory.reduce((sum, row) => sum + row.open_count, 0),
  }

  await setCache('stats', 'global', stats, TTL.STATS)
  return stats
}
