const mockQueryRaw = jest.fn()
const mockTransaction = jest.fn((cb: (tx: { $queryRaw: typeof mockQueryRaw }) => unknown) =>
  cb({ $queryRaw: mockQueryRaw }),
)

jest.mock('../../../config', () => ({
  config: {
    CIVIC_IDENTITY_ASSURANCE_PROVIDERS: ['trusted_kyc'],
    CIVIC_IDENTITY_PROOFING_ADAPTER_KEYS_JSON: '{}',
    VOTE_NULLIFIER_SECRET: 'test-nullifier-secret-32-chars-min!!',
    JWT_SECRET: 'test-secret-with-at-least-32-characters-ok',
  },
}))

jest.mock('../../../lib/prisma', () => ({
  prisma: { $queryRaw: mockQueryRaw, $transaction: mockTransaction },
}))
jest.mock('../../../lib/cache', () => ({
  getCache: jest.fn(), setCache: jest.fn(), delCache: jest.fn().mockResolvedValue(undefined),
  TTL: { PROFILE: 300, SESSION: 60, REPORT: 120, STATS: 600 },
}))
jest.mock('../../../lib/redis', () => ({ redis: { sadd: jest.fn() } }))
jest.mock('../../../lib/jobs', () => ({ enqueueJob: jest.fn() }))
jest.mock('../../../lib/audit', () => ({ recordAuditEvent: jest.fn() }))
jest.mock('../../../lib/pubsub', () => ({ publish: jest.fn() }))
jest.mock('../../reputation/reputation.service', () => ({ recordReputationEvent: jest.fn() }))
jest.mock('../../notifications/notifications.service', () => ({ createNotification: jest.fn() }))

import { advanceProposalStage } from '../governance.service'

const PROPOSAL = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  author_id: '550e8400-e29b-41d4-a716-446655440000',
  title: 'Consulta de prueba', description: 'Consulta cívica para verificar el interlock de identidad.',
  executive_summary: null, category: 'gobernanza', scope: 'city', locality_id: null,
  neighborhood: null, status: 'debate', endorsement_count: 10n, comment_count: 0n,
  view_count: 0n, quorum_required: null, approval_threshold: null, eligible_voters: null,
  total_votes: 0n, approve_votes_weighted: '0.0000', reject_votes_weighted: '0.0000',
  abstain_votes_weighted: '0.0000', assigned_executor: null, execution_deadline: null,
  blockchain_tx_hash: null, ipfs_proposal_uri: null, ipfs_result_uri: null,
  created_at: new Date(), draft_started_at: new Date(), debate_started_at: new Date(),
  voting_starts_at: null, voting_ends_at: null, decided_at: null,
}

beforeEach(() => {
  jest.clearAllMocks()
  mockTransaction.mockImplementation((cb: (tx: { $queryRaw: typeof mockQueryRaw }) => unknown) =>
    cb({ $queryRaw: mockQueryRaw }),
  )
})

describe('P0.4 proof provider activation interlock', () => {
  it('does not open voting when trust policy exists but provider ingress is unavailable', async () => {
    mockQueryRaw.mockResolvedValueOnce([PROPOSAL])

    await expect(advanceProposalStage(PROPOSAL.id, PROPOSAL.author_id)).rejects.toMatchObject({
      statusCode: 503,
      code: 'CIVIC_IDENTITY_ASSURANCE_UNAVAILABLE',
    })

    expect(mockTransaction).toHaveBeenCalledTimes(1)
    expect(mockQueryRaw).toHaveBeenCalledTimes(1)
  })
})
