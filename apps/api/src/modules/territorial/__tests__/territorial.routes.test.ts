jest.mock('../../../lib/redis', () => ({
  redis: { ping: jest.fn().mockResolvedValue('PONG'), get: jest.fn(), set: jest.fn(), del: jest.fn(), on: jest.fn() },
}))

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    citizen: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn() },
    $queryRaw: jest.fn().mockResolvedValue([]),
    $queryRawUnsafe: jest.fn().mockResolvedValue([]),
  },
}))

const mockCreate = jest.fn()
const mockList = jest.fn()
const mockGetById = jest.fn()
const mockNearby = jest.fn()
const mockUpdateStatus = jest.fn()
const mockStats = jest.fn()

jest.mock('../territorial.service', () => ({
  createReport: mockCreate,
  listReports: mockList,
  getReportById: mockGetById,
  getNearbyReports: mockNearby,
  updateReportStatus: mockUpdateStatus,
  getTerritorialStats: mockStats,
}))

import { buildApp } from '../../../app'

const app = buildApp()
const DID = 'did:vertice:550e8400-e29b-41d4-a716-446655440000'
const CITIZEN_ID = '550e8400-e29b-41d4-a716-446655440000'

let verifiedToken: string
let moderatorToken: string

beforeAll(async () => {
  await app.ready()
  verifiedToken  = app.jwt.sign({ sub: CITIZEN_ID, did: DID, lvl: 1, role: 'citizen' })
  moderatorToken = app.jwt.sign({ sub: CITIZEN_ID, did: DID, lvl: 2, role: 'moderator' })
})
afterAll(() => app.close())
beforeEach(() => jest.resetAllMocks())

const MOCK_REPORT = {
  id: 'rep-uuid',
  citizen_id: CITIZEN_ID,
  category: 'infraestructura',
  subcategory: null,
  title: 'Hueco grande en la Calle 30',
  description: 'Gran hueco afecta el tráfico y daña vehículos en sector Manga',
  lat: 10.4236,
  lng: -75.5518,
  neighborhood: 'Manga',
  locality_id: 1,
  address_reference: null,
  urgency_score: 0.5,
  status: 'open',
  media_urls: [],
  created_at: new Date('2024-06-01'),
  updated_at: new Date('2024-06-01'),
  resolved_at: null,
}

const MOCK_SUMMARY = {
  id: 'rep-uuid',
  category: 'infraestructura',
  title: 'Hueco grande en la Calle 30',
  lat: 10.4236,
  lng: -75.5518,
  neighborhood: 'Manga',
  status: 'open',
  urgency_score: 0.5,
  created_at: new Date('2024-06-01'),
}

// ── GET /territorial/reports ───────────────────────────────────────────────────

describe('GET /territorial/reports', () => {
  it('returns list of reports (public endpoint)', async () => {
    mockList.mockResolvedValueOnce([MOCK_SUMMARY])

    const res = await app.inject({ method: 'GET', url: '/territorial/reports' })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.data).toHaveLength(1)
    expect(body.count).toBe(1)
  })

  it('passes filter parameters to service', async () => {
    mockList.mockResolvedValueOnce([])

    await app.inject({
      method: 'GET',
      url: '/territorial/reports?category=seguridad&status=open&locality_id=1',
    })

    expect(mockList).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'seguridad', status: 'open', locality_id: 1 })
    )
  })

  it('returns 400 on invalid category', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/territorial/reports?category=invalid_category',
    })
    expect(res.statusCode).toBe(400)
  })
})

// ── GET /territorial/reports/nearby ────────────────────────────────────────────

describe('GET /territorial/reports/nearby', () => {
  it('returns nearby reports with distance', async () => {
    mockNearby.mockResolvedValueOnce([{ ...MOCK_SUMMARY, description: 'Gran hueco', distance_meters: 230 }])

    const res = await app.inject({
      method: 'GET',
      url: '/territorial/reports/nearby?lat=10.4236&lng=-75.5518&radius_km=1',
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.data[0].distance_meters).toBe(230)
  })

  it('returns 400 when lat/lng are missing', async () => {
    const res = await app.inject({ method: 'GET', url: '/territorial/reports/nearby' })
    expect(res.statusCode).toBe(400)
  })
})

// ── GET /territorial/stats ─────────────────────────────────────────────────────

describe('GET /territorial/stats', () => {
  it('returns territorial stats (public)', async () => {
    mockStats.mockResolvedValueOnce({
      by_category: [{ category: 'infraestructura', total: 42, open_count: 30, resolved_count: 10, avg_urgency: 0.5 }],
      total_reports: 42,
      open_reports: 30,
    })

    const res = await app.inject({ method: 'GET', url: '/territorial/stats' })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.total_reports).toBe(42)
    expect(body.by_category).toHaveLength(1)
  })
})

// ── GET /territorial/reports/:id ───────────────────────────────────────────────

describe('GET /territorial/reports/:id', () => {
  it('returns full report detail (public)', async () => {
    mockGetById.mockResolvedValueOnce(MOCK_REPORT)

    const res = await app.inject({ method: 'GET', url: '/territorial/reports/rep-uuid' })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.id).toBe('rep-uuid')
    expect(body.description).toBeDefined()
  })

  it('propagates 404 from service', async () => {
    mockGetById.mockRejectedValueOnce(
      Object.assign(new Error('Reporte no encontrado'), { statusCode: 404, code: 'REPORT_NOT_FOUND' })
    )

    const res = await app.inject({ method: 'GET', url: '/territorial/reports/nonexistent' })
    expect(res.statusCode).toBe(404)
  })
})

// ── POST /territorial/reports ──────────────────────────────────────────────────

describe('POST /territorial/reports', () => {
  it('returns 401 without authentication', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/territorial/reports',
      payload: {},
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 403 for unverified citizen (lvl 0)', async () => {
    const unverifiedToken = app.jwt.sign({ sub: CITIZEN_ID, did: DID, lvl: 0 })

    const res = await app.inject({
      method: 'POST',
      url: '/territorial/reports',
      headers: { authorization: `Bearer ${unverifiedToken}` },
      payload: {
        title: 'Problema en la vía pública del sector',
        description: 'Describe el problema en detalle para el reporte formal',
        category: 'infraestructura',
        lat: 10.4236,
        lng: -75.5518,
      },
    })
    expect(res.statusCode).toBe(403)
  })

  it('returns 400 when title is too short', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/territorial/reports',
      headers: { authorization: `Bearer ${verifiedToken}` },
      payload: {
        title: 'corto',
        description: 'Descripción válida con suficiente texto para pasar la validación mínima',
        category: 'infraestructura',
        lat: 10.4236,
        lng: -75.5518,
      },
    })
    expect(res.statusCode).toBe(400)
  })

  it('creates report and returns 201', async () => {
    mockCreate.mockResolvedValueOnce(MOCK_REPORT)

    const res = await app.inject({
      method: 'POST',
      url: '/territorial/reports',
      headers: { authorization: `Bearer ${verifiedToken}` },
      payload: {
        title: 'Hueco grande en la Calle 30',
        description: 'Gran hueco afecta el tráfico y daña vehículos en sector Manga',
        category: 'infraestructura',
        lat: 10.4236,
        lng: -75.5518,
        neighborhood: 'Manga',
        locality_id: 1,
      },
    })

    expect(res.statusCode).toBe(201)
    expect(JSON.parse(res.payload).id).toBe('rep-uuid')
    expect(mockCreate).toHaveBeenCalledWith(CITIZEN_ID, expect.objectContaining({
      title: 'Hueco grande en la Calle 30',
      category: 'infraestructura',
    }))
  })
})

// ── PATCH /territorial/reports/:id/status ─────────────────────────────────────

describe('PATCH /territorial/reports/:id/status', () => {
  it('returns 401 without authentication', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/territorial/reports/rep-uuid/status',
      payload: { status: 'resolved' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('updates status with valid payload', async () => {
    mockUpdateStatus.mockResolvedValueOnce({ ...MOCK_REPORT, status: 'resolved', resolved_at: new Date() })

    const res = await app.inject({
      method: 'PATCH',
      url: '/territorial/reports/rep-uuid/status',
      headers: { authorization: `Bearer ${moderatorToken}` },
      payload: { status: 'resolved' },
    })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.payload).status).toBe('resolved')
  })

  it('returns 400 for invalid status value', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/territorial/reports/rep-uuid/status',
      headers: { authorization: `Bearer ${moderatorToken}` },
      payload: { status: 'invalid_status' },
    })
    expect(res.statusCode).toBe(400)
  })
})
