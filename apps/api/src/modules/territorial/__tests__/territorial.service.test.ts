const mockQueryRaw = jest.fn()
const mockGetCache = jest.fn()
const mockSetCache = jest.fn()
const mockDelCache = jest.fn()

jest.mock('../../../lib/prisma', () => ({
  prisma: { $queryRaw: mockQueryRaw },
}))

jest.mock('../../../lib/cache', () => ({
  getCache: mockGetCache,
  setCache: mockSetCache,
  delCache: mockDelCache,
  TTL: { PROFILE: 300, SESSION: 60, REPORT: 120, STATS: 600 },
}))

import {
  createReport,
  listReports,
  getReportById,
  getNearbyReports,
  updateReportStatus,
  getTerritorialStats,
} from '../territorial.service'

// ── Fixture ───────────────────────────────────────────────────────────────────

const REPORT_ROW = {
  id: 'report-uuid',
  citizen_id: 'citizen-uuid',
  category: 'infraestructura',
  subcategory: 'vias',
  title: 'Hueco grande en la Calle 30',
  description: 'Gran hueco afecta el tráfico y daña vehículos en sector Manga',
  lat: 10.4236,
  lng: -75.5518,
  neighborhood: 'Manga',
  locality_id: 1,
  address_reference: 'Frente a la farmacia Cruz Verde',
  urgency_score: 0.5,
  status: 'open',
  media_urls: [],
  created_at: new Date('2024-06-01T10:00:00Z'),
  updated_at: new Date('2024-06-01T10:00:00Z'),
  resolved_at: null,
}

beforeEach(() => {
  jest.resetAllMocks()
  mockSetCache.mockResolvedValue(undefined)
  mockDelCache.mockResolvedValue(undefined)
})

// ── createReport ──────────────────────────────────────────────────────────────

describe('createReport', () => {
  it('creates report and returns transformed data', async () => {
    mockQueryRaw.mockResolvedValueOnce([REPORT_ROW])

    const report = await createReport('citizen-uuid', {
      title: 'Hueco grande en la Calle 30',
      description: 'Gran hueco afecta el tráfico y daña vehículos en sector Manga',
      category: 'infraestructura',
      lat: 10.4236,
      lng: -75.5518,
      media_urls: [],
    })

    expect(report.id).toBe('report-uuid')
    expect(report.category).toBe('infraestructura')
    expect(report.lat).toBe(10.4236)
    expect(report.lng).toBe(-75.5518)
    expect(report.status).toBe('open')
  })

  it('uses default urgency when not provided', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ ...REPORT_ROW, category: 'seguridad', urgency_score: 0.8 }])

    const report = await createReport('citizen-uuid', {
      title: 'Robo en el parque del barrio',
      description: 'Reporte de robo ocurrido ayer en el parque central del barrio',
      category: 'seguridad',
      lat: 10.4236,
      lng: -75.5518,
      media_urls: [],
    })

    // 'seguridad' defaults to 0.8
    expect(report.urgency_score).toBe(0.8)
  })

  it('normalizes number fields from DB strings', async () => {
    mockQueryRaw.mockResolvedValueOnce([{
      ...REPORT_ROW,
      lat: '10.4236',     // PostgreSQL could return as string
      lng: '-75.5518',
      urgency_score: '0.500',
      locality_id: '1',
    }])

    const report = await createReport('citizen-uuid', {
      title: 'Hueco grande en la Calle 30',
      description: 'Gran hueco afecta el tráfico y daña vehículos en sector Manga',
      category: 'infraestructura',
      lat: 10.4236,
      lng: -75.5518,
      media_urls: [],
    })

    expect(typeof report.lat).toBe('number')
    expect(typeof report.lng).toBe('number')
    expect(typeof report.urgency_score).toBe('number')
    expect(typeof report.locality_id).toBe('number')
  })
})

// ── listReports ───────────────────────────────────────────────────────────────

describe('listReports', () => {
  it('returns array of report summaries', async () => {
    mockQueryRaw.mockResolvedValueOnce([REPORT_ROW, { ...REPORT_ROW, id: 'report-uuid-2' }])

    const reports = await listReports({ limit: 20, offset: 0 })

    expect(reports).toHaveLength(2)
    expect(reports[0].id).toBe('report-uuid')
    // Summary no incluye description
    expect((reports[0] as any).description).toBeUndefined()
  })

  it('returns empty array when no reports', async () => {
    mockQueryRaw.mockResolvedValueOnce([])
    const reports = await listReports({ limit: 20, offset: 0 })
    expect(reports).toHaveLength(0)
  })
})

// ── getReportById ─────────────────────────────────────────────────────────────

describe('getReportById', () => {
  it('returns cached report without hitting DB', async () => {
    const cached = { ...REPORT_ROW, lat: 10.4236, lng: -75.5518 }
    mockGetCache.mockResolvedValueOnce(cached)

    const report = await getReportById('report-uuid')

    expect(report).toBe(cached)
    expect(mockQueryRaw).not.toHaveBeenCalled()
  })

  it('fetches from DB on cache miss and caches result', async () => {
    mockGetCache.mockResolvedValueOnce(null)
    mockQueryRaw.mockResolvedValueOnce([REPORT_ROW])

    const report = await getReportById('report-uuid')

    expect(report.id).toBe('report-uuid')
    expect(mockSetCache).toHaveBeenCalledWith('report', 'report-uuid', expect.objectContaining({ id: 'report-uuid' }), 120)
  })

  it('throws 404 when report does not exist', async () => {
    mockGetCache.mockResolvedValueOnce(null)
    mockQueryRaw.mockResolvedValueOnce([])

    await expect(getReportById('nonexistent')).rejects.toMatchObject({
      statusCode: 404,
      code: 'REPORT_NOT_FOUND',
    })
  })
})

// ── getNearbyReports ──────────────────────────────────────────────────────────

describe('getNearbyReports', () => {
  it('returns reports ordered by distance with distance_meters field', async () => {
    const nearbyRows = [
      { ...REPORT_ROW, description: 'Gran hueco afecta el tráfico y daña vehículos', distance_meters: 230.5 },
      { ...REPORT_ROW, id: 'r2', description: 'Otro problema en la zona cercana del barrio', distance_meters: 850.0 },
    ]
    mockQueryRaw.mockResolvedValueOnce(nearbyRows)

    const reports = await getNearbyReports({ lat: 10.4236, lng: -75.5518, radius_km: 1, limit: 10 })

    expect(reports).toHaveLength(2)
    expect(reports[0].distance_meters).toBe(230.5)
    expect(reports[1].distance_meters).toBe(850.0)
  })

  it('returns empty array when no reports nearby', async () => {
    mockQueryRaw.mockResolvedValueOnce([])

    const reports = await getNearbyReports({ lat: 0, lng: 0, radius_km: 0.1, limit: 10 })
    expect(reports).toHaveLength(0)
  })
})

// ── updateReportStatus ────────────────────────────────────────────────────────

describe('updateReportStatus', () => {
  it('updates status and invalidates cache', async () => {
    const updated = { ...REPORT_ROW, status: 'in_progress', resolved_at: null }
    mockQueryRaw.mockResolvedValueOnce([updated])

    const report = await updateReportStatus('report-uuid', { status: 'in_progress' })

    expect(report.status).toBe('in_progress')
    expect(mockDelCache).toHaveBeenCalledWith('report', 'report-uuid')
    expect(mockDelCache).toHaveBeenCalledWith('stats', 'global')
  })

  it('sets resolved_at when status is resolved', async () => {
    const resolvedAt = new Date()
    const updated = { ...REPORT_ROW, status: 'resolved', resolved_at: resolvedAt }
    mockQueryRaw.mockResolvedValueOnce([updated])

    const report = await updateReportStatus('report-uuid', { status: 'resolved' })

    expect(report.status).toBe('resolved')
    expect(report.resolved_at).toEqual(resolvedAt)
  })

  it('throws 404 when report not found', async () => {
    mockQueryRaw.mockResolvedValueOnce([])

    await expect(updateReportStatus('nonexistent', { status: 'resolved' })).rejects.toMatchObject({
      statusCode: 404,
      code: 'REPORT_NOT_FOUND',
    })
  })
})

// ── getTerritorialStats ───────────────────────────────────────────────────────

describe('getTerritorialStats', () => {
  it('returns cached stats without hitting DB', async () => {
    const cached = { by_category: [], total_reports: 0, open_reports: 0 }
    mockGetCache.mockResolvedValueOnce(cached)

    const stats = await getTerritorialStats()

    expect(stats).toBe(cached)
    expect(mockQueryRaw).not.toHaveBeenCalled()
  })

  it('aggregates stats and converts bigint counts to numbers', async () => {
    mockGetCache.mockResolvedValueOnce(null)
    mockQueryRaw.mockResolvedValueOnce([
      { category: 'infraestructura', total: BigInt(42), open_count: BigInt(30), resolved_count: BigInt(10), avg_urgency: 0.5 },
      { category: 'seguridad', total: BigInt(15), open_count: BigInt(10), resolved_count: BigInt(5), avg_urgency: 0.8 },
    ])

    const stats = await getTerritorialStats()

    expect(stats.total_reports).toBe(57)
    expect(stats.open_reports).toBe(40)
    expect(stats.by_category[0].category).toBe('infraestructura')
    expect(stats.by_category[0].total).toBe(42)
    expect(typeof stats.by_category[0].total).toBe('number')
  })
})
