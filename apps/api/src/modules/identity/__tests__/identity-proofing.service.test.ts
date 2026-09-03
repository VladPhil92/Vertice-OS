import { createHmac } from 'crypto'

const mockQueryRaw = jest.fn()
const mockTransaction = jest.fn((cb: (tx: { $queryRaw: typeof mockQueryRaw }) => unknown) =>
  cb({ $queryRaw: mockQueryRaw }),
)

jest.mock('../../../config', () => ({
  config: {
    CIVIC_IDENTITY_ASSURANCE_PROVIDERS: ['trusted_kyc'],
    CIVIC_IDENTITY_PROOFING_EVENT_SECRET: 'test-proofing-event-secret-32-chars!!',
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
  canonicalizeProofingEvent,
  getActiveCivicIdentityProof,
  getCivicIdentityProofs,
  ingestCivicProofingEvent,
  verifyProofingEventSignature,
  type CivicProofingEventInput,
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

function signatureFor(event: CivicProofingEventInput): string {
  return `sha256=${createHmac('sha256', config.CIVIC_IDENTITY_PROOFING_EVENT_SECRET!)
    .update(canonicalizeProofingEvent(event))
    .digest('hex')}`
}

beforeEach(() => {
  jest.resetAllMocks()
  config.CIVIC_IDENTITY_ASSURANCE_PROVIDERS.splice(
    0,
    config.CIVIC_IDENTITY_ASSURANCE_PROVIDERS.length,
    'trusted_kyc',
  )
  config.CIVIC_IDENTITY_PROOFING_EVENT_SECRET = 'test-proofing-event-secret-32-chars!!'
  mockTransaction.mockImplementation((cb: (tx: { $queryRaw: typeof mockQueryRaw }) => unknown) =>
    cb({ $queryRaw: mockQueryRaw }),
  )
})

describe('canonical proofing contract', () => {
  it('normalizes provider and timestamps deterministically', () => {
    expect(canonicalizeProofingEvent({ ...BASE_EVENT, provider: ' Trusted_KYC ' }))
      .toBe([
        'trusted_kyc',
        'evt-001',
        CITIZEN_ID,
        'proof-001',
        'verified',
        '2',
        'a'.repeat(64),
        '2026-09-03T01:00:00.000Z',
        '2027-09-03T01:00:00.000Z',
      ].join('|'))
  })

  it('rejects invalid timestamps before signature comparison', () => {
    expect(() => canonicalizeProofingEvent({ ...BASE_EVENT, occurred_at: 'not-a-date' }))
      .toThrow('Timestamp de proofing inválido')
  })

  it('fails closed when ingress secret is absent', () => {
    config.CIVIC_IDENTITY_PROOFING_EVENT_SECRET = undefined
    expect(() => verifyProofingEventSignature(BASE_EVENT, undefined)).toThrow(
      'La ingestión de identity proofing no está configurada',
    )
  })

  it('rejects malformed and incorrect signatures', () => {
    expect(() => verifyProofingEventSignature(BASE_EVENT, 'sha256=bad')).toThrow(
      'Firma de proofing inválida',
    )
    expect(() => verifyProofingEventSignature(BASE_EVENT, `sha256=${'0'.repeat(64)}`)).toThrow(
      'Firma de proofing inválida',
    )
  })

  it('accepts a valid canonical HMAC signature', () => {
    expect(() => verifyProofingEventSignature(BASE_EVENT, signatureFor(BASE_EVENT))).not.toThrow()
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

  it('returns the best current verified proof', async () => {
    mockQueryRaw.mockResolvedValueOnce([PROOF])
    await expect(getActiveCivicIdentityProof(CITIZEN_ID)).resolves.toEqual(PROOF)
    expect(mockQueryRaw).toHaveBeenCalledTimes(1)
  })
})

describe('signed proofing event ingestion', () => {
  it('rejects providers outside the explicit assurance allowlist', async () => {
    const event = { ...BASE_EVENT, provider: 'unknown_kyc' }
    await expect(ingestCivicProofingEvent(event, signatureFor(event))).rejects.toMatchObject({
      statusCode: 403,
      code: 'UNTRUSTED_PROOFING_PROVIDER',
    })
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('rejects verified events below assurance level 2', async () => {
    const event = { ...BASE_EVENT, assurance_level: 1 }
    await expect(ingestCivicProofingEvent(event, signatureFor(event))).rejects.toMatchObject({
      statusCode: 400,
      code: 'INSUFFICIENT_ASSURANCE_LEVEL',
    })
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('rejects unknown or inactive citizens', async () => {
    mockQueryRaw.mockResolvedValueOnce([])
    await expect(ingestCivicProofingEvent(BASE_EVENT, signatureFor(BASE_EVENT))).rejects.toMatchObject({
      statusCode: 404,
      code: 'CITIZEN_NOT_FOUND',
    })
  })

  it('prevents a provider reference from being rebound to another citizen', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ id: CITIZEN_ID }])
      .mockResolvedValueOnce([{ citizen_id: '550e8400-e29b-41d4-a716-446655440099' }])

    await expect(ingestCivicProofingEvent(BASE_EVENT, signatureFor(BASE_EVENT))).rejects.toMatchObject({
      statusCode: 409,
      code: 'PROOFING_SUBJECT_CONFLICT',
    })
  })

  it('persists an accepted event and current verified state transactionally', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ id: CITIZEN_ID }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'event-row' }])
      .mockResolvedValueOnce([PROOF])

    await expect(ingestCivicProofingEvent(BASE_EVENT, signatureFor(BASE_EVENT))).resolves.toEqual({
      proof: PROOF,
      duplicate: false,
    })
    expect(mockTransaction).toHaveBeenCalledTimes(1)
    expect(mockQueryRaw).toHaveBeenCalledTimes(4)
  })

  it('treats provider retries as idempotent without reapplying state', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ id: CITIZEN_ID }])
      .mockResolvedValueOnce([{ citizen_id: CITIZEN_ID }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([PROOF])

    await expect(ingestCivicProofingEvent(BASE_EVENT, signatureFor(BASE_EVENT))).resolves.toEqual({
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

    await expect(ingestCivicProofingEvent(BASE_EVENT, signatureFor(BASE_EVENT))).rejects.toMatchObject({
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

    await expect(ingestCivicProofingEvent(BASE_EVENT, signatureFor(BASE_EVENT))).resolves.toEqual({
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

    await expect(ingestCivicProofingEvent(BASE_EVENT, signatureFor(BASE_EVENT))).rejects.toMatchObject({
      statusCode: 409,
      code: 'PROOFING_STATE_CONFLICT',
    })
  })
})
