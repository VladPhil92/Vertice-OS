import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { getEffectiveBillingAccess } from './billing.service'

const AI_USAGE_METRIC = 'ai_request' as const
const SCHEDULED_POST_METRIC = 'scheduled_post' as const
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

  const [aiRows, scheduledPostRows, projectRows] = await Promise.all([
    prisma.$queryRaw<UsageCounterRow[]>(Prisma.sql`
      SELECT used
      FROM billing_usage_counters
      WHERE citizen_id = ${citizenId}::uuid
        AND metric = ${AI_USAGE_METRIC}
        AND period_start = ${period.start}::date
      LIMIT 1
    `),
    prisma.$queryRaw<UsageCounterRow[]>(Prisma.sql`
      SELECT used
      FROM billing_usage_counters
      WHERE citizen_id = ${citizenId}::uuid
        AND metric = ${SCHEDULED_POST_METRIC}
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
  const scheduledPostsUsed = Number(scheduledPostRows[0]?.used ?? 0)
  const activeProjects = Number(projectRows[0]?.count ?? 0)

  return {
    planCode: access.plan.code,
    period: { ...period, timezone: BILLING_TIMEZONE },
    metrics: {
      aiRequestsPerMonth: metric(aiUsed, access.plan.limits.aiRequestsPerMonth, true, 'billing_usage_counters'),
      activeProjects: metric(activeProjects, access.plan.limits.activeProjects, false, 'civic_actions'),
      evidenceStorageMb: metric(null, access.plan.limits.evidenceStorageMb, false, 'capacity_only'),
      scheduledPostsPerMonth: metric(scheduledPostsUsed, access.plan.limits.scheduledPostsPerMonth, true, 'billing_usage_counters'),
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

export interface ScheduledPostReservation {
  citizenId: string
  periodStart: string
  used: number
  limit: number
}

export async function reserveScheduledPost(citizenId: string, now = new Date()): Promise<ScheduledPostReservation> {
  const access = await getEffectiveBillingAccess(citizenId)
  const limit = access.plan.limits.scheduledPostsPerMonth
  const periodStart = usagePeriodBogota(now).start

  const rows = await prisma.$queryRaw<UsageCounterRow[]>(Prisma.sql`
    INSERT INTO billing_usage_counters (citizen_id, metric, period_start, used, updated_at)
    VALUES (${citizenId}::uuid, ${SCHEDULED_POST_METRIC}, ${periodStart}::date, 1, NOW())
    ON CONFLICT (citizen_id, metric, period_start)
    DO UPDATE SET
      used = billing_usage_counters.used + 1,
      updated_at = NOW()
    WHERE billing_usage_counters.used < ${limit}
    RETURNING used
  `)

  const used = rows[0]?.used
  if (used === undefined) {
    throw Object.assign(new Error('Has alcanzado el límite mensual de publicaciones programadas de tu plan.'), {
      statusCode: 429,
      code: 'SCHEDULED_POST_QUOTA_EXCEEDED',
      details: { limit, periodStart, planCode: access.plan.code },
    })
  }

  return { citizenId, periodStart, used: Number(used), limit }
}

export async function releaseScheduledPost(reservation: ScheduledPostReservation): Promise<void> {
  await prisma.$executeRaw(Prisma.sql`
    UPDATE billing_usage_counters
    SET used = GREATEST(0, used - 1), updated_at = NOW()
    WHERE citizen_id = ${reservation.citizenId}::uuid
      AND metric = ${SCHEDULED_POST_METRIC}
      AND period_start = ${reservation.periodStart}::date
  `)
}
