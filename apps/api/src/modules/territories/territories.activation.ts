import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { recordAuditEvent } from '../../lib/audit'
import { COHORT_ROLES, type CohortRole } from './territories.operations'
import { getTerritory } from './territories.service'

export const INTEREST_STATUSES = ['pending', 'approved', 'declined', 'withdrawn'] as const
export type InterestStatus = typeof INTEREST_STATUSES[number]

interface InterestRow {
  id: string
  territory_code: string
  citizen_id: string
  interest_role: CohortRole
  status: InterestStatus
  message: string | null
  reviewed_by: string | null
  reviewed_at: Date | null
  created_at: Date
  updated_at: Date
}

function makeError(message: string, statusCode: number, code: string): Error {
  return Object.assign(new Error(message), { statusCode, code })
}

async function assertCitizenBelongsToTerritory(citizenId: string, territoryCode: string): Promise<void> {
  const territory = await getTerritory(territoryCode)
  if (!['municipality', 'district'].includes(territory.level)) {
    throw makeError('La activación ciudadana opera a nivel municipal/distrital', 400, 'ACTIVATION_INTEREST_LEVEL_UNSUPPORTED')
  }

  const rows = await prisma.$queryRaw<Array<{ territory_code: string | null }>>(Prisma.sql`
    SELECT territory_code
    FROM citizens
    WHERE id = ${citizenId}::uuid AND is_active = TRUE
  `)
  if (!rows[0]) throw makeError('Ciudadano no encontrado', 404, 'CITIZEN_NOT_FOUND')
  if (rows[0].territory_code !== territoryCode) {
    throw makeError(
      'Primero selecciona este municipio o distrito como tu territorio actual',
      409,
      'ACTIVATION_INTEREST_TERRITORY_MISMATCH',
    )
  }
}

export async function submitActivationInterest(params: {
  citizenId: string
  territoryCode: string
  interestRole: CohortRole
  message?: string | null
}) {
  if (!COHORT_ROLES.includes(params.interestRole)) {
    throw makeError('Rol de interés inválido', 400, 'INVALID_ACTIVATION_INTEREST_ROLE')
  }
  await assertCitizenBelongsToTerritory(params.citizenId, params.territoryCode)

  const existing = await prisma.$queryRaw<InterestRow[]>(Prisma.sql`
    SELECT id::text, territory_code, citizen_id::text, interest_role, status,
           message, reviewed_by::text, reviewed_at, created_at, updated_at
    FROM territory_activation_interests
    WHERE territory_code = ${params.territoryCode}
      AND citizen_id = ${params.citizenId}::uuid
      AND interest_role = ${params.interestRole}
  `)

  if (existing[0]?.status === 'approved') {
    return {
      ...existing[0],
      authority_effect: 'none',
      cohort_assignment_effect: 'none_without_separate_superadmin_action',
    }
  }

  const rows = await prisma.$queryRaw<InterestRow[]>(Prisma.sql`
    INSERT INTO territory_activation_interests
      (territory_code, citizen_id, interest_role, status, message)
    VALUES (
      ${params.territoryCode}, ${params.citizenId}::uuid,
      ${params.interestRole}, 'pending', ${params.message?.trim() || null}
    )
    ON CONFLICT (territory_code, citizen_id, interest_role) DO UPDATE SET
      status = 'pending',
      message = EXCLUDED.message,
      reviewed_by = NULL,
      reviewed_at = NULL,
      updated_at = NOW()
    RETURNING id::text, territory_code, citizen_id::text, interest_role, status,
              message, reviewed_by::text, reviewed_at, created_at, updated_at
  `)

  await recordAuditEvent({
    actorId: params.citizenId,
    action: 'territory_activation_interest_submitted',
    targetType: 'territory',
    targetId: params.territoryCode,
    result: params.interestRole,
    metadata: { authority_effect: 'none', cohort_assignment_effect: 'none' },
  })

  return {
    ...rows[0],
    authority_effect: 'none',
    cohort_assignment_effect: 'none_without_separate_superadmin_action',
  }
}

export async function listMyActivationInterests(citizenId: string) {
  return prisma.$queryRaw<InterestRow[]>(Prisma.sql`
    SELECT id::text, territory_code, citizen_id::text, interest_role, status,
           message, reviewed_by::text, reviewed_at, created_at, updated_at
    FROM territory_activation_interests
    WHERE citizen_id = ${citizenId}::uuid
    ORDER BY updated_at DESC
  `)
}

export async function withdrawActivationInterest(params: {
  citizenId: string
  territoryCode: string
  interestRole: CohortRole
}) {
  const rows = await prisma.$queryRaw<InterestRow[]>(Prisma.sql`
    UPDATE territory_activation_interests
    SET status = 'withdrawn', updated_at = NOW()
    WHERE territory_code = ${params.territoryCode}
      AND citizen_id = ${params.citizenId}::uuid
      AND interest_role = ${params.interestRole}
      AND status <> 'withdrawn'
    RETURNING id::text, territory_code, citizen_id::text, interest_role, status,
              message, reviewed_by::text, reviewed_at, created_at, updated_at
  `)
  if (!rows[0]) throw makeError('Interés de activación no encontrado', 404, 'ACTIVATION_INTEREST_NOT_FOUND')

  await recordAuditEvent({
    actorId: params.citizenId,
    action: 'territory_activation_interest_withdrawn',
    targetType: 'territory',
    targetId: params.territoryCode,
    result: params.interestRole,
    metadata: { authority_effect: 'none' },
  })
  return { ...rows[0], authority_effect: 'none' }
}

export async function listActivationInterestsForAdmin(params: {
  territoryCode: string
  status?: InterestStatus
  limit?: number
}) {
  await getTerritory(params.territoryCode)
  const limit = Math.max(1, Math.min(params.limit ?? 50, 100))
  const statusFilter = params.status
    ? Prisma.sql`AND i.status = ${params.status}`
    : Prisma.empty

  return prisma.$queryRaw<Array<InterestRow & { civic_profile_type: string; public_civic_profile: boolean }>>(Prisma.sql`
    SELECT i.id::text, i.territory_code, i.citizen_id::text, i.interest_role, i.status,
           i.message, i.reviewed_by::text, i.reviewed_at, i.created_at, i.updated_at,
           c.civic_profile_type, c.public_civic_profile
    FROM territory_activation_interests i
    JOIN citizens c ON c.id = i.citizen_id
    WHERE i.territory_code = ${params.territoryCode}
      ${statusFilter}
    ORDER BY CASE i.status WHEN 'pending' THEN 0 ELSE 1 END, i.created_at ASC
    LIMIT ${limit}
  `)
}

export async function reviewActivationInterest(params: {
  actorId: string
  interestId: string
  status: 'approved' | 'declined'
  reason: string
}) {
  const before = await prisma.$queryRaw<InterestRow[]>(Prisma.sql`
    SELECT id::text, territory_code, citizen_id::text, interest_role, status,
           message, reviewed_by::text, reviewed_at, created_at, updated_at
    FROM territory_activation_interests
    WHERE id = ${params.interestId}::uuid
  `)
  if (!before[0]) throw makeError('Interés de activación no encontrado', 404, 'ACTIVATION_INTEREST_NOT_FOUND')
  if (before[0].status === 'withdrawn') {
    throw makeError('Una manifestación retirada no puede aprobarse', 409, 'ACTIVATION_INTEREST_WITHDRAWN')
  }

  // The state predicate makes withdrawal terminal even if it races this review
  // after the preliminary read. An empty RETURNING means the citizen won that
  // race and the review must fail closed rather than overwrite `withdrawn`.
  const rows = await prisma.$queryRaw<InterestRow[]>(Prisma.sql`
    UPDATE territory_activation_interests
    SET status = ${params.status}, reviewed_by = ${params.actorId}::uuid,
        reviewed_at = NOW(), updated_at = NOW()
    WHERE id = ${params.interestId}::uuid
      AND status <> 'withdrawn'
    RETURNING id::text, territory_code, citizen_id::text, interest_role, status,
              message, reviewed_by::text, reviewed_at, created_at, updated_at
  `)
  if (!rows[0]) {
    throw makeError('La manifestación fue retirada antes de completar la revisión', 409, 'ACTIVATION_INTEREST_WITHDRAWN')
  }

  await recordAuditEvent({
    actorId: params.actorId,
    action: 'territory_activation_interest_reviewed',
    targetType: 'citizen',
    targetId: before[0].citizen_id,
    result: params.status,
    reason: params.reason,
    metadata: {
      territory_code: before[0].territory_code,
      interest_role: before[0].interest_role,
      authority_effect: 'none',
      cohort_assignment_effect: 'none',
    },
  })

  return {
    ...rows[0],
    authority_effect: 'none',
    cohort_assignment_effect: 'none_without_separate_superadmin_action',
  }
}
