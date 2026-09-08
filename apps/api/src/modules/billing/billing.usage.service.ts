import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { getEffectiveBillingAccess } from './billing.service'

export type UsageMetric = 'ai_requests' | 'evidence_storage_bytes' | 'scheduled_posts'

type CounterRow = { metric: UsageMetric; quantity: bigint }

export interface UsageMetricSnapshot {
  metric: UsageMetric
  used: number
  limit: number
  remaining: number
  percent: number
  periodStart: string
}

export interface BillingUsageSnapshot {
  planCode: 'free' | 'pro'
  metrics: Record<UsageMetric, UsageMetricSnapshot>
  generatedAt: string
}

function metricLimit(metric: UsageMetric, limits: {
  evidenceStorageMb: number
  aiRequestsPerMonth: number
  scheduledPostsPerMonth: number
}): number {
  if (metric === 'ai_requests') return limits.aiRequestsPerMonth
  if (metric === 'scheduled_posts') return limits.scheduledPostsPerMonth
  return limits.evidenceStorageMb * 1024 * 1024
}

function periodStartIso(): string {
  const now = new Date()
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)))
}

export async function getBillingUsageSnapshot(citizenId: string): Promise<BillingUsageSnapshot> {
  const access = await getEffectiveBillingAccess(citizenId)
  const rows = await prisma.$queryRaw<CounterRow[]>(Prisma.sql`
    SELECT metric::text, quantity
    FROM billing_usage_counters
    WHERE citizen_id = ${citizenId}::uuid
      AND period_start = DATE_TRUNC('month', NOW() AT TIME ZONE 'America/Bogota')::date
  `)
  const quantities = new Map(rows.map((row) => [row.metric, Number(row.quantity)]))
  const periodStart = periodStartIso()
  const metrics = {} as Record<UsageMetric, UsageMetricSnapshot>

  for (const metric of ['ai_requests', 'evidence_storage_bytes', 'scheduled_posts'] as const) {
    const used = quantities.get(metric) ?? 0
    const limit = metricLimit(metric, access.plan.limits)
    metrics[metric] = {
      metric,
      used,
      limit,
      remaining: Math.max(0, limit - used),
      percent: limit === 0 ? (used > 0 ? 100 : 0) : Math.min(100, Math.round((used / limit) * 100)),
      periodStart,
    }
  }

  return { planCode: access.plan.code, metrics, generatedAt: new Date().toISOString() }
}

export async function reserveUsage(citizenId: string, metric: UsageMetric, amount = 1): Promise<UsageMetricSnapshot> {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('INVALID_USAGE_AMOUNT')
  const access = await getEffectiveBillingAccess(citizenId)
  const limit = metricLimit(metric, access.plan.limits)
  const rows = await prisma.$queryRaw<Array<{ quantity: bigint }>>(Prisma.sql`
    INSERT INTO billing_usage_counters (citizen_id, metric, period_start, quantity)
    VALUES (
      ${citizenId}::uuid,
      ${metric},
      DATE_TRUNC('month', NOW() AT TIME ZONE 'America/Bogota')::date,
      ${amount}
    )
    ON CONFLICT (citizen_id, metric, period_start)
    DO UPDATE SET
      quantity = billing_usage_counters.quantity + EXCLUDED.quantity,
      updated_at = NOW()
    WHERE billing_usage_counters.quantity + EXCLUDED.quantity <= ${limit}
    RETURNING quantity
  `)

  const used = rows[0] ? Number(rows[0].quantity) : 0
  if (!rows[0]) {
    throw Object.assign(new Error('Has alcanzado el límite mensual de tu plan.'), {
      statusCode: 429,
      code: 'PLAN_USAGE_LIMIT_REACHED',
      metric,
      limit,
      upgradePath: '/pricing',
    })
  }

  return {
    metric,
    used,
    limit,
    remaining: Math.max(0, limit - used),
    percent: limit === 0 ? 100 : Math.min(100, Math.round((used / limit) * 100)),
    periodStart: periodStartIso(),
  }
}

export async function releaseUsage(citizenId: string, metric: UsageMetric, amount = 1): Promise<void> {
  if (!Number.isSafeInteger(amount) || amount <= 0) return
  await prisma.$executeRaw(Prisma.sql`
    UPDATE billing_usage_counters
    SET quantity = GREATEST(0, quantity - ${amount}), updated_at = NOW()
    WHERE citizen_id = ${citizenId}::uuid
      AND metric = ${metric}
      AND period_start = DATE_TRUNC('month', NOW() AT TIME ZONE 'America/Bogota')::date
  `)
}
