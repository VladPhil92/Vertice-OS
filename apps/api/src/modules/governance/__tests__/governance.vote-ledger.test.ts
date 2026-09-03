const mockQueryRaw = jest.fn()
const mockTransaction = jest.fn((cb: (tx: { $queryRaw: typeof mockQueryRaw }) => unknown) =>
  cb({ $queryRaw: mockQueryRaw }),
)
const mockDelCache = jest.fn().mockResolvedValue(undefined)
const mockPublish = jest.fn().mockResolvedValue(undefined)
const mockReputation = jest.fn().mockResolvedValue(undefined)
const mockLoggerError = jest.fn()

jest.mock('../../../config', () => ({
  config: {
    VOTE_NULLIFIER_SECRET: 'test-nullifier-secret-32-chars-min!!',
    JWT_SECRET: 'test-secret-with-at-least-32-characters-ok',
  },
}))

jest.mock('../../../lib/prisma', () => ({
  prisma: { $transaction: mockTransaction },
}))

jest.mock('../../../lib/cache', () => ({ delCache: mockDelCache }))
jest.mock('../../../lib/pubsub', () => ({ publish: mockPublish }))
jest.mock('../../../lib/logger', () => ({ logger: { error: mockLoggerError } }))
jest.mock('../../reputation/reputation.service', () => ({
  recordReputationEvent: mockReputation,
}))

import { castVoteLedger } from '../governance.vote-ledger'

const PROPOSAL_ID = '550e8400-e29b-41d4-a716-446655440001'
const CITIZEN_ID = '550e8400-e29b-41d4-a716-446655440000'

const CONTEXT = {
  id: PROPOSAL_ID,
  status: 'voting',
  category: 'infraestructura',
  voting_ends_at: new Date(Date.now() + 3600 * 1000),
  roll_exists: true,
  eligible: true,
}

const DIRECT_VOTE = {
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

describe('canonical liquid-democracy vote ledger', () => {
  it('persists delegated participants and rebuilds the proposal tally from durable vote rows', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([CONTEXT])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([DIRECT_VOTE])
      .mockResolvedValueOnce([
        { delegator_id: '550e8400-e29b-41d4-a716-446655440020' },
        { delegator_id: '550e8400-e29b-41d4-a716-446655440021' },
      ])
      .mockResolvedValueOnce([
        { id: '550e8400-e29b-41d4-a716-446655440030' },
        { id: '550e8400-e29b-41d4-a716-446655440031' },
      ])
      .mockResolvedValueOnce([])

    const receipt = await castVoteLedger(PROPOSAL_ID, CITIZEN_ID, 1)

    expect(receipt.vote_weight).toBe(3)
    expect(receipt.delegated_count).toBe(2)
    expect(receipt.vote_value).toBe(1)

    const contextSql = sqlText(mockQueryRaw.mock.calls[0]?.[0])
    expect(contextSql).toContain('proposal_voter_roll')
    expect(contextSql).toContain('FOR UPDATE')

    const delegationSql = sqlText(mockQueryRaw.mock.calls[3]?.[0])
    expect(delegationSql).toContain('SELECT DISTINCT d.delegator_id')
    expect(delegationSql).toContain('proposal_voter_roll')
    expect(delegationSql).toContain('d.valid_until')

    const delegatedInsertSql = sqlText(mockQueryRaw.mock.calls[4]?.[0])
    expect(delegatedInsertSql).toContain('is_delegated')
    expect(delegatedInsertSql).toContain('ON CONFLICT (nullifier_hash) DO NOTHING')

    const tallySql = sqlText(mockQueryRaw.mock.calls[5]?.[0])
    expect(tallySql).toContain('COUNT(*)::int AS total_votes')
    expect(tallySql).toContain('FROM votes')
    expect(tallySql).toContain('UPDATE proposals')
  })

  it('lets a citizen override a prior delegated vote without creating a second participant', async () => {
    const delegatedVote = {
      ...DIRECT_VOTE,
      vote_value: -1,
      is_delegated: true,
    }
    const overridden = {
      ...DIRECT_VOTE,
      vote_value: 1,
      is_delegated: false,
    }

    mockQueryRaw
      .mockResolvedValueOnce([CONTEXT])
      .mockResolvedValueOnce([delegatedVote])
      .mockResolvedValueOnce([overridden])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    const receipt = await castVoteLedger(PROPOSAL_ID, CITIZEN_ID, 1)

    expect(receipt.vote_id).toBe(DIRECT_VOTE.id)
    expect(receipt.vote_weight).toBe(1)
    expect(receipt.delegated_count).toBe(0)

    const overrideSql = sqlText(mockQueryRaw.mock.calls[2]?.[0])
    expect(overrideSql).toContain('is_delegated = false')
    expect(overrideSql).toContain('delegation_depth = 0')
  })

  it('rejects a second direct vote for the same citizen and proposal', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([CONTEXT])
      .mockResolvedValueOnce([DIRECT_VOTE])

    await expect(castVoteLedger(PROPOSAL_ID, CITIZEN_ID, 1)).rejects.toMatchObject({
      statusCode: 409,
      code: 'ALREADY_VOTED',
    })

    expect(mockQueryRaw).toHaveBeenCalledTimes(2)
  })

  it('fails closed when no frozen voter roll exists', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ ...CONTEXT, roll_exists: false, eligible: false }])

    await expect(castVoteLedger(PROPOSAL_ID, CITIZEN_ID, 1)).rejects.toMatchObject({
      statusCode: 409,
      code: 'VOTER_ROLL_UNAVAILABLE',
    })
  })

  it('rejects a citizen outside the frozen electorate', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ ...CONTEXT, eligible: false }])

    await expect(castVoteLedger(PROPOSAL_ID, CITIZEN_ID, 1)).rejects.toMatchObject({
      statusCode: 403,
      code: 'NOT_ELIGIBLE_VOTER',
    })
  })

  it('rejects votes outside an active voting window', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ ...CONTEXT, status: 'debate' }])

    await expect(castVoteLedger(PROPOSAL_ID, CITIZEN_ID, 1)).rejects.toMatchObject({
      statusCode: 400,
      code: 'WRONG_STATUS',
    })

    mockQueryRaw.mockReset()
    mockQueryRaw.mockResolvedValueOnce([{
      ...CONTEXT,
      voting_ends_at: new Date(Date.now() - 1000),
    }])

    await expect(castVoteLedger(PROPOSAL_ID, CITIZEN_ID, 1)).rejects.toMatchObject({
      statusCode: 400,
      code: 'VOTING_CLOSED',
    })
  })
})
