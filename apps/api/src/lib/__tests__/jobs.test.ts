const mockQueryRaw = jest.fn()
const mockCitizenUpdate = jest.fn()
const mockProposalUpdate = jest.fn()

jest.mock('../prisma', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    citizen: { update: mockCitizenUpdate },
    proposal: { update: mockProposalUpdate },
  },
}))

const mockMintCitizenBadge = jest.fn()
const mockBuildCitizenBadgeURI = jest.fn(() => 'https://ipfs.example/badge')
const mockRecordProposalVoting = jest.fn()
const mockBuildProposalContentHash = jest.fn(() => '0xhash')

jest.mock('../blockchain', () => ({
  mintCitizenBadge: mockMintCitizenBadge,
  buildCitizenBadgeURI: mockBuildCitizenBadgeURI,
  recordProposalVoting: mockRecordProposalVoting,
  buildProposalContentHash: mockBuildProposalContentHash,
}))

import type { Prisma } from '@prisma/client'
import { enqueueJob, claimNextJob, runJob } from '../jobs'

// Extrae el SQL renderizado (con placeholders ?) del último argumento pasado
// a mockQueryRaw, para poder afirmar QUÉ transición de estado se ejecutó sin
// depender de una base de datos real.
function sqlOf(call: unknown[]): string {
  const arg = call[0] as Prisma.Sql
  return arg.sql
}

beforeEach(() => {
  jest.resetAllMocks()
})

// ── enqueueJob ────────────────────────────────────────────────────────────────

describe('enqueueJob', () => {
  it('inserta un job pendiente con el payload serializado', async () => {
    mockQueryRaw.mockResolvedValueOnce(undefined)

    await enqueueJob('mint_identity_badge', {
      citizenId: 'c1', did: 'did:vertice:c1', walletAddress: '0xabc',
    })

    expect(mockQueryRaw).toHaveBeenCalledTimes(1)
    const sql = sqlOf(mockQueryRaw.mock.calls[0])
    expect(sql).toContain('INSERT INTO jobs')
    const values = (mockQueryRaw.mock.calls[0][0] as Prisma.Sql).values
    expect(values[0]).toBe('mint_identity_badge')
    expect(JSON.parse(values[1] as string)).toMatchObject({ citizenId: 'c1' })
  })

  it('usa el cliente de transacción cuando se pasa uno, en vez de prisma global', async () => {
    const txQueryRaw = jest.fn().mockResolvedValueOnce(undefined)

    await enqueueJob('record_voting_result', {
      proposalId: 'p1', title: 't', description: 'd', totalVotes: 1,
      approveWeighted: 1, rejectWeighted: 0, abstainWeighted: 0,
      result: 'approved', ipfsResultUri: null,
    }, { $queryRaw: txQueryRaw })

    expect(txQueryRaw).toHaveBeenCalledTimes(1)
    expect(mockQueryRaw).not.toHaveBeenCalled()
  })
})

// ── claimNextJob ──────────────────────────────────────────────────────────────

describe('claimNextJob', () => {
  it('reclama el job pendiente más antiguo con FOR UPDATE SKIP LOCKED', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      { id: 1, type: 'mint_identity_badge', payload: { citizenId: 'c1' }, attempts: 1, max_attempts: 5 },
    ])

    const job = await claimNextJob()

    expect(job).toMatchObject({ id: 1, type: 'mint_identity_badge' })
    const sql = sqlOf(mockQueryRaw.mock.calls[0])
    expect(sql).toContain('FOR UPDATE SKIP LOCKED')
    expect(sql).toContain("status = 'processing'")
  })

  it('devuelve null cuando no hay jobs pendientes', async () => {
    mockQueryRaw.mockResolvedValueOnce([])
    const job = await claimNextJob()
    expect(job).toBeNull()
  })
})

// ── runJob ────────────────────────────────────────────────────────────────────

describe('runJob — mint_identity_badge', () => {
  it('marca el job succeeded y persiste el tokenId cuando el mint tiene éxito', async () => {
    mockMintCitizenBadge.mockResolvedValueOnce('42')
    mockCitizenUpdate.mockResolvedValueOnce({})
    mockQueryRaw.mockResolvedValueOnce(undefined) // completeJob

    await runJob({
      id: 1, type: 'mint_identity_badge',
      payload: { citizenId: 'c1', did: 'did:vertice:c1', walletAddress: '0xabc' },
      attempts: 1, max_attempts: 5,
    })

    expect(mockCitizenUpdate).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { sbtTokenId: '42' } })
    expect(sqlOf(mockQueryRaw.mock.calls[0])).toContain("status = 'succeeded'")
  })

  it('no toca la DB de ciudadanos cuando el mint es un no-op (badge ya existía)', async () => {
    mockMintCitizenBadge.mockResolvedValueOnce(null)
    mockQueryRaw.mockResolvedValueOnce(undefined) // completeJob

    await runJob({
      id: 2, type: 'mint_identity_badge',
      payload: { citizenId: 'c1', did: 'did:vertice:c1', walletAddress: '0xabc' },
      attempts: 1, max_attempts: 5,
    })

    expect(mockCitizenUpdate).not.toHaveBeenCalled()
    expect(sqlOf(mockQueryRaw.mock.calls[0])).toContain("status = 'succeeded'")
  })

  it('reintenta con backoff cuando el mint lanza un error real (no lo pierde en silencio)', async () => {
    mockMintCitizenBadge.mockRejectedValueOnce(new Error('RPC timeout'))
    mockQueryRaw.mockResolvedValueOnce(undefined) // failJob

    await runJob({
      id: 3, type: 'mint_identity_badge',
      payload: { citizenId: 'c1', did: 'did:vertice:c1', walletAddress: '0xabc' },
      attempts: 1, max_attempts: 5,
    })

    const call = mockQueryRaw.mock.calls[0]
    const sql = sqlOf(call)
    expect(sql).toContain("status = 'pending'")
    expect(sql).toContain('run_after')
    const values = (call[0] as Prisma.Sql).values
    expect(values).toContain('RPC timeout')
  })

  it('marca failed en vez de reintentar cuando se agotan los intentos', async () => {
    mockMintCitizenBadge.mockRejectedValueOnce(new Error('RPC timeout'))
    mockQueryRaw.mockResolvedValueOnce(undefined) // failJob

    await runJob({
      id: 4, type: 'mint_identity_badge',
      payload: { citizenId: 'c1', did: 'did:vertice:c1', walletAddress: '0xabc' },
      attempts: 5, max_attempts: 5,
    })

    const sql = sqlOf(mockQueryRaw.mock.calls[0])
    expect(sql).toContain("status = 'failed'")
  })
})

describe('runJob — record_voting_result', () => {
  it('persiste el tx hash cuando el registro on-chain tiene éxito', async () => {
    mockRecordProposalVoting.mockResolvedValueOnce('0xtxhash')
    mockProposalUpdate.mockResolvedValueOnce({})
    mockQueryRaw.mockResolvedValueOnce(undefined) // completeJob

    await runJob({
      id: 5, type: 'record_voting_result',
      payload: {
        proposalId: 'p1', title: 't', description: 'd', totalVotes: 10,
        approveWeighted: 8, rejectWeighted: 2, abstainWeighted: 0,
        result: 'approved', ipfsResultUri: null,
      },
      attempts: 1, max_attempts: 5,
    })

    expect(mockProposalUpdate).toHaveBeenCalledWith({
      where: { id: 'p1' }, data: { blockchainTxHash: '0xtxhash' },
    })
    expect(sqlOf(mockQueryRaw.mock.calls[0])).toContain("status = 'succeeded'")
  })

  it('reintenta cuando el registro on-chain lanza un error real', async () => {
    mockRecordProposalVoting.mockRejectedValueOnce(new Error('contract reverted'))
    mockQueryRaw.mockResolvedValueOnce(undefined) // failJob

    await runJob({
      id: 6, type: 'record_voting_result',
      payload: {
        proposalId: 'p1', title: 't', description: 'd', totalVotes: 10,
        approveWeighted: 8, rejectWeighted: 2, abstainWeighted: 0,
        result: 'approved', ipfsResultUri: null,
      },
      attempts: 1, max_attempts: 5,
    })

    expect(mockProposalUpdate).not.toHaveBeenCalled()
    expect(sqlOf(mockQueryRaw.mock.calls[0])).toContain("status = 'pending'")
  })
})
