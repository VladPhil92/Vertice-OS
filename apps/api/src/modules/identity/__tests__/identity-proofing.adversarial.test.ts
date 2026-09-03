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
  ingestCivicProofingEvent,
  type CivicProofingEventInput,
} from '../identity-proofing.service'

const CITIZEN_ID = '550e8400-e29b-41d4-a716-446655440000'
const OTHER_CITIZEN_ID = '550e8400-e29b-41d4-a716-446655440099'

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

describe('identity proofing adversarial guards', () => {
  it('rejects signed events dated beyond the bounded clock-skew window', async () => {
    const event: CivicProofingEventInput = {
      provider: 'trusted_kyc',
      event_id: 'evt-future',
      citizen_id: CITIZEN_ID,
      provider_reference: 'proof-future',
      status: 'verified',
      assurance_level: 2,
      evidence_hash: 'a'.repeat(64),
      occurred_at: '2999-01-01T00:00:00.000Z',
      expires_at: null,
    }

    await expect(ingestCivicProofingEvent(event, signatureFor(event))).rejects.toMatchObject({
      statusCode: 400,
      code: 'FUTURE_PROOFING_EVENT',
    })
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('rejects a concurrent subject rebind when the atomic proof upsert loses the race', async () => {
    const event: CivicProofingEventInput = {
      provider: 'trusted_kyc',
      event_id: 'evt-race',
      citizen_id: CITIZEN_ID,
      provider_reference: 'proof-shared',
      status: 'verified',
      assurance_level: 2,
      evidence_hash: 'b'.repeat(64),
      occurred_at: new Date().toISOString(),
      expires_at: null,
    }

    const winningProof = {
      id: '660e8400-e29b-41d4-a716-446655440001',
      citizen_id: OTHER_CITIZEN_ID,
      provider: 'trusted_kyc',
      provider_reference: 'proof-shared',
      status: 'verified',
      assurance_level: 2,
      evidence_hash: 'c'.repeat(64),
      verified_at: new Date(),
      expires_at: null,
      revoked_at: null,
      last_event_at: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    }

    mockQueryRaw
      .mockResolvedValueOnce([{ id: CITIZEN_ID }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'event-row' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([winningProof])

    await expect(ingestCivicProofingEvent(event, signatureFor(event))).rejects.toMatchObject({
      statusCode: 409,
      code: 'PROOFING_SUBJECT_CONFLICT',
    })
  })
})
