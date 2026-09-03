jest.mock('../../../lib/redis', () => ({
  redis: { ping: jest.fn().mockResolvedValue('PONG'), get: jest.fn(), set: jest.fn(), del: jest.fn(), on: jest.fn() },
}))

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    citizen: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn() },
    $queryRaw: jest.fn().mockResolvedValue([]),
  },
}))

jest.mock('../identity.service', () => ({
  resolveDID: jest.fn(),
  getOwnDIDDocument: jest.fn(),
  getVerificationStatus: jest.fn(),
  confirmCedula: jest.fn(),
  requestEmailVerification: jest.fn(),
  confirmEmail: jest.fn(),
  updateCitizenProfile: jest.fn(),
  connectWallet: jest.fn(),
  requestWalletNonce: jest.fn(),
}))

const mockGetAssurance = jest.fn()
const mockGetProofs = jest.fn()
const mockIngestEvent = jest.fn()

jest.mock('../identity-assurance.service', () => ({
  getCivicIdentityAssurance: mockGetAssurance,
}))

jest.mock('../identity-proofing.service', () => ({
  getCivicIdentityProofs: mockGetProofs,
  ingestCivicProofingEvent: mockIngestEvent,
}))

import { buildApp } from '../../../app'

const app = buildApp()
const CITIZEN_ID = '550e8400-e29b-41d4-a716-446655440000'
const DID = `did:vertice:${CITIZEN_ID}`
let token: string

beforeAll(async () => {
  await app.ready()
  token = app.jwt.sign({ sub: CITIZEN_ID, did: DID, lvl: 2 })
})

afterAll(() => app.close())
beforeEach(() => jest.resetAllMocks())

describe('GET /identity/assurance', () => {
  it('returns the proof-backed civic assurance state', async () => {
    mockGetAssurance.mockResolvedValueOnce({
      citizen_id: CITIZEN_ID,
      assured: true,
      status: 'assured',
      governance_eligible: true,
      verification_level: 2,
      provider: 'trusted_kyc',
      provider_verified_at: '2026-09-03T01:00:00.000Z',
      provider_expires_at: null,
      requirements: {
        contact_verified: true,
        provider_ingress_operational: true,
        active_identity_proof: true,
      },
    })

    const res = await app.inject({
      method: 'GET',
      url: '/identity/assurance',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.payload).governance_eligible).toBe(true)
    expect(mockGetAssurance).toHaveBeenCalledWith(CITIZEN_ID)
  })
})

describe('GET /identity/proofing', () => {
  it('requires authentication', async () => {
    const res = await app.inject({ method: 'GET', url: '/identity/proofing' })
    expect(res.statusCode).toBe(401)
  })

  it('returns proof status without exposing the provider subject reference', async () => {
    mockGetProofs.mockResolvedValueOnce([{
      id: '660e8400-e29b-41d4-a716-446655440001',
      citizen_id: CITIZEN_ID,
      provider: 'trusted_kyc',
      provider_reference: 'sensitive-provider-subject',
      status: 'verified',
      assurance_level: 2,
      evidence_hash: 'a'.repeat(64),
      verified_at: new Date('2026-09-03T01:00:00.000Z'),
      expires_at: null,
      revoked_at: null,
      last_event_at: new Date('2026-09-03T01:00:00.000Z'),
      created_at: new Date('2026-09-03T01:00:00.000Z'),
      updated_at: new Date('2026-09-03T01:00:00.000Z'),
    }])

    const res = await app.inject({
      method: 'GET',
      url: '/identity/proofing',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.proofs[0]).toMatchObject({
      provider: 'trusted_kyc',
      status: 'verified',
      assurance_level: 2,
    })
    expect(body.proofs[0].provider_reference).toBeUndefined()
    expect(body.proofs[0].evidence_hash).toBeUndefined()
  })
})

describe('POST /identity/proofing/events', () => {
  const payload = {
    provider: 'trusted_kyc',
    event_id: 'evt-001',
    citizen_id: CITIZEN_ID,
    provider_reference: 'proof-001',
    status: 'verified',
    assurance_level: 2,
    evidence_hash: 'a'.repeat(64),
    occurred_at: '2026-09-03T01:00:00.000Z',
    expires_at: '2027-09-03T01:00:00.000Z',
  }

  it('rejects malformed provider events before service ingestion', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/identity/proofing/events',
      payload: { ...payload, citizen_id: 'not-a-uuid' },
    })

    expect(res.statusCode).toBe(400)
    expect(mockIngestEvent).not.toHaveBeenCalled()
  })

  it('passes signature and provider key id to the normalized ingress service', async () => {
  it('forwards the complete provider-isolated authentication envelope', async () => {
    mockIngestEvent.mockResolvedValueOnce({
      duplicate: false,
      proof: {
        id: '660e8400-e29b-41d4-a716-446655440001',
        provider: 'trusted_kyc',
        status: 'verified',
        assurance_level: 2,
        verified_at: new Date('2026-09-03T01:00:00.000Z'),
        expires_at: new Date('2027-09-03T01:00:00.000Z'),
        revoked_at: null,
      },
    })

    const signature = `sha256=${'a'.repeat(64)}`
    const res = await app.inject({
      method: 'POST',
      url: '/identity/proofing/events',
      headers: {
        'x-vertice-proofing-signature': signature,
        'x-vertice-proofing-key-id': 'test-key',
        'x-vertice-proofing-signature': `v1=${'a'.repeat(64)}`,
        'x-vertice-proofing-timestamp': '1788404400',
        'x-vertice-proofing-key-id': 'primary',
      },
      payload,
    })

    expect(res.statusCode).toBe(202)
    expect(JSON.parse(res.payload).duplicate).toBe(false)
    expect(mockIngestEvent).toHaveBeenCalledWith(payload, signature, 'test-key')
    expect(mockIngestEvent).toHaveBeenCalledWith(payload, {
      signature: `v1=${'a'.repeat(64)}`,
      timestamp: '1788404400',
      key_id: 'primary',
    })
  })

  it('returns 200 for an idempotent provider retry', async () => {
    mockIngestEvent.mockResolvedValueOnce({
      duplicate: true,
      proof: {
        id: '660e8400-e29b-41d4-a716-446655440001',
        provider: 'trusted_kyc',
        status: 'revoked',
        assurance_level: 2,
        verified_at: new Date('2026-09-03T01:00:00.000Z'),
        expires_at: null,
        revoked_at: new Date('2026-09-04T01:00:00.000Z'),
      },
    })

    const res = await app.inject({
      method: 'POST',
      url: '/identity/proofing/events',
      headers: {
        'x-vertice-proofing-signature': `sha256=${'b'.repeat(64)}`,
        'x-vertice-proofing-key-id': 'test-key',
        'x-vertice-proofing-signature': `v1=${'b'.repeat(64)}`,
        'x-vertice-proofing-timestamp': '1788404400',
        'x-vertice-proofing-key-id': 'primary',
      },
      payload,
    })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.payload).duplicate).toBe(true)
  })
})
