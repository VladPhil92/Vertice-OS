jest.mock('../../lib/prisma', () => ({
  prisma: { $queryRaw: jest.fn() },
}))
jest.mock('./territories.feed', () => ({ getTerritoryFeed: jest.fn() }))
jest.mock('./territories.service', () => ({
  getTerritory: jest.fn(),
  getActivationMetrics: jest.fn(),
}))

import { prisma } from '../../lib/prisma'
import { getTerritoryFeed } from './territories.feed'
import { getActivationMetrics, getTerritory } from './territories.service'
import { getPublicCityOverview } from './territories.public'

const mockQueryRaw = prisma.$queryRaw as jest.Mock
const mockGetTerritory = getTerritory as jest.Mock
const mockGetActivationMetrics = getActivationMetrics as jest.Mock
const mockGetTerritoryFeed = getTerritoryFeed as jest.Mock

beforeEach(() => {
  jest.resetAllMocks()
})

describe('getPublicCityOverview', () => {
  it('rejects non municipal/district nodes', async () => {
    mockGetTerritory.mockResolvedValueOnce({ code: 'CO-DP-13', level: 'department' })
    await expect(getPublicCityOverview('CO-DP-13')).rejects.toMatchObject({
      statusCode: 400,
      code: 'PUBLIC_CITY_LEVEL_UNSUPPORTED',
    })
    expect(mockQueryRaw).not.toHaveBeenCalled()
  })

  it('returns only the public aggregate launch projection', async () => {
    mockGetTerritory.mockResolvedValueOnce({
      code: 'CO-MP-13001',
      external_code: '13001',
      name: 'Cartagena de Indias',
      level: 'district',
      activation_status: 'pilot_ready',
    })
    mockGetActivationMetrics.mockResolvedValueOnce({
      territory_code: 'CO-MP-13001',
      registered_citizens: 20,
      active_citizens_30d: 12,
      civic_actions_30d: 8,
      verified_actions_90d: 4,
      reports_30d: 3,
      proposals_30d: 2,
      momentum_score: 72,
      recommended_status: 'pilot_ready',
    })
    mockGetTerritoryFeed.mockResolvedValueOnce({ territory: {}, actions: [], reports: [], proposals: [], empty_state: null })
    mockQueryRaw.mockResolvedValueOnce([{
      operational_state: 'recruiting',
      active_cohort_members: 4n,
      pending_interest_count: 7n,
    }])

    const result = await getPublicCityOverview('CO-MP-13001', 6)
    expect(result.launch).toEqual({
      operational_state: 'recruiting',
      active_cohort_members: 4,
      pending_interest_count: 7,
      accepting_interest: true,
    })
    expect(result.activation.momentum_score).toBe(72)
    expect(result.authority_boundary).toBe('public_discovery_only')
    expect(result.excluded_signals).toContain('payments')
    expect(result).not.toHaveProperty('blockers')
    expect(result.launch).not.toHaveProperty('moderation_capacity')
    expect(result.launch).not.toHaveProperty('notes')
  })

  it('marks a paused node as not accepting interest', async () => {
    mockGetTerritory.mockResolvedValueOnce({ code: 'CO-MP-05001', level: 'municipality', activation_status: 'available' })
    mockGetActivationMetrics.mockResolvedValueOnce({
      registered_citizens: 0, active_citizens_30d: 0, civic_actions_30d: 0,
      verified_actions_90d: 0, reports_30d: 0, proposals_30d: 0, momentum_score: 0,
    })
    mockGetTerritoryFeed.mockResolvedValueOnce({ territory: {}, actions: [], reports: [], proposals: [], empty_state: 'empty' })
    mockQueryRaw.mockResolvedValueOnce([{ operational_state: 'paused', active_cohort_members: 0n, pending_interest_count: 1n }])

    const result = await getPublicCityOverview('CO-MP-05001')
    expect(result.launch.accepting_interest).toBe(false)
  })
})
