const mockQueryRaw = jest.fn()
const mockAdvance = jest.fn()
const mockAudit = jest.fn().mockResolvedValue(undefined)

jest.mock('../../../lib/prisma', () => ({
  prisma: { $queryRaw: mockQueryRaw },
}))

jest.mock('../../../lib/audit', () => ({
  recordAuditEvent: mockAudit,
}))

jest.mock('../governance.service', () => ({
  advanceProposalStage: mockAdvance,
}))

import { adminAdvanceProposalSafely } from '../governance.admin-transition'

const PROPOSAL_ID = '550e8400-e29b-41d4-a716-446655440001'
const AUTHOR_ID = '550e8400-e29b-41d4-a716-446655440002'
const ACTOR_ID = '550e8400-e29b-41d4-a716-446655440003'

const PROPOSAL = {
  id: PROPOSAL_ID,
  author_id: AUTHOR_ID,
  title: 'Consulta cívica con electorado congelado',
  description: 'Descripción suficientemente completa para pruebas de gobernanza.',
  executive_summary: null,
  category: 'infraestructura',
  scope: 'city',
  locality_id: null,
  neighborhood: null,
  status: 'debate',
  endorsement_count: 12,
  comment_count: 4,
  view_count: 20,
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
  created_at: new Date(),
  updated_at: new Date(),
  draft_started_at: new Date(),
  debate_started_at: new Date(),
  voting_starts_at: null,
  voting_ends_at: null,
  decided_at: null,
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('adminAdvanceProposalSafely', () => {
  it('routes an administrative command through the canonical lifecycle principal', async () => {
    mockQueryRaw.mockResolvedValueOnce([PROPOSAL])
    mockAdvance.mockResolvedValueOnce({
      ...PROPOSAL,
      status: 'voting',
      eligible_voters: 25,
      voting_starts_at: new Date(),
      voting_ends_at: new Date(Date.now() + 3600_000),
    })

    const result = await adminAdvanceProposalSafely(PROPOSAL_ID, ACTOR_ID)

    expect(result.status).toBe('voting')
    expect(mockAdvance).toHaveBeenCalledWith(PROPOSAL_ID, AUTHOR_ID, {})
    expect(mockAudit).toHaveBeenCalledWith(expect.objectContaining({
      actorId: ACTOR_ID,
      action: 'admin_advance_proposal',
      result: 'success',
      metadata: expect.objectContaining({
        from: 'debate',
        to: 'voting',
        canonical_transition: true,
      }),
    }))
  })

  it('fails closed when a proposal has no author instead of bypassing lifecycle invariants', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ ...PROPOSAL, author_id: null }])

    await expect(adminAdvanceProposalSafely(PROPOSAL_ID, ACTOR_ID)).rejects.toMatchObject({
      statusCode: 409,
      code: 'AUTHOR_REQUIRED_FOR_CANONICAL_TRANSITION',
    })

    expect(mockAdvance).not.toHaveBeenCalled()
    expect(mockAudit).toHaveBeenCalledWith(expect.objectContaining({
      actorId: ACTOR_ID,
      result: 'rejected',
    }))
  })

  it('preserves canonical voting-window rejection instead of force-closing an active vote', async () => {
    mockQueryRaw.mockResolvedValueOnce([{
      ...PROPOSAL,
      status: 'voting',
      eligible_voters: 25,
      voting_ends_at: new Date(Date.now() + 3600_000),
    }])
    mockAdvance.mockRejectedValueOnce(Object.assign(
      new Error('La votación aún está activa'),
      { statusCode: 400, code: 'VOTING_STILL_ACTIVE' },
    ))

    await expect(adminAdvanceProposalSafely(PROPOSAL_ID, ACTOR_ID)).rejects.toMatchObject({
      statusCode: 400,
      code: 'VOTING_STILL_ACTIVE',
    })

    expect(mockAudit).toHaveBeenCalledWith(expect.objectContaining({
      actorId: ACTOR_ID,
      result: 'rejected',
      reason: 'VOTING_STILL_ACTIVE',
    }))
  })
})
