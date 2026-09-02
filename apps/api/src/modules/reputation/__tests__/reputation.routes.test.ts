jest.mock('../../../lib/redis', () => ({
  redis: { ping: jest.fn().mockResolvedValue('PONG'), get: jest.fn(), set: jest.fn(), del: jest.fn(), on: jest.fn() },
}))

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    citizen: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn() },
    $queryRaw: jest.fn().mockResolvedValue([]),
  },
}))

const mockRecordEvent = jest.fn()
const mockGetProfile = jest.fn()
const mockGetAnalytics = jest.fn()
const mockGetLeaderboard = jest.fn()
const mockGetGraph = jest.fn()

jest.mock('../reputation.service', () => ({
  recordReputationEvent: mockRecordEvent,
  getReputationProfile: mockGetProfile,
  getReputationAnalytics: mockGetAnalytics,
  getLeaderboard: mockGetLeaderboard,
  getCitizenGraph: mockGetGraph,
}))

import { buildApp } from '../../../app'

const app = buildApp()
const DID = 'did:vertice:550e8400-e29b-41d4-a716-446655440000'
const CITIZEN_ID = '550e8400-e29b-41d4-a716-446655440001'

let verifiedToken: string

beforeAll(async () => {
  await app.ready()
  verifiedToken = app.jwt.sign({ sub: CITIZEN_ID, did: DID, lvl: 1 })
})
afterAll(() => app.close())
beforeEach(() => {
  jest.resetAllMocks()
})

const MOCK_PROFILE = {
  citizen_id: CITIZEN_ID,
  reputation_score: 75,
  level: 'activista',
  event_counts: { vote_cast: 5, proposal_created: 2 },
  badges_count: 1,
  total_votes: 5,
  total_proposals: 2,
  total_reports: 0,
  last_activity_at: '2025-06-01T00:00:00.000Z',
  calculated_at: '2025-06-01T12:00:00.000Z',
}

const MOCK_ANALYTICS = {
  citizen_id: CITIZEN_ID,
  score_history: [
    { period: '2026-07', points: 25, cumulative_score: 50 },
    { period: '2026-08', points: 25, cumulative_score: 75 },
  ],
  community: { rank: 12, participants: 150, top_percent: 8 },
  streak: { current_days: 4, active_dates: ['2026-09-01', '2026-08-31'] },
  event_breakdown: [
    { event_type: 'vote_cast', count: 5, points_per_event: 5, points_total: 25 },
  ],
  generated_at: '2026-09-01T12:00:00.000Z',
}

const MOCK_GRAPH = {
  citizen_id: CITIZEN_ID,
  delegates_to: [],
  delegated_from: [],
  voted_on: ['proposal-1', 'proposal-2'],
  created_proposals: ['proposal-3'],
  submitted_reports: [],
}

const MOCK_EVENT = {
  citizen_id: CITIZEN_ID,
  event_type: 'vote_cast',
  points: 5,
  reference_id: 'proposal-uuid',
  created_at: '2025-06-01T00:00:00.000Z',
}

describe('GET /reputation/profile/:citizenId', () => {
  it('returns the reputation profile', async () => {
    mockGetProfile.mockResolvedValue(MOCK_PROFILE)

    const res = await app.inject({
      method: 'GET',
      url: `/reputation/profile/${CITIZEN_ID}`,
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.citizen_id).toBe(CITIZEN_ID)
    expect(body.reputation_score).toBe(75)
    expect(body.level).toBe('activista')
  })

  it('returns 400 for invalid citizenId format', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/reputation/profile/not-a-uuid',
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('GET /reputation/me', () => {
  it('returns own profile when authenticated', async () => {
    mockGetProfile.mockResolvedValue(MOCK_PROFILE)

    const res = await app.inject({
      method: 'GET',
      url: '/reputation/me',
      headers: { Authorization: `Bearer ${verifiedToken}` },
    })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.payload).citizen_id).toBe(CITIZEN_ID)
  })

  it('returns 401 without token', async () => {
    const res = await app.inject({ method: 'GET', url: '/reputation/me' })
    expect(res.statusCode).toBe(401)
  })
})

describe('GET /reputation/me/analytics', () => {
  it('returns analytics for the authenticated citizen', async () => {
    mockGetAnalytics.mockResolvedValue(MOCK_ANALYTICS)

    const res = await app.inject({
      method: 'GET',
      url: '/reputation/me/analytics',
      headers: { Authorization: `Bearer ${verifiedToken}` },
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.citizen_id).toBe(CITIZEN_ID)
    expect(body.community.top_percent).toBe(8)
    expect(body.streak.current_days).toBe(4)
    expect(mockGetAnalytics).toHaveBeenCalledWith(CITIZEN_ID)
  })

  it('returns 401 without token', async () => {
    const res = await app.inject({ method: 'GET', url: '/reputation/me/analytics' })
    expect(res.statusCode).toBe(401)
  })
})

describe('GET /reputation/graph/:citizenId', () => {
  it('returns the citizen graph', async () => {
    mockGetGraph.mockResolvedValue(MOCK_GRAPH)

    const res = await app.inject({
      method: 'GET',
      url: `/reputation/graph/${CITIZEN_ID}`,
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.voted_on).toHaveLength(2)
    expect(body.created_proposals).toHaveLength(1)
  })

  it('returns 400 for non-uuid citizenId', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/reputation/graph/bad-id',
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('GET /reputation/leaderboard', () => {
  it('returns leaderboard with default pagination', async () => {
    mockGetLeaderboard.mockResolvedValue([
      { citizen_id: 'a', reputation_score: 200, level: 'embajador', rank: 1 },
      { citizen_id: 'b', reputation_score: 80, level: 'activista', rank: 2 },
    ])

    const res = await app.inject({
      method: 'GET',
      url: '/reputation/leaderboard',
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.entries).toHaveLength(2)
    expect(body.count).toBe(2)
    expect(body.entries[0].rank).toBe(1)
  })

  it('accepts custom limit and offset', async () => {
    mockGetLeaderboard.mockResolvedValue([])

    const res = await app.inject({
      method: 'GET',
      url: '/reputation/leaderboard?limit=5&offset=10',
    })

    expect(res.statusCode).toBe(200)
    expect(mockGetLeaderboard).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 5, offset: 10 }),
    )
  })

  it('returns 400 for limit exceeding 100', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/reputation/leaderboard?limit=101',
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('POST /reputation/events', () => {
  it('records an event when authenticated', async () => {
    mockRecordEvent.mockResolvedValue(MOCK_EVENT)

    const res = await app.inject({
      method: 'POST',
      url: '/reputation/events',
      headers: { Authorization: `Bearer ${verifiedToken}` },
      payload: {
        citizen_id: CITIZEN_ID,
        event_type: 'vote_cast',
        reference_id: 'proposal-uuid',
      },
    })

    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.payload)
    expect(body.event_type).toBe('vote_cast')
    expect(body.points).toBe(5)
  })

  it('returns 400 for invalid event_type', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/reputation/events',
      headers: { Authorization: `Bearer ${verifiedToken}` },
      payload: { citizen_id: CITIZEN_ID, event_type: 'invalid_event' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for non-uuid citizen_id', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/reputation/events',
      headers: { Authorization: `Bearer ${verifiedToken}` },
      payload: { citizen_id: 'not-a-uuid', event_type: 'vote_cast' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 401 without token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/reputation/events',
      payload: { citizen_id: CITIZEN_ID, event_type: 'vote_cast' },
    })
    expect(res.statusCode).toBe(401)
  })
})
