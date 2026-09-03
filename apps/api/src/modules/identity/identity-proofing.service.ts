import { createHmac, timingSafeEqual } from 'crypto'
import { Prisma } from '@prisma/client'
import { config } from '../../config'
import { prisma } from '../../lib/prisma'
import {
  getActivatedCivicIdentityProviders,
  isActivatedCivicIdentityProvider,
} from './identity-provider-registry'

export type CivicProofingStatus =
  | 'pending'
  | 'review'
  | 'verified'
  | 'rejected'
  | 'expired'
  | 'revoked'

export interface CivicProofingEventInput {
  provider: string
  event_id: string
  citizen_id: string
  provider_reference: string
  status: CivicProofingStatus
  assurance_level: number
  evidence_hash?: string | null
  occurred_at: string
  expires_at?: string | null
}

export interface CivicIdentityProof {
  id: string
  citizen_id: string
  provider: string
  provider_reference: string
  status: CivicProofingStatus
  assurance_level: number
  evidence_hash: string | null
  verified_at: Date | null
  expires_at: Date | null
  revoked_at: Date | null
  last_event_at: Date
  created_at: Date
  updated_at: Date
}

const MAX_FUTURE_EVENT_SKEW_MS = 5 * 60 * 1000

function makeError(message: string, statusCode: number, code: string): Error {
  return Object.assign(new Error(message), { statusCode, code })
}

function normalizedProvider(provider: string): string {
  return provider.trim().toLowerCase()
}

/**
 * Canonical payload signed by the VÉRTICE provider adapter.
 *
 * This is intentionally an internal normalized contract, not a claim that an
 * arbitrary third-party KYC webhook signs this exact representation. A real
 * provider adapter must first validate the vendor's native signature and only
 * then forward a normalized event to this ingress.
 */
export function canonicalizeProofingEvent(input: CivicProofingEventInput): string {
  const occurredAt = new Date(input.occurred_at)
  const expiresAt = input.expires_at ? new Date(input.expires_at) : null
  if (Number.isNaN(occurredAt.valueOf()) || (expiresAt && Number.isNaN(expiresAt.valueOf()))) {
    throw makeError('Timestamp de proofing inválido', 400, 'INVALID_PROOFING_TIMESTAMP')
  }

  return [
    normalizedProvider(input.provider),
    input.event_id,
    input.citizen_id,
    input.provider_reference,
    input.status,
    String(input.assurance_level),
    input.evidence_hash ?? '',
    occurredAt.toISOString(),
    expiresAt?.toISOString() ?? '',
  ].join('|')
}

export function verifyProofingEventSignature(
  input: CivicProofingEventInput,
  signatureHeader: string | undefined,
): void {
  const secret = config.CIVIC_IDENTITY_PROOFING_EVENT_SECRET
  if (!secret) {
    throw makeError(
      'La ingestión de identity proofing no está configurada',
      503,
      'PROOFING_EVENT_INGRESS_DISABLED',
    )
  }

  const supplied = signatureHeader?.replace(/^sha256=/i, '') ?? ''
  if (!/^[0-9a-f]{64}$/i.test(supplied)) {
    throw makeError('Firma de proofing inválida', 401, 'INVALID_PROOFING_SIGNATURE')
  }

  const expected = createHmac('sha256', secret)
    .update(canonicalizeProofingEvent(input))
    .digest()
  const received = Buffer.from(supplied, 'hex')

  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw makeError('Firma de proofing inválida', 401, 'INVALID_PROOFING_SIGNATURE')
  }
}

export async function getCivicIdentityProofs(citizenId: string): Promise<CivicIdentityProof[]> {
  return prisma.$queryRaw<CivicIdentityProof[]>(Prisma.sql`
    SELECT id, citizen_id, provider, provider_reference, status,
           assurance_level, evidence_hash, verified_at, expires_at, revoked_at,
           last_event_at, created_at, updated_at
    FROM civic_identity_proofs
    WHERE citizen_id = ${citizenId}::uuid
    ORDER BY updated_at DESC
  `)
}

export async function getActiveCivicIdentityProof(
  citizenId: string,
): Promise<CivicIdentityProof | null> {
  const providers = getActivatedCivicIdentityProviders()
  if (providers.length === 0) return null

  const rows = await prisma.$queryRaw<CivicIdentityProof[]>(Prisma.sql`
    SELECT id, citizen_id, provider, provider_reference, status,
           assurance_level, evidence_hash, verified_at, expires_at, revoked_at,
           last_event_at, created_at, updated_at
    FROM civic_identity_proofs
    WHERE citizen_id = ${citizenId}::uuid
      AND provider IN (${Prisma.join(providers)})
      AND status = 'verified'
      AND assurance_level >= 2
      AND verified_at IS NOT NULL
      AND verified_at <= NOW()
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY assurance_level DESC, verified_at DESC
    LIMIT 1
  `)

  return rows[0] ?? null
}

export async function ingestCivicProofingEvent(
  input: CivicProofingEventInput,
  signatureHeader: string | undefined,
): Promise<{ proof: CivicIdentityProof; duplicate: boolean }> {
  const provider = normalizedProvider(input.provider)

  // Configuration alone cannot authorize a civic identity source. The provider
  // must also have a compiled/audited adapter registration.
  if (!isActivatedCivicIdentityProvider(provider)) {
    throw makeError(
      'Proveedor de identity proofing no autorizado',
      403,
      'UNTRUSTED_PROOFING_PROVIDER',
    )
  }

  const normalized: CivicProofingEventInput = { ...input, provider }
  verifyProofingEventSignature(normalized, signatureHeader)

  if (normalized.status === 'verified' && normalized.assurance_level < 2) {
    throw makeError(
      'Una identidad verificada debe tener assurance_level >= 2',
      400,
      'INSUFFICIENT_ASSURANCE_LEVEL',
    )
  }

  const occurredAt = new Date(normalized.occurred_at)
  const expiresAt = normalized.expires_at ? new Date(normalized.expires_at) : null
  if (occurredAt.getTime() > Date.now() + MAX_FUTURE_EVENT_SKEW_MS) {
    throw makeError(
      'El evento de identity proofing está fechado demasiado lejos en el futuro',
      400,
      'FUTURE_PROOFING_EVENT',
    )
  }

  return prisma.$transaction(async (tx) => {
    const citizen = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id FROM citizens WHERE id = ${normalized.citizen_id}::uuid AND is_active = TRUE
    `)
    if (citizen.length === 0) {
      throw makeError('Ciudadano no encontrado o inactivo', 404, 'CITIZEN_NOT_FOUND')
    }

    const existing = await tx.$queryRaw<Array<{ citizen_id: string }>>(Prisma.sql`
      SELECT citizen_id
      FROM civic_identity_proofs
      WHERE provider = ${provider}
        AND provider_reference = ${normalized.provider_reference}
      LIMIT 1
    `)
    if (existing[0] && existing[0].citizen_id !== normalized.citizen_id) {
      throw makeError(
        'La referencia del proveedor ya pertenece a otro ciudadano',
        409,
        'PROOFING_SUBJECT_CONFLICT',
      )
    }

    const eventRows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      INSERT INTO civic_identity_proof_events
        (provider, event_id, citizen_id, provider_reference, status,
         assurance_level, evidence_hash, occurred_at, expires_at)
      VALUES (
        ${provider}, ${normalized.event_id}, ${normalized.citizen_id}::uuid,
        ${normalized.provider_reference}, ${normalized.status},
        ${normalized.assurance_level}, ${normalized.evidence_hash ?? null},
        ${occurredAt}, ${expiresAt}
      )
      ON CONFLICT (provider, event_id) DO NOTHING
      RETURNING id
    `)

    if (eventRows.length === 0) {
      const duplicateProof = await tx.$queryRaw<CivicIdentityProof[]>(Prisma.sql`
        SELECT id, citizen_id, provider, provider_reference, status,
               assurance_level, evidence_hash, verified_at, expires_at, revoked_at,
               last_event_at, created_at, updated_at
        FROM civic_identity_proofs
        WHERE provider = ${provider}
          AND provider_reference = ${normalized.provider_reference}
        LIMIT 1
      `)
      if (!duplicateProof[0]) {
        throw makeError('Evento duplicado sin estado de proofing asociado', 409, 'PROOFING_EVENT_ORPHANED')
      }
      if (duplicateProof[0].citizen_id !== normalized.citizen_id) {
        throw makeError(
          'La referencia del proveedor ya pertenece a otro ciudadano',
          409,
          'PROOFING_SUBJECT_CONFLICT',
        )
      }
      return { proof: duplicateProof[0], duplicate: true }
    }

    const verifiedAt = normalized.status === 'verified' ? occurredAt : null
    const revokedAt = normalized.status === 'revoked' ? occurredAt : null

    const proofRows = await tx.$queryRaw<CivicIdentityProof[]>(Prisma.sql`
      INSERT INTO civic_identity_proofs
        (citizen_id, provider, provider_reference, status, assurance_level,
         evidence_hash, verified_at, expires_at, revoked_at, last_event_at)
      VALUES (
        ${normalized.citizen_id}::uuid, ${provider}, ${normalized.provider_reference},
        ${normalized.status}, ${normalized.assurance_level}, ${normalized.evidence_hash ?? null},
        ${verifiedAt}, ${expiresAt}, ${revokedAt}, ${occurredAt}
      )
      ON CONFLICT (provider, provider_reference) DO UPDATE SET
        status = EXCLUDED.status,
        assurance_level = EXCLUDED.assurance_level,
        evidence_hash = COALESCE(EXCLUDED.evidence_hash, civic_identity_proofs.evidence_hash),
        verified_at = CASE
          WHEN EXCLUDED.status = 'verified' THEN EXCLUDED.last_event_at
          ELSE civic_identity_proofs.verified_at
        END,
        expires_at = EXCLUDED.expires_at,
        revoked_at = CASE
          WHEN EXCLUDED.status = 'revoked' THEN EXCLUDED.last_event_at
          ELSE NULL
        END,
        last_event_at = EXCLUDED.last_event_at,
        updated_at = NOW()
      WHERE civic_identity_proofs.citizen_id = EXCLUDED.citizen_id
        AND EXCLUDED.last_event_at >= civic_identity_proofs.last_event_at
      RETURNING id, citizen_id, provider, provider_reference, status,
                assurance_level, evidence_hash, verified_at, expires_at, revoked_at,
                last_event_at, created_at, updated_at
    `)

    if (proofRows.length === 0) {
      const current = await tx.$queryRaw<CivicIdentityProof[]>(Prisma.sql`
        SELECT id, citizen_id, provider, provider_reference, status,
               assurance_level, evidence_hash, verified_at, expires_at, revoked_at,
               last_event_at, created_at, updated_at
        FROM civic_identity_proofs
        WHERE provider = ${provider}
          AND provider_reference = ${normalized.provider_reference}
        LIMIT 1
      `)
      if (!current[0]) {
        throw makeError('No fue posible reconciliar el estado de proofing', 409, 'PROOFING_STATE_CONFLICT')
      }
      if (current[0].citizen_id !== normalized.citizen_id) {
        throw makeError(
          'La referencia del proveedor ya pertenece a otro ciudadano',
          409,
          'PROOFING_SUBJECT_CONFLICT',
        )
      }
      return { proof: current[0], duplicate: false }
    }

    return { proof: proofRows[0], duplicate: false }
  })
}
