import { createHmac, timingSafeEqual } from 'crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import {
  getActivatedCivicIdentityProviders,
  isActivatedCivicIdentityProvider,
  resolveProofingAdapterSecret,
} from './identity-provider-registry'
  getOperationalCivicIdentityProviders,
  resolveProofingAdapterSecret,
} from './identity-proofing-provider-config'

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

export interface CivicProofingIngressAuth {
  signature?: string
  timestamp?: string
  key_id?: string
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

type StoredProofingEvent = {
  citizen_id: string
  provider_reference: string
  status: CivicProofingStatus
  assurance_level: number
  evidence_hash: string | null
  occurred_at: Date
  expires_at: Date | null
}

const MAX_FUTURE_EVENT_SKEW_MS = 5 * 60 * 1000
const MAX_SIGNATURE_SKEW_MS = 5 * 60 * 1000

function makeError(message: string, statusCode: number, code: string): Error {
  return Object.assign(new Error(message), { statusCode, code })
}

function normalizedProvider(provider: string): string {
  return provider.trim().toLowerCase()
}

/**
 * Canonical normalized event produced only after a provider adapter validates
 * the vendor's native webhook/signature contract.
 */
export function canonicalizeProofingEvent(input: CivicProofingEventInput): string {
  const occurredAt = new Date(input.occurred_at)
  const expiresAt = input.expires_at ? new Date(input.expires_at) : null
  if (Number.isNaN(occurredAt.valueOf()) || (expiresAt && Number.isNaN(expiresAt.valueOf()))) {
    throw makeError('Timestamp de proofing inválido', 400, 'INVALID_PROOFING_TIMESTAMP')
  }

  return JSON.stringify({
    provider: normalizedProvider(input.provider),
    event_id: input.event_id,
    citizen_id: input.citizen_id,
    provider_reference: input.provider_reference,
    status: input.status,
    assurance_level: input.assurance_level,
    evidence_hash: input.evidence_hash ?? null,
    occurred_at: occurredAt.toISOString(),
    expires_at: expiresAt?.toISOString() ?? null,
  })
}

/** Bind key-id into the authenticated envelope so key rotation is auditable. */
export function canonicalizeProofingEnvelope(
  input: CivicProofingEventInput,
  keyId: string,
): string {
  return `${keyId}|${canonicalizeProofingEvent(input)}`
}

export function verifyProofingEventSignature(
  input: CivicProofingEventInput,
  signatureHeader: string | undefined,
  keyIdHeader: string | undefined,
): void {
  const { keyId, secret } = resolveProofingAdapterSecret(input.provider, keyIdHeader)
  const supplied = signatureHeader?.replace(/^sha256=/i, '') ?? ''
export function canonicalizeProofingEnvelope(
  input: CivicProofingEventInput,
  timestamp: string,
  keyId: string,
): string {
  return `vertice-proofing-v1\n${timestamp}\n${keyId}\n${canonicalizeProofingEvent(input)}`
}

function parseSignatureTimestamp(timestampHeader: string | undefined): {
  raw: string
  signedAt: Date
} {
  const raw = timestampHeader?.trim() ?? ''
  if (!/^\d{10}$/.test(raw)) {
    throw makeError(
      'Timestamp de firma de proofing inválido',
      401,
      'INVALID_PROOFING_SIGNATURE_TIMESTAMP',
    )
  }

  const signedAt = new Date(Number(raw) * 1000)
  if (Number.isNaN(signedAt.valueOf())) {
    throw makeError(
      'Timestamp de firma de proofing inválido',
      401,
      'INVALID_PROOFING_SIGNATURE_TIMESTAMP',
    )
  }

  if (Math.abs(Date.now() - signedAt.getTime()) > MAX_SIGNATURE_SKEW_MS) {
    throw makeError(
      'La firma de identity proofing está fuera de la ventana permitida',
      401,
      'STALE_PROOFING_SIGNATURE',
    )
  }

  return { raw, signedAt }
}

export function verifyProofingEventSignature(
  input: CivicProofingEventInput,
  auth: CivicProofingIngressAuth,
): { provider: string; keyId: string; signedAt: Date; signatureVersion: 1 } {
  const { raw: timestamp, signedAt } = parseSignatureTimestamp(auth.timestamp)
  const keyId = auth.key_id?.trim() ?? ''
  const { provider, secret } = resolveProofingAdapterSecret(input.provider, keyId)
  const normalized: CivicProofingEventInput = { ...input, provider }

  const supplied = auth.signature?.replace(/^v1=/i, '') ?? ''
  if (!/^[0-9a-f]{64}$/i.test(supplied)) {
    throw makeError('Firma de proofing inválida', 401, 'INVALID_PROOFING_SIGNATURE')
  }

  const expected = createHmac('sha256', secret)
    .update(canonicalizeProofingEnvelope(input, keyId))
    .update(canonicalizeProofingEnvelope(normalized, timestamp, keyId))
    .digest()
  const received = Buffer.from(supplied, 'hex')

  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw makeError('Firma de proofing inválida', 401, 'INVALID_PROOFING_SIGNATURE')
  }

  return { provider, keyId, signedAt, signatureVersion: 1 }
}

function isSameStoredEvent(
  stored: StoredProofingEvent,
  input: CivicProofingEventInput,
  occurredAt: Date,
  expiresAt: Date | null,
): boolean {
  return stored.citizen_id === input.citizen_id
    && stored.provider_reference === input.provider_reference
    && stored.status === input.status
    && Number(stored.assurance_level) === input.assurance_level
    && (stored.evidence_hash ?? null) === (input.evidence_hash ?? null)
    && stored.occurred_at.getTime() === occurredAt.getTime()
    && (stored.expires_at?.getTime() ?? null) === (expiresAt?.getTime() ?? null)
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
  const providers = getOperationalCivicIdentityProviders()
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
  keyIdHeader: string | undefined,
): Promise<{ proof: CivicIdentityProof; duplicate: boolean }> {
  const provider = normalizedProvider(input.provider)

  if (!isActivatedCivicIdentityProvider(provider)) {
    throw makeError(
      'Proveedor de identity proofing no autorizado',
      403,
      'UNTRUSTED_PROOFING_PROVIDER',
    )
  }

  const normalized: CivicProofingEventInput = { ...input, provider }
  verifyProofingEventSignature(normalized, signatureHeader, keyIdHeader)
  auth: CivicProofingIngressAuth,
): Promise<{ proof: CivicIdentityProof; duplicate: boolean }> {
  const provider = normalizedProvider(input.provider)
  const normalized: CivicProofingEventInput = { ...input, provider }
  const ingress = verifyProofingEventSignature(normalized, auth)

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
         assurance_level, evidence_hash, occurred_at, expires_at,
         ingress_signature_version, ingress_key_id, ingress_signed_at)
      VALUES (
        ${provider}, ${normalized.event_id}, ${normalized.citizen_id}::uuid,
        ${normalized.provider_reference}, ${normalized.status},
        ${normalized.assurance_level}, ${normalized.evidence_hash ?? null},
        ${occurredAt}, ${expiresAt}, ${ingress.signatureVersion},
        ${ingress.keyId}, ${ingress.signedAt}
      )
      ON CONFLICT (provider, event_id) DO NOTHING
      RETURNING id
    `)

    if (eventRows.length === 0) {
      const storedEvents = await tx.$queryRaw<StoredProofingEvent[]>(Prisma.sql`
        SELECT citizen_id, provider_reference, status, assurance_level,
               evidence_hash, occurred_at, expires_at
        FROM civic_identity_proof_events
        WHERE provider = ${provider}
          AND event_id = ${normalized.event_id}
        LIMIT 1
      `)
      if (!storedEvents[0]) {
        throw makeError('Evento duplicado sin receipt asociado', 409, 'PROOFING_EVENT_ORPHANED')
      }
      if (!isSameStoredEvent(storedEvents[0], normalized, occurredAt, expiresAt)) {
        throw makeError(
          'El event_id ya está vinculado a un evento de proofing diferente',
          409,
          'PROOFING_EVENT_ID_CONFLICT',
        )
      }

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
