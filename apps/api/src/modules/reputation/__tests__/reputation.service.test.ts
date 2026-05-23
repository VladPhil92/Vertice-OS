const mockQueryRaw  = jest.fn()
const mockGetCache  = jest.fn()
const mockSetCache  = jest.fn()
const mockDelCache  = jest.fn()
const mockRunCypher = jest.fn()

jest.mock('../../../lib/prisma', () => ({
  prisma: { $queryRaw: mockQueryRaw },
}))

jest.mock('../../../lib/cache', () => ({
  getCache: mockGetCache,
  setCache: mockSetCache,
  delCache: mockDelCache,
  TTL: { PROFILE: 300, SESSION: 60, REPORT: 120, STATS: 600 },
}))

jest.mock('../../../lib/neo4j', () => ({
  runCypher:          mockRunCypher,
  ensureCitizenNode:  jest.fn().mockResolvedValue(undefined),
}))

import {
  recordReputationEvent,
  getReputationProfile,
  getLeaderboard,
  getCitizenGraph,
} from '../reputation.service'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CITIZEN_ID  = '550e8400-e29b-41d4-a716-446655440001'
const PROPOSAL_ID = 'proposal-uuid-001'

beforeEach(() => {
  jest.resetAllMocks()
  mockGetCache.mockResolvedValue(null)
  mockSetCache.mockResolvedValue(undefined)
  mockDelCache.mockResolvedValue(undefined)
  mockRunCypher.mockResolvedValue([])
})

// ── recordReputationEvent ─────────────────────────────────────────────────────

describe('recordReputationEvent', () => {
  it('inserts event row and returns the record', async () => {
    const now = new Date()
    mockQueryRaw.mockResolvedValueOnce([{ id: 'event-id', created_at: now }])

    const result = await recordReputationEvent({
      citizen_id: CITIZEN_ID,
      event_type: 'vote_cast',
      reference_id: PROPOSAL_ID,
    })

    expect(mockQueryRaw).toHaveBeenCalledTimes(1)
    expect(result.citizen_id).toBe(CITIZEN_ID)
    expect(result.event_type).toBe('vote_cast')
    expect(result.points).toBe(5)
    expect(result.reference_id).toBe(PROPOSAL_ID)
  })

  it('invalidates profile and leaderboard cache after recording', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ id: 'event-id', created_at: new Date() }])

    await recordReputationEvent({ citizen_id: CITIZEN_ID, event_type: 'badge_earned' })

    expect(mockDelCache).toHaveBeenCalledWith(expect.stringContaining('profile'), CITIZEN_ID)
    expect(mockDelCache).toHaveBeenCalledWith(expect.stringContaining('leaderboard'), 'global')
  })

  it('assigns correct points for each event type', async () => {
    mockQueryRaw.mockResolvedValue([{ id: 'x', created_at: new Date() }])

    const cases: Array<[string, number]> = [
      ['vote_cast', 5],
      ['proposal_created', 10],
      ['proposal_approved', 30],
      ['proposal_rejected', -5],
      ['report_submitted', 8],
      ['report_resolved', 15],
      ['badge_earned', 20],
    ]

    for (const [event, points] of cases) {
      const result = await recordReputationEvent({
        citizen_id: CITIZEN_ID,
        event_type: event as any,
      })
      expect(result.points).toBe(points)
    }
  })

  it('triggers neo4j graph relation for vote_cast', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ id: 'x', created_at: new Date() }])

    await recordReputationEvent({
      citizen_id: CITIZEN_ID,
      event_type: 'vote_cast',
      reference_id: PROPOSAL_ID,
    })

    // runCypher called at least once for graph relation (fire-and-forget; may be async)
    await new Promise((r) => setTimeout(r, 10))
    expect(mockRunCypher).toHaveBeenCalled()
  })
})

// ── getReputationProfile ──────────────────────────────────────────────────────

describe('getReputationProfile', () => {
  it('returns cached profile when available', async () => {
    const cachedProfile = { citizen_id: CITIZEN_ID, reputation_score: 42 }
    mockGetCache.mockResolvedValueOnce(cachedProfile)

    const result = await getReputationProfile(CITIZEN_ID)

    expect(result).toEqual(cachedProfile)
    expect(mockQueryRaw).not.toHaveBeenCalled()
  })

  it('computes profile from DB on cache miss', async () => {
    mockGetCache.mockResolvedValue(null)
    // SUM query
    mockQueryRaw.mockResolvedValueOnce([{ total: 55n }])
    // event counts
    mockQueryRaw.mockResolvedValueOnce([
      { event_type: 'vote_cast',        cnt: 3n },
      { event_type: 'proposal_created', cnt: 1n },
    ])
    // last_activity
    mockQueryRaw.mockResolvedValueOnce([{ last_activity: new Date('2025-01-01') }])
    // badge count
    mockQueryRaw.mockResolvedValueOnce([{ badge_count: 1n }])

    const profile = await getReputationProfile(CITIZEN_ID)

    expect(profile.reputation_score).toBe(55)
    expect(profile.level).toBe('activista')  // 50–99
    expect(profile.total_votes).toBe(3)
    expect(profile.total_proposals).toBe(1)
    expect(mockSetCache).toHaveBeenCalled()
  })

  it('maps level correctly at boundaries', async () => {
    const cases: Array<[number, string]> = [
      [0,   'observador'],
      [19,  'observador'],
      [20,  'participante'],
      [49,  'participante'],
      [50,  'activista'],
      [99,  'activista'],
      [100, 'lider'],
      [199, 'lider'],
      [200, 'embajador'],
    ]

    for (const [score, expectedLevel] of cases) {
      mockGetCache.mockResolvedValueOnce(null)
      mockQueryRaw
        .mockResolvedValueOnce([{ total: BigInt(score) }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ last_activity: null }])
        .mockResolvedValueOnce([{ badge_count: 0n }])

      const profile = await getReputationProfile(CITIZEN_ID)
      expect(profile.level).toBe(expectedLevel)
    }
  })

  it('caps score at 0 when sum is negative', async () => {
    mockGetCache.mockResolvedValueOnce(null)
    mockQueryRaw
      .mockResolvedValueOnce([{ total: -10n }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ last_activity: null }])
      .mockResolvedValueOnce([{ badge_count: 0n }])

    const profile = await getReputationProfile(CITIZEN_ID)
    expect(profile.reputation_score).toBe(0)
  })
})

// ── getLeaderboard ─────────────────────────────────────────────────────────────

describe('getLeaderboard', () => {
  it('returns leaderboard entries ordered by score', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      { citizen_id: 'citizen-a', total: 200n },
      { citizen_id: 'citizen-b', total: 80n },
      { citizen_id: 'citizen-c', total: 10n },
    ])

    const entries = await getLeaderboard({ limit: 20, offset: 0 })

    expect(entries).toHaveLength(3)
    expect(entries[0]).toMatchObject({ citizen_id: 'citizen-a', rank: 1, level: 'embajador' })
    expect(entries[1]).toMatchObject({ citizen_id: 'citizen-b', rank: 2, level: 'activista' })
    expect(entries[2]).toMatchObject({ citizen_id: 'citizen-c', rank: 3, level: 'observador' })
  })

  it('uses cache on subsequent requests with offset=0', async () => {
    const cached = [{ citizen_id: 'x', reputation_score: 50, level: 'activista', rank: 1 }]
    mockGetCache.mockResolvedValueOnce(cached)

    const entries = await getLeaderboard({ limit: 10, offset: 0 })

    expect(entries).toHaveLength(1)
    expect(mockQueryRaw).not.toHaveBeenCalled()
  })

  it('skips cache when offset > 0', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ citizen_id: 'y', total: 30n }])

    const entries = await getLeaderboard({ limit: 10, offset: 10 })

    expect(mockGetCache).not.toHaveBeenCalled()
    expect(entries[0].rank).toBe(11)
  })
})

// ── getCitizenGraph ────────────────────────────────────────────────────────────

describe('getCitizenGraph', () => {
  it('assembles graph from neo4j query results', async () => {
    // voted_on
    mockRunCypher.mockResolvedValueOnce([{ proposal_id: 'p-1' }, { proposal_id: 'p-2' }])
    // created_proposals
    mockRunCypher.mockResolvedValueOnce([{ proposal_id: 'p-3' }])
    // submitted_reports
    mockRunCypher.mockResolvedValueOnce([{ report_id: 'r-1' }])
    // delegates_to
    mockRunCypher.mockResolvedValueOnce([{ target_id: 'citizen-b' }])
    // delegated_from
    mockRunCypher.mockResolvedValueOnce([])

    const graph = await getCitizenGraph(CITIZEN_ID)

    expect(graph.citizen_id).toBe(CITIZEN_ID)
    expect(graph.voted_on).toEqual(['p-1', 'p-2'])
    expect(graph.created_proposals).toEqual(['p-3'])
    expect(graph.submitted_reports).toEqual(['r-1'])
    expect(graph.delegates_to).toEqual(['citizen-b'])
    expect(graph.delegated_from).toEqual([])
  })

  it('returns empty arrays when citizen has no activity', async () => {
    mockRunCypher.mockResolvedValue([])

    const graph = await getCitizenGraph(CITIZEN_ID)

    expect(graph.voted_on).toEqual([])
    expect(graph.created_proposals).toEqual([])
    expect(graph.submitted_reports).toEqual([])
  })
})
