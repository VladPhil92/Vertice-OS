jest.mock('../../lib/prisma', () => ({
  prisma: {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
    $transaction: jest.fn(),
  },
}))

jest.mock('../../lib/audit', () => ({ recordAuditEvent: jest.fn() }))

import { classifyCrowdfundingOrderStatus, financeCsvEscape } from './finance-operations.service'

describe('classifyCrowdfundingOrderStatus', () => {
  it('requires enough verified money before marking an order paid', () => {
    expect(classifyCrowdfundingOrderStatus('processed', 49_999, 50_000)).toBe('pending')
    expect(classifyCrowdfundingOrderStatus('processed', 50_000, 50_000)).toBe('paid')
    expect(classifyCrowdfundingOrderStatus('approved', 60_000, 50_000)).toBe('paid')
  })

  it('preserves financial reversal states explicitly', () => {
    expect(classifyCrowdfundingOrderStatus('refunded', 0, 50_000)).toBe('refunded')
    expect(classifyCrowdfundingOrderStatus('charged_back', 50_000, 50_000)).toBe('chargeback')
    expect(classifyCrowdfundingOrderStatus('cancelled', 0, 50_000)).toBe('cancelled')
    expect(classifyCrowdfundingOrderStatus('rejected', 0, 50_000)).toBe('failed')
  })

  it('fails closed for unknown or incomplete provider states', () => {
    expect(classifyCrowdfundingOrderStatus('mystery', 50_000, 50_000)).toBe('pending')
    expect(classifyCrowdfundingOrderStatus('processed', null, 50_000)).toBe('pending')
  })
})

describe('financeCsvEscape', () => {
  it('leaves simple accounting fields untouched', () => {
    expect(financeCsvEscape('paid')).toBe('paid')
    expect(financeCsvEscape(15000)).toBe('15000')
  })

  it('quotes commas, newlines and embedded quotes safely', () => {
    expect(financeCsvEscape('a,b')).toBe('"a,b"')
    expect(financeCsvEscape('a\nb')).toBe('"a\nb"')
    expect(financeCsvEscape('a"b')).toBe('"a""b"')
  })

  it('does not stringify missing values', () => {
    expect(financeCsvEscape(null)).toBe('')
    expect(financeCsvEscape(undefined)).toBe('')
  })
})
