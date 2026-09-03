const mockQueryRaw = jest.fn()
const mockTransaction = jest.fn((cb: (tx: { $queryRaw: typeof mockQueryRaw }) => unknown) =>
  cb({ $queryRaw: mockQueryRaw }),
)

jest.mock('../../../config', () => ({
  config: {
    CIVIC_IDENTITY_ASSURANCE_PROVIDERS: ['trusted_kyc'],
    VOTE_NULLIFIER_SECRET: 'test-nullifier-secret-32-chars-min!!',
    JWT_SECRET: 'test-secret-with-at-least-32-characters-ok',
  },
}))

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    $transaction: mockTransaction,
  },
}))

jest.mock('../../../lib/cache', () => ({
  getCache: jest.fn(),
  setCache: jest.fn(),
  delCache: jest.fn().mockResolvedValue(undefined),
  TTL: { PROFILE: 300, SESSION: 60, REPORT: 120, STATS: 600 },
}))

jest.mock('../../../lib/redis', () => ({ redis: { sadd: jest.fn().mockResolvedValue(1) } }))
jest.mock('../../../lib/jobs', () => ({ enqueueJob: jest.fn() }))
jest.mock('../../../lib/audit', () => ({ recordAuditEvent: jest.fn() }))
jest.mock('../../../lib/pubsub', () => ({ publish: jest.fn().mockResolvedValue(undefined) }))
jest.mock('../../reputation/reputation.service', () => ({ recordReputationEvent: jest.fn().mockResolvedValue(undefined) }))
jest.mock('../../notifications/notifications.service', () => ({ createNotification: jest.fn().mockResolvedValue(undefined) }))

import { advanceProposalStage, castVote } from '../governance.service'

const BASE_PROPOSAL = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  author_id: '550e8400-e29b-41d4-a716-446655440000',
  title: 'Propuesta cívica',
  description: 'Descripción suficientemente amplia para la prueba de gobernanza.',
  executive_summary: null,
  category: 'infraestructura',
  scope: 'city',
  locality_id: null,
  neighborhood: null,
  status: 'debate',
  endorsement_count: 10n,
  comment_count: 0n,
  view_count: 0n,
  quorum_required: null,
  approval_threshold: null,
  eligible_voters: null,
  total_votes: 0n,
  approve_votes_weighted: '0.0000',
  reject_votes_weighted: '0.0000',
  abstain_votes_weighted: '0.0000',
  assigned_executor: null,
  execution_deadline: null,
  blockchain_tx_hash: null,
  ipfs_proposal_uri: null,
  ipfs_result_uri: null,
  created_at: new Date('2026-09-02T20:00:00.000Z'),
  draft_started_at: null,
  debate_started_at: new Date('2026-09-02T20:00:00.000Z'),
  voting_starts_at: null,
  voting_ends_at: null,
  decided_at: null,
}

function sqlText(value: unknown): string {
  const sql = value as { strings?: readonly string[] }
  return sql.strings?.join(' ') ?? String(value)
}

beforeEach(() => {
  // Preserve async mock implementations declared above (notifications,
  // reputation, pubsub, cache) while isolating call history between tests.
  jest.clearAllMocks()
  mockTransaction.mockImplementation((cb: (tx: { $queryRaw: typeof mockQueryRaw }) => unknown) =>
    cb({ $queryRaw: mockQueryRaw }),
  )
})

describe('P0 governance identity assurance policy', () => {
  it('freezes the voter roll from assured identities only, so quorum uses the same electorate as vote admission', async () => {
    const votingProposal = {
      ...BASE_PROPOSAL,
      status: 'voting',
      eligible_voters: 1n,
      quorum_required: '0.250',
      approval_threshold: '0.550',
      voting_starts_at: new Date(),
      voting_ends_at: new Date(Date.now() + 72 * 3600 * 1000),
    }

    mockQueryRaw
      .mockResolvedValueOnce([BASE_PROPOSAL])
      .mockResolvedValueOnce([{ citizen_id: '550e8400-e29b-41d4-a716-446655440010' }])
      .mockResolvedValueOnce([votingProposal])

    const result = await advanceProposalStage(BASE_PROPOSAL.id, BASE_PROPOSAL.author_id)

    expect(result.eligible_voters).toBe(1)
    const rosterSql = sqlText(mockQueryRaw.mock.calls[1]?.[0])
    expect(rosterSql).toContain('external_identities')
    expect(rosterSql).toContain('c.verification_level >= 2')
    expect(rosterSql).toContain('ei.provider IN')
  })

  it('rejects a direct voter who is not in the frozen roll', async () => {
    const votingProposal = {
      ...BASE_PROPOSAL,
      status: 'voting',
      voting_ends_at: new Date(Date.now() + 3600 * 1000),
    }

    mockQueryRaw
      .mockResolvedValueOnce([votingProposal])
      .mockResolvedValueOnce([{ already_voted: 0, reputation_score: '0.0000', eligible: false }])

    await expect(castVote(
      BASE_PROPOSAL.id,
      '550e8400-e29b-41d4-a716-446655440099',
      1,
    )).rejects.toMatchObject({
      statusCode: 403,
      code: 'NOT_ELIGIBLE_VOTER',
    })

    expect(mockQueryRaw).toHaveBeenCalledTimes(2)
  })

  it('uses the frozen roll for delegated weight and preserves validity and delegation scope', async () => {
    const votingProposal = {
      ...BASE_PROPOSAL,
      status: 'voting',
      voting_ends_at: new Date(Date.now() + 3600 * 1000),
    }
    const voteRow = {
      id: '550e8400-e29b-41d4-a716-446655440020',
      vote_weight: '1.0000',
      vote_value: 1,
      created_at: new Date(),
    }

    mockQueryRaw
      .mockResolvedValueOnce([votingProposal])
      .mockResolvedValueOnce([{ already_voted: 0, reputation_score: '0.0000', eligible: true }])
      .mockResolvedValueOnce([voteRow])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    const receipt = await castVote(
      BASE_PROPOSAL.id,
      '550e8400-e29b-41d4-a716-446655440000',
      1,
    )

    expect(receipt.vote_weight).toBe(1)
    expect(receipt.delegated_count).toBe(0)

    const directEligibilitySql = sqlText(mockQueryRaw.mock.calls[1]?.[0])
    expect(directEligibilitySql).toContain('proposal_voter_roll')
    expect(directEligibilitySql).not.toContain('external_identities')

    const delegationSql = sqlText(mockQueryRaw.mock.calls[3]?.[0])
    expect(delegationSql).toContain('proposal_voter_roll')
    expect(delegationSql).toContain('pvr.proposal_id')
    expect(delegationSql).toContain('pvr.citizen_id')
    expect(delegationSql).toContain('d.valid_from <= NOW()')
    expect(delegationSql).toContain('d.valid_until IS NULL OR d.valid_until > NOW()')
    expect(delegationSql).toContain("d.delegation_type = 'general'")
    expect(delegationSql).toContain("d.delegation_type = 'domain'")
    expect(delegationSql).toContain("d.delegation_type = 'proposal'")
    expect(delegationSql).not.toContain('external_identities')
  })
})
