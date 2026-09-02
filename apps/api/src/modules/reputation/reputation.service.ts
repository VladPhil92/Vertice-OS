import { Prisma } from '@prisma/client'
import { runCypher } from '../../lib/neo4j'
import { prisma } from '../../lib/prisma'
import { logger } from '../../lib/logger'
import { getCache, setCache, delCache, TTL } from '../../lib/cache'
import type {
  ReputationAnalytics,
  ReputationProfile,
  ReputationEventRecord,
  LeaderboardEntry,
  CitizenGraph,
  ReputationEvent,
} from './reputation.types'
import { EVENT_POINTS, scoreToLevel } from './reputation.types'
import type { RecordEventInput, LeaderboardInput } from './reputation.schema'

// ── Cache helpers ─────────────────────────────────────────────────────────────

const NS = {
  profile: 'reputation:profile',
  analytics: 'reputation:analytics',
  leaderboard: 'reputation:leaderboard',
} as const

const PROFILE_TTL = TTL.PROFILE
const ANALYTICS_TTL = TTL.STATS
const LEADERBOARD_TTL = TTL.STATS

// ── Date helpers ──────────────────────────────────────────────────────────────

function bogotaDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function normalizeDateKey(value: Date | string): string {
  if (typeof value === 'string') return value.slice(0, 10)
  return value.toISOString().slice(0, 10)
}

function utcDayNumber(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number)
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000)
}

function computeCurrentStreak(activeDates: string[]): number {
  if (activeDates.length === 0) return 0

  const today = bogotaDateKey(new Date())
  const latest = activeDates[0]
  const latestGap = utcDayNumber(today) - utcDayNumber(latest)
  if (latestGap > 1 || latestGap < 0) return 0

  let streak = 1
  for (let index = 1; index < activeDates.length; index += 1) {
    const previous = activeDates[index - 1]
    const current = activeDates[index]
    if (utcDayNumber(previous) - utcDayNumber(current) !== 1) break
    streak += 1
  }
  return streak
}

// ── Neo4j graph helpers ───────────────────────────────────────────────────────

async function ensureCitizenNode(citizenId: string): Promise<void> {
  await runCypher(
    `MERGE (c:Citizen {citizen_id: $citizenId})
     ON CREATE SET c.created_at = datetime()`,
    { citizenId },
  )
}

async function recordGraphRelation(
  citizenId: string,
  eventType: ReputationEvent,
  referenceId: string | null,
): Promise<void> {
  switch (eventType) {
    case 'vote_cast':
      if (!referenceId) return
      await runCypher(
        `MERGE (c:Citizen {citizen_id: $citizenId})
         MERGE (p:Proposal {proposal_id: $referenceId})
         MERGE (c)-[r:VOTED]->(p)
         ON CREATE SET r.voted_at = datetime()`,
        { citizenId, referenceId },
      )
      break

    case 'proposal_created':
      if (!referenceId) return
      await runCypher(
        `MERGE (c:Citizen {citizen_id: $citizenId})
         MERGE (p:Proposal {proposal_id: $referenceId})
         MERGE (c)-[r:CREATED_PROPOSAL]->(p)
         ON CREATE SET r.created_at = datetime()`,
        { citizenId, referenceId },
      )
      break

    case 'report_submitted':
      if (!referenceId) return
      await runCypher(
        `MERGE (c:Citizen {citizen_id: $citizenId})
         MERGE (rep:TerritorialReport {report_id: $referenceId})
         MERGE (c)-[r:SUBMITTED_REPORT]->(rep)
         ON CREATE SET r.submitted_at = datetime()`,
        { citizenId, referenceId },
      )
      break

    case 'endorsement_given':
      if (!referenceId) return
      await runCypher(
        `MERGE (c:Citizen {citizen_id: $citizenId})
         MERGE (p:Proposal {proposal_id: $referenceId})
         MERGE (c)-[r:ENDORSED]->(p)
         ON CREATE SET r.endorsed_at = datetime()`,
        { citizenId, referenceId },
      )
      break

    default:
      break
  }
}

// ── Score computation ─────────────────────────────────────────────────────────

async function computeScoreFromDB(citizenId: string): Promise<number> {
  const rows = await prisma.$queryRaw<{ total: bigint }[]>(
    Prisma.sql`
      SELECT COALESCE(SUM(points), 0) AS total
      FROM reputation_events
      WHERE citizen_id = ${citizenId}::uuid
    `,
  )
  return Math.max(0, Number(rows[0]?.total ?? 0))
}

async function countEventsByType(
  citizenId: string,
): Promise<Partial<Record<ReputationEvent, number>>> {
  const rows = await prisma.$queryRaw<{ event_type: string; cnt: bigint }[]>(
    Prisma.sql`
      SELECT event_type, COUNT(*) AS cnt
      FROM reputation_events
      WHERE citizen_id = ${citizenId}::uuid
      GROUP BY event_type
    `,
  )
  const result: Partial<Record<ReputationEvent, number>> = {}
  for (const row of rows) {
    result[row.event_type as ReputationEvent] = Number(row.cnt)
  }
  return result
}

// ── Public service functions ──────────────────────────────────────────────────

export async function recordReputationEvent(input: RecordEventInput): Promise<ReputationEventRecord> {
  const { citizen_id, event_type, reference_id } = input
  const points = EVENT_POINTS[event_type]

  ensureCitizenNode(citizen_id).catch((err: unknown) => {
    logger.error('[reputation] neo4j ensureCitizenNode failed', err)
  })

  const row = await prisma.$queryRaw<{ id: string; created_at: Date }[]>(
    Prisma.sql`
      INSERT INTO reputation_events (citizen_id, event_type, points, reference_id)
      VALUES (${citizen_id}::uuid, ${event_type}, ${points}, ${reference_id ?? null})
      RETURNING id, created_at
    `,
  )

  recordGraphRelation(citizen_id, event_type, reference_id ?? null).catch((err: unknown) => {
    logger.error('[reputation] neo4j graph relation failed', err)
  })

  await Promise.all([
    delCache(NS.profile, citizen_id),
    delCache(NS.analytics, citizen_id),
    delCache(NS.leaderboard, 'global'),
  ])

  return {
    citizen_id,
    event_type,
    points,
    reference_id: reference_id ?? null,
    created_at: row[0]?.created_at.toISOString() ?? new Date().toISOString(),
  }
}

export async function getReputationProfile(citizenId: string): Promise<ReputationProfile> {
  const cached = await getCache<ReputationProfile>(NS.profile, citizenId)
  if (cached) return cached

  const [score, eventCounts, activityRow, badgeRow] = await Promise.all([
    computeScoreFromDB(citizenId),
    countEventsByType(citizenId),
    prisma.$queryRaw<{ last_activity: Date | null }[]>(
      Prisma.sql`
        SELECT MAX(created_at) AS last_activity
        FROM reputation_events
        WHERE citizen_id = ${citizenId}::uuid
      `,
    ),
    prisma.$queryRaw<{ badge_count: bigint }[]>(
      Prisma.sql`
        SELECT COUNT(*) AS badge_count
        FROM reputation_events
        WHERE citizen_id = ${citizenId}::uuid
          AND event_type = 'badge_earned'
      `,
    ),
  ])

  const profile: ReputationProfile = {
    citizen_id: citizenId,
    reputation_score: score,
    level: scoreToLevel(score),
    event_counts: eventCounts,
    badges_count: Number(badgeRow[0]?.badge_count ?? 0),
    total_votes: eventCounts.vote_cast ?? 0,
    total_proposals: eventCounts.proposal_created ?? 0,
    total_reports: eventCounts.report_submitted ?? 0,
    last_activity_at: activityRow[0]?.last_activity?.toISOString() ?? null,
    calculated_at: new Date().toISOString(),
  }

  await setCache(NS.profile, citizenId, profile, PROFILE_TTL)
  return profile
}

export async function getReputationAnalytics(citizenId: string): Promise<ReputationAnalytics> {
  const cached = await getCache<ReputationAnalytics>(NS.analytics, citizenId)
  if (cached) return cached

  const [historyRows, standingRows, activeDateRows, breakdownRows] = await Promise.all([
    prisma.$queryRaw<{ period: string; total: bigint }[]>(
      Prisma.sql`
        SELECT
          TO_CHAR(DATE_TRUNC('month', created_at AT TIME ZONE 'America/Bogota'), 'YYYY-MM') AS period,
          COALESCE(SUM(points), 0) AS total
        FROM reputation_events
        WHERE citizen_id = ${citizenId}::uuid
        GROUP BY 1
        ORDER BY 1 ASC
      `,
    ),
    prisma.$queryRaw<{ rank: bigint; participants: bigint }[]>(
      Prisma.sql`
        WITH scores AS (
          SELECT citizen_id, GREATEST(COALESCE(SUM(points), 0), 0)::bigint AS score
          FROM reputation_events
          GROUP BY citizen_id
        ),
        target AS (
          SELECT COALESCE(
            (SELECT score FROM scores WHERE citizen_id = ${citizenId}::uuid),
            0::bigint
          ) AS score
        )
        SELECT
          (
            1 + (SELECT COUNT(*) FROM scores, target WHERE scores.score > target.score)
          )::bigint AS rank,
          (
            (SELECT COUNT(*) FROM scores) +
            CASE
              WHEN EXISTS (SELECT 1 FROM scores WHERE citizen_id = ${citizenId}::uuid) THEN 0
              ELSE 1
            END
          )::bigint AS participants
      `,
    ),
    prisma.$queryRaw<{ activity_date: Date | string }[]>(
      Prisma.sql`
        SELECT DISTINCT (created_at AT TIME ZONE 'America/Bogota')::date AS activity_date
        FROM reputation_events
        WHERE citizen_id = ${citizenId}::uuid
        ORDER BY activity_date DESC
        LIMIT 90
      `,
    ),
    prisma.$queryRaw<{ event_type: string; cnt: bigint; total: bigint }[]>(
      Prisma.sql`
        SELECT event_type, COUNT(*) AS cnt, COALESCE(SUM(points), 0) AS total
        FROM reputation_events
        WHERE citizen_id = ${citizenId}::uuid
        GROUP BY event_type
        ORDER BY total DESC, event_type ASC
      `,
    ),
  ])

  let rawCumulative = 0
  const fullHistory = historyRows.map((row) => {
    const points = Number(row.total)
    rawCumulative += points
    return {
      period: row.period,
      points,
      cumulative_score: Math.max(0, rawCumulative),
    }
  })

  const standing = standingRows[0]
  const participants = Math.max(1, Number(standing?.participants ?? 1))
  const rank = Math.max(1, Number(standing?.rank ?? 1))
  const topPercent = Math.min(100, Math.max(1, Math.ceil((rank / participants) * 100)))

  const activeDates = activeDateRows.map((row) => normalizeDateKey(row.activity_date))

  const eventBreakdown = breakdownRows.flatMap((row) => {
    const eventType = row.event_type as ReputationEvent
    if (!(eventType in EVENT_POINTS)) return []
    return [{
      event_type: eventType,
      count: Number(row.cnt),
      points_per_event: EVENT_POINTS[eventType],
      points_total: Number(row.total),
    }]
  })

  const analytics: ReputationAnalytics = {
    citizen_id: citizenId,
    score_history: fullHistory.slice(-12),
    community: {
      rank,
      participants,
      top_percent: topPercent,
    },
    streak: {
      current_days: computeCurrentStreak(activeDates),
      active_dates: activeDates.slice(0, 30),
    },
    event_breakdown: eventBreakdown,
    generated_at: new Date().toISOString(),
  }

  await setCache(NS.analytics, citizenId, analytics, ANALYTICS_TTL)
  return analytics
}

export async function getLeaderboard(input: LeaderboardInput): Promise<LeaderboardEntry[]> {
  const { limit, offset, locality } = input
  const leaderboardId = locality ?? 'global'

  if (offset === 0) {
    const cached = await getCache<LeaderboardEntry[]>(NS.leaderboard, leaderboardId)
    if (cached) return cached.slice(0, limit)
  }

  const rows = await prisma.$queryRaw<{ citizen_id: string; total: bigint }[]>(
    Prisma.sql`
      SELECT citizen_id::text, COALESCE(SUM(points), 0) AS total
      FROM reputation_events
      GROUP BY citizen_id
      ORDER BY total DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `,
  )

  const entries: LeaderboardEntry[] = rows.map((row, idx) => {
    const score = Math.max(0, Number(row.total))
    return {
      citizen_id: row.citizen_id,
      reputation_score: score,
      level: scoreToLevel(score),
      rank: offset + idx + 1,
    }
  })

  if (offset === 0) {
    await setCache(NS.leaderboard, leaderboardId, entries, LEADERBOARD_TTL)
  }

  return entries
}

export async function getCitizenGraph(citizenId: string): Promise<CitizenGraph> {
  const [votedRows, proposalRows, reportRows, delegatesToRows, delegatedFromRows] = await Promise.all([
    runCypher<{ proposal_id: string }>(
      `MATCH (c:Citizen {citizen_id: $citizenId})-[:VOTED]->(p:Proposal)
       RETURN p.proposal_id AS proposal_id`,
      { citizenId },
    ),
    runCypher<{ proposal_id: string }>(
      `MATCH (c:Citizen {citizen_id: $citizenId})-[:CREATED_PROPOSAL]->(p:Proposal)
       RETURN p.proposal_id AS proposal_id`,
      { citizenId },
    ),
    runCypher<{ report_id: string }>(
      `MATCH (c:Citizen {citizen_id: $citizenId})-[:SUBMITTED_REPORT]->(r:TerritorialReport)
       RETURN r.report_id AS report_id`,
      { citizenId },
    ),
    runCypher<{ target_id: string }>(
      `MATCH (c:Citizen {citizen_id: $citizenId})-[:DELEGATED_TO]->(t:Citizen)
       RETURN t.citizen_id AS target_id`,
      { citizenId },
    ),
    runCypher<{ source_id: string }>(
      `MATCH (s:Citizen)-[:DELEGATED_TO]->(c:Citizen {citizen_id: $citizenId})
       RETURN s.citizen_id AS source_id`,
      { citizenId },
    ),
  ])

  return {
    citizen_id: citizenId,
    delegates_to: delegatesToRows.map((row) => row.target_id),
    delegated_from: delegatedFromRows.map((row) => row.source_id),
    voted_on: votedRows.map((row) => row.proposal_id),
    created_proposals: proposalRows.map((row) => row.proposal_id),
    submitted_reports: reportRows.map((row) => row.report_id),
  }
}

export async function recordDelegation(
  fromCitizenId: string,
  toCitizenId: string,
  domain: string | null,
): Promise<void> {
  await runCypher(
    `MERGE (from:Citizen {citizen_id: $fromCitizenId})
     MERGE (to:Citizen {citizen_id: $toCitizenId})
     MERGE (from)-[r:DELEGATED_TO]->(to)
     ON CREATE SET r.domain = $domain, r.created_at = datetime()
     ON MATCH  SET r.domain = $domain, r.updated_at = datetime()`,
    { fromCitizenId, toCitizenId, domain },
  )
}

export async function removeDelegation(
  fromCitizenId: string,
  toCitizenId: string,
): Promise<void> {
  await runCypher(
    `MATCH (from:Citizen {citizen_id: $fromCitizenId})-[r:DELEGATED_TO]->(to:Citizen {citizen_id: $toCitizenId})
     DELETE r`,
    { fromCitizenId, toCitizenId },
  )
}
