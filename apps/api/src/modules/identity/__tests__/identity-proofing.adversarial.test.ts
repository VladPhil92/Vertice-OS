import { createHmac } from 'crypto'

const mockQueryRaw = jest.fn()
const mockTransaction = jest.fn((cb: (tx: { $queryRaw: typeof mockQueryRaw }) => unknown) =>
  cb({ $queryRaw: mockQueryRaw }),
)

const KEY_ID = 'test-key'
const PROVIDER_KEY_SECRET = 'test-proofing-provider-key-32-characters!!'
const PROVIDER_SECRET = 'test-proofing-adapter-secret-32-chars!!'

jest.mock('../../../config', () => ({
  config: {
    NODE_ENV: 'test',
    CIVIC_IDENTITY_ASSURANCE_PROVIDERS: ['trusted_kyc'],
    CIVIC_IDENTITY_PROOFING_ADAPTER_KEYS_JSON: JSON.stringify({
      trusted_kyc: { 'test-key': PROVIDER_KEY_SECRET },
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
  ingestCivicProofingEvent,
  type CivicProofingEventInput,
} from '../identity-proofing.service'

const CITIZEN_ID = '550e8400-e29b-41d4-a716-446655440000'
const OTHER_CITIZEN_ID = '550e8400-e29b-41d4-a716-446655440099'

function signatureFor(event: CivicProofingEventInput): string {
  return `sha256=${createHmac('sha256', PROVIDER_KEY_SECRET)
    .update(canonicalizeProofingEnvelope(event, KEY_ID))
    .digest('hex')}`
function authFor(event: CivicProofingEventInput) {
  const timestamp = String(Math.floor(Date.now() / 1000))
  const keyId = 'primary'
  const signature = createHmac('sha256', PROVIDER_SECRET)
    .update(canonicalizeProofingEnvelope(event, timestamp, keyId))
    .digest('hex')
  return { signature: `v1=${signature}`, timestamp, key_id: keyId }
}

beforeEach(() => {
  jest.resetAllMocks()
  config.NODE_ENV = 'test'
  config.CIVIC_IDENTITY_ASSURANCE_PROVIDERS.splice(
    0,
    config.CIVIC_IDENTITY_ASSURANCE_PROVIDERS.length,
    'trusted_kyc',
  )
  config.CIVIC_IDENTITY_PROOFING_ADAPTER_KEYS_JSON = JSON.stringify({
    trusted_kyc: { [KEY_ID]: PROVIDER_KEY_SECRET },
    trusted_kyc: { primary: PROVIDER_SECRET },
  })
  mockTransaction.mockImplementation((cb: (tx: { $queryRaw: typeof mockQueryRaw }) => unknown) =>
    cb({ $queryRaw: mockQueryRaw }),
  )
})

describe('identity proofing adversarial guards', () => {
  it('rejects authenticated events dated beyond the bounded event clock-skew window', async () => {
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

    await expect(ingestCivicProofingEvent(event, signatureFor(event), KEY_ID)).rejects.toMatchObject({
    await expect(ingestCivicProofingEvent(event, authFor(event))).rejects.toMatchObject({
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

    await expect(ingestCivicProofingEvent(event, signatureFor(event), KEY_ID)).rejects.toMatchObject({
    await expect(ingestCivicProofingEvent(event, authFor(event))).rejects.toMatchObject({
      statusCode: 409,
      code: 'PROOFING_SUBJECT_CONFLICT',
    })
  })
})
