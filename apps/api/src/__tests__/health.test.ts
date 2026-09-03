const mockRedisPing = jest.fn().mockResolvedValue('PONG')
const mockPrismaQueryRaw = jest.fn().mockResolvedValue([{ '?column?': 1 }])
const mockVerifyConnectivity = jest.fn().mockResolvedValue({})

jest.mock('../lib/redis', () => ({
  redis: {
    ping: mockRedisPing,
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    on: jest.fn(),
  },
}))

jest.mock('../lib/prisma', () => ({
  prisma: { $queryRaw: mockPrismaQueryRaw },
}))

jest.mock('../lib/neo4j', () => ({
  getNeo4jDriver: () => ({ verifyConnectivity: mockVerifyConnectivity }),
  closeNeo4j: jest.fn(),
}))

import { buildApp } from '../app'

const app = buildApp()

beforeAll(() => app.ready())
afterAll(() => app.close())

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.status).toBe('ok')
    expect(body.version).toBe('0.1.0')
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('reports the Railway commit SHA when available', async () => {
    process.env.RAILWAY_GIT_COMMIT_SHA = 'railway-test-revision'
    try {
      const res = await app.inject({ method: 'GET', url: '/health' })
      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.payload).revision).toBe('railway-test-revision')
    } finally {
      delete process.env.RAILWAY_GIT_COMMIT_SHA
    }
  })
})

describe('GET /health/ready', () => {
  beforeEach(() => {
    mockRedisPing.mockResolvedValue('PONG')
    mockPrismaQueryRaw.mockResolvedValue([{ '?column?': 1 }])
    mockVerifyConnectivity.mockResolvedValue({})
  })

  it('returns 200 when Redis, DB, and Neo4j are reachable', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/ready' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.status).toBe('ok')
    expect(body.checks.redis).toBe('ok')
    expect(body.checks.database).toBe('ok')
    expect(body.checks.neo4j).toBe('ok')
    expect(body.capabilities).toMatchObject({
      voting_crypto: 'ready',
      identity_crypto: 'ready',
      ctg_one_federation: 'disabled',
    })
    expect(body.capabilities).not.toHaveProperty('secrets')
  })

  it('returns 503 when Redis fails — dependencia requerida', async () => {
    mockRedisPing.mockRejectedValueOnce(new Error('ECONNREFUSED'))

    const res = await app.inject({ method: 'GET', url: '/health/ready' })
    expect(res.statusCode).toBe(503)
    const body = JSON.parse(res.payload)
    expect(body.status).toBe('unavailable')
    expect(body.checks.redis).toBe('fail')
    expect(body.checks.database).toBe('ok')
  })

  it('returns 503 when DB fails — dependencia requerida', async () => {
    mockPrismaQueryRaw.mockRejectedValueOnce(new Error('connection refused'))

    const res = await app.inject({ method: 'GET', url: '/health/ready' })
    expect(res.statusCode).toBe(503)
    const body = JSON.parse(res.payload)
    expect(body.status).toBe('unavailable')
    expect(body.checks.redis).toBe('ok')
    expect(body.checks.database).toBe('fail')
  })

  // Regresión: Neo4j contaba como dependencia requerida, así que el
  // healthcheck del despliegue devolvía 503 permanentemente cuando no se
  // desplegaba Neo4j. Sigue siendo observable, pero no bloquea la API base.
  it('sigue LISTO (200) cuando solo Neo4j falla — es dependencia opcional', async () => {
    mockVerifyConnectivity.mockRejectedValueOnce(new Error('ServiceUnavailable'))

    const res = await app.inject({ method: 'GET', url: '/health/ready' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.status).toBe('degraded')
    expect(body.checks.neo4j).toBe('fail')
    expect(body.checks.redis).toBe('ok')
    expect(body.checks.database).toBe('ok')
  })
})

describe('GET /health/federation', () => {
  it('fails closed without exposing secrets when the local trust secret is absent', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/federation' })
    expect(res.statusCode).toBe(503)
    const body = JSON.parse(res.payload)
    expect(body.status).toBe('local_unconfigured')
    expect(body).not.toHaveProperty('secret')
    expect(body).not.toHaveProperty('url')
  })
})
