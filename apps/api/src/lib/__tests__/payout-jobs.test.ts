const mockQueryRaw = jest.fn()
const mockReconcileCampaignPayout = jest.fn()

jest.mock('../prisma', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    citizen: { update: jest.fn() },
    proposal: { update: jest.fn() },
  },
}))

jest.mock('../blockchain', () => ({
  mintCitizenBadge: jest.fn(),
  buildCitizenBadgeURI: jest.fn(),
  recordProposalVoting: jest.fn(),
  buildProposalContentHash: jest.fn(),
}))

jest.mock('../../modules/billing/finance-operations.service', () => ({
  reconcileFinanceLedger: jest.fn(),
}))

jest.mock('../../modules/billing/crowdfunding-payout.service', () => ({
  reconcileCampaignPayout: mockReconcileCampaignPayout,
}))

import type { Prisma } from '@prisma/client'
import { enqueueJob, runJob } from '../jobs'

function sqlOf(call: unknown[]): string {
  return (call[0] as Prisma.Sql).sql
}

beforeEach(() => {
  jest.resetAllMocks()
})

describe('durable crowdfunding payout reconciliation', () => {
  it('serializes payout and requesting admin identity into the durable job', async () => {
    mockQueryRaw.mockResolvedValueOnce(undefined)

    await enqueueJob('reconcile_crowdfunding_payout', {
      payoutRequestId: '550e8400-e29b-41d4-a716-446655440010',
      requestedByCitizenId: '550e8400-e29b-41d4-a716-446655440011',
    })

    const values = (mockQueryRaw.mock.calls[0][0] as Prisma.Sql).values
    expect(values[0]).toBe('reconcile_crowdfunding_payout')
    expect(JSON.parse(values[1] as string)).toEqual({
      payoutRequestId: '550e8400-e29b-41d4-a716-446655440010',
      requestedByCitizenId: '550e8400-e29b-41d4-a716-446655440011',
    })
  })

  it('marks the job succeeded after provider-backed reconciliation completes', async () => {
    mockReconcileCampaignPayout.mockResolvedValueOnce({
      id: '550e8400-e29b-41d4-a716-446655440010',
      status: 'pending_approval',
      amountCop: 50000,
    })
    mockQueryRaw.mockResolvedValueOnce(undefined)

    await runJob({
      id: 40,
      type: 'reconcile_crowdfunding_payout',
      payload: {
        payoutRequestId: '550e8400-e29b-41d4-a716-446655440010',
        requestedByCitizenId: '550e8400-e29b-41d4-a716-446655440011',
      },
      attempts: 1,
      max_attempts: 5,
    })

    expect(mockReconcileCampaignPayout).toHaveBeenCalledWith({
      payoutRequestId: '550e8400-e29b-41d4-a716-446655440010',
      actorId: '550e8400-e29b-41d4-a716-446655440011',
    })
    expect(sqlOf(mockQueryRaw.mock.calls[0])).toContain("status = 'succeeded'")
  })

  it('requeues reconciliation with backoff when provider state is unavailable', async () => {
    mockReconcileCampaignPayout.mockRejectedValueOnce(new Error('provider timeout'))
    mockQueryRaw.mockResolvedValueOnce(undefined)

    await runJob({
      id: 41,
      type: 'reconcile_crowdfunding_payout',
      payload: { payoutRequestId: '550e8400-e29b-41d4-a716-446655440010' },
      attempts: 1,
      max_attempts: 5,
    })

    const call = mockQueryRaw.mock.calls[0]
    expect(sqlOf(call)).toContain("status = 'pending'")
    expect(sqlOf(call)).toContain('run_after')
    expect((call[0] as Prisma.Sql).values).toContain('provider timeout')
  })
})
