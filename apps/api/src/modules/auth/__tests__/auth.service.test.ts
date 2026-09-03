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
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
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

const mockRedisGetdel = jest.fn()
const mockRedisSet = jest.fn()

jest.mock('../../../lib/redis', () => ({
  redis: { getdel: mockRedisGetdel, set: mockRedisSet },
}))

const mockSendPasswordReset = jest.fn()

jest.mock('../../../lib/email', () => ({
  sendPasswordReset: mockSendPasswordReset,
}))

import bcrypt from 'bcrypt'
import { prisma } from '../../../lib/prisma'
import {
  registerCitizen,
  loginCitizen,
  getCitizenProfile,
  revokeSession,
  requestPasswordReset,
  resetPassword,
  changePassword,
} from '../auth.service'

const mockApp = {
  jwt: { sign: jest.fn().mockReturnValue('mock.access.token') },
} as unknown as FastifyInstance

// resetAllMocks limpia tanto calls como la cola de mockResolvedValueOnce
beforeEach(() => {
  jest.resetAllMocks()
  // Defaults para el flujo normal
  ;(bcrypt.hash as jest.Mock).mockResolvedValue('$2b$12$hashed_for_testing')
  ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)
  ;(prisma.$queryRaw as jest.Mock).mockResolvedValue([])
  ;(prisma.$executeRaw as jest.Mock).mockResolvedValue(1)
  mockSession.create.mockResolvedValue({ id: 'session-uuid' })
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
    ;(bcrypt.compare as jest.Mock).mockResolvedValue(false)

    await expect(
      loginCitizen(mockApp, { email: 'ghost@example.com', password: 'Password1' }, {})
    ).rejects.toMatchObject({ statusCode: 401, code: 'INVALID_CREDENTIALS' })
  })

  // Regresión: antes bcrypt.compare() se saltaba por completo cuando el
  // ciudadano no existía — el cuerpo de la respuesta era idéntico al de
  // password incorrecta, pero el TIEMPO no (una consulta a Postgres vs.
  // bcrypt.compare a 12 rondas), lo que permite enumerar emails registrados
  // midiendo latencia aunque el mensaje de error sea igual.
  it('siempre llama a bcrypt.compare, incluso cuando el ciudadano no existe (evita enumeración por temporización)', async () => {
    mockCitizen.findUnique.mockResolvedValueOnce(null)
    ;(bcrypt.compare as jest.Mock).mockResolvedValue(false)

    await expect(
      loginCitizen(mockApp, { email: 'ghost@example.com', password: 'Password1' }, {})
    ).rejects.toMatchObject({ statusCode: 401 })

    expect(bcrypt.compare).toHaveBeenCalledTimes(1)
    // Compara contra un hash de relleno, nunca contra undefined/null
    const [, hashArg] = (bcrypt.compare as jest.Mock).mock.calls[0]
    expect(typeof hashArg).toBe('string')
    expect(hashArg.length).toBeGreaterThan(0)
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
      role: 'citizen',
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
    expect(mockSession.create).toHaveBeenCalled()
    expect(prisma.$executeRaw).toHaveBeenCalled()
    expect(mockApp.jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'citizen', sid: 'session-uuid' }),
      expect.any(Object),
    )
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

// ── requestPasswordReset / resetPassword ────────────────────────────────────

describe('requestPasswordReset', () => {
  it('genera un token, lo guarda en Redis con TTL y envía el correo', async () => {
    mockCitizen.findUnique.mockResolvedValueOnce({ id: 'citizen-uuid', email: 'user@example.com' })
    mockRedisSet.mockResolvedValueOnce('OK')

    await requestPasswordReset('user@example.com')

    expect(mockRedisSet).toHaveBeenCalledWith(
      expect.stringContaining('vertice:pwd_reset:'),
      'citizen-uuid',
      'EX',
      30 * 60,
    )
    expect(mockSendPasswordReset).toHaveBeenCalledWith('user@example.com', expect.any(String))
  })

  it('no hace nada (ni Redis ni email) cuando el email no existe — previene enumeración', async () => {
    mockCitizen.findUnique.mockResolvedValueOnce(null)

    await requestPasswordReset('ghost@example.com')

    expect(mockRedisSet).not.toHaveBeenCalled()
    expect(mockSendPasswordReset).not.toHaveBeenCalled()
  })
})

describe('resetPassword', () => {
  it('actualiza la contraseña y revoca todas las sesiones activas', async () => {
    mockRedisGetdel.mockResolvedValueOnce('citizen-uuid')
    ;(prisma.$transaction as jest.Mock).mockResolvedValueOnce([{}, {}])

    await resetPassword('valid-token', 'NuevaClave123')

    expect(mockRedisGetdel).toHaveBeenCalledWith('vertice:pwd_reset:valid-token')
    expect(bcrypt.hash).toHaveBeenCalledWith('NuevaClave123', expect.any(Number))
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect((prisma.$transaction as jest.Mock).mock.calls[0][0]).toHaveLength(2) // update + revoke sessions
    expect(mockDelCache).toHaveBeenCalledWith('profile', 'citizen-uuid')
  })

  it('throws 400 cuando el token no existe o ya expiró', async () => {
    mockRedisGetdel.mockResolvedValueOnce(null)

    await expect(resetPassword('bad-token', 'NuevaClave123')).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_RESET_TOKEN',
    })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  // Regresión: antes era GET + DEL (después de la transacción), dejando el
  // token vigente durante toda la ventana de la transacción — y de forma
  // PERMANENTE si esta fallaba. GETDEL consume el token de un solo golpe, así
  // que una segunda solicitud con el mismo token (reintento, carrera, o
  // reutilización de un token filtrado) siempre lo ve como inexistente.
  it('un segundo intento con el mismo token, tras uno exitoso, falla — token de un solo uso', async () => {
    mockRedisGetdel.mockResolvedValueOnce('citizen-uuid').mockResolvedValueOnce(null)
    ;(prisma.$transaction as jest.Mock).mockResolvedValueOnce([{}, {}])

    await resetPassword('one-time-token', 'PrimeraClave1')
    await expect(resetPassword('one-time-token', 'SegundaClave2')).rejects.toMatchObject({
      code: 'INVALID_RESET_TOKEN',
    })

    expect(mockRedisGetdel).toHaveBeenCalledTimes(2)
  })
})

// ── changePassword ──────────────────────────────────────────────────────────

describe('changePassword', () => {
  it('actualiza la contraseña cuando la actual es correcta', async () => {
    mockCitizen.findUnique.mockResolvedValueOnce({ passwordHash: '$2b$12$current' })
    ;(bcrypt.compare as jest.Mock).mockResolvedValueOnce(true)
    ;(prisma.$transaction as jest.Mock).mockResolvedValueOnce([{}, {}])

    await changePassword('citizen-uuid', 'ClaveActual1', 'ClaveNueva2')

    expect(bcrypt.compare).toHaveBeenCalledWith('ClaveActual1', '$2b$12$current')
    expect(bcrypt.hash).toHaveBeenCalledWith('ClaveNueva2', expect.any(Number))
    expect(mockDelCache).toHaveBeenCalledWith('profile', 'citizen-uuid')
  })

  it('throws 401 cuando la contraseña actual es incorrecta, sin tocar la DB', async () => {
    mockCitizen.findUnique.mockResolvedValueOnce({ passwordHash: '$2b$12$current' })
    ;(bcrypt.compare as jest.Mock).mockResolvedValueOnce(false)

    await expect(
      changePassword('citizen-uuid', 'ClaveIncorrecta', 'ClaveNueva2')
    ).rejects.toMatchObject({ statusCode: 401, code: 'INVALID_CURRENT_PASSWORD' })

    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  // Misma protección de temporización que en login: comparar siempre, incluso
  // contra un ciudadano inexistente (no debería pasar vía requireAuth, pero
  // el servicio no debe confiar en eso ciegamente).
  it('llama a bcrypt.compare incluso si el ciudadano no aparece en la consulta', async () => {
    mockCitizen.findUnique.mockResolvedValueOnce(null)
    ;(bcrypt.compare as jest.Mock).mockResolvedValueOnce(false)

    await expect(
      changePassword('missing-uuid', 'cualquiera', 'ClaveNueva2')
    ).rejects.toMatchObject({ statusCode: 401 })

    expect(bcrypt.compare).toHaveBeenCalledTimes(1)
  })

  it('mantiene viva la sesión actual y cierra las demás, cuando se pasa el refresh token', async () => {
    mockCitizen.findUnique.mockResolvedValueOnce({ passwordHash: '$2b$12$current' })
    ;(bcrypt.compare as jest.Mock).mockResolvedValueOnce(true)
    ;(prisma.$transaction as jest.Mock).mockResolvedValueOnce([{}, {}])

    await changePassword('citizen-uuid', 'ClaveActual1', 'ClaveNueva2', 'current-refresh-token')

    const call = (prisma.$transaction as jest.Mock).mock.calls[0][0]
    expect(call).toHaveLength(2)
  })
})
