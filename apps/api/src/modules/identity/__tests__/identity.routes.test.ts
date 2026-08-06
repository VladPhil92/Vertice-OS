jest.mock('../../../lib/redis', () => ({
  redis: { ping: jest.fn().mockResolvedValue('PONG'), get: jest.fn(), set: jest.fn(), del: jest.fn(), on: jest.fn() },
}))

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    citizen: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn() },
    $queryRaw: jest.fn().mockResolvedValue([]),
  },
}))

const mockResolveDID = jest.fn()
const mockGetOwnDID = jest.fn()
const mockGetStatus = jest.fn()
const mockConfirmCedula = jest.fn()
const mockRequestEmail = jest.fn()
const mockConfirmEmail = jest.fn()
const mockUpdateProfile = jest.fn()

jest.mock('../identity.service', () => ({
  resolveDID: mockResolveDID,
  getOwnDIDDocument: mockGetOwnDID,
  getVerificationStatus: mockGetStatus,
  confirmCedula: mockConfirmCedula,
  requestEmailVerification: mockRequestEmail,
  confirmEmail: mockConfirmEmail,
  updateCitizenProfile: mockUpdateProfile,
}))

import { buildApp } from '../../../app'

const app = buildApp()
const DID = 'did:vertice:550e8400-e29b-41d4-a716-446655440000'
const CITIZEN_ID = '550e8400-e29b-41d4-a716-446655440000'

let token: string

beforeAll(async () => {
  await app.ready()
  // Ciudadano con cédula confirmada (level 1)
  token = app.jwt.sign({ sub: CITIZEN_ID, did: DID, lvl: 1 })
})
afterAll(() => app.close())
beforeEach(() => jest.resetAllMocks())

const mockDoc = {
  '@context': ['https://www.w3.org/ns/did/v1'],
  id: DID,
  controller: DID,
  verificationMethod: [{ id: `${DID}#keys-1`, type: 'Ed25519VerificationKey2020', controller: DID, publicKeyMultibase: 'z...' }],
  authentication: [`${DID}#keys-1`],
  service: [{ id: `${DID}#civic-profile`, type: 'CivicProfile', serviceEndpoint: `http://localhost:4000/identity/did/${DID}` }],
  created: '2024-01-01T00:00:00.000Z',
  updated: '2024-01-01T00:00:00.000Z',
  verificationLevel: 1,
}

// ── GET /identity/did/:did ─────────────────────────────────────────────────────

describe('GET /identity/did/:did', () => {
  it('returns DID document with correct Content-Type', async () => {
    mockResolveDID.mockResolvedValueOnce(mockDoc)

    const res = await app.inject({ method: 'GET', url: `/identity/did/${DID}` })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('application/did+ld+json')
    const body = JSON.parse(res.payload)
    expect(body.id).toBe(DID)
    expect(body['@context']).toContain('https://www.w3.org/ns/did/v1')
  })

  it('returns 400 for unsupported DID method', async () => {
    const res = await app.inject({ method: 'GET', url: '/identity/did/did:ethr:0x123' })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.payload).code).toBe('UNSUPPORTED_DID_METHOD')
  })

  it('propagates 404 from service when DID not found', async () => {
    mockResolveDID.mockRejectedValueOnce(
      Object.assign(new Error('DID no encontrado'), { statusCode: 404, code: 'DID_NOT_FOUND' })
    )

    const res = await app.inject({ method: 'GET', url: `/identity/did/${DID}` })
    expect(res.statusCode).toBe(404)
  })
})

// ── GET /identity/me ──────────────────────────────────────────────────────────

describe('GET /identity/me', () => {
  it('returns 401 without JWT', async () => {
    const res = await app.inject({ method: 'GET', url: '/identity/me' })
    expect(res.statusCode).toBe(401)
  })

  it('returns own DID document when authenticated', async () => {
    mockGetOwnDID.mockResolvedValueOnce(mockDoc)

    const res = await app.inject({
      method: 'GET',
      url: '/identity/me',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.payload).id).toBe(DID)
    expect(mockGetOwnDID).toHaveBeenCalledWith(CITIZEN_ID)
  })
})

// ── GET /identity/status ──────────────────────────────────────────────────────

describe('GET /identity/status', () => {
  it('returns verification status with capabilities', async () => {
    mockGetStatus.mockResolvedValueOnce({
      citizen_id: CITIZEN_ID,
      did: DID,
      level: 1,
      level_name: 'cedula_confirmada',
      can_vote: true,
      can_propose: false,
    })

    const res = await app.inject({
      method: 'GET',
      url: '/identity/status',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.level).toBe(1)
    expect(body.can_vote).toBe(true)
    expect(body.can_propose).toBe(false)
  })
})

// ── POST /identity/verify/cedula ───────────────────────────────────────────────

describe('POST /identity/verify/cedula', () => {
  const level0Token = () => app.jwt.sign({ sub: CITIZEN_ID, did: DID, lvl: 0 })

  it('returns 400 when cedula is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/identity/verify/cedula',
      headers: { authorization: `Bearer ${level0Token()}` },
      payload: {},
    })
    expect(res.statusCode).toBe(400)
  })

  it('confirms cedula and returns level 1 status', async () => {
    mockConfirmCedula.mockResolvedValueOnce({
      citizen_id: CITIZEN_ID,
      did: DID,
      level: 1,
      level_name: 'cedula_confirmada',
      can_vote: true,
      can_propose: false,
    })

    const res = await app.inject({
      method: 'POST',
      url: '/identity/verify/cedula',
      headers: { authorization: `Bearer ${level0Token()}` },
      payload: { cedula: '1234567890' },
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.level).toBe(1)
    expect(body.can_vote).toBe(true)
  })

  it('propagates 400 CEDULA_MISMATCH from service', async () => {
    mockConfirmCedula.mockRejectedValueOnce(
      Object.assign(new Error('La cédula no coincide'), { statusCode: 400, code: 'CEDULA_MISMATCH' })
    )

    const res = await app.inject({
      method: 'POST',
      url: '/identity/verify/cedula',
      headers: { authorization: `Bearer ${level0Token()}` },
      payload: { cedula: '9999999999' },
    })

    expect(res.statusCode).toBe(400)
  })
})

// ── POST /identity/verify/email ────────────────────────────────────────────────

describe('POST /identity/verify/email', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await app.inject({ method: 'POST', url: '/identity/verify/email' })
    expect(res.statusCode).toBe(401)
  })

  it('returns 403 when citizen has level 0 (cédula no confirmada)', async () => {
    const level0Token = app.jwt.sign({ sub: CITIZEN_ID, did: DID, lvl: 0 })

    const res = await app.inject({
      method: 'POST',
      url: '/identity/verify/email',
      headers: { authorization: `Bearer ${level0Token}` },
    })

    expect(res.statusCode).toBe(403)
    expect(JSON.parse(res.payload).code).toBe('IDENTITY_NOT_VERIFIED')
  })

  it('returns token in dev mode for level 1 citizen', async () => {
    mockRequestEmail.mockResolvedValueOnce({
      message: 'Token generado (modo desarrollo)',
      token: 'a'.repeat(64),
    })

    const res = await app.inject({
      method: 'POST',
      url: '/identity/verify/email',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.payload).token).toHaveLength(64)
  })
})

// ── POST /identity/verify/email/confirm ───────────────────────────────────────

describe('POST /identity/verify/email/confirm', () => {
  it('returns 400 when token has wrong length', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/identity/verify/email/confirm',
      headers: { authorization: `Bearer ${token}` },
      payload: { token: 'tooshort' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('confirms email and returns level 2', async () => {
    mockConfirmEmail.mockResolvedValueOnce({
      citizen_id: CITIZEN_ID,
      did: DID,
      level: 2,
      level_name: 'identidad_completa',
      can_vote: true,
      can_propose: true,
    })

    const res = await app.inject({
      method: 'POST',
      url: '/identity/verify/email/confirm',
      headers: { authorization: `Bearer ${token}` },
      payload: { token: 'a'.repeat(64) },
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.level).toBe(2)
    expect(body.can_propose).toBe(true)
  })
})

// ── PUT /identity/profile ──────────────────────────────────────────────────────

describe('PUT /identity/profile', () => {
  it('returns 400 when no fields provided', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/identity/profile',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    })
    expect(res.statusCode).toBe(400)
  })

  it('updates profile successfully', async () => {
    mockUpdateProfile.mockResolvedValueOnce(undefined)

    const res = await app.inject({
      method: 'PUT',
      url: '/identity/profile',
      headers: { authorization: `Bearer ${token}` },
      payload: { neighborhood: 'Getsemaní', locality_id: 1 },
    })

    expect(res.statusCode).toBe(200)
    expect(mockUpdateProfile).toHaveBeenCalledWith(
      CITIZEN_ID,
      { neighborhood: 'Getsemaní', locality_id: 1 }
    )
  })
})
