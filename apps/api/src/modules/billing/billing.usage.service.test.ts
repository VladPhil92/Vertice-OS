jest.mock('../../lib/prisma', () => ({
  prisma: { $queryRaw: jest.fn(), $executeRaw: jest.fn() },
}))

jest.mock('./billing.service', () => ({
  getEffectiveBillingAccess: jest.fn(),
}))

import { prisma } from '../../lib/prisma'
import { BILLING_PLANS, REPUTATION_NEUTRALITY_POLICY } from './billing.catalog'
import { getEffectiveBillingAccess } from './billing.service'
import {
  getBillingUsage,
  reserveAiRequest,
  runWithAiUsageQuota,
  usagePeriodBogota,
} from './billing.usage.service'

const mockQueryRaw = prisma.$queryRaw as jest.Mock
const mockExecuteRaw = prisma.$executeRaw as jest.Mock
const mockGetAccess = getEffectiveBillingAccess as jest.Mock

function access(plan: 'free' | 'pro') {
  return {
    plan: BILLING_PLANS[plan],
    subscription: null,
    reputationNeutrality: REPUTATION_NEUTRALITY_POLICY,
  }
}

beforeEach(() => {
  jest.resetAllMocks()
  mockExecuteRaw.mockResolvedValue(1)
})

describe('billing usage metering', () => {
  it('uses calendar-month boundaries in America/Bogota', () => {
    expect(usagePeriodBogota(new Date('2026-12-15T12:00:00.000Z'))).toEqual({
      start: '2026-12-01',
      endExclusive: '2027-01-01',
    })
  })

  it('returns measured AI and active-project usage without inventing storage usage', async () => {
    mockGetAccess.mockResolvedValue(access('free'))
    mockQueryRaw
      .mockResolvedValueOnce([{ used: 12 }])
      .mockResolvedValueOnce([{ count: 2n }])

    const result = await getBillingUsage('550e8400-e29b-41d4-a716-446655440000', new Date('2026-09-08T17:00:00.000Z'))

    expect(result.planCode).toBe('free')
    expect(result.metrics.aiRequestsPerMonth).toMatchObject({ used: 12, limit: 20, remaining: 8, enforced: true })
    expect(result.metrics.activeProjects).toMatchObject({ used: 2, limit: 3, remaining: 1 })
    expect(result.metrics.evidenceStorageMb.used).toBeNull()
    expect(result.neutrality.usageChangesReputation).toBe(false)
  })

  it('fails closed when the monthly AI quota is exhausted', async () => {
    mockGetAccess.mockResolvedValue(access('free'))
    mockQueryRaw.mockResolvedValueOnce([])

    await expect(reserveAiRequest('550e8400-e29b-41d4-a716-446655440000')).rejects.toMatchObject({
      statusCode: 429,
      code: 'AI_MONTHLY_QUOTA_EXCEEDED',
    })
  })

  it('releases a reserved unit when the downstream AI operation fails', async () => {
    mockGetAccess.mockResolvedValue(access('pro'))
    mockQueryRaw.mockResolvedValueOnce([{ used: 7 }])

    await expect(runWithAiUsageQuota(
      '550e8400-e29b-41d4-a716-446655440000',
      async () => { throw new Error('downstream unavailable') },
    )).rejects.toThrow('downstream unavailable')

    expect(mockExecuteRaw).toHaveBeenCalledTimes(1)
  })
})
