const mockQueryRaw = jest.fn()
const mockGetCitizenProfile = jest.fn()
const mockGetCivicProfile = jest.fn()
const mockGetReputationProfile = jest.fn()
const mockGetTerritorialStats = jest.fn()
const mockGetGovernanceStats = jest.fn()
const mockListCivicCases = jest.fn()
const mockListMyCivicActions = jest.fn()

jest.mock('../../../lib/prisma', () => ({ prisma: { $queryRaw: mockQueryRaw } }))
jest.mock('../../auth/auth.service', () => ({ getCitizenProfile: mockGetCitizenProfile }))
jest.mock('../../civic-actions/civic-actions.service', () => ({ listMyCivicActions: mockListMyCivicActions }))
jest.mock('../../community/community.service', () => ({ getCivicProfile: mockGetCivicProfile }))
jest.mock('../../reputation/reputation.service', () => ({ getReputationProfile: mockGetReputationProfile }))
jest.mock('../../territorial/territorial.service', () => ({ getTerritorialStats: mockGetTerritorialStats }))
jest.mock('../../governance/governance.service', () => ({ getGovernanceStats: mockGetGovernanceStats }))
jest.mock('../../workflows/workflow.service', () => ({ listCivicCases: mockListCivicCases }))

import { getCitizenCommandCenter } from '../dashboard.service'

const CITIZEN_ID = '550e8400-e29b-41d4-a716-446655440000'

beforeEach(() => {
  jest.resetAllMocks()
})

describe('citizen dashboard command center', () => {
  it('reports workflow and evidence-backed civic action metrics with civic profile context', async () => {
    mockGetCitizenProfile.mockResolvedValueOnce({
      id: CITIZEN_ID,
      email: 'citizen@example.com',
      neighborhood: 'Manga',
      locality_id: 1,
      verification_level: 2,
      created_at: new Date('2026-09-01T10:00:00.000Z'),
    })
    mockGetCivicProfile.mockResolvedValueOnce({
      citizen_id: CITIZEN_ID,
      display_name: 'Líder Manga',
      neighborhood: 'Manga',
      profile_type: 'social_leader',
      bio: 'Gestión comunitaria y recuperación de espacio público.',
      organization: 'Colectivo Manga Activa',
      public_profile: true,
      reputation_score: 42,
    })
    mockGetReputationProfile.mockResolvedValueOnce({
      reputation_score: 42,
      level: 'activo',
      total_votes: 3,
      total_proposals: 2,
      total_reports: 8,
      badges_count: 1,
    })
    mockGetTerritorialStats.mockResolvedValueOnce({ total_reports: 12, open_reports: 4, by_category: [] })
    mockGetGovernanceStats.mockResolvedValueOnce({ total_proposals: 4, by_status: [] })

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
      .mockResolvedValueOnce([{
        total: 4n,
        active: 2n,
        verified: 1n,
        needs_evidence: 1n,
        awaiting_verification: 1n,
      }])

    const recentCases = [{ id: 'case-1', stage: 'analysis' }]
    const recentActions = [{
      id: 'action-1',
      title: 'Recuperación del parque del barrio',
      status: 'in_progress',
      civic_score: 48,
      confidence_score: 62,
      evidence_count: 2,
    }]
    mockListCivicCases.mockResolvedValueOnce(recentCases)
    mockListMyCivicActions.mockResolvedValueOnce(recentActions)

    const result = await getCitizenCommandCenter(CITIZEN_ID)

    expect(mockGetCivicProfile).toHaveBeenCalledWith(CITIZEN_ID)
    expect(mockListCivicCases).toHaveBeenCalledWith(CITIZEN_ID, 5)
    expect(mockListMyCivicActions).toHaveBeenCalledWith(CITIZEN_ID, { limit: 5 })
    expect(result.profile).toMatchObject({
      civic_profile_type: 'social_leader',
      civic_bio: 'Gestión comunitaria y recuperación de espacio público.',
      civic_organization: 'Colectivo Manga Activa',
      public_civic_profile: true,
    })
    expect(result.mine.workflows).toEqual({ total: 8, active: 6, recent: recentCases })
    expect(result.mine.civic_actions).toEqual({
      total: 4,
      active: 2,
      verified: 1,
      needs_evidence: 1,
      awaiting_verification: 1,
      recent: recentActions,
    })
    expect(result.reputation.endorsements_given).toBe(3)
    expect(result.attention.civic_actions_needing_evidence).toBe(1)
    expect(result.attention.total_items).toBe(2)
  })

  it('fails closed to zero metrics for a new citizen while preserving civic-profile defaults from the domain', async () => {
    mockGetCitizenProfile.mockResolvedValueOnce({
      id: CITIZEN_ID,
      email: 'new-citizen@example.com',
      neighborhood: null,
      locality_id: null,
      verification_level: 0,
      created_at: new Date('2026-09-06T10:00:00.000Z'),
    })
    mockGetCivicProfile.mockResolvedValueOnce({
      citizen_id: CITIZEN_ID,
      display_name: null,
      neighborhood: null,
      profile_type: 'citizen',
      bio: null,
      organization: null,
      public_profile: false,
      reputation_score: 0,
    })
    mockGetReputationProfile.mockResolvedValueOnce({
      reputation_score: 0,
      level: 'nuevo',
      total_votes: 0,
      total_proposals: 0,
      total_reports: 0,
      badges_count: 0,
    })
    mockGetTerritorialStats.mockResolvedValueOnce({ total_reports: 0, open_reports: 0, by_category: [] })
    mockGetGovernanceStats.mockResolvedValueOnce({ total_proposals: 0, by_status: [] })
    mockQueryRaw.mockResolvedValue([])
    mockListCivicCases.mockResolvedValueOnce([])
    mockListMyCivicActions.mockResolvedValueOnce([])

    const result = await getCitizenCommandCenter(CITIZEN_ID)

    expect(result.profile).toMatchObject({
      civic_profile_type: 'citizen',
      civic_bio: null,
      civic_organization: null,
      public_civic_profile: false,
    })
    expect(result.mine.civic_actions).toEqual({
      total: 0,
      active: 0,
      verified: 0,
      needs_evidence: 0,
      awaiting_verification: 0,
      recent: [],
    })
    expect(result.mine.workflows).toEqual({ total: 0, active: 0, recent: [] })
    expect(result.reputation.endorsements_given).toBe(0)
    expect(result.attention).toMatchObject({
      verification_required: true,
      civic_actions_needing_evidence: 0,
      total_items: 1,
    })
  })
})
