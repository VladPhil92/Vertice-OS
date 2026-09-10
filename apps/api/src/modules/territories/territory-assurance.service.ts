import { createHash } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'

export const TERRITORY_ASSURANCE_EVIDENCE_TYPES = [
  'secure_document',
  'institutional_attestation',
  'provider_attestation',
] as const

export const TERRITORY_ASSURANCE_REQUEST_STATUSES = [
  'submitted',
  'verified',
  'rejected',
  'revoked',
  'superseded',
] as const

export const TERRITORY_ASSURANCE_DECISIONS = ['approve', 'reject', 'revoke'] as const

export type TerritoryAssuranceEvidenceType = typeof TERRITORY_ASSURANCE_EVIDENCE_TYPES[number]
export type TerritoryAssuranceRequestStatus = typeof TERRITORY_ASSURANCE_REQUEST_STATUSES[number]
export type TerritoryAssuranceDecision = typeof TERRITORY_ASSURANCE_DECISIONS[number]

interface TerritoryAssuranceRequestRow {
  id: string
  citizen_id: string | null
  territory_code: string
  territory_name: string | null
  status: TerritoryAssuranceRequestStatus
  requested_level: number
  evidence_type: TerritoryAssuranceEvidenceType
  submitted_at: Date
  reviewed_at: Date | null
  reviewed_by: string | null
  decision_reason: string | null
  updated_at: Date
}

interface CitizenAssuranceRow {
  citizen_id: string
  territory_code: string | null
  territory_name: string | null
  territory_level: string | null
  territory_assurance_level: number
  territory_assurance_source: string
  territory_verified_at: Date | null
  territory_assurance_request_id: string | null
}

function makeError(message: string, statusCode: number, code: string): Error {
  return Object.assign(new Error(message), { statusCode, code })
}

function digestEvidenceReference(reference: string): string {
  return createHash('sha256').update(reference, 'utf8').digest('hex')
}

function requestProjection(alias = 'r'): Prisma.Sql {
  return Prisma.raw(`
    ${alias}.id::text,
    ${alias}.citizen_id::text,
    ${alias}.territory_code,
    t.name AS territory_name,
    ${alias}.status,
    ${alias}.requested_level,
    ${alias}.evidence_type,
    ${alias}.submitted_at,
    ${alias}.reviewed_at,
    ${alias}.reviewed_by::text,
    ${alias}.decision_reason,
    ${alias}.updated_at
  `)
}

export async function getMyTerritoryAssurance(citizenId: string) {
  const rows = await prisma.$queryRaw<CitizenAssuranceRow[]>(Prisma.sql`
    SELECT
      c.id::text AS citizen_id,
      c.territory_code,
      t.name AS territory_name,
      t.level AS territory_level,
      c.territory_assurance_level,
      c.territory_assurance_source,
      c.territory_verified_at,
      c.territory_assurance_request_id::text
    FROM citizens c
    LEFT JOIN territories t ON t.code = c.territory_code
    WHERE c.id = ${citizenId}::uuid
  `)
  const citizen = rows[0]
  if (!citizen) throw makeError('Ciudadano no encontrado', 404, 'CITIZEN_NOT_FOUND')

  const pending = await prisma.$queryRaw<TerritoryAssuranceRequestRow[]>(Prisma.sql`
    SELECT ${requestProjection()}
    FROM territory_assurance_requests r
    JOIN territories t ON t.code = r.territory_code
    WHERE r.citizen_id = ${citizenId}::uuid
      AND r.status = 'submitted'
    ORDER BY r.submitted_at DESC
    LIMIT 1
  `)

  return {
    ...citizen,
    pending_request: pending[0] ?? null,
    governance_effect: citizen.territory_assurance_level >= 1
      ? 'territorial_prerequisite_satisfied'
      : 'none_without_verified_residence',
  }
}

export async function submitTerritoryAssuranceRequest(params: {
  citizenId: string
  evidenceType: TerritoryAssuranceEvidenceType
  evidenceReference: string
}) {
  const evidenceDigest = digestEvidenceReference(params.evidenceReference)

  return prisma.$transaction(async (tx) => {
    const citizens = await tx.$queryRaw<Array<{
      citizen_id: string
      territory_code: string | null
      territory_level: string | null
    }>>(Prisma.sql`
      SELECT c.id::text AS citizen_id, c.territory_code, t.level AS territory_level
      FROM citizens c
      LEFT JOIN territories t ON t.code = c.territory_code
      WHERE c.id = ${params.citizenId}::uuid
      FOR UPDATE OF c
    `)
    const citizen = citizens[0]
    if (!citizen) throw makeError('Ciudadano no encontrado', 404, 'CITIZEN_NOT_FOUND')
    if (!citizen.territory_code) {
      throw makeError(
        'Selecciona primero tu municipio o distrito principal',
        409,
        'TERRITORY_ASSURANCE_REQUIRES_HOME_TERRITORY',
      )
    }
    if (!['municipality', 'district'].includes(citizen.territory_level ?? '')) {
      throw makeError(
        'La verificación de residencia opera únicamente a nivel municipal o distrital',
        409,
        'TERRITORY_ASSURANCE_HOME_LEVEL_UNSUPPORTED',
      )
    }

    const inserted = await tx.$queryRaw<TerritoryAssuranceRequestRow[]>(Prisma.sql`
      INSERT INTO territory_assurance_requests (
        citizen_id, territory_code, status, requested_level,
        evidence_type, evidence_reference_digest
      ) VALUES (
        ${params.citizenId}::uuid,
        ${citizen.territory_code},
        'submitted',
        1,
        ${params.evidenceType},
        ${evidenceDigest}
      )
      ON CONFLICT DO NOTHING
      RETURNING
        id::text,
        citizen_id::text,
        territory_code,
        NULL::text AS territory_name,
        status,
        requested_level,
        evidence_type,
        submitted_at,
        reviewed_at,
        reviewed_by::text,
        decision_reason,
        updated_at
    `)

    if (inserted[0]) {
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO territory_assurance_events (
          request_id, citizen_id, territory_code, actor_id,
          event_type, status_from, status_to, reason
        ) VALUES (
          ${inserted[0].id}::uuid,
          ${params.citizenId}::uuid,
          ${citizen.territory_code},
          ${params.citizenId}::uuid,
          'submitted', NULL, 'submitted', 'citizen_submission'
        )
      `)
      return { request: inserted[0], reused: false }
    }

    const existing = await tx.$queryRaw<TerritoryAssuranceRequestRow[]>(Prisma.sql`
      SELECT ${requestProjection()}
      FROM territory_assurance_requests r
      JOIN territories t ON t.code = r.territory_code
      WHERE r.citizen_id = ${params.citizenId}::uuid
        AND r.territory_code = ${citizen.territory_code}
        AND r.status IN ('submitted', 'verified')
      ORDER BY r.submitted_at DESC
      LIMIT 1
    `)
    if (!existing[0]) {
      throw makeError(
        'No fue posible crear la solicitud de verificación territorial',
        409,
        'TERRITORY_ASSURANCE_REQUEST_CONFLICT',
      )
    }
    return { request: existing[0], reused: true }
  })
}

export async function listTerritoryAssuranceRequests(params: {
  status?: TerritoryAssuranceRequestStatus
  limit?: number
} = {}) {
  const statusFilter = params.status
    ? Prisma.sql`AND r.status = ${params.status}`
    : Prisma.empty
  const limit = Math.max(1, Math.min(params.limit ?? 50, 100))

  return prisma.$queryRaw<TerritoryAssuranceRequestRow[]>(Prisma.sql`
    SELECT ${requestProjection()}
    FROM territory_assurance_requests r
    JOIN territories t ON t.code = r.territory_code
    WHERE 1 = 1
    ${statusFilter}
    ORDER BY
      CASE r.status WHEN 'submitted' THEN 0 ELSE 1 END,
      r.submitted_at ASC
    LIMIT ${limit}
  `)
}

export async function decideTerritoryAssuranceRequest(params: {
  actorId: string
  requestId: string
  decision: TerritoryAssuranceDecision
  reason: string
}) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<TerritoryAssuranceRequestRow & {
      current_territory_code: string | null
    }>>(Prisma.sql`
      SELECT
        ${requestProjection()},
        c.territory_code AS current_territory_code
      FROM territory_assurance_requests r
      JOIN territories t ON t.code = r.territory_code
      LEFT JOIN citizens c ON c.id = r.citizen_id
      WHERE r.id = ${params.requestId}::uuid
      FOR UPDATE OF r
    `)
    const request = rows[0]
    if (!request) throw makeError('Solicitud territorial no encontrada', 404, 'TERRITORY_ASSURANCE_REQUEST_NOT_FOUND')
    if (!request.citizen_id) {
      throw makeError('La cuenta asociada ya no está disponible', 409, 'TERRITORY_ASSURANCE_CITIZEN_UNAVAILABLE')
    }

    if (params.decision === 'approve') {
      if (request.status !== 'submitted') {
        throw makeError('Solo una solicitud enviada puede aprobarse', 409, 'TERRITORY_ASSURANCE_INVALID_TRANSITION')
      }
      if (request.current_territory_code !== request.territory_code) {
        throw makeError(
          'El territorio principal cambió después de enviar la solicitud',
          409,
          'TERRITORY_ASSURANCE_HOME_TERRITORY_CHANGED',
        )
      }

      const verified = await tx.$queryRaw<TerritoryAssuranceRequestRow[]>(Prisma.sql`
        UPDATE territory_assurance_requests r
        SET status = 'verified',
            reviewed_at = NOW(),
            reviewed_by = ${params.actorId}::uuid,
            decision_reason = ${params.reason},
            updated_at = NOW()
        FROM territories t
        WHERE r.id = ${params.requestId}::uuid
          AND t.code = r.territory_code
        RETURNING ${requestProjection('r')}
      `)
      const row = verified[0]
      if (!row) throw makeError('Solicitud territorial no encontrada', 404, 'TERRITORY_ASSURANCE_REQUEST_NOT_FOUND')

      const citizenUpdated = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        UPDATE citizens
        SET territory_assurance_level = ${row.requested_level},
            territory_assurance_source = ${`assurance:${row.evidence_type}`},
            territory_verified_at = NOW(),
            territory_assurance_request_id = ${row.id}::uuid
        WHERE id = ${request.citizen_id}::uuid
          AND territory_code = ${row.territory_code}
        RETURNING id::text
      `)
      if (!citizenUpdated[0]) {
        throw makeError(
          'El territorio principal cambió durante la decisión',
          409,
          'TERRITORY_ASSURANCE_HOME_TERRITORY_CHANGED',
        )
      }

      await tx.$executeRaw(Prisma.sql`
        INSERT INTO territory_assurance_events (
          request_id, citizen_id, territory_code, actor_id,
          event_type, status_from, status_to, reason
        ) VALUES (
          ${row.id}::uuid, ${request.citizen_id}::uuid, ${row.territory_code}, ${params.actorId}::uuid,
          'verified', 'submitted', 'verified', ${params.reason}
        )
      `)
      return row
    }

    if (params.decision === 'reject') {
      if (request.status !== 'submitted') {
        throw makeError('Solo una solicitud enviada puede rechazarse', 409, 'TERRITORY_ASSURANCE_INVALID_TRANSITION')
      }
      const rejected = await tx.$queryRaw<TerritoryAssuranceRequestRow[]>(Prisma.sql`
        UPDATE territory_assurance_requests r
        SET status = 'rejected',
            reviewed_at = NOW(),
            reviewed_by = ${params.actorId}::uuid,
            decision_reason = ${params.reason},
            updated_at = NOW()
        FROM territories t
        WHERE r.id = ${params.requestId}::uuid
          AND t.code = r.territory_code
        RETURNING ${requestProjection('r')}
      `)
      const row = rejected[0]
      if (!row) throw makeError('Solicitud territorial no encontrada', 404, 'TERRITORY_ASSURANCE_REQUEST_NOT_FOUND')
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO territory_assurance_events (
          request_id, citizen_id, territory_code, actor_id,
          event_type, status_from, status_to, reason
        ) VALUES (
          ${row.id}::uuid, ${request.citizen_id}::uuid, ${row.territory_code}, ${params.actorId}::uuid,
          'rejected', 'submitted', 'rejected', ${params.reason}
        )
      `)
      return row
    }

    if (request.status !== 'verified') {
      throw makeError('Solo una verificación vigente puede revocarse', 409, 'TERRITORY_ASSURANCE_INVALID_TRANSITION')
    }
    const revoked = await tx.$queryRaw<TerritoryAssuranceRequestRow[]>(Prisma.sql`
      UPDATE territory_assurance_requests r
      SET status = 'revoked',
          reviewed_at = NOW(),
          reviewed_by = ${params.actorId}::uuid,
          decision_reason = ${params.reason},
          updated_at = NOW()
      FROM territories t
      WHERE r.id = ${params.requestId}::uuid
        AND t.code = r.territory_code
      RETURNING ${requestProjection('r')}
    `)
    const row = revoked[0]
    if (!row) throw makeError('Solicitud territorial no encontrada', 404, 'TERRITORY_ASSURANCE_REQUEST_NOT_FOUND')

    await tx.$executeRaw(Prisma.sql`
      UPDATE citizens
      SET territory_assurance_level = 0,
          territory_assurance_source = 'revoked',
          territory_verified_at = NULL,
          territory_assurance_request_id = NULL
      WHERE id = ${request.citizen_id}::uuid
        AND territory_assurance_request_id = ${row.id}::uuid
    `)
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO territory_assurance_events (
        request_id, citizen_id, territory_code, actor_id,
        event_type, status_from, status_to, reason
      ) VALUES (
        ${row.id}::uuid, ${request.citizen_id}::uuid, ${row.territory_code}, ${params.actorId}::uuid,
        'revoked', 'verified', 'revoked', ${params.reason}
      )
    `)
    return row
  })
}
