const mockCitizen = {
  findUnique: jest.fn(),
  findUniqueOrThrow: jest.fn(),
  update: jest.fn(),
}

jest.mock('../../../lib/prisma', () => ({
  prisma: { citizen: mockCitizen },
}))

const mockRedisGet = jest.fn()
const mockRedisSet = jest.fn()
const mockRedisDel = jest.fn()

jest.mock('../../../lib/redis', () => ({
  redis: { get: mockRedisGet, set: mockRedisSet, del: mockRedisDel, on: jest.fn() },
}))

const mockGetCache = jest.fn()
const mockDelCache = jest.fn()

jest.mock('../../../lib/cache', () => ({
  getCache: mockGetCache,
  setCache: jest.fn(),
  delCache: mockDelCache,
  TTL: { PROFILE: 300, SESSION: 60 },
}))

import {
  resolveDID,
  getOwnDIDDocument,
  getVerificationStatus,
  confirmCedula,
  requestEmailVerification,
  confirmEmail,
  updateCitizenProfile,
} from '../identity.service'

const CITIZEN_BASE = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  did: 'did:vertice:550e8400-e29b-41d4-a716-446655440000',
  verificationLevel: 0,
  localityId: null,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  lastActiveAt: null,
}

beforeEach(() => {
  jest.resetAllMocks()
})

// ── resolveDID ────────────────────────────────────────────────────────────────

describe('resolveDID', () => {
  it('throws 404 when DID does not exist', async () => {
    mockGetCache.mockResolvedValueOnce(null)
    mockCitizen.findUnique.mockResolvedValueOnce(null)

    await expect(resolveDID('did:vertice:nonexistent')).rejects.toMatchObject({
      statusCode: 404,
      code: 'DID_NOT_FOUND',
    })
  })

  it('returns a W3C-compliant DID Document for an existing citizen', async () => {
    mockGetCache.mockResolvedValueOnce(null)
    mockCitizen.findUnique.mockResolvedValueOnce(CITIZEN_BASE)
    mockRedisSet.mockResolvedValueOnce('OK')

    const doc = await resolveDID(CITIZEN_BASE.did)

    expect(doc['@context']).toContain('https://www.w3.org/ns/did/v1')
    expect(doc.id).toBe(CITIZEN_BASE.did)
    expect(doc.controller).toBe(CITIZEN_BASE.did)
    expect(doc.verificationMethod).toHaveLength(1)
    expect(doc.verificationMethod[0].id).toBe(`${CITIZEN_BASE.did}#keys-1`)
    expect(doc.authentication).toContain(`${CITIZEN_BASE.did}#keys-1`)
    expect(doc.service[0].type).toBe('CivicProfile')
    expect(doc.verificationLevel).toBe(0)
  })

  it('returns cached document without hitting DB', async () => {
    const cachedDoc = { id: CITIZEN_BASE.did, verificationLevel: 1 }
    mockGetCache.mockResolvedValueOnce(cachedDoc)

    const doc = await resolveDID(CITIZEN_BASE.did)

    expect(doc).toBe(cachedDoc)
    expect(mockCitizen.findUnique).not.toHaveBeenCalled()
  })
})

// ── getVerificationStatus ─────────────────────────────────────────────────────

describe('getVerificationStatus', () => {
  it('reflects level 0 capabilities correctly', async () => {
    mockCitizen.findUniqueOrThrow.mockResolvedValueOnce({ ...CITIZEN_BASE, verificationLevel: 0 })

    const status = await getVerificationStatus(CITIZEN_BASE.id)

    expect(status.level).toBe(0)
    expect(status.level_name).toBe('registrado')
    expect(status.can_vote).toBe(false)
    expect(status.can_propose).toBe(false)
  })

  it('reflects level 1 capabilities correctly', async () => {
    mockCitizen.findUniqueOrThrow.mockResolvedValueOnce({ ...CITIZEN_BASE, verificationLevel: 1 })

    const status = await getVerificationStatus(CITIZEN_BASE.id)

    expect(status.level).toBe(1)
    expect(status.level_name).toBe('cedula_confirmada')
    expect(status.can_vote).toBe(true)
    expect(status.can_propose).toBe(false)
  })

  it('reflects level 2 capabilities correctly', async () => {
    mockCitizen.findUniqueOrThrow.mockResolvedValueOnce({ ...CITIZEN_BASE, verificationLevel: 2 })

    const status = await getVerificationStatus(CITIZEN_BASE.id)

    expect(status.level).toBe(2)
    expect(status.level_name).toBe('identidad_completa')
    expect(status.can_vote).toBe(true)
    expect(status.can_propose).toBe(true)
  })
})

// ── confirmCedula ─────────────────────────────────────────────────────────────

describe('confirmCedula', () => {
  it('upgrades citizen to level 1 when cedula matches', async () => {
    const crypto = await import('crypto')
    const cedula = '1234567890'
    const cedulaHash = crypto.createHash('sha256').update(cedula).digest('hex')

    mockCitizen.findUniqueOrThrow.mockResolvedValueOnce({
      ...CITIZEN_BASE,
      cedulaHash,
      verificationLevel: 0,
    })
    mockCitizen.update.mockResolvedValueOnce({ ...CITIZEN_BASE, verificationLevel: 1 })

    const status = await confirmCedula(CITIZEN_BASE.id, cedula)

    expect(status.level).toBe(1)
    expect(status.can_vote).toBe(true)
    expect(mockDelCache).toHaveBeenCalledWith('profile', CITIZEN_BASE.id)
  })

  it('throws 400 when cedula does not match hash', async () => {
    const crypto = await import('crypto')
    const wrongCedulaHash = crypto.createHash('sha256').update('9999999999').digest('hex')

    mockCitizen.findUniqueOrThrow.mockResolvedValueOnce({
      ...CITIZEN_BASE,
      cedulaHash: wrongCedulaHash,
      verificationLevel: 0,
    })

    await expect(confirmCedula(CITIZEN_BASE.id, '1234567890')).rejects.toMatchObject({
      statusCode: 400,
      code: 'CEDULA_MISMATCH',
    })
  })

  it('throws 409 when cedula already confirmed', async () => {
    mockCitizen.findUniqueOrThrow.mockResolvedValueOnce({ ...CITIZEN_BASE, verificationLevel: 1 })

    await expect(confirmCedula(CITIZEN_BASE.id, '1234567890')).rejects.toMatchObject({
      statusCode: 409,
      code: 'ALREADY_VERIFIED',
    })
  })
})

// ── requestEmailVerification ──────────────────────────────────────────────────

describe('requestEmailVerification', () => {
  it('throws 400 when citizen has no email', async () => {
    mockCitizen.findUniqueOrThrow.mockResolvedValueOnce({
      email: null,
      verificationLevel: 1,
    })

    await expect(requestEmailVerification(CITIZEN_BASE.id)).rejects.toMatchObject({
      statusCode: 400,
      code: 'NO_EMAIL',
    })
  })

  it('throws 422 when cedula not confirmed yet', async () => {
    mockCitizen.findUniqueOrThrow.mockResolvedValueOnce({
      email: 'user@example.com',
      verificationLevel: 0,
    })

    await expect(requestEmailVerification(CITIZEN_BASE.id)).rejects.toMatchObject({
      statusCode: 422,
      code: 'CEDULA_NOT_CONFIRMED',
    })
  })

  it('generates and stores a token in dev mode', async () => {
    mockCitizen.findUniqueOrThrow.mockResolvedValueOnce({
      email: 'user@example.com',
      verificationLevel: 1,
    })
    mockRedisSet.mockResolvedValueOnce('OK')

    const result = await requestEmailVerification(CITIZEN_BASE.id)

    expect(result.token).toHaveLength(64)
    expect(mockRedisSet).toHaveBeenCalledWith(
      expect.stringContaining(CITIZEN_BASE.id),
      result.token,
      'EX',
      expect.any(Number)
    )
  })

  it('throws 409 when email already verified', async () => {
    mockCitizen.findUniqueOrThrow.mockResolvedValueOnce({
      email: 'user@example.com',
      verificationLevel: 2,
    })

    await expect(requestEmailVerification(CITIZEN_BASE.id)).rejects.toMatchObject({
      statusCode: 409,
      code: 'ALREADY_VERIFIED',
    })
  })
})

// ── confirmEmail ──────────────────────────────────────────────────────────────

describe('confirmEmail', () => {
  const token = 'a'.repeat(64)

  it('upgrades citizen to level 2 with valid token', async () => {
    mockRedisGet.mockResolvedValueOnce(token)
    mockCitizen.update.mockResolvedValueOnce({ ...CITIZEN_BASE, verificationLevel: 2 })
    mockRedisDel.mockResolvedValueOnce(1)

    const status = await confirmEmail(CITIZEN_BASE.id, token)

    expect(status.level).toBe(2)
    expect(status.can_propose).toBe(true)
    expect(mockRedisDel).toHaveBeenCalled()
    expect(mockDelCache).toHaveBeenCalledWith('profile', CITIZEN_BASE.id)
  })

  it('throws 400 when token does not match', async () => {
    mockRedisGet.mockResolvedValueOnce('different-token')

    await expect(confirmEmail(CITIZEN_BASE.id, token)).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_TOKEN',
    })
  })

  it('throws 400 when token has expired (not in Redis)', async () => {
    mockRedisGet.mockResolvedValueOnce(null)

    await expect(confirmEmail(CITIZEN_BASE.id, token)).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_TOKEN',
    })
  })
})

// ── updateCitizenProfile ──────────────────────────────────────────────────────

describe('updateCitizenProfile', () => {
  it('updates neighborhood and locality, then invalidates cache', async () => {
    mockCitizen.update.mockResolvedValueOnce({})

    await updateCitizenProfile(CITIZEN_BASE.id, { neighborhood: 'Getsemaní', locality_id: 1 })

    expect(mockCitizen.update).toHaveBeenCalledWith({
      where: { id: CITIZEN_BASE.id },
      data: expect.objectContaining({ neighborhood: 'Getsemaní', localityId: 1 }),
    })
    expect(mockDelCache).toHaveBeenCalledWith('profile', CITIZEN_BASE.id)
  })

  it('updates only neighborhood when locality_id is omitted', async () => {
    mockCitizen.update.mockResolvedValueOnce({})

    await updateCitizenProfile(CITIZEN_BASE.id, { neighborhood: 'Bocagrande' })

    const callArg = mockCitizen.update.mock.calls[0][0]
    expect(callArg.data.neighborhood).toBe('Bocagrande')
    expect(callArg.data.localityId).toBeUndefined()
  })
})
