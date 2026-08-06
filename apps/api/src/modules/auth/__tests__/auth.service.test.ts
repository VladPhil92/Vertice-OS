import type { FastifyInstance } from 'fastify'
import type { CitizenPublicProfile } from '../auth.types'

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}))

const mockCitizen = {
  findFirst: jest.fn(),
  create: jest.fn(),
  findUnique: jest.fn(),
  findUniqueOrThrow: jest.fn(),
  update: jest.fn(),
}
const mockSession = {
  create: jest.fn(),
  findUnique: jest.fn(),
  updateMany: jest.fn(),
}

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    citizen: mockCitizen,
    session: mockSession,
    $transaction: jest.fn(),
  },
}))

const mockGetCache = jest.fn()
const mockSetCache = jest.fn()
const mockDelCache = jest.fn()

jest.mock('../../../lib/cache', () => ({
  getCache: mockGetCache,
  setCache: mockSetCache,
  delCache: mockDelCache,
  TTL: { PROFILE: 300, SESSION: 60 },
}))

import bcrypt from 'bcrypt'
import { prisma } from '../../../lib/prisma'
import { registerCitizen, loginCitizen, getCitizenProfile, revokeSession } from '../auth.service'

const mockApp = {
  jwt: { sign: jest.fn().mockReturnValue('mock.access.token') },
} as unknown as FastifyInstance

// resetAllMocks limpia tanto calls como la cola de mockResolvedValueOnce
beforeEach(() => {
  jest.resetAllMocks()
  // Defaults para el flujo normal
  ;(bcrypt.hash as jest.Mock).mockResolvedValue('$2b$12$hashed_for_testing')
  ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)
  mockApp.jwt.sign = jest.fn().mockReturnValue('mock.access.token')
})

// ── registerCitizen ──────────────────────────────────────────────────────────

describe('registerCitizen', () => {
  it('registers a new citizen successfully', async () => {
    mockCitizen.findFirst.mockResolvedValueOnce(null)
    mockCitizen.create.mockResolvedValueOnce({
      id: 'citizen-uuid',
      did: 'did:vertice:citizen-uuid',
    })

    const result = await registerCitizen({
      email: 'test@example.com',
      password: 'Password1',
      cedula: '1234567890',
    })

    expect(result.citizen_id).toBe('citizen-uuid')
    expect(result.did).toBe('did:vertice:citizen-uuid')
  })

  it('throws 409 when cedula already registered', async () => {
    const { hashCedula } = await import('../../../lib/identity-hash')
    const hash = hashCedula('1234567890')
    // findFirst devuelve un ciudadano cuyo cedulaHash coincide con el input
    mockCitizen.findFirst.mockResolvedValueOnce({ id: 'x', cedulaHash: hash, email: null })

    await expect(
      registerCitizen({ email: 'new@example.com', password: 'Password1', cedula: '1234567890' })
    ).rejects.toMatchObject({ statusCode: 409, code: 'CEDULA_ALREADY_EXISTS' })
  })

  it('throws 409 when email already registered', async () => {
    const { hashCedula } = await import('../../../lib/identity-hash')
    // Hash de una cédula DIFERENTE para que el chequeo de cédula no salte primero
    const differentHash = hashCedula('0000000000')
    mockCitizen.findFirst.mockResolvedValueOnce({
      id: 'x',
      cedulaHash: differentHash,
      email: 'test@example.com',
    })

    await expect(
      registerCitizen({ email: 'test@example.com', password: 'Password1', cedula: '1234567890' })
    ).rejects.toMatchObject({ statusCode: 409, code: 'EMAIL_ALREADY_EXISTS' })
  })
})

// ── loginCitizen ─────────────────────────────────────────────────────────────

describe('loginCitizen', () => {
  it('throws 401 when citizen does not exist', async () => {
    mockCitizen.findUnique.mockResolvedValueOnce(null)
    // bcrypt.compare NO se llama cuando el ciudadano no existe
    ;(bcrypt.compare as jest.Mock).mockResolvedValue(false)

    await expect(
      loginCitizen(mockApp, { email: 'ghost@example.com', password: 'Password1' }, {})
    ).rejects.toMatchObject({ statusCode: 401, code: 'INVALID_CREDENTIALS' })
  })

  it('throws 401 when password does not match', async () => {
    mockCitizen.findUnique.mockResolvedValueOnce({
      id: 'uuid',
      did: 'did:vertice:uuid',
      passwordHash: '$2b$12$hash',
      verificationLevel: 0,
    })
    ;(bcrypt.compare as jest.Mock).mockResolvedValue(false)

    await expect(
      loginCitizen(mockApp, { email: 'test@example.com', password: 'WrongPass' }, {})
    ).rejects.toMatchObject({ statusCode: 401, code: 'INVALID_CREDENTIALS' })
  })

  it('returns tokens on valid credentials', async () => {
    mockCitizen.findUnique.mockResolvedValueOnce({
      id: 'citizen-uuid',
      did: 'did:vertice:citizen-uuid',
      passwordHash: '$2b$12$hash',
      verificationLevel: 1,
    })
    // bcrypt.compare ya devuelve true por el beforeEach
    ;(prisma.$transaction as jest.Mock).mockResolvedValueOnce([{}, {}])

    const result = await loginCitizen(
      mockApp,
      { email: 'test@example.com', password: 'Password1' },
      { userAgent: 'test-agent', ipAddress: '127.0.0.1' }
    )

    expect(result.access_token).toBe('mock.access.token')
    expect(result.token_type).toBe('Bearer')
    expect(result.refresh_token).toHaveLength(80) // 40 bytes → hex = 80 chars
    expect(result.citizen_id).toBe('citizen-uuid')
  })
})

// ── getCitizenProfile ─────────────────────────────────────────────────────────

describe('getCitizenProfile', () => {
  const cachedProfile: CitizenPublicProfile = {
    id: 'citizen-uuid',
    did: 'did:vertice:citizen-uuid',
    email: 'test@example.com',
    neighborhood: 'Getsemaní',
    locality_id: 1,
    reputation_score: '0.0000',
    verification_level: 0,
    created_at: new Date('2024-01-01'),
    last_active_at: null,
  }

  it('returns cached profile without hitting DB', async () => {
    mockGetCache.mockResolvedValueOnce(cachedProfile)

    const result = await getCitizenProfile('citizen-uuid')

    expect(result).toEqual(cachedProfile)
    expect(mockCitizen.findUniqueOrThrow).not.toHaveBeenCalled()
    expect(mockSetCache).not.toHaveBeenCalled()
  })

  it('fetches from DB on cache miss and caches the result', async () => {
    mockGetCache.mockResolvedValueOnce(null)
    mockCitizen.findUniqueOrThrow.mockResolvedValueOnce({
      id: 'citizen-uuid',
      did: 'did:vertice:citizen-uuid',
      email: 'test@example.com',
      neighborhood: 'Getsemaní',
      localityId: 1,
      reputationScore: { toString: () => '0.0000' },
      verificationLevel: 0,
      createdAt: new Date('2024-01-01'),
      lastActiveAt: null,
    })

    const result = await getCitizenProfile('citizen-uuid')

    expect(mockSetCache).toHaveBeenCalledWith(
      'profile',
      'citizen-uuid',
      expect.objectContaining({ id: 'citizen-uuid' }),
      300
    )
    expect(result.id).toBe('citizen-uuid')
    expect(result.reputation_score).toBe('0.0000')
  })
})

// ── revokeSession ─────────────────────────────────────────────────────────────

describe('revokeSession', () => {
  it('revokes session and invalidates profile cache', async () => {
    mockSession.findUnique.mockResolvedValueOnce({ citizenId: 'citizen-uuid' })
    mockSession.updateMany.mockResolvedValueOnce({ count: 1 })

    await revokeSession('raw-refresh-token')

    expect(mockSession.findUnique).toHaveBeenCalledWith({
      where: { refreshTokenHash: expect.any(String) },
      select: { citizenId: true },
    })
    expect(mockSession.updateMany).toHaveBeenCalledWith({
      where: { refreshTokenHash: expect.any(String), revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    })
    expect(mockDelCache).toHaveBeenCalledWith('profile', 'citizen-uuid')
  })

  it('does not call delCache if session not found', async () => {
    mockSession.findUnique.mockResolvedValueOnce(null)
    mockSession.updateMany.mockResolvedValueOnce({ count: 0 })

    await revokeSession('unknown-token')

    expect(mockDelCache).not.toHaveBeenCalled()
  })
})
