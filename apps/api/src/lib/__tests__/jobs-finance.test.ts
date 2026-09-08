const mockQueryRaw = jest.fn()
const mockReconcileFinanceLedger = jest.fn()

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
  reconcileFinanceLedger: mockReconcileFinanceLedger,
}))

import type { Prisma } from '@prisma/client'
import { enqueueJob, runJob } from '../jobs'

function sqlOf(call: unknown[]): string {
  return (call[0] as Prisma.Sql).sql
}

beforeEach(() => jest.resetAllMocks())

describe('reconcile_payment_ledger durable job', () => {
  it('serializes the requesting admin into the durable payload', async () => {
    mockQueryRaw.mockResolvedValueOnce(undefined)

    await enqueueJob('reconcile_payment_ledger', { requestedByCitizenId: 'admin-1' })

    const values = (mockQueryRaw.mock.calls[0][0] as Prisma.Sql).values
    expect(values[0]).toBe('reconcile_payment_ledger')
    expect(JSON.parse(values[1] as string)).toEqual({ requestedByCitizenId: 'admin-1' })
  })

  it('marks the job succeeded after a non-failed reconciliation run', async () => {
    mockReconcileFinanceLedger.mockResolvedValueOnce({
      id: 'run-1', status: 'partial', scanned: 10, changed: 2, failed: 1,
    })
    mockQueryRaw.mockResolvedValueOnce(undefined)

    await runJob({
      id: 20,
      type: 'reconcile_payment_ledger',
      payload: { requestedByCitizenId: 'admin-1' },
      attempts: 1,
      max_attempts: 5,
    })

    expect(mockReconcileFinanceLedger).toHaveBeenCalledWith({
      actorId: 'admin-1', triggerKind: 'job', limit: 100,
    })
    expect(sqlOf(mockQueryRaw.mock.calls[0])).toContain("status = 'succeeded'")
  })

  it('retries when an entire reconciliation run fails', async () => {
    mockReconcileFinanceLedger.mockResolvedValueOnce({
      id: 'run-2', status: 'failed', scanned: 10, changed: 0, failed: 10,
    })
    mockQueryRaw.mockResolvedValueOnce(undefined)

    await runJob({
      id: 21,
      type: 'reconcile_payment_ledger',
      payload: { requestedByCitizenId: 'admin-1' },
      attempts: 1,
      max_attempts: 5,
    })

    const sql = sqlOf(mockQueryRaw.mock.calls[0])
    expect(sql).toContain("status = 'pending'")
    expect(sql).toContain('run_after')
  })
})
