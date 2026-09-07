const mockQueryRaw = jest.fn()

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
  },
}))

import { getPilotControlCenter } from '../pilot.service'

beforeEach(() => {
  jest.resetAllMocks()
})

describe('pilot control center metrics', () => {
  it('maps privacy-safe cohort, Civic Action outcomes and operational aggregates', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{
        active_citizens: 100n,
        registered_7d: 20n,
        active_7d: 60n,
        verified_citizens: 80n,
        federated_citizens: 50n,
        public_profiles: 30n,
        reports_7d: 14n,
        proposals_7d: 4n,
        endorsements_7d: 25n,
        validations_7d: 10n,
        follows_7d: 16n,
        civic_actions_7d: 12n,
        civic_action_evidence_7d: 18n,
        civic_action_validations_7d: 9n,
        meaningful_participants_7d: 65n,
        reports_open: 12n,
        reports_in_progress: 5n,
        reports_resolved: 31n,
        proposals_debate: 3n,
        proposals_voting: 2n,
        civic_actions_proposed: 4n,
        civic_actions_preparing: 3n,
        civic_actions_in_progress: 8n,
        civic_actions_result_declared: 5n,
        civic_actions_under_verification: 2n,
        civic_actions_verified: 6n,
        civic_actions_disputed: 1n,
        civic_actions_no_evidence: 1n,
        civic_actions_not_completed: 2n,
        civic_actions_non_cancelled: 32n,
        civic_actions_with_evidence: 24n,
        corroborations_7d: 8n,
        disputes_7d: 2n,
        civic_action_corroborations_7d: 7n,
        civic_action_disputes_7d: 2n,
        privileged_users: 4n,
      }])
      .mockResolvedValueOnce([
        { neighborhood: 'Manga', citizen_count: 18n },
        { neighborhood: 'Bocagrande', citizen_count: 12n },
      ])

    const result = await getPilotControlCenter()

    expect(result.window_days).toBe(7)
    expect(result.cohort).toMatchObject({
      active_citizens: 100,
      registered_7d: 20,
      active_7d: 60,
      verified_citizens: 80,
      federated_citizens: 50,
      public_profiles: 30,
      verification_rate_pct: 80,
      federation_rate_pct: 50,
      weekly_active_rate_pct: 60,
      meaningful_participation_rate_pct: 65,
    })
    expect(result.participation).toMatchObject({
      meaningful_participants_7d: 65,
      reports_7d: 14,
      proposals_7d: 4,
      endorsements_7d: 25,
      validations_7d: 10,
      follows_7d: 16,
      civic_actions_7d: 12,
      civic_action_evidence_7d: 18,
      civic_action_validations_7d: 9,
    })
    expect(result.operations).toEqual({
      civic_actions: {
        proposed: 4,
        preparing: 3,
        in_progress: 8,
        result_declared: 5,
        under_verification: 2,
        verified: 6,
        disputed: 1,
        no_evidence: 1,
        not_completed: 2,
        non_cancelled: 32,
        with_evidence: 24,
        evidence_coverage_rate_pct: 75,
        verified_action_rate_pct: 18.8,
        validations_7d: { corroborations: 7, disputes: 2 },
      },
      reports: { open: 12, in_progress: 5, resolved: 31 },
      proposals: { debate: 3, voting: 2 },
      evidence: { corroborations_7d: 8, disputes_7d: 2 },
      privileged_users: 4,
    })
    expect(result.geography.privacy_min_group_size).toBe(3)
    expect(result.geography.top_neighborhoods).toEqual([
      { neighborhood: 'Manga', citizen_count: 18 },
      { neighborhood: 'Bocagrande', citizen_count: 12 },
    ])
    expect(result.score_policy.social_popularity_affects_reputation).toBe(false)
    expect(result.score_policy.community_validation_affects_reputation).toBe(false)
    expect(result.generated_at).toEqual(expect.any(String))
  })

  it('returns stable zero rates for an empty pilot cohort', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    const result = await getPilotControlCenter()

    expect(result.cohort.active_citizens).toBe(0)
    expect(result.cohort.verification_rate_pct).toBe(0)
    expect(result.cohort.federation_rate_pct).toBe(0)
    expect(result.cohort.weekly_active_rate_pct).toBe(0)
    expect(result.cohort.meaningful_participation_rate_pct).toBe(0)
    expect(result.participation.meaningful_participants_7d).toBe(0)
    expect(result.operations.civic_actions.non_cancelled).toBe(0)
    expect(result.operations.civic_actions.evidence_coverage_rate_pct).toBe(0)
    expect(result.operations.civic_actions.verified_action_rate_pct).toBe(0)
    expect(result.geography.top_neighborhoods).toEqual([])
  })
})
