jest.mock('../../../lib/redis', () => ({
  redis: { ping: jest.fn().mockResolvedValue('PONG'), get: jest.fn(), set: jest.fn(), del: jest.fn(), on: jest.fn() },
}))

const mockPrismaQueryRaw = jest.fn().mockResolvedValue([])
jest.mock('../../../lib/prisma', () => ({
  prisma: {
    citizen: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn() },
    $queryRaw: mockPrismaQueryRaw,
  },
}))

const mockListTerritories = jest.fn()
const mockGetTerritory = jest.fn()
const mockGetMyTerritory = jest.fn()
const mockSetMyTerritory = jest.fn()
const mockGetActivationMetrics = jest.fn()
const mockSetActivationStatus = jest.fn()
const mockSyncDivipolaCatalog = jest.fn()
jest.mock('../territories.service', () => ({
  TERRITORY_LEVELS: ['country', 'department', 'municipality', 'district', 'locality', 'commune', 'neighborhood', 'vereda'],
  ACTIVATION_STATUSES: ['available', 'emerging', 'community_active', 'pilot_ready', 'verified_network'],
  listTerritories: (...args: unknown[]) => mockListTerritories(...args),
  getTerritory: (...args: unknown[]) => mockGetTerritory(...args),
  getMyTerritory: (...args: unknown[]) => mockGetMyTerritory(...args),
  setMyTerritory: (...args: unknown[]) => mockSetMyTerritory(...args),
  getActivationMetrics: (...args: unknown[]) => mockGetActivationMetrics(...args),
  setActivationStatus: (...args: unknown[]) => mockSetActivationStatus(...args),
  syncDivipolaCatalog: (...args: unknown[]) => mockSyncDivipolaCatalog(...args),
}))

const mockGetTerritoryFeed = jest.fn()
jest.mock('../territories.feed', () => ({
  getTerritoryFeed: (...args: unknown[]) => mockGetTerritoryFeed(...args),
}))

const mockGetNationalActivationRanking = jest.fn()
jest.mock('../territories.ranking', () => ({
  getNationalActivationRanking: (...args: unknown[]) => mockGetNationalActivationRanking(...args),
}))

import { buildApp } from '../../../app'

const app = buildApp()
const CITIZEN_ID = '550e8400-e29b-41d4-a716-446655440001'
const SUPERADMIN_ID = '550e8400-e29b-41d4-a716-446655440002'
const DID = 'did:vertice:550e8400-e29b-41d4-a716-446655440000'

let token: string
let superadminToken: string

beforeAll(async () => {
  await app.ready()
  token = app.jwt.sign({ sub: CITIZEN_ID, did: DID, lvl: 1 })
  superadminToken = app.jwt.sign({ sub: SUPERADMIN_ID, did: DID, lvl: 1, role: 'superadmin', sid: 'session-1' })
})
afterAll(() => app.close())
beforeEach(() => {
  jest.resetAllMocks()
  mockPrismaQueryRaw.mockResolvedValue([{ ok: 1 }])
})

describe('GET /territories', () => {
  it('lists territories without authentication', async () => {
    mockListTerritories.mockResolvedValue([{ code: 'CO-MP-13001' }])
    const res = await app.inject({ method: 'GET', url: '/territories' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ count: 1 })
  })

  it('rejects an invalid level filter', async () => {
    const res = await app.inject({ method: 'GET', url: '/territories?level=planet' })
    expect(res.statusCode).toBe(400)
    expect(mockListTerritories).not.toHaveBeenCalled()
  })
})

describe('GET /territories/activation/ranking', () => {
  it('returns the national ranking with its scoring boundary note', async () => {
    mockGetNationalActivationRanking.mockResolvedValue([])
    const res = await app.inject({ method: 'GET', url: '/territories/activation/ranking' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ scoring_boundary: 'civic_activity_only' })
  })

  it('rejects a limit outside the 1-100 range', async () => {
    const res = await app.inject({ method: 'GET', url: '/territories/activation/ranking?limit=0' })
    expect(res.statusCode).toBe(400)
  })
})

describe('GET /territories/me', () => {
  it('requires authentication', async () => {
    const res = await app.inject({ method: 'GET', url: '/territories/me' })
    expect(res.statusCode).toBe(401)
  })

  it('returns the citizen territory when authenticated', async () => {
    mockGetMyTerritory.mockResolvedValue({ territory_code: 'CO-MP-13001' })
    const res = await app.inject({ method: 'GET', url: '/territories/me', headers: { Authorization: `Bearer ${token}` } })
    expect(res.statusCode).toBe(200)
    expect(mockGetMyTerritory).toHaveBeenCalledWith(CITIZEN_ID)
  })
})

describe('PUT /territories/me', () => {
  it('rejects an invalid body', async () => {
    const res = await app.inject({
      method: 'PUT', url: '/territories/me',
      headers: { Authorization: `Bearer ${token}` },
      payload: { territory_code: '' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('sets the citizen territory and marks it self-asserted', async () => {
    mockSetMyTerritory.mockResolvedValue({ territory_code: 'CO-MP-13001', neighborhood: 'Manga', locality_id: null, territory: {} })
    const res = await app.inject({
      method: 'PUT', url: '/territories/me',
      headers: { Authorization: `Bearer ${token}` },
      payload: { territory_code: 'CO-MP-13001', neighborhood: 'Manga' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ territory_assurance: 'self_asserted', governance_effect: 'none_without_territory_assurance' })
  })
})

describe('POST /territories/admin/sync-divipola', () => {
  it('rejects a non-superadmin citizen', async () => {
    const res = await app.inject({
      method: 'POST', url: '/territories/admin/sync-divipola',
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    expect(mockSyncDivipolaCatalog).not.toHaveBeenCalled()
  })

  it('forces a sync for a live superadmin session', async () => {
    mockSyncDivipolaCatalog.mockResolvedValue({ skipped: false, records_seen: 1102, records_upserted: 1102 })
    const res = await app.inject({
      method: 'POST', url: '/territories/admin/sync-divipola',
      headers: { Authorization: `Bearer ${superadminToken}` },
    })
    expect(res.statusCode).toBe(200)
    expect(mockSyncDivipolaCatalog).toHaveBeenCalledWith({ force: true })
  })
})

describe('PATCH /territories/admin/:code/activation', () => {
  it('rejects a reason shorter than the minimum', async () => {
    const res = await app.inject({
      method: 'PATCH', url: '/territories/admin/CO-MP-13001/activation',
      headers: { Authorization: `Bearer ${superadminToken}` },
      payload: { status: 'pilot_ready', reason: 'short' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('updates the activation status for a live superadmin session', async () => {
    mockSetActivationStatus.mockResolvedValue({ territory: {}, metrics: {} })
    const res = await app.inject({
      method: 'PATCH', url: '/territories/admin/CO-MP-13001/activation',
      headers: { Authorization: `Bearer ${superadminToken}` },
      payload: { status: 'pilot_ready', reason: 'meets pilot readiness criteria' },
    })
    expect(res.statusCode).toBe(200)
    expect(mockSetActivationStatus).toHaveBeenCalledWith({
      actorId: SUPERADMIN_ID, territoryCode: 'CO-MP-13001', status: 'pilot_ready', reason: 'meets pilot readiness criteria',
    })
  })
})

describe('GET /territories/:code/feed', () => {
  it('returns the territorial feed', async () => {
    mockGetTerritoryFeed.mockResolvedValue({ territory: {}, actions: [], reports: [], proposals: [], empty_state: null })
    const res = await app.inject({ method: 'GET', url: '/territories/CO-MP-13001/feed' })
    expect(res.statusCode).toBe(200)
    expect(mockGetTerritoryFeed).toHaveBeenCalledWith('CO-MP-13001', 12)
  })

  it('rejects a feed limit outside the 1-30 range', async () => {
    const res = await app.inject({ method: 'GET', url: '/territories/CO-MP-13001/feed?limit=31' })
    expect(res.statusCode).toBe(400)
  })
})

describe('GET /territories/:code/activation', () => {
  it('returns the activation metrics', async () => {
    mockGetActivationMetrics.mockResolvedValue({ momentum_score: 42, recommended_status: 'community_active' })
    const res = await app.inject({ method: 'GET', url: '/territories/CO-MP-13001/activation' })
    expect(res.statusCode).toBe(200)
    expect(mockGetActivationMetrics).toHaveBeenCalledWith('CO-MP-13001')
  })
})

describe('GET /territories/:code', () => {
  it('returns the territory', async () => {
    mockGetTerritory.mockResolvedValue({ code: 'CO-MP-13001' })
    const res = await app.inject({ method: 'GET', url: '/territories/CO-MP-13001' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ code: 'CO-MP-13001' })
  })
})
