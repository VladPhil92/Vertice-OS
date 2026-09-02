const mockQueryRaw = jest.fn()
const mockGetCitizenProfile = jest.fn()
const mockGetReputationProfile = jest.fn()
const mockGetTerritorialStats = jest.fn()
const mockGetGovernanceStats = jest.fn()
const mockListCivicCases = jest.fn()

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
  },
}))

jest.mock('../../auth/auth.service', () => ({
  getCitizenProfile: mockGetCitizenProfile,
}))

jest.mock('../../reputation/reputation.service', () => ({
  getReputationProfile: mockGetReputationProfile,
}))

jest.mock('../../territorial/territorial.service', () => ({
  getTerritorialStats: mockGetTerritorialStats,
}))

jest.mock('../../governance/governance.service', () => ({
  getGovernanceStats: mockGetGovernanceStats,
}))

jest.mock('../../workflows/workflow.service', () => ({
  listCivicCases: mockListCivicCases,
}))

import { getCitizenCommandCenter } from '../dashboard.service'

const CITIZEN_ID = '550e8400-e29b-41d4-a716-446655440000'

beforeEach(() => {
  jest.resetAllMocks()
})

describe('citizen dashboard workflow metrics', () => {
  it('keeps recent workflow cases limited while reporting unbounded total and active counts', async () => {
    mockGetCitizenProfile.mockResolvedValueOnce({
      id: CITIZEN_ID,
      email: 'citizen@example.com',
      neighborhood: 'Manga',
      locality_id: 1,
      verification_level: 1,
      created_at: new Date('2026-09-01T10:00:00.000Z'),
    })
    mockGetReputationProfile.mockResolvedValueOnce({
      reputation_score: 42,
      level: 'activo',
      total_votes: 3,
      total_proposals: 2,
      total_reports: 8,
      badges_count: 1,
    })
    mockGetTerritorialStats.mockResolvedValueOnce({ total: 12 })
    mockGetGovernanceStats.mockResolvedValueOnce({ active_proposals: 4 })

    mockQueryRaw
      .mockResolvedValueOnce([{ status: 'open', count: 8n }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ status: 'idea', count: 2n }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ status: 'draft', count: 1n }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ count: 3n }])
      .mockResolvedValueOnce([{ total: 8n, active: 6n }])

    const recentCases = [
      { id: 'case-1', stage: 'analysis' },
      { id: 'case-2', stage: 'proposal' },
    ]
    mockListCivicCases.mockResolvedValueOnce(recentCases)

    const result = await getCitizenCommandCenter(CITIZEN_ID)

    expect(mockListCivicCases).toHaveBeenCalledWith(CITIZEN_ID, 5)
    expect(result.mine.workflows).toEqual({
      total: 8,
      active: 6,
      recent: recentCases,
    })
    expect(result.mine.reports.total).toBe(8)
    expect(result.mine.proposals.total).toBe(2)
    expect(result.mine.legal.total).toBe(1)
    expect(result.reputation.endorsements_given).toBe(3)
    expect(result.attention.total_items).toBe(1)
  })
})
