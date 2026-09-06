jest.mock('../../../lib/redis', () => ({
  redis: {
    ping: jest.fn().mockResolvedValue('PONG'),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    on: jest.fn(),
  },
}))

const mockQueryRaw = jest.fn().mockResolvedValue([{ ok: 1 }])
const mockCitizenDashboard = jest.fn()
const mockPilotDashboard = jest.fn()

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    citizen: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn() },
    $queryRaw: mockQueryRaw,
    $queryRawUnsafe: jest.fn().mockResolvedValue([]),
  },
}))

jest.mock('../dashboard.service', () => ({
  getCitizenCommandCenter: mockCitizenDashboard,
}))

jest.mock('../pilot.service', () => ({
  getPilotControlCenter: mockPilotDashboard,
}))

import { buildApp } from '../../../app'

const app = buildApp()
const CITIZEN_ID = '550e8400-e29b-41d4-a716-446655440000'
const DID = `did:vertice:${CITIZEN_ID}`

let citizenToken: string
let adminToken: string
let superadminToken: string

beforeAll(async () => {
  await app.ready()
  citizenToken = app.jwt.sign({ sub: CITIZEN_ID, did: DID, lvl: 1, role: 'citizen' })
  adminToken = app.jwt.sign({ sub: CITIZEN_ID, did: DID, lvl: 2, role: 'admin' })
  superadminToken = app.jwt.sign({ sub: CITIZEN_ID, did: DID, lvl: 2, role: 'superadmin' })
})

afterAll(() => app.close())

beforeEach(() => {
  jest.clearAllMocks()
  mockQueryRaw.mockResolvedValue([{ ok: 1 }])
})

describe('GET /dashboard/admin/pilot', () => {
  it('rejects unauthenticated access', async () => {
    const res = await app.inject({ method: 'GET', url: '/dashboard/admin/pilot' })
    expect(res.statusCode).toBe(401)
    expect(mockPilotDashboard).not.toHaveBeenCalled()
  })

  it('rejects ordinary citizen roles', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/dashboard/admin/pilot',
      headers: { authorization: `Bearer ${citizenToken}` },
    })

    expect(res.statusCode).toBe(403)
    expect(mockPilotDashboard).not.toHaveBeenCalled()
  })

  it('fails closed when a privileged role grant was revoked', async () => {
    mockQueryRaw.mockResolvedValueOnce([])

    const res = await app.inject({
      method: 'GET',
      url: '/dashboard/admin/pilot',
      headers: { authorization: `Bearer ${adminToken}` },
    })

    expect(res.statusCode).toBe(403)
    expect(JSON.parse(res.payload).code).toBe('ROLE_GRANT_REVOKED')
    expect(mockPilotDashboard).not.toHaveBeenCalled()
  })

  it.each([
    ['admin', () => adminToken],
    ['superadmin', () => superadminToken],
  ])('serves privacy-safe pilot metrics to %s', async (_role, tokenFactory) => {
    mockPilotDashboard.mockResolvedValueOnce({
      window_days: 7,
      cohort: { active_citizens: 100 },
      generated_at: '2026-09-06T17:00:00.000Z',
    })

    const res = await app.inject({
      method: 'GET',
      url: '/dashboard/admin/pilot',
      headers: { authorization: `Bearer ${tokenFactory()}` },
    })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.payload).cohort.active_citizens).toBe(100)
    expect(mockPilotDashboard).toHaveBeenCalledTimes(1)
  })
})
