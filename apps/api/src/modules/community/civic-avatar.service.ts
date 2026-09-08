import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import {
  createDirectImageUpload,
  deleteImageAsset,
  inspectImageAsset,
  isImageProviderReady,
  resolveImageDeliveryUrl,
} from '../media/media-provider'

export type CivicAvatarStatus = 'missing' | 'approved' | 'rejected'

export interface CivicAvatarState {
  citizen_id: string
  avatar_url: string | null
  status: CivicAvatarStatus
  updated_at: string | null
  upload_enabled: boolean
}

export interface PublicCivicAvatar {
  citizen_id: string
  avatar_url: string | null
  identity_verified: boolean
}

function requireProvider(): void {
  if (!isImageProviderReady()) {
    throw Object.assign(
      new Error('La carga de imágenes de perfil no está disponible temporalmente.'),
      { statusCode: 503, code: 'CIVIC_AVATAR_STORAGE_UNAVAILABLE' },
    )
  }
}

export async function getCivicAvatarState(citizenId: string): Promise<CivicAvatarState> {
  const rows = await prisma.$queryRaw<Array<{
    citizen_id: string
    civic_avatar_url: string | null
    civic_avatar_status: CivicAvatarStatus
    civic_avatar_updated_at: Date | null
  }>>(Prisma.sql`
    SELECT
      id::text AS citizen_id,
      civic_avatar_url,
      civic_avatar_status,
      civic_avatar_updated_at
    FROM citizens
    WHERE id = ${citizenId}::uuid
      AND is_active = TRUE
    LIMIT 1
  `)

  const row = rows[0]
  if (!row) {
    throw Object.assign(new Error('Perfil cívico no encontrado'), {
      statusCode: 404,
      code: 'CIVIC_PROFILE_NOT_FOUND',
    })
  }

  return {
    citizen_id: row.citizen_id,
    avatar_url: row.civic_avatar_status === 'approved' ? row.civic_avatar_url : null,
    status: row.civic_avatar_status,
    updated_at: row.civic_avatar_updated_at?.toISOString() ?? null,
    upload_enabled: isImageProviderReady(),
  }
}

export async function listPublicCivicAvatars(citizenIds: string[]): Promise<Record<string, PublicCivicAvatar>> {
  const uniqueIds = [...new Set(citizenIds)]
  if (uniqueIds.length === 0) return {}

  const rows = await prisma.$queryRaw<Array<{
    citizen_id: string
    civic_avatar_url: string | null
    civic_avatar_status: CivicAvatarStatus
    verification_level: number
  }>>(Prisma.sql`
    SELECT
      id::text AS citizen_id,
      civic_avatar_url,
      civic_avatar_status,
      verification_level
    FROM citizens
    WHERE id::text IN (${Prisma.join(uniqueIds)})
      AND is_active = TRUE
      AND public_civic_profile = TRUE
  `)

  const result: Record<string, PublicCivicAvatar> = {}
  for (const row of rows) {
    result[row.citizen_id] = {
      citizen_id: row.citizen_id,
      avatar_url: row.civic_avatar_status === 'approved' ? row.civic_avatar_url : null,
      identity_verified: Number(row.verification_level) >= 1,
    }
  }
  return result
}

export async function createCivicAvatarUploadIntent(citizenId: string): Promise<{
  asset_id: string
  upload_url: string
}> {
  requireProvider()

  const currentRows = await prisma.$queryRaw<Array<{ pending_asset_id: string | null }>>(Prisma.sql`
    SELECT civic_avatar_pending_asset_id AS pending_asset_id
    FROM citizens
    WHERE id = ${citizenId}::uuid
      AND is_active = TRUE
    LIMIT 1
  `)
  if (!currentRows[0]) {
    throw Object.assign(new Error('Perfil cívico no encontrado'), {
      statusCode: 404,
      code: 'CIVIC_PROFILE_NOT_FOUND',
    })
  }

  if (currentRows[0].pending_asset_id) {
    await deleteImageAsset(currentRows[0].pending_asset_id)
  }

  const intent = await createDirectImageUpload(citizenId, 'civic_profile_avatar')

  await prisma.$executeRaw(Prisma.sql`
    UPDATE citizens
    SET
      civic_avatar_pending_asset_id = ${intent.provider_asset_id},
      last_active_at = NOW()
    WHERE id = ${citizenId}::uuid
      AND is_active = TRUE
  `)

  return {
    asset_id: intent.provider_asset_id,
    upload_url: intent.upload_url,
  }
}

export async function confirmCivicAvatarUpload(
  citizenId: string,
  assetId: string,
): Promise<CivicAvatarState> {
  requireProvider()

  const rows = await prisma.$queryRaw<Array<{
    pending_asset_id: string | null
    current_asset_id: string | null
  }>>(Prisma.sql`
    SELECT
      civic_avatar_pending_asset_id AS pending_asset_id,
      civic_avatar_asset_id AS current_asset_id
    FROM citizens
    WHERE id = ${citizenId}::uuid
      AND is_active = TRUE
    LIMIT 1
  `)

  const row = rows[0]
  if (!row) {
    throw Object.assign(new Error('Perfil cívico no encontrado'), {
      statusCode: 404,
      code: 'CIVIC_PROFILE_NOT_FOUND',
    })
  }
  if (!row.pending_asset_id || row.pending_asset_id !== assetId) {
    throw Object.assign(new Error('La sesión de carga no corresponde a este perfil.'), {
      statusCode: 409,
      code: 'CIVIC_AVATAR_UPLOAD_MISMATCH',
    })
  }

  const image = await inspectImageAsset(assetId)
  if (image.id !== assetId) {
    throw Object.assign(new Error('No fue posible confirmar la imagen cargada.'), {
      statusCode: 409,
      code: 'CIVIC_AVATAR_ASSET_MISMATCH',
    })
  }

  const ownerInMetadata = typeof image.metadata?.citizen_id === 'string'
    ? image.metadata.citizen_id
    : null
  const purposeInMetadata = typeof image.metadata?.purpose === 'string'
    ? image.metadata.purpose
    : null
  if (ownerInMetadata !== citizenId || purposeInMetadata !== 'civic_profile_avatar') {
    throw Object.assign(new Error('La imagen cargada no pertenece a este perfil.'), {
      statusCode: 409,
      code: 'CIVIC_AVATAR_OWNER_MISMATCH',
    })
  }

  const avatarUrl = resolveImageDeliveryUrl(image)
  if (!avatarUrl) {
    throw Object.assign(new Error('La imagen fue cargada, pero no tiene una URL pública de entrega.'), {
      statusCode: 502,
      code: 'CIVIC_AVATAR_DELIVERY_URL_MISSING',
    })
  }

  await prisma.$executeRaw(Prisma.sql`
    UPDATE citizens
    SET
      civic_avatar_asset_id = ${assetId},
      civic_avatar_pending_asset_id = NULL,
      civic_avatar_url = ${avatarUrl},
      civic_avatar_status = 'approved',
      civic_avatar_policy_attested_at = NOW(),
      civic_avatar_updated_at = NOW(),
      last_active_at = NOW()
    WHERE id = ${citizenId}::uuid
      AND is_active = TRUE
  `)

  if (row.current_asset_id && row.current_asset_id !== assetId) {
    await deleteImageAsset(row.current_asset_id)
  }

  return getCivicAvatarState(citizenId)
}

export async function removeCivicAvatar(citizenId: string): Promise<CivicAvatarState> {
  const rows = await prisma.$queryRaw<Array<{
    current_asset_id: string | null
    pending_asset_id: string | null
  }>>(Prisma.sql`
    SELECT
      civic_avatar_asset_id AS current_asset_id,
      civic_avatar_pending_asset_id AS pending_asset_id
    FROM citizens
    WHERE id = ${citizenId}::uuid
      AND is_active = TRUE
    LIMIT 1
  `)

  if (!rows[0]) {
    throw Object.assign(new Error('Perfil cívico no encontrado'), {
      statusCode: 404,
      code: 'CIVIC_PROFILE_NOT_FOUND',
    })
  }

  await prisma.$executeRaw(Prisma.sql`
    UPDATE citizens
    SET
      civic_avatar_asset_id = NULL,
      civic_avatar_pending_asset_id = NULL,
      civic_avatar_url = NULL,
      civic_avatar_status = 'missing',
      civic_avatar_policy_attested_at = NULL,
      civic_avatar_updated_at = NOW(),
      last_active_at = NOW()
    WHERE id = ${citizenId}::uuid
      AND is_active = TRUE
  `)

  const assets = [rows[0].current_asset_id, rows[0].pending_asset_id]
    .filter((value): value is string => Boolean(value))
  await Promise.all(assets.map((assetId) => deleteImageAsset(assetId)))

  return getCivicAvatarState(citizenId)
}
