const mockQueryRaw = jest.fn()
jest.mock('../../lib/prisma', () => ({ prisma: { $queryRaw: mockQueryRaw } }))

import { getNationalLaunchOperations } from './territories.operations.ranking'

beforeEach(() => jest.resetAllMocks())

describe('getNationalLaunchOperations', () => {
  it('computes readiness, targets and blockers from a single set-based query', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      {
        code: 'CO-MP-05001', external_code: '05001', name: 'Medellín', level: 'municipality', parent_code: 'CO-DP-05', activation_status: 'community_active',
        operational_state: 'recruiting', target_active_citizens: 10, target_verified_actions: 3, target_local_leaders: 2, target_moderators: 1,
        active_citizens_30d: 20n, creators_30d: 8n, verified_actions_90d: 5n,
        evidence_backed_actions_90d: 8n, total_actions_90d: 10n,
        resolved_reports_90d: 8n, total_reports_90d: 10n, local_leaders: 3n, moderation_capacity: 2n, active_cohort_members: 4n,
      },
      {
        code: 'CO-MP-11001', external_code: '11001', name: 'Bogotá', level: 'district', parent_code: 'CO-DP-11', activation_status: 'available',
        operational_state: null, target_active_citizens: null, target_verified_actions: null, target_local_leaders: null, target_moderators: null,
        active_citizens_30d: 1n, creators_30d: 0n, verified_actions_90d: 0n,
        evidence_backed_actions_90d: 0n, total_actions_90d: 0n,
        resolved_reports_90d: 0n, total_reports_90d: 0n, local_leaders: 0n, moderation_capacity: 0n, active_cohort_members: 0n,
      },
    ])

    const rows = await getNationalLaunchOperations(10)
    expect(mockQueryRaw).toHaveBeenCalledTimes(1)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ territory_code: 'CO-MP-05001', launch_ready: true, blockers: [] })
    expect(rows[0].metrics.evidence_completion_pct).toBe(80)
    expect(rows[1]).toMatchObject({ operational_state: 'observing', launch_ready: false })
    expect(rows[1].blockers).toEqual(expect.arrayContaining(['moderation_capacity', 'active_citizens', 'verified_actions', 'local_leaders']))
    expect(rows[0].scoring_boundary).toBe('civic_and_operational_only')
  })

  it('bounds the result length after sorting by readiness', async () => {
    const base = {
      external_code: null, level: 'municipality', parent_code: 'CO-DP-13', activation_status: 'available',
      operational_state: null, target_active_citizens: 0, target_verified_actions: 0, target_local_leaders: 0, target_moderators: 0,
      creators_30d: 0n, verified_actions_90d: 0n, evidence_backed_actions_90d: 0n, total_actions_90d: 0n,
      resolved_reports_90d: 0n, total_reports_90d: 0n, local_leaders: 0n, moderation_capacity: 0n, active_cohort_members: 0n,
    }
    mockQueryRaw.mockResolvedValueOnce([
      { ...base, code: 'a', name: 'A', active_citizens_30d: 1n },
      { ...base, code: 'b', name: 'B', active_citizens_30d: 5n },
      { ...base, code: 'c', name: 'C', active_citizens_30d: 3n },
    ])
    const rows = await getNationalLaunchOperations(2)
    expect(rows.map((row) => row.territory_code)).toEqual(['b', 'c'])
  })

  it('returns an empty board when no municipalities exist', async () => {
    mockQueryRaw.mockResolvedValueOnce([])
    await expect(getNationalLaunchOperations()).resolves.toEqual([])
  })
})
