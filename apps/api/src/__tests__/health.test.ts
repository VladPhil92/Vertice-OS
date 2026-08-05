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
  })

  it('returns 503 and marks degraded when Redis fails', async () => {
    mockRedisPing.mockRejectedValueOnce(new Error('ECONNREFUSED'))

    const res = await app.inject({ method: 'GET', url: '/health/ready' })
    expect(res.statusCode).toBe(503)
    const body = JSON.parse(res.payload)
    expect(body.status).toBe('degraded')
    expect(body.checks.redis).toBe('fail')
    expect(body.checks.database).toBe('ok')
  })

  it('returns 503 and marks degraded when DB fails', async () => {
    mockPrismaQueryRaw.mockRejectedValueOnce(new Error('connection refused'))

    const res = await app.inject({ method: 'GET', url: '/health/ready' })
    expect(res.statusCode).toBe(503)
    const body = JSON.parse(res.payload)
    expect(body.status).toBe('degraded')
    expect(body.checks.redis).toBe('ok')
    expect(body.checks.database).toBe('fail')
  })

  it('returns 503 and marks degraded when Neo4j fails', async () => {
    mockVerifyConnectivity.mockRejectedValueOnce(new Error('ServiceUnavailable'))

    const res = await app.inject({ method: 'GET', url: '/health/ready' })
    expect(res.statusCode).toBe(503)
    const body = JSON.parse(res.payload)
    expect(body.status).toBe('degraded')
    expect(body.checks.neo4j).toBe('fail')
    expect(body.checks.redis).toBe('ok')
    expect(body.checks.database).toBe('ok')
  })
})
