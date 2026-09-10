jest.mock('../../lib/prisma', () => ({
  prisma: { $queryRaw: jest.fn() },
}))
jest.mock('./territories.service', () => ({
  getMyTerritory: jest.fn(),
  getTerritory: jest.fn(),
}))

import { prisma } from '../../lib/prisma'
import { getMyTerritory, getTerritory } from './territories.service'
import {
  assertColombianMunicipalTerritory,
  getCitizenTerritoryContext,
  isWithinColombiaEnvelope,
} from './territory-context.service'

const mockQueryRaw = prisma.$queryRaw as jest.Mock
const mockGetMyTerritory = getMyTerritory as jest.Mock
const mockGetTerritory = getTerritory as jest.Mock

const CARTAGENA = {
  territory_code: 'CO-MP-13001',
  territory_name: 'Cartagena de Indias',
  territory_level: 'district',
  department_code: 'CO-DP-13',
  department_name: 'Bolívar',
  neighborhood: null,
  locality_id: null,
  activation_status: 'pilot_ready',
}

beforeEach(() => jest.resetAllMocks())

describe('national territory mobility context', () => {
  it('keeps Cartagena as home while Medellin is the active travel context', async () => {
    mockGetMyTerritory.mockResolvedValueOnce(CARTAGENA)
    mockQueryRaw.mockResolvedValueOnce([{
      territory_code: 'CO-MP-05001',
      territory_name: 'Medellín',
      territory_level: 'municipality',
      department_code: 'CO-DP-05',
      department_name: 'Antioquia',
      source: 'gps',
      updated_at: new Date('2026-09-10T12:00:00Z'),
    }])

    const result = await getCitizenTerritoryContext('00000000-0000-4000-8000-000000000001')

    expect(result.home.territory_code).toBe('CO-MP-13001')
    expect(result.home.context_role).toBe('home')
    expect(result.active?.territory_code).toBe('CO-MP-05001')
    expect(result.active?.source).toBe('gps')
    expect(result.policy.home_changes_on_travel).toBe(false)
    expect(result.policy.active_context_grants_governance_authority).toBe(false)
  })

  it('falls back to home without persisting a fake active location', async () => {
    mockGetMyTerritory.mockResolvedValueOnce(CARTAGENA)
    mockQueryRaw.mockResolvedValueOnce([])

    const result = await getCitizenTerritoryContext('00000000-0000-4000-8000-000000000001')

    expect(result.active).toMatchObject({
      territory_code: 'CO-MP-13001',
      source: 'home_fallback',
      is_home_fallback: true,
      updated_at: null,
    })
  })

  it('accepts Colombian municipalities but rejects non-municipal targets', async () => {
    mockGetTerritory.mockResolvedValueOnce({
      code: 'CO-MP-05001', country_code: 'CO', level: 'municipality',
    })
    await expect(assertColombianMunicipalTerritory('CO-MP-05001')).resolves.toMatchObject({ code: 'CO-MP-05001' })

    mockGetTerritory.mockResolvedValueOnce({
      code: 'CO-DP-05', country_code: 'CO', level: 'department',
    })
    await expect(assertColombianMunicipalTerritory('CO-DP-05')).rejects.toMatchObject({
      code: 'TERRITORY_MUNICIPAL_LEVEL_REQUIRED',
    })
  })

  it('rejects obviously non-Colombian report coordinates', () => {
    expect(isWithinColombiaEnvelope(10.391, -75.479)).toBe(true)
    expect(isWithinColombiaEnvelope(6.2442, -75.5812)).toBe(true)
    expect(isWithinColombiaEnvelope(40.7128, -74.006)).toBe(false)
  })
})
