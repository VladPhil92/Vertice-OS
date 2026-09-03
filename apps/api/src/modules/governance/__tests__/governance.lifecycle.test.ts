const mockTopQueryRaw = jest.fn()
const mockTxQueryRaw = jest.fn()
const mockTransaction = jest.fn((cb: (tx: { $queryRaw: typeof mockTxQueryRaw }) => unknown) =>
  cb({ $queryRaw: mockTxQueryRaw }),
)
const mockAdvance = jest.fn()
const mockEnqueueJob = jest.fn().mockResolvedValue(undefined)
const mockDelCache = jest.fn().mockResolvedValue(undefined)
const mockCreateNotification = jest.fn().mockResolvedValue(undefined)

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    $queryRaw: mockTopQueryRaw,
    $transaction: mockTransaction,
  },
}))

jest.mock('../../../lib/jobs', () => ({ enqueueJob: mockEnqueueJob }))
jest.mock('../../../lib/cache', () => ({ delCache: mockDelCache }))
jest.mock('../../notifications/notifications.service', () => ({
  createNotification: mockCreateNotification,
}))
jest.mock('../governance.service', () => ({
  advanceProposalStage: mockAdvance,
}))

import { advanceProposalStageSafely } from '../governance.lifecycle'

const PROPOSAL_ID = '550e8400-e29b-41d4-a716-446655440001'
const CITIZEN_ID = '550e8400-e29b-41d4-a716-446655440000'

const VOTING_ROW = {
  id: PROPOSAL_ID,
  author_id: CITIZEN_ID,
  title: 'Consulta con contrato electoral congelado',
  description: 'Una propuesta suficientemente detallada para probar el cierre electoral seguro.',
  executive_summary: null,
  category: 'infraestructura',
  scope: 'city',
  locality_id: null,
  neighborhood: null,
  status: 'voting',
  endorsement_count: 12,
  comment_count: 0,
  view_count: 0,
  quorum_required: '0.100',
  approval_threshold: '0.600',
  eligible_voters: 100,
  total_votes: 20,
  approve_votes_weighted: '14.0000',
  reject_votes_weighted: '6.0000',
  abstain_votes_weighted: '0.0000',
  assigned_executor: null,
  execution_deadline: null,
  rejection_reason: null,
  blockchain_tx_hash: null,
  ipfs_proposal_uri: null,
  ipfs_result_uri: null,
  created_at: new Date('2026-09-01T00:00:00Z'),
  draft_started_at: new Date('2026-09-01T01:00:00Z'),
  debate_started_at: new Date('2026-09-01T02:00:00Z'),
  voting_starts_at: new Date('2026-09-01T03:00:00Z'),
  voting_ends_at: new Date(Date.now() - 60_000),
  decided_at: null,
}

beforeEach(() => {
  jest.clearAllMocks()
  mockTopQueryRaw.mockReset()
  mockTxQueryRaw.mockReset()
  mockTransaction.mockImplementation((cb: (tx: { $queryRaw: typeof mockTxQueryRaw }) => unknown) =>
    cb({ $queryRaw: mockTxQueryRaw }),
  )
})

describe('governance frozen lifecycle', () => {
  it('keeps pre-vote stages on the existing canonical transition engine', async () => {
    const expected = { ...VOTING_ROW, status: 'debate' }
    mockTopQueryRaw.mockResolvedValueOnce([{ status: 'debate' }])
    mockAdvance.mockResolvedValueOnce(expected)

    const result = await advanceProposalStageSafely(PROPOSAL_ID, CITIZEN_ID, {})

    expect(result).toBe(expected)
    expect(mockAdvance).toHaveBeenCalledWith(PROPOSAL_ID, CITIZEN_ID, {})
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('finalizes an expired vote from frozen thresholds rather than current scope config', async () => {
    // City config currently requires 25% quorum, but this consultation froze
    // 10%. Participation is 20%, so only the frozen contract can approve it.
    mockTopQueryRaw.mockResolvedValueOnce([{ status: 'voting' }])
    mockTxQueryRaw
      .mockResolvedValueOnce([VOTING_ROW])
      .mockResolvedValueOnce([{ ...VOTING_ROW, status: 'approved', decided_at: new Date() }])

    const result = await advanceProposalStageSafely(PROPOSAL_ID, CITIZEN_ID, {})

    expect(result.status).toBe('approved')
    expect(mockAdvance).not.toHaveBeenCalled()
    expect(mockEnqueueJob).toHaveBeenCalledWith(
      'record_voting_result',
      expect.objectContaining({ proposalId: PROPOSAL_ID, result: 'approved' }),
      expect.any(Object),
    )
    expect(mockDelCache).toHaveBeenCalledWith('proposal', PROPOSAL_ID)
    expect(mockDelCache).toHaveBeenCalledWith('stats', 'global')
  })

  it('rejects finalization while the frozen voting window is still active', async () => {
    mockTopQueryRaw.mockResolvedValueOnce([{ status: 'voting' }])
    mockTxQueryRaw.mockResolvedValueOnce([{
      ...VOTING_ROW,
      voting_ends_at: new Date(Date.now() + 60_000),
    }])

    await expect(advanceProposalStageSafely(PROPOSAL_ID, CITIZEN_ID, {})).rejects.toMatchObject({
      statusCode: 400,
      code: 'VOTING_STILL_ACTIVE',
    })

    expect(mockEnqueueJob).not.toHaveBeenCalled()
  })
})
