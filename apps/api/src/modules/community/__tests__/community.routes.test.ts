jest.mock('../../../lib/redis', () => ({
  redis: {
    ping: jest.fn().mockResolvedValue('PONG'),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    on: jest.fn(),
  },
}))

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    citizen: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn() },
    $queryRaw: jest.fn().mockResolvedValue([{ ok: 1 }]),
    $queryRawUnsafe: jest.fn().mockResolvedValue([]),
  },
}))

const mockListFeed = jest.fn()
const mockListFollowingFeed = jest.fn()
const mockLeaderboard = jest.fn()
const mockGetProfile = jest.fn()
const mockUpdateProfile = jest.fn()
const mockGetPublicProfile = jest.fn()
const mockGetFollowState = jest.fn()
const mockFollow = jest.fn()
const mockUnfollow = jest.fn()
const mockValidationState = jest.fn()
const mockSetValidation = jest.fn()
const mockRemoveValidation = jest.fn()

jest.mock('../community.service', () => ({
  listCommunityFeed: mockListFeed,
  listFollowingFeed: mockListFollowingFeed,
  getCommunityLeaderboard: mockLeaderboard,
  getCivicProfile: mockGetProfile,
  updateCivicProfile: mockUpdateProfile,
  getPublicCivicProfile: mockGetPublicProfile,
  getFollowState: mockGetFollowState,
  followCivicProfile: mockFollow,
  unfollowCivicProfile: mockUnfollow,
  getActivityValidationState: mockValidationState,
  setActivityValidation: mockSetValidation,
  removeActivityValidation: mockRemoveValidation,
}))

import { buildApp } from '../../../app'

const app = buildApp()
const CITIZEN_ID = '550e8400-e29b-41d4-a716-446655440000'
const TARGET_ID = '550e8400-e29b-41d4-a716-446655440001'
const ACTIVITY_ID = '550e8400-e29b-41d4-a716-446655440010'
const DID = `did:vertice:${CITIZEN_ID}`

let authToken: string
let verifiedToken: string

beforeAll(async () => {
  await app.ready()
  authToken = app.jwt.sign({ sub: CITIZEN_ID, did: DID, lvl: 0, role: 'citizen' })
  verifiedToken = app.jwt.sign({ sub: CITIZEN_ID, did: DID, lvl: 1, role: 'citizen' })
})

afterAll(() => app.close())

beforeEach(() => {
  jest.clearAllMocks()
})

describe('community public feed and leaderboard routes', () => {
  it('returns the public feed contract with social graph metadata', async () => {
    mockListFeed.mockResolvedValueOnce([])

    const res = await app.inject({ method: 'GET', url: '/community/feed?limit=10' })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.count).toBe(0)
    expect(body.scoring.version).toBe('civic-action-v1')
    expect(body.social_graph.version).toBe('community-v2')
    expect(mockListFeed).toHaveBeenCalledWith(expect.objectContaining({ limit: 10 }))
  })

  it('rejects invalid public feed query parameters', async () => {
    const res = await app.inject({ method: 'GET', url: '/community/feed?type=invalid' })
    expect(res.statusCode).toBe(400)
    expect(mockListFeed).not.toHaveBeenCalled()
  })

  it('rejects invalid leaderboard parameters', async () => {
    const res = await app.inject({ method: 'GET', url: '/community/leaderboard?limit=0' })
    expect(res.statusCode).toBe(400)
    expect(mockLeaderboard).not.toHaveBeenCalled()
  })

  it('returns leaderboard metadata that explicitly excludes community popularity', async () => {
    mockLeaderboard.mockResolvedValueOnce([])

    const res = await app.inject({ method: 'GET', url: '/community/leaderboard?limit=5' })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.excludes).toContain('corroboraciones comunitarias')
    expect(body.scoring_version).toBe('civic-action-v1')
  })
})

describe('community following routes', () => {
  it('requires authentication for the following feed', async () => {
    const res = await app.inject({ method: 'GET', url: '/community/following/feed' })
    expect(res.statusCode).toBe(401)
  })

  it('returns the authenticated following feed', async () => {
    mockListFollowingFeed.mockResolvedValueOnce([])

    const res = await app.inject({
      method: 'GET',
      url: '/community/following/feed?type=report&limit=12',
      headers: { authorization: `Bearer ${authToken}` },
    })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.payload)).toMatchObject({ count: 0, scope: 'following' })
    expect(mockListFollowingFeed).toHaveBeenCalledWith(
      CITIZEN_ID,
      expect.objectContaining({ type: 'report', limit: 12 }),
    )
  })

  it('rejects invalid following feed query parameters', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/community/following/feed?limit=101',
      headers: { authorization: `Bearer ${authToken}` },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns a public civic profile for a valid UUID', async () => {
    mockGetPublicProfile.mockResolvedValueOnce({ citizen_id: TARGET_ID, public_profile: true })

    const res = await app.inject({ method: 'GET', url: `/community/profiles/${TARGET_ID}` })

    expect(res.statusCode).toBe(200)
    expect(mockGetPublicProfile).toHaveBeenCalledWith(TARGET_ID)
  })

  it('rejects malformed public profile identifiers', async () => {
    const res = await app.inject({ method: 'GET', url: '/community/profiles/not-a-uuid' })
    expect(res.statusCode).toBe(400)
  })

  it('requires authentication for follow state', async () => {
    const res = await app.inject({ method: 'GET', url: `/community/profiles/${TARGET_ID}/follow-state` })
    expect(res.statusCode).toBe(401)
  })

  it('returns follow state for an authenticated viewer', async () => {
    mockGetFollowState.mockResolvedValueOnce({ following: true, follower_count: 3 })

    const res = await app.inject({
      method: 'GET',
      url: `/community/profiles/${TARGET_ID}/follow-state`,
      headers: { authorization: `Bearer ${authToken}` },
    })

    expect(res.statusCode).toBe(200)
    expect(mockGetFollowState).toHaveBeenCalledWith(CITIZEN_ID, TARGET_ID)
  })

  it('rejects malformed follow targets before calling the service', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/community/profiles/not-a-uuid/follow',
      headers: { authorization: `Bearer ${authToken}` },
    })

    expect(res.statusCode).toBe(400)
    expect(mockFollow).not.toHaveBeenCalled()
  })

  it('follows and unfollows a valid public profile', async () => {
    mockFollow.mockResolvedValueOnce({ following: true, follower_count: 4 })
    mockUnfollow.mockResolvedValueOnce({ following: false, follower_count: 3 })

    const follow = await app.inject({
      method: 'POST',
      url: `/community/profiles/${TARGET_ID}/follow`,
      headers: { authorization: `Bearer ${authToken}` },
    })
    const unfollow = await app.inject({
      method: 'DELETE',
      url: `/community/profiles/${TARGET_ID}/follow`,
      headers: { authorization: `Bearer ${authToken}` },
    })

    expect(follow.statusCode).toBe(200)
    expect(unfollow.statusCode).toBe(200)
    expect(mockFollow).toHaveBeenCalledWith(CITIZEN_ID, TARGET_ID)
    expect(mockUnfollow).toHaveBeenCalledWith(CITIZEN_ID, TARGET_ID)
  })
})

describe('community evidence validation routes', () => {
  it('returns a public validation summary', async () => {
    mockValidationState.mockResolvedValueOnce({
      corroborations: 2,
      disputes: 1,
      total: 3,
      my_stance: null,
      my_note: null,
    })

    const res = await app.inject({
      method: 'GET',
      url: `/community/activities/report/${ACTIVITY_ID}/validations`,
    })

    expect(res.statusCode).toBe(200)
    expect(mockValidationState).toHaveBeenCalledWith('report', ACTIVITY_ID)
  })

  it('rejects unsupported activity types', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/community/activities/comment/${ACTIVITY_ID}/validations`,
    })
    expect(res.statusCode).toBe(400)
  })

  it('requires a verified identity to submit a validation', async () => {
    const unauthenticated = await app.inject({
      method: 'PUT',
      url: `/community/activities/report/${ACTIVITY_ID}/validation`,
      payload: { stance: 'corroborate' },
    })
    const unverified = await app.inject({
      method: 'PUT',
      url: `/community/activities/report/${ACTIVITY_ID}/validation`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: { stance: 'corroborate' },
    })

    expect(unauthenticated.statusCode).toBe(401)
    expect(unverified.statusCode).toBe(403)
    expect(mockSetValidation).not.toHaveBeenCalled()
  })

  it('rejects an invalid stance and exposes field validation details', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/community/activities/report/${ACTIVITY_ID}/validation`,
      headers: { authorization: `Bearer ${verifiedToken}` },
      payload: { stance: 'invalid' },
    })

    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.payload).details).toBeDefined()
  })

  it('rejects invalid route params even when the body is valid', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/community/activities/report/not-a-uuid/validation',
      headers: { authorization: `Bearer ${verifiedToken}` },
      payload: { stance: 'corroborate' },
    })

    expect(res.statusCode).toBe(400)
    const body = JSON.parse(res.payload)
    expect(body.error).toBe('Validación comunitaria inválida')
    expect(body.details).toBeUndefined()
  })

  it('submits a corroboration for a verified citizen', async () => {
    mockSetValidation.mockResolvedValueOnce({
      corroborations: 3,
      disputes: 1,
      total: 4,
      my_stance: 'corroborate',
      my_note: null,
    })

    const res = await app.inject({
      method: 'PUT',
      url: `/community/activities/proposal/${ACTIVITY_ID}/validation`,
      headers: { authorization: `Bearer ${verifiedToken}` },
      payload: { stance: 'corroborate' },
    })

    expect(res.statusCode).toBe(200)
    expect(mockSetValidation).toHaveBeenCalledWith(
      CITIZEN_ID,
      'proposal',
      ACTIVITY_ID,
      { stance: 'corroborate' },
    )
  })

  it('requires authentication to remove a validation', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/community/activities/report/${ACTIVITY_ID}/validation`,
    })
    expect(res.statusCode).toBe(401)
  })

  it('removes a validation for an authenticated citizen', async () => {
    mockRemoveValidation.mockResolvedValueOnce({
      corroborations: 0,
      disputes: 0,
      total: 0,
      my_stance: null,
      my_note: null,
    })

    const res = await app.inject({
      method: 'DELETE',
      url: `/community/activities/report/${ACTIVITY_ID}/validation`,
      headers: { authorization: `Bearer ${authToken}` },
    })

    expect(res.statusCode).toBe(200)
    expect(mockRemoveValidation).toHaveBeenCalledWith(CITIZEN_ID, 'report', ACTIVITY_ID)
  })
})
