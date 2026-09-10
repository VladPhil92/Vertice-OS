jest.mock('../../lib/prisma', () => ({
  prisma: {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
  },
}))
jest.mock('./territories.service', () => ({
  syncDivipolaCatalog: jest.fn(),
}))

import { prisma } from '../../lib/prisma'
import {
  resolveTerritoryByPoint,
  verifyTerritoryPoint,
} from './territory-boundaries.service'

const mockQueryRaw = prisma.$queryRaw as jest.Mock

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

beforeEach(() => jest.resetAllMocks())

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

  it('does not guess when overlapping/border geometries produce multiple candidates', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      CARTAGENA_ROW,
      { ...CARTAGENA_ROW, territory_code: 'CO-MP-13002', territory_name: 'Municipio vecino' },
    ])

    const result = await resolveTerritoryByPoint(10.391, -75.479)

    expect(result.status).toBe('ambiguous_border')
    if (result.status === 'ambiguous_border') expect(result.candidates).toHaveLength(2)
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
