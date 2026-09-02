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
    $queryRaw: jest.fn().mockResolvedValue([]),
    $queryRawUnsafe: jest.fn().mockResolvedValue([]),
  },
}))

const mockCastVote = jest.fn()

jest.mock('../governance.service', () => ({
  createProposal: jest.fn(),
  listProposals: jest.fn(),
  getProposalById: jest.fn(),
  endorseProposal: jest.fn(),
  advanceProposalStage: jest.fn(),
  castVote: mockCastVote,
  getVoteTally: jest.fn(),
  createDelegation: jest.fn(),
  revokeDelegation: jest.fn(),
  getMyDelegations: jest.fn(),
  getGovernanceStats: jest.fn(),
  adminAdvanceProposal: jest.fn(),
  adminArchiveProposal: jest.fn(),
  adminListProposals: jest.fn(),
}))

import { buildApp } from '../../../app'
import { prisma } from '../../../lib/prisma'

const app = buildApp()
const CITIZEN_ID = '550e8400-e29b-41d4-a716-446655440000'
const DID = `did:vertice:${CITIZEN_ID}`
let verifiedToken: string

beforeAll(async () => {
  await app.ready()
  verifiedToken = app.jwt.sign({ sub: CITIZEN_ID, did: DID, lvl: 2 })
})

afterAll(() => app.close())

beforeEach(() => {
  jest.resetAllMocks()
})

describe('P0 civic identity assurance — voting boundary', () => {
  it('fails closed when the citizen is in the voter roll but lacks trusted external assurance', async () => {
    ;(prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([{
      roll_exists: true,
      identity_assured: false,
      eligible: false,
    }])

    const response = await app.inject({
      method: 'POST',
      url: '/governance/proposals/550e8400-e29b-41d4-a716-446655440001/vote',
      headers: { authorization: `Bearer ${verifiedToken}` },
      payload: { vote_value: 1 },
    })

    expect(response.statusCode).toBe(403)
    expect(JSON.parse(response.payload)).toMatchObject({
      code: 'CIVIC_IDENTITY_REQUIRED',
    })
    expect(mockCastVote).not.toHaveBeenCalled()
  })
})
