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

import { Wallet } from 'ethers'
import {
  resolveDID,
  getOwnDIDDocument,
  getVerificationStatus,
  confirmCedula,
  requestEmailVerification,
  confirmEmail,
  updateCitizenProfile,
  connectWallet,
  requestWalletNonce,
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
    // No debe publicarse ninguna clave criptográfica: no existe un método
    // real todavía (ver nota de privacidad en buildDIDDocument).
    expect(doc.verificationMethod).toBeUndefined()
    expect(doc.authentication).toBeUndefined()
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
    expect(status.level_name).toBe('documento_declarado')
    expect(status.can_vote).toBe(true)
    expect(status.can_propose).toBe(false)
  })

  it('reflects level 2 capabilities correctly', async () => {
    mockCitizen.findUniqueOrThrow.mockResolvedValueOnce({ ...CITIZEN_BASE, verificationLevel: 2 })

    const status = await getVerificationStatus(CITIZEN_BASE.id)

    expect(status.level).toBe(2)
    expect(status.level_name).toBe('contacto_verificado')
    expect(status.can_vote).toBe(true)
    expect(status.can_propose).toBe(true)
  })
})

// ── confirmCedula ─────────────────────────────────────────────────────────────

describe('confirmCedula', () => {
  it('upgrades citizen to level 1 when cedula matches', async () => {
    const { hashCedula } = await import('../../../lib/identity-hash')
    const cedula = '1234567890'
    const cedulaHash = hashCedula(cedula)

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
    const { hashCedula } = await import('../../../lib/identity-hash')
    const wrongCedulaHash = hashCedula('9999999999')

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

// ── requestWalletNonce / connectWallet (firma real, sin mockear ethers) ────────
// Regresión: antes conectar una wallet solo comprobaba formato + unicidad, sin
// exigir prueba de control real. Estos tests firman de verdad con una wallet
// efímera de ethers para ejercitar la verificación criptográfica completa, no
// solo el camino feliz con mocks.

describe('requestWalletNonce', () => {
  it('genera un mensaje que incluye la dirección y guarda el nonce en Redis con TTL', async () => {
    const wallet = Wallet.createRandom()
    mockRedisSet.mockResolvedValueOnce('OK')

    const { message } = await requestWalletNonce(CITIZEN_BASE.id, wallet.address)

    expect(message).toContain(wallet.address)
    expect(message).toContain(CITIZEN_BASE.id)
    expect(mockRedisSet).toHaveBeenCalledWith(
      expect.stringContaining(CITIZEN_BASE.id),
      expect.any(String),
      'EX',
      expect.any(Number),
    )
  })

  it('rechaza una dirección con formato inválido', async () => {
    await expect(requestWalletNonce(CITIZEN_BASE.id, 'not-an-address')).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_WALLET_ADDRESS',
    })
  })
})

describe('connectWallet', () => {
  it('conecta la wallet cuando la firma es válida y corresponde a la dirección', async () => {
    const wallet = Wallet.createRandom()
    const nonce = 'test-nonce-abc123'
    mockRedisGet.mockResolvedValueOnce(nonce)

    const message = [
      'localhost:3000 quiere que conectes tu wallet a VÉRTICE OS.',
      '',
      `Ciudadano: ${CITIZEN_BASE.id}`,
      `Wallet: ${wallet.address}`,
      `Nonce: ${nonce}`,
    ].join('\n')
    const signature = await wallet.signMessage(message)

    mockCitizen.findUnique.mockResolvedValueOnce(null) // sin conflicto
    mockCitizen.update.mockResolvedValueOnce({
      id: CITIZEN_BASE.id, did: CITIZEN_BASE.did, verificationLevel: 0, sbtTokenId: null,
    })

    const result = await connectWallet(CITIZEN_BASE.id, { wallet_address: wallet.address, signature })

    expect(result.wallet_address).toBe(wallet.address)
    expect(mockRedisDel).toHaveBeenCalled() // nonce consumido de un solo uso
  })

  it('rechaza cuando no hay nonce pendiente (expirado o nunca solicitado)', async () => {
    mockRedisGet.mockResolvedValueOnce(null)

    await expect(connectWallet(CITIZEN_BASE.id, {
      wallet_address: '0x' + 'a'.repeat(40),
      signature: '0x' + '0'.repeat(130),
    })).rejects.toMatchObject({ statusCode: 400, code: 'NONCE_EXPIRED' })
  })

  it('rechaza una firma que no corresponde a la dirección declarada', async () => {
    // El ciudadano firma con SU wallet real, pero afirma una dirección AJENA
    // — exactamente el ataque que este fix cierra: copiar la dirección
    // pública de otra persona y reclamarla sin controlarla.
    const attacker = Wallet.createRandom()
    const victimAddress = Wallet.createRandom().address
    const nonce = 'test-nonce-xyz789'
    mockRedisGet.mockResolvedValueOnce(nonce)

    const message = [
      'localhost:3000 quiere que conectes tu wallet a VÉRTICE OS.',
      '',
      `Ciudadano: ${CITIZEN_BASE.id}`,
      `Wallet: ${victimAddress}`, // la dirección que el atacante DECLARA
      `Nonce: ${nonce}`,
    ].join('\n')
    const signature = await attacker.signMessage(message) // pero firma con SU propia clave

    await expect(connectWallet(CITIZEN_BASE.id, {
      wallet_address: victimAddress,
      signature,
    })).rejects.toMatchObject({ statusCode: 400, code: 'SIGNATURE_ADDRESS_MISMATCH' })
  })

  it('rechaza una firma sintácticamente inválida sin reventar', async () => {
    mockRedisGet.mockResolvedValueOnce('some-nonce')

    await expect(connectWallet(CITIZEN_BASE.id, {
      wallet_address: '0x' + 'a'.repeat(40),
      signature: '0xnotasignature',
    })).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_SIGNATURE' })
  })

  it('consume el nonce incluso cuando la firma es inválida (previene reintentos)', async () => {
    mockRedisGet.mockResolvedValueOnce('some-nonce')

    await connectWallet(CITIZEN_BASE.id, {
      wallet_address: '0x' + 'a'.repeat(40),
      signature: '0xnotasignature',
    }).catch(() => null)

    expect(mockRedisDel).toHaveBeenCalled()
  })
})
