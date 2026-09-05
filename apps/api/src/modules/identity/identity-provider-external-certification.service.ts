import { createHash } from 'crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { getNativeCivicIdentityProviderAdapter } from './identity-provider-registry'

const PROVIDER_RE = /^[a-z0-9][a-z0-9_.-]{0,49}$/

export type NativeProviderCertificationEventRow = {
  provider: string
  event_id: string
  citizen_id: string
  provider_reference: string
  status: string
  assurance_level: number
  evidence_hash: string | null
  occurred_at: Date
  ingress_signature_version: number
  ingress_signed_at: Date | null
}

export type ExternalProviderCertificationEvidence = {
  provider: string
  contract_version: 1
  evidence_digest: string
  subject_binding_hash: string
  verified_event_id: string
  revoked_event_id: string
  expired_event_id: string
}

export type ExternalProviderCertificationRecord = ExternalProviderCertificationEvidence & {
  id: string
  certified_by: string | null
  certified_at: Date
  revoked_by: string | null
  revoked_at: Date | null
  revocation_reason: string | null
}

function makeError(message: string, statusCode: number, code: string): Error {
  return Object.assign(new Error(message), { statusCode, code })
}

function normalizeProvider(providerInput: string): string {
  const provider = providerInput.trim().toLowerCase()
  if (!PROVIDER_RE.test(provider)) {
    throw makeError('Proveedor de certificación inválido', 400, 'INVALID_CERTIFICATION_PROVIDER')
  }
  return provider
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function canonicalEvent(row: NativeProviderCertificationEventRow) {
  return {
    event_id: row.event_id,
    status: row.status,
    assurance_level: Number(row.assurance_level),
    evidence_hash: row.evidence_hash,
    occurred_at: row.occurred_at.toISOString(),
    ingress_signature_version: Number(row.ingress_signature_version),
    ingress_signed_at: row.ingress_signed_at?.toISOString() ?? null,
  }
}

/**
 * Validates already-persisted native webhook receipts as an external lifecycle
 * canary. The function is pure so CI can certify the evidence contract without
 * needing vendor credentials or a database.
 */
export function validateExternalProviderCertificationEvidence(
  providerInput: string,
  rows: NativeProviderCertificationEventRow[],
): ExternalProviderCertificationEvidence {
  const provider = normalizeProvider(providerInput)
  if (rows.length !== 3) {
    throw makeError('El canary debe contener exactamente tres eventos', 422, 'CANARY_EVENT_SET_INCOMPLETE')
  }
  if (rows.some((row) => row.provider !== provider)) {
    throw makeError('El canary mezcla proveedores', 422, 'CANARY_PROVIDER_MISMATCH')
  }
  if (rows.some((row) => Number(row.ingress_signature_version) !== 2 || !row.ingress_signed_at)) {
    throw makeError(
      'El canary contiene eventos sin procedencia nativa autenticada',
      422,
      'CANARY_NATIVE_PROVENANCE_REQUIRED',
    )
  }

  const byStatus = new Map(rows.map((row) => [row.status, row]))
  const verified = byStatus.get('verified')
  const revoked = byStatus.get('revoked')
  const expired = byStatus.get('expired')
  if (!verified || !revoked || !expired || byStatus.size !== 3) {
    throw makeError(
      'El canary requiere verified, revoked y expired',
      422,
      'CANARY_LIFECYCLE_INCOMPLETE',
    )
  }
  if (Number(verified.assurance_level) < 2) {
    throw makeError('El evento verified no alcanza assurance 2', 422, 'CANARY_ASSURANCE_INSUFFICIENT')
  }

  const sameSubject = [revoked, expired].every((row) =>
    row.citizen_id === verified.citizen_id
      && row.provider_reference === verified.provider_reference,
  )
  if (!sameSubject) {
    throw makeError('El canary no conserva el mismo sujeto', 422, 'CANARY_SUBJECT_BINDING_FAILED')
  }

  if (!(verified.occurred_at.getTime() <= revoked.occurred_at.getTime()
    && revoked.occurred_at.getTime() <= expired.occurred_at.getTime())) {
    throw makeError('El lifecycle del canary no es monotónico', 422, 'CANARY_NON_MONOTONIC_LIFECYCLE')
  }

  const subjectBindingHash = sha256(
    `${provider}\0${verified.citizen_id}\0${verified.provider_reference}`,
  )
  const evidenceDigest = sha256(JSON.stringify({
    provider,
    contract_version: 1,
    subject_binding_hash: subjectBindingHash,
    lifecycle: [canonicalEvent(verified), canonicalEvent(revoked), canonicalEvent(expired)],
  }))

  return {
    provider,
    contract_version: 1,
    evidence_digest: evidenceDigest,
    subject_binding_hash: subjectBindingHash,
    verified_event_id: verified.event_id,
    revoked_event_id: revoked.event_id,
    expired_event_id: expired.event_id,
  }
}

export async function listExternalProviderCertifications(): Promise<ExternalProviderCertificationRecord[]> {
  return prisma.$queryRaw<ExternalProviderCertificationRecord[]>(Prisma.sql`
    SELECT id, provider, contract_version, evidence_digest, subject_binding_hash,
           verified_event_id, revoked_event_id, expired_event_id,
           certified_by, certified_at, revoked_by, revoked_at, revocation_reason
    FROM civic_identity_provider_certifications
    ORDER BY certified_at DESC
  `)
}

export async function getActiveEvidenceCertifiedProviders(): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ provider: string }>>(Prisma.sql`
    SELECT provider
    FROM civic_identity_provider_certifications
    WHERE revoked_at IS NULL
    ORDER BY provider ASC
  `)
  return rows.map((row) => row.provider)
}

export async function certifyExternalProviderFromPersistedEvents(
  providerInput: string,
  input: {
    verified_event_id: string
    revoked_event_id: string
    expired_event_id: string
  },
  actorId: string,
): Promise<{ certification: ExternalProviderCertificationRecord; duplicate: boolean }> {
  const provider = normalizeProvider(providerInput)
  const adapter = getNativeCivicIdentityProviderAdapter(provider)
  if (!adapter) {
    throw makeError('El provider no tiene adapter nativo compilado', 404, 'NATIVE_PROVIDER_NOT_REGISTERED')
  }
  if (!adapter.isRuntimeReady()) {
    throw makeError(
      'El provider no tiene credenciales runtime completas',
      503,
      'NATIVE_PROVIDER_RUNTIME_NOT_READY',
    )
  }

  const eventIds = [input.verified_event_id, input.revoked_event_id, input.expired_event_id]
  if (new Set(eventIds).size !== eventIds.length) {
    throw makeError('Los event_id del canary deben ser distintos', 400, 'CANARY_EVENT_IDS_NOT_DISTINCT')
  }

  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<NativeProviderCertificationEventRow[]>(Prisma.sql`
      SELECT provider, event_id, citizen_id, provider_reference, status,
             assurance_level, evidence_hash, occurred_at,
             ingress_signature_version, ingress_signed_at
      FROM civic_identity_proof_events
      WHERE provider = ${provider}
        AND event_id IN (${Prisma.join(eventIds)})
    `)

    const evidence = validateExternalProviderCertificationEvidence(provider, rows)
    const expectedByStatus = {
      verified: input.verified_event_id,
      revoked: input.revoked_event_id,
      expired: input.expired_event_id,
    }
    if (evidence.verified_event_id !== expectedByStatus.verified
      || evidence.revoked_event_id !== expectedByStatus.revoked
      || evidence.expired_event_id !== expectedByStatus.expired) {
      throw makeError(
        'Los event_id no corresponden al lifecycle declarado',
        422,
        'CANARY_EVENT_STATUS_BINDING_FAILED',
      )
    }

    const existing = await tx.$queryRaw<ExternalProviderCertificationRecord[]>(Prisma.sql`
      SELECT id, provider, contract_version, evidence_digest, subject_binding_hash,
             verified_event_id, revoked_event_id, expired_event_id,
             certified_by, certified_at, revoked_by, revoked_at, revocation_reason
      FROM civic_identity_provider_certifications
      WHERE provider = ${provider} AND revoked_at IS NULL
      LIMIT 1
    `)
    if (existing[0]) {
      if (existing[0].evidence_digest === evidence.evidence_digest) {
        return { certification: existing[0], duplicate: true }
      }
      throw makeError(
        'El provider ya tiene otra certificación activa',
        409,
        'PROVIDER_CERTIFICATION_ALREADY_ACTIVE',
      )
    }

    const inserted = await tx.$queryRaw<ExternalProviderCertificationRecord[]>(Prisma.sql`
      INSERT INTO civic_identity_provider_certifications
        (provider, contract_version, evidence_digest, subject_binding_hash,
         verified_event_id, revoked_event_id, expired_event_id, certified_by)
      VALUES (
        ${provider}, 1, ${evidence.evidence_digest}, ${evidence.subject_binding_hash},
        ${evidence.verified_event_id}, ${evidence.revoked_event_id},
        ${evidence.expired_event_id}, ${actorId}::uuid
      )
      ON CONFLICT DO NOTHING
      RETURNING id, provider, contract_version, evidence_digest, subject_binding_hash,
                verified_event_id, revoked_event_id, expired_event_id,
                certified_by, certified_at, revoked_by, revoked_at, revocation_reason
    `)
    if (!inserted[0]) {
      throw makeError('Conflicto al certificar el provider', 409, 'PROVIDER_CERTIFICATION_CONFLICT')
    }

    await tx.$executeRaw(Prisma.sql`
      INSERT INTO admin_audit_log
        (actor_id, action, target_type, target_id, result, metadata)
      VALUES (
        ${actorId}::uuid,
        'identity_provider.certify_external_canary',
        'civic_identity_provider',
        ${provider},
        'success',
        ${JSON.stringify({
          contract_version: 1,
          evidence_digest: evidence.evidence_digest,
          verified_event_id: evidence.verified_event_id,
          revoked_event_id: evidence.revoked_event_id,
          expired_event_id: evidence.expired_event_id,
        })}::jsonb
      )
    `)

    return { certification: inserted[0], duplicate: false }
  })
}

export async function revokeExternalProviderCertification(
  providerInput: string,
  actorId: string,
  reasonInput: string,
): Promise<ExternalProviderCertificationRecord> {
  const provider = normalizeProvider(providerInput)
  const reason = reasonInput.trim()
  if (reason.length < 10 || reason.length > 500) {
    throw makeError(
      'La revocación requiere una razón entre 10 y 500 caracteres',
      400,
      'INVALID_CERTIFICATION_REVOCATION_REASON',
    )
  }

  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<ExternalProviderCertificationRecord[]>(Prisma.sql`
      UPDATE civic_identity_provider_certifications
      SET revoked_at = NOW(), revoked_by = ${actorId}::uuid, revocation_reason = ${reason}
      WHERE provider = ${provider} AND revoked_at IS NULL
      RETURNING id, provider, contract_version, evidence_digest, subject_binding_hash,
                verified_event_id, revoked_event_id, expired_event_id,
                certified_by, certified_at, revoked_by, revoked_at, revocation_reason
    `)
    if (!rows[0]) {
      throw makeError('No existe una certificación activa', 404, 'ACTIVE_PROVIDER_CERTIFICATION_NOT_FOUND')
    }

    await tx.$executeRaw(Prisma.sql`
      INSERT INTO admin_audit_log
        (actor_id, action, target_type, target_id, result, reason, metadata)
      VALUES (
        ${actorId}::uuid,
        'identity_provider.revoke_external_certification',
        'civic_identity_provider',
        ${provider},
        'success',
        ${reason},
        ${JSON.stringify({ evidence_digest: rows[0].evidence_digest })}::jsonb
      )
    `)

    return rows[0]
  })
}
