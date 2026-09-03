import { createHmac } from 'crypto'

const mockQueryRaw = jest.fn()
const mockTransaction = jest.fn((cb: (tx: { $queryRaw: typeof mockQueryRaw }) => unknown) =>
  cb({ $queryRaw: mockQueryRaw }),
)

const PROVIDER_SECRET = 'test-proofing-adapter-secret-32-chars!!'

jest.mock('../../../config', () => ({
  config: {
    CIVIC_IDENTITY_ASSURANCE_PROVIDERS: ['trusted_kyc'],
    CIVIC_IDENTITY_PROOFING_EVENT_SECRET: undefined,
    CIVIC_IDENTITY_PROOFING_ADAPTER_KEYS_JSON: JSON.stringify({
      trusted_kyc: { primary: 'test-proofing-adapter-secret-32-chars!!' },
    }),
  },
}))

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    $transaction: mockTransaction,
  },
}))

import { config } from '../../../config'
import {
  canonicalizeProofingEnvelope,
  canonicalizeProofingEvent,
  getActiveCivicIdentityProof,
  getCivicIdentityProofs,
  ingestCivicProofingEvent,
  verifyProofingEventSignature,
  type CivicProofingEventInput,
  type CivicProofingIngressAuth,
} from '../identity-proofing.service'

const CITIZEN_ID = '550e8400-e29b-41d4-a716-446655440000'
const BASE_EVENT: CivicProofingEventInput = {
  provider: 'trusted_kyc',
  event_id: 'evt-001',
  citizen_id: CITIZEN_ID,
  provider_reference: 'proof-001',
  status: 'verified',
  assurance_level: 2,
  evidence_hash: 'a'.repeat(64),
  occurred_at: '2026-09-02T20:00:00-05:00',
  expires_at: '2027-09-02T20:00:00-05:00',
}

const PROOF = {
  id: '660e8400-e29b-41d4-a716-446655440001',
  citizen_id: CITIZEN_ID,
  provider: 'trusted_kyc',
  provider_reference: 'proof-001',
  status: 'verified',
  assurance_level: 2,
  evidence_hash: 'a'.repeat(64),
  verified_at: new Date('2026-09-03T01:00:00.000Z'),
  expires_at: new Date('2027-09-03T01:00:00.000Z'),
  revoked_at: null,
  last_event_at: new Date('2026-09-03T01:00:00.000Z'),
  created_at: new Date('2026-09-03T01:00:00.000Z'),
  updated_at: new Date('2026-09-03T01:00:00.000Z'),
}

function authFor(
  event: CivicProofingEventInput,
  options: { timestamp?: number; keyId?: string; secret?: string } = {},
): CivicProofingIngressAuth {
  const timestamp = String(options.timestamp ?? Math.floor(Date.now() / 1000))
  const keyId = options.keyId ?? 'primary'
  const secret = options.secret ?? PROVIDER_SECRET
  const signature = createHmac('sha256', secret)
    .update(canonicalizeProofingEnvelope(event, timestamp, keyId))
    .digest('hex')
  return { signature: `v1=${signature}`, timestamp, key_id: keyId }
}

beforeEach(() => {
  jest.resetAllMocks()
  config.CIVIC_IDENTITY_ASSURANCE_PROVIDERS.splice(
    0,
    config.CIVIC_IDENTITY_ASSURANCE_PROVIDERS.length,
    'trusted_kyc',
  )
  config.CIVIC_IDENTITY_PROOFING_ADAPTER_KEYS_JSON = JSON.stringify({
    trusted_kyc: { primary: PROVIDER_SECRET, rotating: 'second-proofing-adapter-secret-32-chars!' },
  })
  mockTransaction.mockImplementation((cb: (tx: { $queryRaw: typeof mockQueryRaw }) => unknown) =>
    cb({ $queryRaw: mockQueryRaw }),
  )
})

describe('canonical proofing contract P0.4', () => {
  it('normalizes provider and timestamps as stable JSON', () => {
    expect(canonicalizeProofingEvent({ ...BASE_EVENT, provider: ' Trusted_KYC ' }))
      .toBe(JSON.stringify({
        provider: 'trusted_kyc',
        event_id: 'evt-001',
        citizen_id: CITIZEN_ID,
        provider_reference: 'proof-001',
        status: 'verified',
        assurance_level: 2,
        evidence_hash: 'a'.repeat(64),
        occurred_at: '2026-09-03T01:00:00.000Z',
        expires_at: '2027-09-03T01:00:00.000Z',
      }))
  })

  it('rejects invalid event timestamps before signature comparison', () => {
    expect(() => canonicalizeProofingEvent({ ...BASE_EVENT, occurred_at: 'not-a-date' }))
      .toThrow('Timestamp de proofing inválido')
  })

  it('rejects missing, malformed and stale signature timestamps', () => {
    expect(() => verifyProofingEventSignature(BASE_EVENT, { key_id: 'primary' }))
      .toThrow('Timestamp de firma de proofing inválido')

    expect(() => verifyProofingEventSignature(BASE_EVENT, {
      ...authFor(BASE_EVENT),
      timestamp: 'not-a-time',
    })).toThrow('Timestamp de firma de proofing inválido')

    expect(() => verifyProofingEventSignature(BASE_EVENT, authFor(BASE_EVENT, {
      timestamp: Math.floor(Date.now() / 1000) - 601,
    }))).toThrow('fuera de la ventana permitida')
  })

  it('rejects unknown key ids and wrong provider-scoped secrets', () => {
    expect(() => verifyProofingEventSignature(BASE_EVENT, authFor(BASE_EVENT, { keyId: 'missing' })))
      .toThrow('Identificador de llave de proofing inválido')

    expect(() => verifyProofingEventSignature(BASE_EVENT, authFor(BASE_EVENT, {
      secret: 'wrong-proofing-adapter-secret-32-chars!!',
    }))).toThrow('Firma de proofing inválida')
  })

  it('accepts current and overlapping rotation keys for one trusted provider', () => {
    expect(() => verifyProofingEventSignature(BASE_EVENT, authFor(BASE_EVENT))).not.toThrow()
    expect(() => verifyProofingEventSignature(BASE_EVENT, authFor(BASE_EVENT, {
      keyId: 'rotating',
      secret: 'second-proofing-adapter-secret-32-chars!',
    }))).not.toThrow()
  })

  it('does not let a key from one provider authenticate another provider', () => {
    config.CIVIC_IDENTITY_ASSURANCE_PROVIDERS.push('other_kyc')
    config.CIVIC_IDENTITY_PROOFING_ADAPTER_KEYS_JSON = JSON.stringify({
      trusted_kyc: { primary: PROVIDER_SECRET },
      other_kyc: { primary: 'other-provider-proofing-secret-32-chars!!' },
    })
    const otherEvent = { ...BASE_EVENT, provider: 'other_kyc', event_id: 'evt-other' }

    expect(() => verifyProofingEventSignature(otherEvent, authFor(otherEvent, {
      secret: PROVIDER_SECRET,
    }))).toThrow('Firma de proofing inválida')
  })
})

describe('proof queries', () => {
  it('returns the citizen proof history', async () => {
    mockQueryRaw.mockResolvedValueOnce([PROOF])
    await expect(getCivicIdentityProofs(CITIZEN_ID)).resolves.toEqual([PROOF])
  })

  it('fails closed without trusted providers before hitting the database', async () => {
    config.CIVIC_IDENTITY_ASSURANCE_PROVIDERS.splice(0)
    await expect(getActiveCivicIdentityProof(CITIZEN_ID)).resolves.toBeNull()
    expect(mockQueryRaw).not.toHaveBeenCalled()
  })

  it('fails closed when the trusted provider has no operational ingress key', async () => {
    config.CIVIC_IDENTITY_PROOFING_ADAPTER_KEYS_JSON = '{}'
    await expect(getActiveCivicIdentityProof(CITIZEN_ID)).resolves.toBeNull()
    expect(mockQueryRaw).not.toHaveBeenCalled()
  })

  it('returns the best current verified proof from an operational provider', async () => {
    mockQueryRaw.mockResolvedValueOnce([PROOF])
    await expect(getActiveCivicIdentityProof(CITIZEN_ID)).resolves.toEqual(PROOF)
    expect(mockQueryRaw).toHaveBeenCalledTimes(1)
  })
})

describe('provider-isolated signed proofing event ingestion', () => {
  it('rejects providers outside the explicit assurance allowlist', async () => {
    const event = { ...BASE_EVENT, provider: 'unknown_kyc' }
    await expect(ingestCivicProofingEvent(event, authFor(event))).rejects.toMatchObject({
      statusCode: 403,
      code: 'UNTRUSTED_PROOFING_PROVIDER',
    })
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('rejects trusted providers whose ingress registry is missing', async () => {
    config.CIVIC_IDENTITY_PROOFING_ADAPTER_KEYS_JSON = '{}'
    await expect(ingestCivicProofingEvent(BASE_EVENT, authFor(BASE_EVENT))).rejects.toMatchObject({
      statusCode: 503,
      code: 'PROOFING_PROVIDER_INGRESS_DISABLED',
    })
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('rejects verified events below assurance level 2', async () => {
    const event = { ...BASE_EVENT, assurance_level: 1 }
    await expect(ingestCivicProofingEvent(event, authFor(event))).rejects.toMatchObject({
      statusCode: 400,
      code: 'INSUFFICIENT_ASSURANCE_LEVEL',
    })
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('rejects unknown or inactive citizens', async () => {
    mockQueryRaw.mockResolvedValueOnce([])
    await expect(ingestCivicProofingEvent(BASE_EVENT, authFor(BASE_EVENT))).rejects.toMatchObject({
      statusCode: 404,
      code: 'CITIZEN_NOT_FOUND',
    })
  })

  it('prevents a provider reference from being rebound to another citizen', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ id: CITIZEN_ID }])
      .mockResolvedValueOnce([{ citizen_id: '550e8400-e29b-41d4-a716-446655440099' }])

    await expect(ingestCivicProofingEvent(BASE_EVENT, authFor(BASE_EVENT))).rejects.toMatchObject({
      statusCode: 409,
      code: 'PROOFING_SUBJECT_CONFLICT',
    })
  })

  it('persists accepted ingress provenance and current verified state transactionally', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ id: CITIZEN_ID }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'event-row' }])
      .mockResolvedValueOnce([PROOF])

    await expect(ingestCivicProofingEvent(BASE_EVENT, authFor(BASE_EVENT))).resolves.toEqual({
      proof: PROOF,
      duplicate: false,
    })
    expect(mockTransaction).toHaveBeenCalledTimes(1)
    expect(mockQueryRaw).toHaveBeenCalledTimes(4)
    const eventInsert = String(mockQueryRaw.mock.calls[2]?.[0])
    expect(eventInsert).toContain('ingress_signature_version')
    expect(eventInsert).toContain('ingress_key_id')
    expect(eventInsert).toContain('ingress_signed_at')
  })

  it('treats provider retries as idempotent without reapplying state', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ id: CITIZEN_ID }])
      .mockResolvedValueOnce([{ citizen_id: CITIZEN_ID }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([PROOF])

    await expect(ingestCivicProofingEvent(BASE_EVENT, authFor(BASE_EVENT))).resolves.toEqual({
      proof: PROOF,
      duplicate: true,
    })
    expect(mockQueryRaw).toHaveBeenCalledTimes(4)
  })

  it('rejects an impossible duplicate event with no state row', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ id: CITIZEN_ID }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    await expect(ingestCivicProofingEvent(BASE_EVENT, authFor(BASE_EVENT))).rejects.toMatchObject({
      statusCode: 409,
      code: 'PROOFING_EVENT_ORPHANED',
    })
  })

  it('keeps newer state when an older signed event arrives out of order', async () => {
    const newerProof = {
      ...PROOF,
      status: 'revoked',
      revoked_at: new Date('2026-09-04T01:00:00.000Z'),
      last_event_at: new Date('2026-09-04T01:00:00.000Z'),
    }
    mockQueryRaw
      .mockResolvedValueOnce([{ id: CITIZEN_ID }])
      .mockResolvedValueOnce([{ citizen_id: CITIZEN_ID }])
      .mockResolvedValueOnce([{ id: 'event-row' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([newerProof])

    await expect(ingestCivicProofingEvent(BASE_EVENT, authFor(BASE_EVENT))).resolves.toEqual({
      proof: newerProof,
      duplicate: false,
    })
  })

  it('fails if state reconciliation produces no current proof', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ id: CITIZEN_ID }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'event-row' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    await expect(ingestCivicProofingEvent(BASE_EVENT, authFor(BASE_EVENT))).rejects.toMatchObject({
      statusCode: 409,
      code: 'PROOFING_STATE_CONFLICT',
    })
  })
})
