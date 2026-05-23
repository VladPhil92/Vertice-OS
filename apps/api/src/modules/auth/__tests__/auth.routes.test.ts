// Mocks antes de imports — Jest los hoista automáticamente

jest.mock('../../../lib/redis', () => ({
  redis: {
    ping: jest.fn().mockResolvedValue('PONG'),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    on: jest.fn(),
  },
}))

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    citizen: { findFirst: jest.fn(), create: jest.fn(), findUniqueOrThrow: jest.fn() },
    session: { create: jest.fn(), findUnique: jest.fn(), updateMany: jest.fn() },
    $queryRaw: jest.fn().mockResolvedValue([]),
    $transaction: jest.fn(),
  },
}))

const mockRegister = jest.fn()
const mockLogin = jest.fn()
const mockRefresh = jest.fn()
const mockRevoke = jest.fn()
const mockGetProfile = jest.fn()

jest.mock('../auth.service', () => ({
  registerCitizen: mockRegister,
  loginCitizen: mockLogin,
  refreshAccessToken: mockRefresh,
  revokeSession: mockRevoke,
  getCitizenProfile: mockGetProfile,
}))

import { buildApp } from '../../../app'

const app = buildApp()

beforeAll(() => app.ready())
afterAll(() => app.close())
beforeEach(() => jest.clearAllMocks())

// ── POST /auth/register ───────────────────────────────────────────────────────

describe('POST /auth/register', () => {
  it('returns 201 on successful registration', async () => {
    mockRegister.mockResolvedValueOnce({ citizen_id: 'uuid-123', did: 'did:vertice:uuid-123' })

    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'new@example.com', password: 'Password1', cedula: '1234567890' },
    })

    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.payload)
    expect(body.citizen_id).toBe('uuid-123')
    expect(body.did).toBe('did:vertice:uuid-123')
  })

  it('returns 400 when body is missing required fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'bad@example.com' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when password is too weak', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'a@example.com', password: 'weak', cedula: '123456' },
    })
    expect(res.statusCode).toBe(400)
  })
})

// ── POST /auth/token ──────────────────────────────────────────────────────────

describe('POST /auth/token', () => {
  it('returns access token and sets refresh cookie on valid login', async () => {
    mockLogin.mockResolvedValueOnce({
      access_token: 'mock.token',
      token_type: 'Bearer',
      expires_in: 900,
      citizen_id: 'uuid-123',
      refresh_token: 'raw-refresh-token-80-chars-long-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })

    const res = await app.inject({
      method: 'POST',
      url: '/auth/token',
      payload: { email: 'user@example.com', password: 'Password1' },
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.access_token).toBe('mock.token')
    expect(body.refresh_token).toBeUndefined() // no debe estar en el body
    expect(res.headers['set-cookie']).toBeDefined()
  })

  it('returns 400 when body is invalid', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/token',
      payload: { email: 'not-an-email' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('propagates 401 from service on bad credentials', async () => {
    mockLogin.mockRejectedValueOnce(
      Object.assign(new Error('Credenciales inválidas'), { statusCode: 401, code: 'INVALID_CREDENTIALS' })
    )

    const res = await app.inject({
      method: 'POST',
      url: '/auth/token',
      payload: { email: 'user@example.com', password: 'WrongPass1' },
    })
    expect(res.statusCode).toBe(401)
  })
})

// ── POST /auth/refresh ────────────────────────────────────────────────────────

describe('POST /auth/refresh', () => {
  it('returns 401 when no refresh cookie present', async () => {
    const res = await app.inject({ method: 'POST', url: '/auth/refresh' })
    expect(res.statusCode).toBe(401)
    const body = JSON.parse(res.payload)
    expect(body.code).toBe('NO_REFRESH_TOKEN')
  })

  it('returns new access token when refresh cookie is valid', async () => {
    mockRefresh.mockResolvedValueOnce({
      access_token: 'new.access.token',
      token_type: 'Bearer',
      expires_in: 900,
    })

    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      cookies: { vertice_refresh: 'valid-refresh-token' },
    })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.payload).access_token).toBe('new.access.token')
  })
})

// ── POST /auth/logout ─────────────────────────────────────────────────────────

describe('POST /auth/logout', () => {
  it('clears the refresh cookie', async () => {
    mockRevoke.mockResolvedValueOnce(undefined)

    const res = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      cookies: { vertice_refresh: 'some-token' },
    })

    expect(res.statusCode).toBe(200)
    // Cookie debe borrarse (valor vacío o max-age=0)
    const cookie = res.headers['set-cookie'] as string
    expect(cookie).toMatch(/vertice_refresh=;|Max-Age=0/)
  })

  it('returns 200 even without a refresh cookie', async () => {
    const res = await app.inject({ method: 'POST', url: '/auth/logout' })
    expect(res.statusCode).toBe(200)
    expect(mockRevoke).not.toHaveBeenCalled()
  })
})

// ── GET /auth/me ──────────────────────────────────────────────────────────────

describe('GET /auth/me', () => {
  it('returns 401 without Authorization header', async () => {
    const res = await app.inject({ method: 'GET', url: '/auth/me' })
    expect(res.statusCode).toBe(401)
  })

  it('returns citizen profile with valid JWT', async () => {
    await app.ready()
    const token = app.jwt.sign({ sub: 'citizen-uuid', did: 'did:vertice:citizen-uuid', lvl: 0 })

    mockGetProfile.mockResolvedValueOnce({
      id: 'citizen-uuid',
      did: 'did:vertice:citizen-uuid',
      email: 'user@example.com',
      neighborhood: null,
      locality_id: null,
      reputation_score: '0.0000',
      verification_level: 0,
      created_at: new Date('2024-01-01'),
      last_active_at: null,
    })

    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.id).toBe('citizen-uuid')
    expect(mockGetProfile).toHaveBeenCalledWith('citizen-uuid')
  })
})
