jest.mock('../../lib/prisma', () => ({
  prisma: { $queryRaw: jest.fn() },
}))

import { prisma } from '../../lib/prisma'
import { getBillingCatalog, getEffectiveBillingAccess } from './billing.service'

const mockQueryRaw = prisma.$queryRaw as jest.Mock

beforeEach(() => {
  jest.resetAllMocks()
})

describe('getBillingCatalog', () => {
  it('returns the plan catalog with the reputation neutrality policy', () => {
    const catalog = getBillingCatalog()

    expect(catalog.currency).toBe('COP')
    expect(catalog.plans.map((plan) => plan.code)).toEqual(['free', 'pro'])
    expect(catalog.reputationNeutrality.paymentsChangeScore).toBe(false)
  })
})

describe('getEffectiveBillingAccess', () => {
  it('defaults to the free plan when there is no active subscription', async () => {
    mockQueryRaw.mockResolvedValue([])

    const access = await getEffectiveBillingAccess('citizen-1')

    expect(access.plan.code).toBe('free')
    expect(access.subscription).toBeNull()
  })

  it('reports the active Pro subscription and its billing period', async () => {
    const periodEnd = new Date('2026-10-01T00:00:00.000Z')
    mockQueryRaw.mockResolvedValue([
      {
        id: 'sub-1',
        plan_code: 'pro',
        status: 'active',
        billing_cycle: 'monthly',
        provider: 'mercadopago',
        current_period_start: new Date('2026-09-01T00:00:00.000Z'),
        current_period_end: periodEnd,
        cancel_at_period_end: false,
      },
    ])

    const access = await getEffectiveBillingAccess('citizen-1')

    expect(access.plan.code).toBe('pro')
    expect(access.subscription).toEqual({
      id: 'sub-1',
      status: 'active',
      billingCycle: 'monthly',
      provider: 'mercadopago',
      currentPeriodStart: '2026-09-01T00:00:00.000Z',
      currentPeriodEnd: periodEnd.toISOString(),
      cancelAtPeriodEnd: false,
    })
  })

  it('treats a subscription with no recorded period end as still open', async () => {
    mockQueryRaw.mockResolvedValue([
      {
        id: 'sub-2',
        plan_code: 'pro',
        status: 'trialing',
        billing_cycle: null,
        provider: 'mercadopago',
        current_period_start: null,
        current_period_end: null,
        cancel_at_period_end: false,
      },
    ])

    const access = await getEffectiveBillingAccess('citizen-1')

    expect(access.subscription?.currentPeriodStart).toBeNull()
    expect(access.subscription?.currentPeriodEnd).toBeNull()
  })
})
