jest.mock('../../lib/prisma', () => ({
  prisma: {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
  },
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

    expect(mockExecuteRaw).toHaveBeenCalledTimes(1)
  })
})
