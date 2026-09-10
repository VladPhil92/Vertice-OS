import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import {
  CURRENT_COMMUNITY_POLICY_VERSION,
  type CommunityModerationQueueQuery,
  type CommunityModerationResolutionInput,
  type CommunitySafetyReportInput,
  type CommunitySafetyReportStatus,
  type CommunitySafetyTargetType,
} from './community.schema'

export interface CommunityPolicyState {
  current_version: string
  accepted: boolean
  accepted_version: string | null
  accepted_at: string | null
  guidelines_url: string
}

export interface CommunityBlockState {
  blocked: boolean
}

export interface CommunitySafetyReportReceipt {
  id: string
  status: CommunitySafetyReportStatus
  target_type: CommunitySafetyTargetType
  target_id: string
  created_at: string
}

export interface CommunityModerationQueueItem extends CommunitySafetyReportReceipt {
  reporter_id: string
  target_owner_id: string | null
  reason: string
  details: string | null
  updated_at: string
}

const GUIDELINES_URL = 'https://vertice.ctgone.com/community-guidelines'

async function requireActiveCitizen(citizenId: string): Promise<void> {
  const rows = await prisma.$queryRaw<Array<{ ok: number }>>(Prisma.sql`
    SELECT 1 AS ok
    FROM citizens
    WHERE id = ${citizenId}::uuid AND is_active = TRUE
    LIMIT 1
  `)
  if (!rows[0]) {
    throw Object.assign(new Error('Perfil cívico no encontrado'), {
      statusCode: 404,
      code: 'CIVIC_PROFILE_NOT_FOUND',
    })
  }
}

export async function getCommunityPolicyState(citizenId: string): Promise<CommunityPolicyState> {
  const rows = await prisma.$queryRaw<Array<{ policy_version: string; accepted_at: Date }>>(Prisma.sql`
    SELECT policy_version, accepted_at
    FROM community_policy_acceptances
    WHERE citizen_id = ${citizenId}::uuid
    LIMIT 1
  `)
  const row = rows[0]
  return {
    current_version: CURRENT_COMMUNITY_POLICY_VERSION,
    accepted: row?.policy_version === CURRENT_COMMUNITY_POLICY_VERSION,
    accepted_version: row?.policy_version ?? null,
    accepted_at: row?.accepted_at?.toISOString() ?? null,
    guidelines_url: GUIDELINES_URL,
  }
}

export async function acceptCommunityPolicy(
  citizenId: string,
  policyVersion: string,
  source: 'app' | 'web' = 'app',
): Promise<CommunityPolicyState> {
  if (policyVersion !== CURRENT_COMMUNITY_POLICY_VERSION) {
    throw Object.assign(new Error('La versión de las Normas de Comunidad ya no es vigente.'), {
      statusCode: 409,
      code: 'COMMUNITY_POLICY_VERSION_STALE',
    })
  }
  await requireActiveCitizen(citizenId)
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO community_policy_acceptances (
      citizen_id, policy_version, accepted_source, accepted_at, updated_at
    ) VALUES (
      ${citizenId}::uuid, ${policyVersion}, ${source}, NOW(), NOW()
    )
    ON CONFLICT (citizen_id)
    DO UPDATE SET
      policy_version = EXCLUDED.policy_version,
      accepted_source = EXCLUDED.accepted_source,
      accepted_at = NOW(),
      updated_at = NOW()
  `)
  return getCommunityPolicyState(citizenId)
}

export async function ensureCommunityPolicyAccepted(citizenId: string): Promise<void> {
  const state = await getCommunityPolicyState(citizenId)
  if (!state.accepted) {
    throw Object.assign(
      new Error('Debes revisar y aceptar las Normas de Comunidad antes de publicar contenido.'),
      {
        statusCode: 428,
        code: 'COMMUNITY_POLICY_ACCEPTANCE_REQUIRED',
        policyVersion: CURRENT_COMMUNITY_POLICY_VERSION,
        guidelinesUrl: GUIDELINES_URL,
      },
    )
  }
}

export async function isCommunityInteractionBlocked(viewerId: string, targetId: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ blocked: boolean }>>(Prisma.sql`
    SELECT EXISTS (
      SELECT 1
      FROM community_user_blocks
      WHERE (blocker_id = ${viewerId}::uuid AND blocked_id = ${targetId}::uuid)
         OR (blocker_id = ${targetId}::uuid AND blocked_id = ${viewerId}::uuid)
    ) AS blocked
  `)
  return Boolean(rows[0]?.blocked)
}

export async function getCommunityBlockState(viewerId: string, targetId: string): Promise<CommunityBlockState> {
  if (viewerId === targetId) return { blocked: false }
  await requireActiveCitizen(targetId)
  const rows = await prisma.$queryRaw<Array<{ blocked: boolean }>>(Prisma.sql`
    SELECT EXISTS (
      SELECT 1
      FROM community_user_blocks
      WHERE blocker_id = ${viewerId}::uuid
        AND blocked_id = ${targetId}::uuid
    ) AS blocked
  `)
  return { blocked: Boolean(rows[0]?.blocked) }
}

export async function listCommunityBlocks(citizenId: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ blocked_id: string }>>(Prisma.sql`
    SELECT blocked_id::text
    FROM community_user_blocks
    WHERE blocker_id = ${citizenId}::uuid
    ORDER BY created_at DESC
  `)
  return rows.map((row) => row.blocked_id)
}

export async function blockCommunityUser(viewerId: string, targetId: string): Promise<CommunityBlockState> {
  if (viewerId === targetId) {
    throw Object.assign(new Error('No puedes bloquear tu propio perfil.'), {
      statusCode: 409,
      code: 'SELF_BLOCK_NOT_ALLOWED',
    })
  }
  await requireActiveCitizen(targetId)

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO community_user_blocks (blocker_id, blocked_id)
      VALUES (${viewerId}::uuid, ${targetId}::uuid)
      ON CONFLICT (blocker_id, blocked_id) DO NOTHING
    `)
    // A block immediately breaks social-graph contact in both directions.
    await tx.$executeRaw(Prisma.sql`
      DELETE FROM civic_profile_follows
      WHERE (follower_id = ${viewerId}::uuid AND followed_id = ${targetId}::uuid)
         OR (follower_id = ${targetId}::uuid AND followed_id = ${viewerId}::uuid)
    `)
  })

  return { blocked: true }
}

export async function unblockCommunityUser(viewerId: string, targetId: string): Promise<CommunityBlockState> {
  await prisma.$executeRaw(Prisma.sql`
    DELETE FROM community_user_blocks
    WHERE blocker_id = ${viewerId}::uuid
      AND blocked_id = ${targetId}::uuid
  `)
  return { blocked: false }
}

async function resolveSafetyTarget(
  targetType: CommunitySafetyTargetType,
  targetId: string,
): Promise<{ ownerId: string | null }> {
  if (targetType === 'profile') {
    const rows = await prisma.$queryRaw<Array<{ owner_id: string }>>(Prisma.sql`
      SELECT id::text AS owner_id
      FROM citizens
      WHERE id = ${targetId}::uuid AND is_active = TRUE
      LIMIT 1
    `)
    if (!rows[0]) throw Object.assign(new Error('Perfil no encontrado'), { statusCode: 404, code: 'SAFETY_TARGET_NOT_FOUND' })
    return { ownerId: rows[0].owner_id }
  }

  if (targetType === 'report') {
    const rows = await prisma.$queryRaw<Array<{ owner_id: string | null }>>(Prisma.sql`
      SELECT citizen_id::text AS owner_id
      FROM territorial_reports
      WHERE id = ${targetId}::uuid AND status NOT IN ('rejected', 'duplicate')
      LIMIT 1
    `)
    if (!rows[0]) throw Object.assign(new Error('Reporte no encontrado'), { statusCode: 404, code: 'SAFETY_TARGET_NOT_FOUND' })
    return { ownerId: rows[0].owner_id }
  }

  if (targetType === 'proposal') {
    const rows = await prisma.$queryRaw<Array<{ owner_id: string | null }>>(Prisma.sql`
      SELECT author_id::text AS owner_id
      FROM proposals
      WHERE id = ${targetId}::uuid AND status <> 'archived'
      LIMIT 1
    `)
    if (!rows[0]) throw Object.assign(new Error('Propuesta no encontrada'), { statusCode: 404, code: 'SAFETY_TARGET_NOT_FOUND' })
    return { ownerId: rows[0].owner_id }
  }

  const rows = await prisma.$queryRaw<Array<{ owner_id: string | null }>>(Prisma.sql`
    SELECT citizen_id::text AS owner_id
    FROM scheduled_civic_publications
    WHERE id = ${targetId}::uuid AND status = 'published'
    LIMIT 1
  `)
  if (!rows[0]) throw Object.assign(new Error('Publicación no encontrada'), { statusCode: 404, code: 'SAFETY_TARGET_NOT_FOUND' })
  return { ownerId: rows[0].owner_id }
}

export async function reportCommunityTarget(
  reporterId: string,
  input: CommunitySafetyReportInput,
): Promise<CommunitySafetyReportReceipt> {
  const target = await resolveSafetyTarget(input.target_type, input.target_id)
  if (target.ownerId === reporterId) {
    throw Object.assign(new Error('No puedes denunciar tu propio contenido o perfil.'), {
      statusCode: 409,
      code: 'SELF_REPORT_NOT_ALLOWED',
    })
  }

  const rows = await prisma.$queryRaw<Array<{
    id: string
    status: CommunitySafetyReportStatus
    target_type: CommunitySafetyTargetType
    target_id: string
    created_at: Date
  }>>(Prisma.sql`
    INSERT INTO community_safety_reports (
      reporter_id, target_type, target_id, target_owner_id, reason, details,
      status, created_at, updated_at, resolved_at, resolved_by, resolution_action, resolution_note
    ) VALUES (
      ${reporterId}::uuid,
      ${input.target_type},
      ${input.target_id}::uuid,
      ${target.ownerId}::uuid,
      ${input.reason},
      ${input.details ?? null},
      'pending', NOW(), NOW(), NULL, NULL, NULL, NULL
    )
    ON CONFLICT (reporter_id, target_type, target_id)
    DO UPDATE SET
      reason = EXCLUDED.reason,
      details = EXCLUDED.details,
      status = 'pending',
      updated_at = NOW(),
      resolved_at = NULL,
      resolved_by = NULL,
      resolution_action = NULL,
      resolution_note = NULL
    RETURNING id::text, status, target_type, target_id::text, created_at
  `)

  const row = rows[0]
  if (!row) throw new Error('No fue posible registrar la denuncia comunitaria')
  return {
    id: row.id,
    status: row.status,
    target_type: row.target_type,
    target_id: row.target_id,
    created_at: row.created_at.toISOString(),
  }
}

export async function listCommunityModerationQueue(
  input: CommunityModerationQueueQuery,
): Promise<CommunityModerationQueueItem[]> {
  const rows = await prisma.$queryRaw<Array<{
    id: string
    reporter_id: string
    target_type: CommunitySafetyTargetType
    target_id: string
    target_owner_id: string | null
    reason: string
    details: string | null
    status: CommunitySafetyReportStatus
    created_at: Date
    updated_at: Date
  }>>(Prisma.sql`
    SELECT
      id::text,
      reporter_id::text,
      target_type,
      target_id::text,
      target_owner_id::text,
      reason,
      details,
      status,
      created_at,
      updated_at
    FROM community_safety_reports
    WHERE status = ${input.status}
    ORDER BY created_at ASC
    LIMIT ${input.limit}
  `)

  return rows.map((row) => ({
    ...row,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  }))
}

export async function resolveCommunitySafetyReport(
  moderatorId: string,
  reportId: string,
  input: CommunityModerationResolutionInput,
): Promise<{ id: string; status: 'actioned' | 'dismissed'; action: 'none' | 'hide_target' }> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{
      id: string
      target_type: CommunitySafetyTargetType
      target_id: string
    }>>(Prisma.sql`
      SELECT id::text, target_type, target_id::text
      FROM community_safety_reports
      WHERE id = ${reportId}::uuid
      FOR UPDATE
    `)
    const report = rows[0]
    if (!report) {
      throw Object.assign(new Error('Denuncia no encontrada'), { statusCode: 404, code: 'SAFETY_REPORT_NOT_FOUND' })
    }

    const hide = input.action === 'hide_target'
    if (hide) {
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO community_moderation_visibility (
          target_type, target_id, hidden_by, source_report_id, reason, hidden_at
        ) VALUES (
          ${report.target_type},
          ${report.target_id}::uuid,
          ${moderatorId}::uuid,
          ${report.id}::uuid,
          ${input.note},
          NOW()
        )
        ON CONFLICT (target_type, target_id)
        DO UPDATE SET
          hidden_by = EXCLUDED.hidden_by,
          source_report_id = EXCLUDED.source_report_id,
          reason = EXCLUDED.reason,
          hidden_at = NOW()
      `)
    }

    const status = hide ? 'actioned' : 'dismissed'
    const action = hide ? 'hide_target' : 'none'
    await tx.$executeRaw(Prisma.sql`
      UPDATE community_safety_reports
      SET
        status = ${status},
        resolved_at = NOW(),
        resolved_by = ${moderatorId}::uuid,
        resolution_action = ${action},
        resolution_note = ${input.note},
        updated_at = NOW()
      WHERE id = ${reportId}::uuid
    `)

    return { id: reportId, status, action }
  })
}
