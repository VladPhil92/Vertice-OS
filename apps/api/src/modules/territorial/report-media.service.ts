import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { delCache } from '../../lib/cache'
import {
  createDirectImageUpload,
  deleteImageAsset,
  inspectImageAsset,
  isImageProviderReady,
  resolveImageDeliveryUrl,
} from '../media/media-provider'

const REPORT_MEDIA_PURPOSE = 'territorial_report_evidence' as const
const REPORT_MEDIA_PROVIDER = 'cloudflare_images'
const MAX_REPORT_MEDIA = 5

type SqlClient = Pick<Prisma.TransactionClient, '$queryRaw' | '$executeRaw'>

export interface LockedReportMediaAsset {
  id: string
  public_url: string
}

export interface ReportMediaState {
  media_asset_id: string
  url: string
  status: 'confirmed' | 'attached'
}

function requireReportMediaProvider(): void {
  if (!isImageProviderReady()) {
    throw Object.assign(new Error('La carga de evidencia fotográfica no está disponible temporalmente.'), {
      statusCode: 503,
      code: 'REPORT_MEDIA_STORAGE_UNAVAILABLE',
    })
  }
}

export async function createReportMediaUploadIntent(citizenId: string): Promise<{
  media_asset_id: string
  upload_url: string
}> {
  requireReportMediaProvider()
  const intent = await createDirectImageUpload(citizenId, REPORT_MEDIA_PURPOSE)

  try {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      INSERT INTO media_assets (
        provider, provider_asset_id, owner_citizen_id, purpose, status, expires_at
      ) VALUES (
        ${REPORT_MEDIA_PROVIDER},
        ${intent.provider_asset_id},
        ${citizenId}::uuid,
        ${REPORT_MEDIA_PURPOSE},
        'pending',
        NOW() + INTERVAL '2 hours'
      )
      RETURNING id::text
    `)

    return { media_asset_id: rows[0].id, upload_url: intent.upload_url }
  } catch (error) {
    await deleteImageAsset(intent.provider_asset_id)
    throw error
  }
}

export async function confirmReportMediaUpload(
  citizenId: string,
  mediaAssetId: string,
): Promise<ReportMediaState> {
  requireReportMediaProvider()

  const rows = await prisma.$queryRaw<Array<{
    id: string
    provider_asset_id: string
    status: string
    public_url: string | null
  }>>(Prisma.sql`
    SELECT id::text, provider_asset_id, status, public_url
    FROM media_assets
    WHERE id = ${mediaAssetId}::uuid
      AND owner_citizen_id = ${citizenId}::uuid
      AND provider = ${REPORT_MEDIA_PROVIDER}
      AND purpose = ${REPORT_MEDIA_PURPOSE}
      AND deleted_at IS NULL
    LIMIT 1
  `)

  const row = rows[0]
  if (!row) {
    throw Object.assign(new Error('La sesión de evidencia no corresponde a este ciudadano.'), {
      statusCode: 404,
      code: 'REPORT_MEDIA_ASSET_NOT_FOUND',
    })
  }

  if ((row.status === 'confirmed' || row.status === 'attached') && row.public_url) {
    return {
      media_asset_id: row.id,
      url: row.public_url,
      status: row.status,
    }
  }

  if (row.status !== 'pending') {
    throw Object.assign(new Error('La evidencia ya no puede confirmarse.'), {
      statusCode: 409,
      code: 'REPORT_MEDIA_INVALID_STATE',
    })
  }

  const image = await inspectImageAsset(row.provider_asset_id)
  if (image.id !== row.provider_asset_id) {
    throw Object.assign(new Error('No fue posible confirmar la evidencia cargada.'), {
      statusCode: 409,
      code: 'REPORT_MEDIA_PROVIDER_ASSET_MISMATCH',
    })
  }

  const metadataOwner = typeof image.metadata?.citizen_id === 'string'
    ? image.metadata.citizen_id
    : null
  const metadataPurpose = typeof image.metadata?.purpose === 'string'
    ? image.metadata.purpose
    : null

  if (metadataOwner !== citizenId || metadataPurpose !== REPORT_MEDIA_PURPOSE) {
    throw Object.assign(new Error('La evidencia cargada no pertenece a esta operación.'), {
      statusCode: 409,
      code: 'REPORT_MEDIA_OWNERSHIP_MISMATCH',
    })
  }

  const publicUrl = resolveImageDeliveryUrl(image)
  if (!publicUrl) {
    throw Object.assign(new Error('La evidencia fue cargada, pero no tiene URL pública de entrega.'), {
      statusCode: 502,
      code: 'REPORT_MEDIA_DELIVERY_URL_MISSING',
    })
  }

  await prisma.$executeRaw(Prisma.sql`
    UPDATE media_assets
    SET
      status = 'confirmed',
      public_url = ${publicUrl},
      confirmed_at = NOW(),
      expires_at = NULL
    WHERE id = ${mediaAssetId}::uuid
      AND owner_citizen_id = ${citizenId}::uuid
      AND status = 'pending'
  `)

  return { media_asset_id: mediaAssetId, url: publicUrl, status: 'confirmed' }
}

export async function lockConfirmedReportMediaAssets(
  tx: SqlClient,
  citizenId: string,
  mediaAssetIds: string[],
): Promise<LockedReportMediaAsset[]> {
  if (mediaAssetIds.length === 0) return []
  if (mediaAssetIds.length > MAX_REPORT_MEDIA) {
    throw Object.assign(new Error('Un reporte puede contener máximo cinco evidencias.'), {
      statusCode: 400,
      code: 'REPORT_MEDIA_LIMIT_EXCEEDED',
    })
  }

  const uniqueIds = [...new Set(mediaAssetIds)]
  if (uniqueIds.length !== mediaAssetIds.length) {
    throw Object.assign(new Error('La misma evidencia no puede adjuntarse dos veces.'), {
      statusCode: 400,
      code: 'REPORT_MEDIA_DUPLICATE_ASSET',
    })
  }

  const rows = await tx.$queryRaw<Array<{
    id: string
    public_url: string
  }>>(Prisma.sql`
    SELECT ma.id::text, ma.public_url
    FROM media_assets ma
    LEFT JOIN territorial_report_media trm ON trm.media_asset_id = ma.id
    WHERE ma.id::text IN (${Prisma.join(uniqueIds)})
      AND ma.owner_citizen_id = ${citizenId}::uuid
      AND ma.provider = ${REPORT_MEDIA_PROVIDER}
      AND ma.purpose = ${REPORT_MEDIA_PURPOSE}
      AND ma.status = 'confirmed'
      AND ma.public_url IS NOT NULL
      AND ma.deleted_at IS NULL
      AND trm.media_asset_id IS NULL
    FOR UPDATE OF ma
  `)

  if (rows.length !== uniqueIds.length) {
    throw Object.assign(new Error('Una o más evidencias no están confirmadas, no pertenecen al usuario o ya fueron utilizadas.'), {
      statusCode: 409,
      code: 'REPORT_MEDIA_NOT_ATTACHABLE',
    })
  }

  const byId = new Map(rows.map((row) => [row.id, row]))
  return uniqueIds.map((id) => byId.get(id) as LockedReportMediaAsset)
}

export async function attachLockedReportMedia(
  tx: SqlClient,
  reportId: string,
  assets: LockedReportMediaAsset[],
  startPosition = 0,
): Promise<void> {
  for (let index = 0; index < assets.length; index += 1) {
    const asset = assets[index]
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO territorial_report_media (report_id, media_asset_id, position)
      VALUES (${reportId}::uuid, ${asset.id}::uuid, ${startPosition + index})
    `)
    await tx.$executeRaw(Prisma.sql`
      UPDATE media_assets
      SET status = 'attached'
      WHERE id = ${asset.id}::uuid
        AND status = 'confirmed'
    `)
  }
}

export async function attachReportEvidence(
  citizenId: string,
  reportId: string,
  mediaAssetIds: string[],
): Promise<{ report_id: string; media_urls: string[]; attached_count: number }> {
  const result = await prisma.$transaction(async (tx) => {
    const reportRows = await tx.$queryRaw<Array<{
      citizen_id: string | null
      media_urls: string[] | null
    }>>(Prisma.sql`
      SELECT citizen_id::text, media_urls
      FROM territorial_reports
      WHERE id = ${reportId}::uuid
      FOR UPDATE
    `)

    const report = reportRows[0]
    if (!report) {
      throw Object.assign(new Error('Reporte no encontrado'), {
        statusCode: 404,
        code: 'REPORT_NOT_FOUND',
      })
    }
    if (!report.citizen_id || report.citizen_id !== citizenId) {
      throw Object.assign(new Error('Solo el autor puede agregar evidencia a este reporte.'), {
        statusCode: 403,
        code: 'REPORT_MEDIA_OWNER_REQUIRED',
      })
    }

    const existingUrls = report.media_urls ?? []
    if (existingUrls.length + mediaAssetIds.length > MAX_REPORT_MEDIA) {
      throw Object.assign(new Error('Un reporte puede contener máximo cinco evidencias.'), {
        statusCode: 400,
        code: 'REPORT_MEDIA_LIMIT_EXCEEDED',
      })
    }

    const assets = await lockConfirmedReportMediaAssets(tx, citizenId, mediaAssetIds)
    await attachLockedReportMedia(tx, reportId, assets, existingUrls.length)

    const mediaUrls = [...existingUrls, ...assets.map((asset) => asset.public_url)]
    await tx.$executeRaw(Prisma.sql`
      UPDATE territorial_reports
      SET media_urls = ${mediaUrls}, updated_at = NOW()
      WHERE id = ${reportId}::uuid
    `)

    return { report_id: reportId, media_urls: mediaUrls, attached_count: assets.length }
  })

  await delCache('report', reportId)
  return result
}
