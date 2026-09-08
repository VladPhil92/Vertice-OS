jest.mock('../../../lib/prisma', () => ({
  prisma: {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
    $transaction: jest.fn(),
  },
}))

jest.mock('../../../lib/audit', () => ({ recordAuditEvent: jest.fn() }))

import { classifyWompiPayoutState } from '../crowdfunding-payout.service'

describe('classifyWompiPayoutState', () => {
  it('does not treat a prepared batch as money delivered', () => {
    expect(classifyWompiPayoutState('PENDING_APPROVAL', [
      { id: 'tx1', status: 'PENDING' },
    ])).toBe('pending_approval')
  })

  it('marks a payout paid only from an approved transaction', () => {
    expect(classifyWompiPayoutState('TOTAL_PAYMENT', [
      { id: 'tx1', status: 'APPROVED' },
    ])).toBe('paid')
  })

  it('requires reconciliation when the batch claims payment without a conclusive transaction', () => {
    expect(classifyWompiPayoutState('TOTAL_PAYMENT', [
      { id: 'tx1', status: 'PENDING' },
    ])).toBe('reconciliation_required')
  })

  it('maps failed, rejected and cancelled provider outcomes conservatively', () => {
    expect(classifyWompiPayoutState('PENDING', [{ id: 'tx1', status: 'FAILED' }])).toBe('failed')
    expect(classifyWompiPayoutState('REJECTED', [])).toBe('failed')
    expect(classifyWompiPayoutState('NOT_APPROVED', [])).toBe('not_approved')
    expect(classifyWompiPayoutState('CANCELLED', [])).toBe('cancelled')
  })
})
