import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import {
  BILLING_PLANS,
  REPUTATION_NEUTRALITY_POLICY,
  getPlan,
  type BillingCycle,
  type PlanCode,
} from './billing.catalog'

type SubscriptionRow = {
  id: string
  plan_code: PlanCode
  status: string
  billing_cycle: BillingCycle | null
  provider: string | null
  current_period_start: Date | null
  current_period_end: Date | null
  cancel_at_period_end: boolean
}

export interface EffectiveBillingAccess {
  plan: ReturnType<typeof getPlan>
  subscription: null | {
    id: string
    status: string
    billingCycle: BillingCycle | null
    provider: string | null
    currentPeriodStart: string | null
    currentPeriodEnd: string | null
    cancelAtPeriodEnd: boolean
  }
  reputationNeutrality: typeof REPUTATION_NEUTRALITY_POLICY
}

export function getBillingCatalog() {
  return {
    currency: 'COP' as const,
    plans: Object.values(BILLING_PLANS),
    reputationNeutrality: REPUTATION_NEUTRALITY_POLICY,
  }
}

export async function getEffectiveBillingAccess(citizenId: string): Promise<EffectiveBillingAccess> {
  const rows = await prisma.$queryRaw<SubscriptionRow[]>(Prisma.sql`
    SELECT
      id,
      plan_code,
      status,
      billing_cycle,
      provider,
      current_period_start,
      current_period_end,
      cancel_at_period_end
    FROM subscriptions
    WHERE citizen_id = ${citizenId}::uuid
      AND status IN ('active', 'trialing')
      AND (current_period_end IS NULL OR current_period_end > NOW())
    ORDER BY
      CASE WHEN plan_code = 'pro' THEN 0 ELSE 1 END,
      created_at DESC
    LIMIT 1
  `)

  const subscription = rows[0]
  const planCode: PlanCode = subscription?.plan_code === 'pro' ? 'pro' : 'free'

  return {
    plan: getPlan(planCode),
    subscription: subscription
      ? {
          id: subscription.id,
          status: subscription.status,
          billingCycle: subscription.billing_cycle,
          provider: subscription.provider,
          currentPeriodStart: subscription.current_period_start?.toISOString() ?? null,
          currentPeriodEnd: subscription.current_period_end?.toISOString() ?? null,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        }
      : null,
    reputationNeutrality: REPUTATION_NEUTRALITY_POLICY,
  }
}
