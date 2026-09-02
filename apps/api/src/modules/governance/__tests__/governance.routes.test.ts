jest.mock('../../../lib/redis', () => ({
  redis: { ping: jest.fn().mockResolvedValue('PONG'), get: jest.fn(), set: jest.fn(), del: jest.fn(), on: jest.fn() },
}))

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    citizen: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn() },
    $queryRaw: jest.fn().mockResolvedValue([]),
    $queryRawUnsafe: jest.fn().mockResolvedValue([]),
  },
}))

const mockCreate = jest.fn()
const mockList = jest.fn()
const mockGetById = jest.fn()
const mockEndorse = jest.fn()
const mockAdvance = jest.fn()
const mockVote = jest.fn()
const mockTally = jest.fn()
const mockCreateDelegation = jest.fn()
const mockRevokeDelegation = jest.fn()
const mockMyDelegations = jest.fn()
const mockStats = jest.fn()

jest.mock('../governance.service', () => ({
  createProposal: mockCreate,
  listProposals: mockList,
  getProposalById: mockGetById,
  endorseProposal: mockEndorse,
  advanceProposalStage: mockAdvance,
  castVote: mockVote,
  getVoteTally: mockTally,
  createDelegation: mockCreateDelegation,
  revokeDelegation: mockRevokeDelegation,
  getMyDelegations: mockMyDelegations,
  getGovernanceStats: mockStats,
}))

import { buildApp } from '../../../app'
import { prisma } from '../../../lib/prisma'

const app = buildApp()
const DID = 'did:vertice:550e8400-e29b-41d4-a716-446655440000'
const CITIZEN_ID = '550e8400-e29b-41d4-a716-446655440000'
const DELEGATE_ID = '660e8400-e29b-41d4-a716-446655440001'

let verifiedToken: string

beforeAll(async () => {
  await app.ready()
  verifiedToken = app.jwt.sign({ sub: CITIZEN_ID, did: DID, lvl: 1 })
})
afterAll(() => app.close())
beforeEach(() => {
  jest.resetAllMocks()
  ;(prisma.$queryRaw as jest.Mock).mockResolvedValue([])
})

const MOCK_PROPOSAL = {
  id: 'proposal-uuid',
  author_id: CITIZEN_ID,
  title: 'Mejorar el parque central del barrio de Manga',
  description: 'El parque necesita iluminación y zonas de recreación para todos los vecinos del sector.',
  executive_summary: 'Renovación del parque central',
  category: 'infraestructura',
  scope: 'neighborhood',
  status: 'idea',
  endorsement_count: 0,
  comment_count: 0,
  view_count: 0,
  quorum_required: null,
  approval_threshold: null,
  eligible_voters: null,
  total_votes: 0,
  approve_votes_weighted: 0,
  reject_votes_weighted: 0,
  abstain_votes_weighted: 0,
  assigned_executor: null,
  execution_deadline: null,
  blockchain_tx_hash: null,
  ipfs_proposal_uri: null,
  ipfs_result_uri: null,
  created_at: new Date('2024-06-01'),
  draft_started_at: null,
  debate_started_at: null,
  voting_starts_at: null,
  voting_ends_at: null,
  decided_at: null,
}

const MOCK_SUMMARY = {
  id: 'proposal-uuid',
  author_id: CITIZEN_ID,
  title: 'Mejorar el parque central del barrio de Manga',
  category: 'infraestructura',
  scope: 'neighborhood',
  status: 'idea',
  endorsement_count: 0,
  total_votes: 0,
  approve_votes_weighted: 0,
  reject_votes_weighted: 0,
  voting_ends_at: null,
  created_at: new Date('2024-06-01'),
}

const MOCK_DELEGATION = {
  id: 'delegation-uuid',
  delegator_id: CITIZEN_ID,
  delegate_id: DELEGATE_ID,
  delegation_type: 'general',
  domain: null,
  proposal_id: null,
  is_active: true,
  valid_from: new Date('2024-06-01'),
  valid_until: null,
  created_at: new Date('2024-06-01'),
  revoked_at: null,
}

// ── GET /governance/proposals ──────────────────────────────────────────────────

describe('GET /governance/proposals', () => {
  it('returns list of proposals (public endpoint)', async () => {
    mockList.mockResolvedValueOnce([MOCK_SUMMARY])

    const res = await app.inject({ method: 'GET', url: '/governance/proposals' })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.data).toHaveLength(1)
    expect(body.count).toBe(1)
  })

  it('passes filter parameters to service', async () => {
    mockList.mockResolvedValueOnce([])

    await app.inject({
      method: 'GET',
      url: '/governance/proposals?status=voting&category=infraestructura&scope=city',
    })

    expect(mockList).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'voting', category: 'infraestructura', scope: 'city' })
    )
  })

  it('returns 400 on invalid status', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/governance/proposals?status=invalid_status',
    })
    expect(res.statusCode).toBe(400)
  })
})

// ── GET /governance/proposals/stats ───────────────────────────────────────────

describe('GET /governance/proposals/stats', () => {
  it('returns governance stats (public)', async () => {
    mockStats.mockResolvedValueOnce({
      total_proposals: 10,
      by_status: [{ status: 'idea', count: 5 }],
      by_category: [{ category: 'infraestructura', count: 3 }],
      active_votes: 2,
      total_votes_cast: 42,
    })

    const res = await app.inject({ method: 'GET', url: '/governance/proposals/stats' })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.total_proposals).toBe(10)
    expect(body.active_votes).toBe(2)
  })
})

// ── GET /governance/proposals/:id ─────────────────────────────────────────────

describe('GET /governance/proposals/:id', () => {
  it('returns full proposal detail (public)', async () => {
    mockGetById.mockResolvedValueOnce(MOCK_PROPOSAL)

    const res = await app.inject({ method: 'GET', url: '/governance/proposals/proposal-uuid' })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.id).toBe('proposal-uuid')
    expect(body.description).toBeDefined()
  })

  it('propagates 404 from service', async () => {
    mockGetById.mockRejectedValueOnce(
      Object.assign(new Error('Propuesta no encontrada'), { statusCode: 404, code: 'PROPOSAL_NOT_FOUND' })
    )

    const res = await app.inject({ method: 'GET', url: '/governance/proposals/nonexistent' })
    expect(res.statusCode).toBe(404)
  })
})

// ── GET /governance/proposals/:id/tally ───────────────────────────────────────

describe('GET /governance/proposals/:id/tally', () => {
  it('returns vote tally (public)', async () => {
    mockTally.mockResolvedValueOnce({
      proposal_id: 'proposal-uuid',
      status: 'voting',
      total_votes: 25,
      approve_weighted: 18,
      reject_weighted: 7,
      abstain_weighted: 0,
      quorum_required: 0.15,
      approval_threshold: 0.4,
      eligible_voters: 100,
      quorum_reached: true,
      approval_percentage: 72,
      voting_ends_at: new Date(Date.now() + 3600 * 1000),
    })

    const res = await app.inject({ method: 'GET', url: '/governance/proposals/proposal-uuid/tally' })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.total_votes).toBe(25)
    expect(body.quorum_reached).toBe(true)
  })
})

// ── POST /governance/proposals ─────────────────────────────────────────────────

describe('POST /governance/proposals', () => {
  it('returns 401 without authentication', async () => {
    const res = await app.inject({ method: 'POST', url: '/governance/proposals', payload: {} })
    expect(res.statusCode).toBe(401)
  })

  it('returns 400 when title is too short', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/governance/proposals',
      headers: { authorization: `Bearer ${verifiedToken}` },
      payload: {
        title: 'Corto',
        description: 'El parque necesita iluminación y zonas de recreación adecuadas para todos los vecinos del sector.',
        category: 'infraestructura',
        scope: 'neighborhood',
      },
    })
    expect(res.statusCode).toBe(400)
  })

  it('creates proposal and returns 201', async () => {
    mockCreate.mockResolvedValueOnce(MOCK_PROPOSAL)

    const res = await app.inject({
      method: 'POST',
      url: '/governance/proposals',
      headers: { authorization: `Bearer ${verifiedToken}` },
      payload: {
        title: 'Mejorar el parque central del barrio de Manga',
        description: 'El parque necesita iluminación y zonas de recreación adecuadas para todos los vecinos del sector.',
        category: 'infraestructura',
        scope: 'neighborhood',
      },
    })

    expect(res.statusCode).toBe(201)
    expect(JSON.parse(res.payload).id).toBe('proposal-uuid')
    expect(mockCreate).toHaveBeenCalledWith(CITIZEN_ID, expect.objectContaining({
      category: 'infraestructura',
      scope: 'neighborhood',
    }))
  })
})

// ── POST /governance/proposals/:id/endorse ────────────────────────────────────

describe('POST /governance/proposals/:id/endorse', () => {
  it('returns 401 without authentication', async () => {
    const res = await app.inject({ method: 'POST', url: '/governance/proposals/p1/endorse' })
    expect(res.statusCode).toBe(401)
  })

  it('endorses proposal and returns updated count', async () => {
    mockEndorse.mockResolvedValueOnce({ proposal_id: 'proposal-uuid', endorsement_count: 6, status: 'idea', advanced: false })

    const res = await app.inject({
      method: 'POST',
      url: '/governance/proposals/proposal-uuid/endorse',
      headers: { authorization: `Bearer ${verifiedToken}` },
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.endorsement_count).toBe(6)
    expect(body.advanced).toBe(false)
  })

  it('propagates 409 from service on duplicate endorse', async () => {
    mockEndorse.mockRejectedValueOnce(
      Object.assign(new Error('Ya avalaste'), { statusCode: 409, code: 'ALREADY_ENDORSED' })
    )

    const res = await app.inject({
      method: 'POST',
      url: '/governance/proposals/proposal-uuid/endorse',
      headers: { authorization: `Bearer ${verifiedToken}` },
    })
    expect(res.statusCode).toBe(409)
  })
})

// ── POST /governance/proposals/:id/vote ───────────────────────────────────────

describe('POST /governance/proposals/:id/vote', () => {
  it('returns 401 without authentication', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/governance/proposals/p1/vote',
      payload: { vote_value: 1 },
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 400 on invalid vote_value', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/governance/proposals/proposal-uuid/vote',
      headers: { authorization: `Bearer ${verifiedToken}` },
      payload: { vote_value: 2 },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 409 when the proposal has no frozen voter roll', async () => {
    ;(prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([{ roll_exists: false, eligible: false }])

    const res = await app.inject({
      method: 'POST',
      url: '/governance/proposals/proposal-uuid/vote',
      headers: { authorization: `Bearer ${verifiedToken}` },
      payload: { vote_value: 1 },
    })

    expect(res.statusCode).toBe(409)
    expect(JSON.parse(res.payload).code).toBe('VOTER_ROLL_UNAVAILABLE')
    expect(mockVote).not.toHaveBeenCalled()
  })

  it('returns 403 when the citizen is not in the frozen voter roll', async () => {
    ;(prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([{ roll_exists: true, eligible: false }])

    const res = await app.inject({
      method: 'POST',
      url: '/governance/proposals/proposal-uuid/vote',
      headers: { authorization: `Bearer ${verifiedToken}` },
      payload: { vote_value: 1 },
    })

    expect(res.statusCode).toBe(403)
    expect(JSON.parse(res.payload).code).toBe('NOT_ELIGIBLE_VOTER')
    expect(mockVote).not.toHaveBeenCalled()
  })

  it('casts vote and returns 201 receipt for an eligible citizen', async () => {
    ;(prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([{ roll_exists: true, eligible: true }])
    mockVote.mockResolvedValueOnce({
      vote_id: 'vote-uuid',
      vote_weight: 1.0,
      vote_value: 1,
      proposal_id: 'proposal-uuid',
      created_at: new Date(),
    })

    const res = await app.inject({
      method: 'POST',
      url: '/governance/proposals/proposal-uuid/vote',
      headers: { authorization: `Bearer ${verifiedToken}` },
      payload: { vote_value: 1 },
    })

    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.payload)
    expect(body.vote_id).toBe('vote-uuid')
    expect(body.vote_value).toBe(1)
    expect(mockVote).toHaveBeenCalledWith('proposal-uuid', CITIZEN_ID, 1)
  })
})

// ── PATCH /governance/proposals/:id/advance ───────────────────────────────────

describe('PATCH /governance/proposals/:id/advance', () => {
  it('returns 401 without authentication', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/governance/proposals/p1/advance' })
    expect(res.statusCode).toBe(401)
  })

  it('advances proposal stage and returns updated proposal', async () => {
    mockAdvance.mockResolvedValueOnce({ ...MOCK_PROPOSAL, status: 'draft', draft_started_at: new Date() })

    const res = await app.inject({
      method: 'PATCH',
      url: '/governance/proposals/proposal-uuid/advance',
      headers: { authorization: `Bearer ${verifiedToken}` },
      payload: {},
    })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.payload).status).toBe('draft')
    expect(mockAdvance).toHaveBeenCalledWith('proposal-uuid', CITIZEN_ID, expect.any(Object))
  })
})

// ── POST /governance/delegations ──────────────────────────────────────────────

describe('POST /governance/delegations', () => {
  it('returns 401 without authentication', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/governance/delegations',
      payload: { delegate_id: DELEGATE_ID, delegation_type: 'general' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 400 when domain is missing for domain-type delegation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/governance/delegations',
      headers: { authorization: `Bearer ${verifiedToken}` },
      payload: { delegate_id: DELEGATE_ID, delegation_type: 'domain' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('creates delegation and returns 201', async () => {
    mockCreateDelegation.mockResolvedValueOnce(MOCK_DELEGATION)

    const res = await app.inject({
      method: 'POST',
      url: '/governance/delegations',
      headers: { authorization: `Bearer ${verifiedToken}` },
      payload: { delegate_id: DELEGATE_ID, delegation_type: 'general' },
    })

    expect(res.statusCode).toBe(201)
    expect(JSON.parse(res.payload).id).toBe('delegation-uuid')
    expect(mockCreateDelegation).toHaveBeenCalledWith(CITIZEN_ID, expect.objectContaining({
      delegate_id: DELEGATE_ID,
      delegation_type: 'general',
    }))
  })
})

// ── GET /governance/delegations/me ────────────────────────────────────────────

describe('GET /governance/delegations/me', () => {
  it('returns 401 without authentication', async () => {
    const res = await app.inject({ method: 'GET', url: '/governance/delegations/me' })
    expect(res.statusCode).toBe(401)
  })

  it('returns active delegations for current user', async () => {
    mockMyDelegations.mockResolvedValueOnce([MOCK_DELEGATION])

    const res = await app.inject({
      method: 'GET',
      url: '/governance/delegations/me',
      headers: { authorization: `Bearer ${verifiedToken}` },
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].delegation_type).toBe('general')
    expect(mockMyDelegations).toHaveBeenCalledWith(CITIZEN_ID)
  })
})

// ── DELETE /governance/delegations/:id ────────────────────────────────────────

describe('DELETE /governance/delegations/:id', () => {
  it('returns 401 without authentication', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/governance/delegations/delegation-uuid' })
    expect(res.statusCode).toBe(401)
  })

  it('revokes delegation and returns success', async () => {
    mockRevokeDelegation.mockResolvedValueOnce(undefined)

    const res = await app.inject({
      method: 'DELETE',
      url: '/governance/delegations/delegation-uuid',
      headers: { authorization: `Bearer ${verifiedToken}` },
    })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.payload).success).toBe(true)
    expect(mockRevokeDelegation).toHaveBeenCalledWith('delegation-uuid', CITIZEN_ID)
  })
})