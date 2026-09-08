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
const AI_USAGE_METRIC = 'ai_request' as const
const BILLING_TIMEZONE = 'America/Bogota' as const

type UsageCounterRow = { used: number }
type CountRow = { count: bigint }

export interface BillingUsageMetric {
  used: number | null
  limit: number
  remaining: number | null
  percent: number | null
  enforced: boolean
  source: string
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
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-01`
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
  period: {
    start: string
    endExclusive: string
    timezone: typeof BILLING_TIMEZONE
  }
  metrics: {
    aiRequestsPerMonth: BillingUsageMetric
    activeProjects: BillingUsageMetric
    evidenceStorageMb: BillingUsageMetric
    scheduledPostsPerMonth: BillingUsageMetric
  }
  neutrality: {
    usageChangesReputation: false
    subscriptionChangesReputation: false
  }
}

function monthPartsBogota(now = new Date()): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BILLING_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return { year: Number(values.year), month: Number(values.month) }
}

export function usagePeriodBogota(now = new Date()): { start: string; endExclusive: string } {
  const { year, month } = monthPartsBogota(now)
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const nextYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  const endExclusive = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
  return { start, endExclusive }
}

function metric(used: number | null, limit: number, enforced: boolean, source: string): BillingUsageMetric {
  if (used === null) return { used, limit, remaining: null, percent: null, enforced, source }
  const remaining = Math.max(0, limit - used)
  const percent = limit <= 0 ? (used > 0 ? 100 : 0) : Math.min(100, Math.round((used / limit) * 100))
  return { used, limit, remaining, percent, enforced, source }
}

export async function getBillingUsage(citizenId: string, now = new Date()): Promise<BillingUsageSnapshot> {
  const access = await getEffectiveBillingAccess(citizenId)
  const period = usagePeriodBogota(now)

  const [aiRows, projectRows] = await Promise.all([
    prisma.$queryRaw<UsageCounterRow[]>(Prisma.sql`
      SELECT used
      FROM billing_usage_counters
      WHERE citizen_id = ${citizenId}::uuid
        AND metric = ${AI_USAGE_METRIC}
        AND period_start = ${period.start}::date
      LIMIT 1
    `),
    prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT COUNT(*) AS count
      FROM civic_actions
      WHERE actor_id = ${citizenId}::uuid
        AND status NOT IN ('verified', 'not_completed', 'cancelled')
    `),
  ])

  const aiUsed = Number(aiRows[0]?.used ?? 0)
  const activeProjects = Number(projectRows[0]?.count ?? 0)

  return {
    planCode: access.plan.code,
    period: { ...period, timezone: BILLING_TIMEZONE },
    metrics: {
      aiRequestsPerMonth: metric(aiUsed, access.plan.limits.aiRequestsPerMonth, true, 'billing_usage_counters'),
      activeProjects: metric(activeProjects, access.plan.limits.activeProjects, false, 'civic_actions'),
      evidenceStorageMb: metric(null, access.plan.limits.evidenceStorageMb, false, 'capacity_only'),
      scheduledPostsPerMonth: metric(null, access.plan.limits.scheduledPostsPerMonth, false, 'capacity_only'),
    },
    neutrality: {
      usageChangesReputation: false,
      subscriptionChangesReputation: false,
    },
  }
}

export interface AiUsageReservation {
  citizenId: string
  periodStart: string
  used: number
  limit: number
}

export async function reserveAiRequest(citizenId: string, now = new Date()): Promise<AiUsageReservation> {
  const access = await getEffectiveBillingAccess(citizenId)
  const limit = access.plan.limits.aiRequestsPerMonth
  const periodStart = usagePeriodBogota(now).start

  const rows = await prisma.$queryRaw<UsageCounterRow[]>(Prisma.sql`
    INSERT INTO billing_usage_counters (citizen_id, metric, period_start, used, updated_at)
    VALUES (${citizenId}::uuid, ${AI_USAGE_METRIC}, ${periodStart}::date, 1, NOW())
    ON CONFLICT (citizen_id, metric, period_start)
    DO UPDATE SET
      used = billing_usage_counters.used + 1,
      updated_at = NOW()
    WHERE billing_usage_counters.used < ${limit}
    RETURNING used
  `)

  const used = rows[0]?.used
  if (used === undefined) {
    throw Object.assign(new Error('Has alcanzado el límite mensual de solicitudes de IA de tu plan.'), {
      statusCode: 429,
      code: 'AI_MONTHLY_QUOTA_EXCEEDED',
      details: { limit, periodStart, planCode: access.plan.code },
    })
  }

  return { citizenId, periodStart, used: Number(used), limit }
}

export async function releaseAiRequest(reservation: AiUsageReservation): Promise<void> {
  await prisma.$executeRaw(Prisma.sql`
    UPDATE billing_usage_counters
    SET used = GREATEST(0, used - 1), updated_at = NOW()
    WHERE citizen_id = ${reservation.citizenId}::uuid
      AND metric = ${AI_USAGE_METRIC}
      AND period_start = ${reservation.periodStart}::date
  `)
}

export async function runWithAiUsageQuota<T>(
  citizenId: string,
  operation: () => Promise<T>,
): Promise<T> {
  const reservation = await reserveAiRequest(citizenId)
  try {
    return await operation()
  } catch (error) {
    await releaseAiRequest(reservation).catch(() => undefined)
    throw error
  }
}
