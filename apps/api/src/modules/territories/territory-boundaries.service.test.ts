jest.mock('../../lib/prisma', () => ({
  prisma: {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
    $transaction: jest.fn(),
  },
}))
jest.mock('./territories.service', () => ({
  syncDivipolaCatalog: jest.fn(),
}))

import { prisma } from '../../lib/prisma'
import { syncDivipolaCatalog } from './territories.service'
import {
  getBoundaryCatalogStatus,
  resolveTerritoryByPoint,
  syncDaneMunicipalBoundaries,
  verifyTerritoryPoint,
} from './territory-boundaries.service'

const mockQueryRaw = prisma.$queryRaw as jest.Mock
const mockExecuteRaw = prisma.$executeRaw as jest.Mock
const mockTransaction = prisma.$transaction as jest.Mock
const mockSyncDivipolaCatalog = syncDivipolaCatalog as jest.Mock

const CARTAGENA_ROW = {
  territory_code: 'CO-MP-13001',
  external_code: '13001',
  territory_name: 'Cartagena de Indias',
  territory_level: 'district',
  parent_code: 'CO-DP-13',
  country_code: 'CO',
  activation_status: 'pilot_ready',
  department_code: 'CO-DP-13',
  department_name: 'Bolívar',
  source_version: 'MGN_2025',
  distance_meters: 0,
}

const COMPLETE_STATUS_ROW = {
  boundary_count: BigInt(500),
  source_version: 'MGN_2025',
  last_synced_at: new Date('2026-09-10T12:00:00.000Z'),
  latest_features_seen: 500,
  latest_features_upserted: 500,
  latest_completed_at: new Date('2026-09-10T12:00:00.000Z'),
}

function makeFeature(index: number) {
  return {
    type: 'Feature',
    properties: { MPIO_CDPMP: String(10000 + index) },
    geometry: {
      type: 'Polygon',
      coordinates: [],
    },
  }
}

function makeFeatureCollection(count = 500) {
  return {
    type: 'FeatureCollection',
    features: Array.from({ length: count }, (_, index) => makeFeature(index)),
  }
}

function mockFetchJson(payload: unknown, ok = true, status = 200) {
  return jest.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok,
    status,
    json: jest.fn().mockResolvedValue(payload),
  } as unknown as Response)
}

function installTransaction(tx: { $executeRaw: jest.Mock; $queryRaw: jest.Mock }) {
  mockTransaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx))
}

beforeEach(() => {
  jest.resetAllMocks()
  mockExecuteRaw.mockResolvedValue(0)
  mockSyncDivipolaCatalog.mockResolvedValue(undefined)
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('territory boundary integrity', () => {
  it('rejects foreign coordinates before querying the polygon catalog', async () => {
    await expect(resolveTerritoryByPoint(40.7128, -74.006)).resolves.toEqual({ status: 'outside_colombia' })
    expect(mockQueryRaw).not.toHaveBeenCalled()
  })

  it('resolves an unambiguous point to its canonical municipality/district', async () => {
    mockQueryRaw.mockResolvedValueOnce([CARTAGENA_ROW])

    const result = await resolveTerritoryByPoint(10.391, -75.479)

    expect(result).toMatchObject({
      status: 'matched',
      boundary_source_version: 'MGN_2025',
      territory: {
        code: 'CO-MP-13001',
        name: 'Cartagena de Indias',
        department_name: 'Bolívar',
      },
    })
  })

  it('does not guess when overlapping/border geometries produce multiple exact candidates', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      CARTAGENA_ROW,
      { ...CARTAGENA_ROW, territory_code: 'CO-MP-13002', territory_name: 'Municipio vecino' },
    ])

    const result = await resolveTerritoryByPoint(10.391, -75.479)

    expect(result.status).toBe('ambiguous_border')
    if (result.status === 'ambiguous_border') expect(result.candidates).toHaveLength(2)
  })

  it('resolves a single nearby polygon using the documented border tolerance', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...CARTAGENA_ROW, distance_meters: 42.5 }])

    await expect(resolveTerritoryByPoint(10.391, -75.479)).resolves.toMatchObject({
      status: 'near_border',
      boundary_source_version: 'MGN_2025',
      distance_meters: 42.5,
      territory: { code: 'CO-MP-13001', distance_meters: 42.5 },
    })
  })

  it('does not guess when multiple nearby polygons are plausible', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { ...CARTAGENA_ROW, distance_meters: 30 },
        {
          ...CARTAGENA_ROW,
          territory_code: 'CO-MP-13002',
          territory_name: 'Municipio vecino',
          distance_meters: 35,
        },
      ])

    const result = await resolveTerritoryByPoint(10.391, -75.479)

    expect(result.status).toBe('ambiguous_border')
    if (result.status === 'ambiguous_border') expect(result.candidates).toHaveLength(2)
  })

  it('reports catalog_unavailable when no polygon matches and the national catalog is incomplete', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...COMPLETE_STATUS_ROW, boundary_count: BigInt(499) }])

    await expect(resolveTerritoryByPoint(10.391, -75.479)).resolves.toEqual({
      status: 'catalog_unavailable',
    })
  })

  it('returns unresolved only when a complete catalog has no matching or nearby polygon', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([COMPLETE_STATUS_ROW])

    await expect(resolveTerritoryByPoint(10.391, -75.479)).resolves.toEqual({ status: 'unresolved' })
  })

  it('accepts a selected territory inside its authoritative polygon', async () => {
    mockQueryRaw.mockResolvedValueOnce([{
      source_version: 'MGN_2025',
      inside: true,
      distance_meters: 0,
    }])

    await expect(verifyTerritoryPoint('CO-MP-13001', 10.391, -75.479)).resolves.toEqual({
      status: 'polygon_verified',
      source_version: 'MGN_2025',
      distance_meters: 0,
    })
  })

  it('allows documented GPS/boundary tolerance near a municipal edge', async () => {
    mockQueryRaw.mockResolvedValueOnce([{
      source_version: 'MGN_2025',
      inside: false,
      distance_meters: 74.5,
    }])

    await expect(verifyTerritoryPoint('CO-MP-13001', 10.391, -75.479)).resolves.toMatchObject({
      status: 'border_tolerance',
      source_version: 'MGN_2025',
      distance_meters: 74.5,
    })
  })

  it('respects a custom border tolerance', async () => {
    mockQueryRaw.mockResolvedValueOnce([{
      source_version: 'MGN_2025',
      inside: false,
      distance_meters: 120,
    }])

    await expect(verifyTerritoryPoint('CO-MP-13001', 10.391, -75.479, 100)).resolves.toMatchObject({
      status: 'mismatch',
      distance_meters: 120,
    })
  })

  it('rejects a selected municipality when the report point is materially outside its polygon', async () => {
    mockQueryRaw.mockResolvedValueOnce([{
      source_version: 'MGN_2025',
      inside: false,
      distance_meters: 4200,
    }])

    await expect(verifyTerritoryPoint('CO-MP-13001', 10.391, -75.479)).resolves.toMatchObject({
      status: 'mismatch',
      distance_meters: 4200,
    })
  })

  it('degrades explicitly when that territory has no synchronized polygon yet', async () => {
    mockQueryRaw.mockResolvedValueOnce([])

    await expect(verifyTerritoryPoint('CO-MP-13001', 10.391, -75.479)).resolves.toEqual({
      status: 'catalog_unavailable',
      source_version: null,
      distance_meters: null,
    })
  })
})

describe('boundary catalog status', () => {
  it('certifies point-in-polygon readiness only when live and provider counts are complete and equal', async () => {
    mockQueryRaw.mockResolvedValueOnce([COMPLETE_STATUS_ROW])

    await expect(getBoundaryCatalogStatus()).resolves.toMatchObject({
      boundary_count: 500,
      source: 'dane_mgn',
      source_version: 'MGN_2025',
      expected_feature_count: 500,
      point_in_polygon_ready: true,
      default_border_tolerance_meters: 150,
    })
  })

  it('keeps readiness false when the published catalog is incomplete', async () => {
    mockQueryRaw.mockResolvedValueOnce([{
      ...COMPLETE_STATUS_ROW,
      boundary_count: BigInt(499),
    }])

    await expect(getBoundaryCatalogStatus()).resolves.toMatchObject({
      boundary_count: 499,
      expected_feature_count: 500,
      point_in_polygon_ready: false,
    })
  })

  it('returns an explicit empty status when there is no successful sync yet', async () => {
    mockQueryRaw.mockResolvedValueOnce([])

    await expect(getBoundaryCatalogStatus()).resolves.toMatchObject({
      boundary_count: 0,
      source_version: null,
      last_synced_at: null,
      latest_completed_at: null,
      expected_feature_count: null,
      point_in_polygon_ready: false,
    })
  })
})

describe('DANE municipal boundary synchronization', () => {
  it('skips a recent complete catalog instead of contacting DANE again', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ completed_at: new Date() }])
      .mockResolvedValueOnce([COMPLETE_STATUS_ROW])

    const fetchSpy = jest.spyOn(globalThis, 'fetch')

    await expect(syncDaneMunicipalBoundaries()).resolves.toMatchObject({
      skipped: true,
      reason: 'fresh_boundaries',
      point_in_polygon_ready: true,
    })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(mockSyncDivipolaCatalog).not.toHaveBeenCalled()
  })

  it('fails closed and audits an upstream DANE HTTP error', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ id: 'run-http-failure' }])
    mockFetchJson({}, false, 503)

    await expect(syncDaneMunicipalBoundaries({ force: true })).rejects.toThrow(
      'DANE municipal boundary service responded 503',
    )

    expect(mockSyncDivipolaCatalog).toHaveBeenCalledWith({ force: false })
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1)
  })

  it('rejects a non-FeatureCollection provider payload', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ id: 'run-malformed' }])
    mockFetchJson({ type: 'Feature', features: [] })

    await expect(syncDaneMunicipalBoundaries({ force: true })).rejects.toThrow(
      'DANE boundary payload is not a GeoJSON FeatureCollection',
    )
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1)
  })

  it('rejects an unexpectedly small provider snapshot', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ id: 'run-small' }])
    mockFetchJson(makeFeatureCollection(10))

    await expect(syncDaneMunicipalBoundaries({ force: true })).rejects.toThrow(
      'DANE boundary payload is unexpectedly small (10)',
    )
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1)
  })

  it('rejects a provider snapshot containing invalid municipal geometry', async () => {
    const payload = makeFeatureCollection()
    payload.features[0] = {
      ...payload.features[0],
      geometry: { type: 'Point', coordinates: [] },
    }
    mockQueryRaw.mockResolvedValueOnce([{ id: 'run-invalid-geometry' }])
    mockFetchJson(payload)

    await expect(syncDaneMunicipalBoundaries({ force: true })).rejects.toThrow(
      'DANE boundary payload contains 1 invalid municipal geometries',
    )
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1)
  })

  it('rejects duplicate municipal codes before opening the publication transaction', async () => {
    const payload = makeFeatureCollection()
    payload.features[1] = {
      ...payload.features[1],
      properties: { MPIO_CDPMP: payload.features[0].properties.MPIO_CDPMP },
    }
    mockQueryRaw.mockResolvedValueOnce([{ id: 'run-duplicate' }])
    mockFetchJson(payload)

    await expect(syncDaneMunicipalBoundaries({ force: true })).rejects.toThrow(
      'DANE boundary payload contains duplicate municipality codes',
    )
    expect(mockTransaction).not.toHaveBeenCalled()
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1)
  })

  it('publishes a complete provider snapshot atomically and records success', async () => {
    const payload = makeFeatureCollection()
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(0),
      $queryRaw: jest.fn()
        .mockResolvedValueOnce([{ count: BigInt(500) }])
        .mockResolvedValueOnce([{ count: BigInt(500) }]),
    }
    installTransaction(tx)
    mockQueryRaw
      .mockResolvedValueOnce([{ id: 'run-success' }])
      .mockResolvedValueOnce([COMPLETE_STATUS_ROW])
    mockFetchJson(payload)

    await expect(syncDaneMunicipalBoundaries({ force: true })).resolves.toMatchObject({
      skipped: false,
      features_seen: 500,
      features_upserted: 500,
      features_skipped: 0,
      point_in_polygon_ready: true,
    })

    expect(mockTransaction).toHaveBeenCalledTimes(1)
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2)
    expect(tx.$executeRaw).toHaveBeenCalledTimes(24)
    expect(mockExecuteRaw).not.toHaveBeenCalled()
  })

  it('aborts publication when staging does not contain every normalized boundary', async () => {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(0),
      $queryRaw: jest.fn().mockResolvedValueOnce([{ count: BigInt(499) }]),
    }
    installTransaction(tx)
    mockQueryRaw.mockResolvedValueOnce([{ id: 'run-stage-mismatch' }])
    mockFetchJson(makeFeatureCollection())

    await expect(syncDaneMunicipalBoundaries({ force: true })).rejects.toThrow(
      'Boundary staging coverage mismatch: expected 500, staged 499',
    )
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1)
  })

  it('aborts publication when the live catalog count differs from the provider snapshot', async () => {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(0),
      $queryRaw: jest.fn()
        .mockResolvedValueOnce([{ count: BigInt(500) }])
        .mockResolvedValueOnce([{ count: BigInt(499) }]),
    }
    installTransaction(tx)
    mockQueryRaw.mockResolvedValueOnce([{ id: 'run-publish-mismatch' }])
    mockFetchJson(makeFeatureCollection())

    await expect(syncDaneMunicipalBoundaries({ force: true })).rejects.toThrow(
      'Boundary publication coverage mismatch: expected 500, published 499',
    )
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1)
  })
})
