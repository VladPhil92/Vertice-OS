const mockQueryRaw = jest.fn()
const mockAudit = jest.fn()
const mockGetTerritory = jest.fn()
const mockNationalActivationRanking = jest.fn()

jest.mock('../../lib/prisma', () => ({ prisma: { $queryRaw: mockQueryRaw } }))
jest.mock('../../lib/audit', () => ({ recordAuditEvent: mockAudit }))
jest.mock('./territories.service', () => ({ getTerritory: mockGetTerritory }))
jest.mock('./territories.ranking', () => ({ getNationalActivationRanking: mockNationalActivationRanking }))

import {
  assignLaunchCohortMember,
  getLaunchPlan,
  upsertLaunchPlan,
} from './territories.operations'

const TERRITORY = {
  code: 'CO-MP-05001', external_code: '05001', name: 'Medellín', level: 'municipality',
  parent_code: 'CO-DP-05', country_code: 'CO', slug: 'medellin', activation_status: 'community_active',
  source: 'dane_divipola', source_version: 'MGN_2025', activated_at: null,
}

const READY_METRICS_ROW = {
  active_citizens_30d: 20n,
  creators_30d: 8n,
  verified_actions_90d: 5n,
  evidence_backed_actions_90d: 8n,
  total_actions_90d: 10n,
  resolved_reports_90d: 8n,
  total_reports_90d: 10n,
  local_leaders: 3n,
  moderation_capacity: 2n,
  active_cohort_members: 4n,
}

const PLAN_ROW = {
  territory_code: 'CO-MP-05001', operational_state: 'launch_ready',
  target_active_citizens: 10, target_verified_actions: 3, target_local_leaders: 2, target_moderators: 1,
  launch_window_start: null, launch_window_end: null, notes: null, updated_by: null,
  created_at: new Date('2026-09-09T00:00:00Z'), updated_at: new Date('2026-09-09T00:00:00Z'),
}

beforeEach(() => {
  jest.resetAllMocks()
  mockGetTerritory.mockResolvedValue(TERRITORY)
  mockAudit.mockResolvedValue(undefined)
})

describe('getLaunchPlan', () => {
  it('computes launch readiness using civic and operational signals', async () => {
    mockQueryRaw.mockResolvedValueOnce([PLAN_ROW]).mockResolvedValueOnce([READY_METRICS_ROW])
    const result = await getLaunchPlan(TERRITORY.code)
    expect(result.launch_ready).toBe(true)
    expect(result.blockers).toEqual([])
    expect(result.readiness_score).toBeGreaterThanOrEqual(60)
    expect(result.metrics.evidence_completion_pct).toBe(80)
    expect(result.metrics.report_resolution_pct).toBe(80)
    expect(result.authority_boundary).toBe('operational_only')
  })

  it('returns fail-visible blockers when local capacity is missing', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([PLAN_ROW])
      .mockResolvedValueOnce([{ ...READY_METRICS_ROW, active_citizens_30d: 1n, verified_actions_90d: 0n, local_leaders: 0n, moderation_capacity: 0n }])
    const result = await getLaunchPlan(TERRITORY.code)
    expect(result.launch_ready).toBe(false)
    expect(result.blockers).toEqual(expect.arrayContaining(['moderation_capacity', 'active_citizens', 'verified_actions', 'local_leaders']))
  })

  it('creates an in-memory observing default when no plan is persisted yet', async () => {
    mockQueryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([READY_METRICS_ROW])
    const result = await getLaunchPlan(TERRITORY.code)
    expect(result.plan.operational_state).toBe('observing')
    expect(result.plan.target_moderators).toBe(1)
  })

  it('rejects department-level launch plans', async () => {
    mockGetTerritory.mockResolvedValueOnce({ ...TERRITORY, level: 'department' })
    await expect(getLaunchPlan('CO-DP-05')).rejects.toMatchObject({ code: 'LAUNCH_LEVEL_UNSUPPORTED' })
    expect(mockQueryRaw).not.toHaveBeenCalled()
  })
})

describe('upsertLaunchPlan', () => {
  it('fails closed when trying to launch a node with readiness blockers', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([PLAN_ROW])
      .mockResolvedValueOnce([{ ...READY_METRICS_ROW, moderation_capacity: 0n }])
    await expect(upsertLaunchPlan({
      actorId: '550e8400-e29b-41d4-a716-446655440001',
      territoryCode: TERRITORY.code,
      operationalState: 'launched',
      reason: 'launch requested by operations',
    })).rejects.toMatchObject({ code: 'LAUNCH_READINESS_BLOCKED', statusCode: 409 })
  })

  it('rejects an inverted launch window', async () => {
    mockQueryRaw.mockResolvedValueOnce([PLAN_ROW]).mockResolvedValueOnce([READY_METRICS_ROW])
    await expect(upsertLaunchPlan({
      actorId: '550e8400-e29b-41d4-a716-446655440001',
      territoryCode: TERRITORY.code,
      operationalState: 'recruiting',
      reason: 'prepare city cohort',
      launchWindowStart: '2026-10-10',
      launchWindowEnd: '2026-10-01',
    })).rejects.toMatchObject({ code: 'INVALID_LAUNCH_WINDOW' })
  })

  it('persists a ready launch, event ledger and audit record', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([PLAN_ROW])
      .mockResolvedValueOnce([READY_METRICS_ROW])
      .mockResolvedValueOnce([{ ...PLAN_ROW, operational_state: 'launched', updated_by: '550e8400-e29b-41d4-a716-446655440001' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...PLAN_ROW, operational_state: 'launched' }])
      .mockResolvedValueOnce([READY_METRICS_ROW])

    const result = await upsertLaunchPlan({
      actorId: '550e8400-e29b-41d4-a716-446655440001',
      territoryCode: TERRITORY.code,
      operationalState: 'launched',
      reason: 'readiness criteria validated',
    })
    expect(result.plan.operational_state).toBe('launched')
    expect(mockAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'territory_launch_plan_updated' }))
    expect(mockQueryRaw).toHaveBeenCalledTimes(6)
  })
})

describe('assignLaunchCohortMember', () => {
  it('rejects assigning a person from another territory', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ id: '550e8400-e29b-41d4-a716-446655440099', territory_code: 'CO-MP-11001' }])
    await expect(assignLaunchCohortMember({
      actorId: '550e8400-e29b-41d4-a716-446655440001',
      territoryCode: TERRITORY.code,
      citizenId: '550e8400-e29b-41d4-a716-446655440099',
      cohortRole: 'ambassador',
    })).rejects.toMatchObject({ code: 'COHORT_TERRITORY_MISMATCH' })
  })

  it('assigns an operational cohort label without authority effect', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ id: '550e8400-e29b-41d4-a716-446655440099', territory_code: TERRITORY.code }])
      .mockResolvedValueOnce([])
    const result = await assignLaunchCohortMember({
      actorId: '550e8400-e29b-41d4-a716-446655440001',
      territoryCode: TERRITORY.code,
      citizenId: '550e8400-e29b-41d4-a716-446655440099',
      cohortRole: 'organizer',
    })
    expect(result.authority_effect).toBe('none')
    expect(mockAudit).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({ authority_effect: 'none' }),
    }))
  })
})
