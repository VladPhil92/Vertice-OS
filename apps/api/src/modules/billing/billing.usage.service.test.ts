jest.mock('../../lib/prisma', () => ({
  prisma: {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
  },
  prisma: { $queryRaw: jest.fn(), $executeRaw: jest.fn() },
}))

jest.mock('./billing.service', () => ({
  getEffectiveBillingAccess: jest.fn(),
}))

import { prisma } from '../../lib/prisma'
import { getEffectiveBillingAccess } from './billing.service'
import {
  getBillingUsageSnapshot,
  releaseUsage,
  reserveUsage,
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
const mockAccess = getEffectiveBillingAccess as jest.Mock

beforeEach(() => {
  jest.resetAllMocks()
  mockAccess.mockResolvedValue({
    plan: {
      code: 'pro',
      limits: {
        evidenceStorageMb: 5000,
        aiRequestsPerMonth: 500,
        scheduledPostsPerMonth: 100,
      },
    },
  })
})

describe('billing usage metering', () => {
  it('returns current monthly usage against the effective plan limits', async () => {
    mockQueryRaw.mockResolvedValue([
      { metric: 'ai_requests', quantity: 12n },
      { metric: 'scheduled_posts', quantity: 4n },
    ])

    const usage = await getBillingUsageSnapshot('550e8400-e29b-41d4-a716-446655440000')

    expect(usage.planCode).toBe('pro')
    expect(usage.metrics.ai_requests).toMatchObject({ used: 12, limit: 500, remaining: 488 })
    expect(usage.metrics.scheduled_posts).toMatchObject({ used: 4, limit: 100, remaining: 96 })
    expect(usage.metrics.evidence_storage_bytes.limit).toBe(5000 * 1024 * 1024)
    expect(usage.metrics.ai_requests.periodStart).toMatch(/^\d{4}-\d{2}-01$/)
  })

  it('atomically reserves capacity when the plan still has quota', async () => {
    mockQueryRaw.mockResolvedValue([{ quantity: 21n }])

    const result = await reserveUsage('550e8400-e29b-41d4-a716-446655440000', 'ai_requests')

    expect(result.used).toBe(21)
    expect(result.limit).toBe(500)
    expect(result.remaining).toBe(479)
  })

  it('fails closed when the monthly limit is exhausted', async () => {
    mockAccess.mockResolvedValue({
      plan: {
        code: 'free',
        limits: {
          evidenceStorageMb: 250,
          aiRequestsPerMonth: 20,
          scheduledPostsPerMonth: 0,
        },
      },
    })
    mockQueryRaw.mockResolvedValue([])

    await expect(reserveUsage(
      '550e8400-e29b-41d4-a716-446655440000',
      'ai_requests',
    )).rejects.toMatchObject({ code: 'PLAN_USAGE_LIMIT_REACHED', statusCode: 429, limit: 20 })
  })

  it('can release a reservation after a failed downstream operation', async () => {
    mockExecuteRaw.mockResolvedValue(1)

    await releaseUsage('550e8400-e29b-41d4-a716-446655440000', 'ai_requests')
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
