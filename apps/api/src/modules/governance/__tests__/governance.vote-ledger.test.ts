const mockQueryRaw = jest.fn()
const mockTransaction = jest.fn((cb: (tx: { $queryRaw: typeof mockQueryRaw }) => unknown) =>
  cb({ $queryRaw: mockQueryRaw }),
)
const mockDelCache = jest.fn().mockResolvedValue(undefined)
const mockPublish = jest.fn().mockResolvedValue(undefined)
const mockRecordReputationEvent = jest.fn().mockResolvedValue(undefined)

jest.mock('../../../config', () => ({
  config: {
    VOTE_NULLIFIER_SECRET: 'test-nullifier-secret-32-chars-min!!',
    JWT_SECRET: 'test-jwt-secret-with-at-least-32-characters',
  },
}))

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    $transaction: mockTransaction,
  },
}))

jest.mock('../../../lib/cache', () => ({
  delCache: mockDelCache,
}))

jest.mock('../../../lib/logger', () => ({
  logger: { error: jest.fn() },
}))

jest.mock('../../../lib/pubsub', () => ({
  publish: mockPublish,
}))

jest.mock('../../reputation/reputation.service', () => ({
  recordReputationEvent: mockRecordReputationEvent,
}))

import { castVoteLedger } from '../governance.vote-ledger'

const PROPOSAL_ID = '550e8400-e29b-41d4-a716-446655440001'
const CITIZEN_ID = '550e8400-e29b-41d4-a716-446655440000'

const votingContext = {
  id: PROPOSAL_ID,
  status: 'voting',
  category: 'infraestructura',
  voting_ends_at: new Date(Date.now() + 60_000),
  roll_exists: true,
  eligible: true,
}

const directVoteRow = {
  id: '550e8400-e29b-41d4-a716-446655440010',
  vote_weight: '1.0000',
  vote_value: 1,
  is_delegated: false,
  created_at: new Date(),
}

function sqlText(value: unknown): string {
  const sql = value as { strings?: readonly string[] }
  return sql.strings?.join(' ') ?? String(value)
}

beforeEach(() => {
  jest.clearAllMocks()
  mockQueryRaw.mockReset()
  mockTransaction.mockImplementation((cb: (tx: { $queryRaw: typeof mockQueryRaw }) => unknown) =>
    cb({ $queryRaw: mockQueryRaw }),
  )
})

describe('canonical governance vote ledger', () => {
  it('serializes a proposal vote and rebuilds the tally from durable vote rows', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([votingContext])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([directVoteRow])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    const receipt = await castVoteLedger(PROPOSAL_ID, CITIZEN_ID, 1)

    expect(receipt).toMatchObject({
      vote_id: directVoteRow.id,
      vote_weight: 1,
      vote_value: 1,
      proposal_id: PROPOSAL_ID,
      delegated_count: 0,
    })

    const admissionSql = sqlText(mockQueryRaw.mock.calls[0]?.[0])
    expect(admissionSql).toContain('FOR UPDATE')
    expect(admissionSql).toContain('proposal_voter_roll')

    const tallySql = sqlText(mockQueryRaw.mock.calls[4]?.[0])
    expect(tallySql).toContain('COUNT(*)::int AS total_votes')
    expect(tallySql).toContain('FROM votes')
    expect(tallySql).toContain('UPDATE proposals')
  })

  it('resolves one effective delegation before filtering by delegate', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([votingContext])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([directVoteRow])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    await castVoteLedger(PROPOSAL_ID, CITIZEN_ID, 1)

    const delegationSql = sqlText(mockQueryRaw.mock.calls[3]?.[0])
    expect(delegationSql).toContain('WITH effective_delegations AS')
    expect(delegationSql).toContain('DISTINCT ON (d.delegator_id)')
    expect(delegationSql).toContain("WHEN 'proposal' THEN 3")
    expect(delegationSql).toContain("WHEN 'domain' THEN 2")
    expect(delegationSql).toContain('ELSE 1')
    expect(delegationSql).toContain('d.created_at DESC')
    expect(delegationSql).toContain('WHERE ed.delegate_id')

    const ctePosition = delegationSql.indexOf('WITH effective_delegations AS')
    const delegateFilterPosition = delegationSql.indexOf('WHERE ed.delegate_id')
    expect(ctePosition).toBeGreaterThanOrEqual(0)
    expect(delegateFilterPosition).toBeGreaterThan(ctePosition)
  })

  it('converts prior delegated participation into one direct participant instead of duplicating it', async () => {
    const delegatedVote = {
      ...directVoteRow,
      vote_value: -1,
      is_delegated: true,
    }
    const overriddenVote = {
      ...directVoteRow,
      vote_value: 1,
      is_delegated: false,
    }

    mockQueryRaw
      .mockResolvedValueOnce([votingContext])
      .mockResolvedValueOnce([delegatedVote])
      .mockResolvedValueOnce([overriddenVote])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    const receipt = await castVoteLedger(PROPOSAL_ID, CITIZEN_ID, 1)

    expect(receipt.vote_id).toBe(directVoteRow.id)
    expect(receipt.vote_value).toBe(1)
    expect(receipt.vote_weight).toBe(1)
    expect(receipt.delegated_count).toBe(0)

    const overrideSql = sqlText(mockQueryRaw.mock.calls[2]?.[0])
    expect(overrideSql).toContain('UPDATE votes')
    expect(overrideSql).toContain('is_delegated = false')
    expect(overrideSql).toContain('delegation_depth = 0')
  })
})
