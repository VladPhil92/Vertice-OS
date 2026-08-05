import { Prisma } from '@prisma/client'
import { runCypher } from '../../lib/neo4j'
import { prisma } from '../../lib/prisma'
import { logger } from '../../lib/logger'
import { getCache, setCache, delCache, TTL } from '../../lib/cache'
import {
  ReputationProfile,
  ReputationEventRecord,
  LeaderboardEntry,
  CitizenGraph,
  Neo4jEventCount,
  ReputationEvent,
  EVENT_POINTS,
  scoreToLevel,
} from './reputation.types'
import type { RecordEventInput, LeaderboardInput } from './reputation.schema'

// ── Cache helpers ─────────────────────────────────────────────────────────────

const NS = {
  profile:     'reputation:profile',
  leaderboard: 'reputation:leaderboard',
} as const

const PROFILE_TTL     = TTL.PROFILE      // 300 s
const LEADERBOARD_TTL = TTL.STATS        // 600 s

// ── Neo4j graph helpers ───────────────────────────────────────────────────────

async function ensureCitizenNode(citizenId: string): Promise<void> {
  await runCypher(
    `MERGE (c:Citizen {citizen_id: $citizenId})
     ON CREATE SET c.created_at = datetime()`,
    { citizenId }
  )
}

async function recordGraphRelation(
  citizenId: string,
  eventType: ReputationEvent,
  referenceId: string | null
): Promise<void> {
  switch (eventType) {
    case 'vote_cast':
      if (!referenceId) return
      await runCypher(
        `MERGE (c:Citizen {citizen_id: $citizenId})
         MERGE (p:Proposal {proposal_id: $referenceId})
         MERGE (c)-[r:VOTED]->(p)
         ON CREATE SET r.voted_at = datetime()`,
        { citizenId, referenceId }
      )
      break

    case 'proposal_created':
      if (!referenceId) return
      await runCypher(
        `MERGE (c:Citizen {citizen_id: $citizenId})
         MERGE (p:Proposal {proposal_id: $referenceId})
         MERGE (c)-[r:CREATED_PROPOSAL]->(p)
         ON CREATE SET r.created_at = datetime()`,
        { citizenId, referenceId }
      )
      break

    case 'report_submitted':
      if (!referenceId) return
      await runCypher(
        `MERGE (c:Citizen {citizen_id: $citizenId})
         MERGE (rep:TerritorialReport {report_id: $referenceId})
         MERGE (c)-[r:SUBMITTED_REPORT]->(rep)
         ON CREATE SET r.submitted_at = datetime()`,
        { citizenId, referenceId }
      )
      break

    case 'endorsement_given':
      if (!referenceId) return
      await runCypher(
        `MERGE (c:Citizen {citizen_id: $citizenId})
         MERGE (p:Proposal {proposal_id: $referenceId})
         MERGE (c)-[r:ENDORSED]->(p)
         ON CREATE SET r.endorsed_at = datetime()`,
        { citizenId, referenceId }
      )
      break

    default:
      // badge_earned, delegation_*, proposal_approved/rejected, report_resolved:
      // only tracked via reputation_events table, no additional graph edge needed
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
    `
  )
  return Math.max(0, Number(rows[0]?.total ?? 0))
}

async function countEventsByType(citizenId: string): Promise<Partial<Record<ReputationEvent, number>>> {
  const rows = await prisma.$queryRaw<{ event_type: string; cnt: bigint }[]>(
    Prisma.sql`
      SELECT event_type, COUNT(*) AS cnt
      FROM reputation_events
      WHERE citizen_id = ${citizenId}::uuid
      GROUP BY event_type
    `
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

  await ensureCitizenNode(citizen_id)

  // Persist event to PostgreSQL
  const row = await prisma.$queryRaw<{ id: string; created_at: Date }[]>(
    Prisma.sql`
      INSERT INTO reputation_events (citizen_id, event_type, points, reference_id)
      VALUES (${citizen_id}::uuid, ${event_type}, ${points}, ${reference_id ?? null})
      RETURNING id, created_at
    `
  )

  // Record graph relation in Neo4j (fire-and-forget pattern: errors logged, not thrown)
  recordGraphRelation(citizen_id, event_type, reference_id ?? null).catch((err: unknown) => {
    logger.error('[reputation] neo4j graph relation failed', err)
  })

  // Invalidate profile cache
  await delCache(NS.profile, citizen_id)
  await delCache(NS.leaderboard, 'global')

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
      `
    ),
    prisma.$queryRaw<{ badge_count: bigint }[]>(
      Prisma.sql`
        SELECT COUNT(*) AS badge_count
        FROM reputation_events
        WHERE citizen_id = ${citizenId}::uuid
          AND event_type = 'badge_earned'
      `
    ),
  ])

  const profile: ReputationProfile = {
    citizen_id:       citizenId,
    reputation_score: score,
    level:            scoreToLevel(score),
    event_counts:     eventCounts,
    badges_count:     Number(badgeRow[0]?.badge_count ?? 0),
    total_votes:      eventCounts['vote_cast'] ?? 0,
    total_proposals:  eventCounts['proposal_created'] ?? 0,
    total_reports:    eventCounts['report_submitted'] ?? 0,
    last_activity_at: activityRow[0]?.last_activity?.toISOString() ?? null,
    calculated_at:    new Date().toISOString(),
  }

  await setCache(NS.profile, citizenId, profile, PROFILE_TTL)
  return profile
}

export async function getLeaderboard(input: LeaderboardInput): Promise<LeaderboardEntry[]> {
  const { limit, offset, locality } = input
  const leaderboardId = locality ?? 'global'

  if (offset === 0) {
    const cached = await getCache<LeaderboardEntry[]>(NS.leaderboard, leaderboardId)
    if (cached) return cached.slice(0, limit)
  }

  // Build leaderboard from PostgreSQL aggregate
  const rows = await prisma.$queryRaw<{ citizen_id: string; total: bigint }[]>(
    Prisma.sql`
      SELECT citizen_id::text, COALESCE(SUM(points), 0) AS total
      FROM reputation_events
      GROUP BY citizen_id
      ORDER BY total DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `
  )

  const entries: LeaderboardEntry[] = rows.map((row, idx) => {
    const score = Math.max(0, Number(row.total))
    return {
      citizen_id:       row.citizen_id,
      reputation_score: score,
      level:            scoreToLevel(score),
      rank:             offset + idx + 1,
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
      { citizenId }
    ),
    runCypher<{ proposal_id: string }>(
      `MATCH (c:Citizen {citizen_id: $citizenId})-[:CREATED_PROPOSAL]->(p:Proposal)
       RETURN p.proposal_id AS proposal_id`,
      { citizenId }
    ),
    runCypher<{ report_id: string }>(
      `MATCH (c:Citizen {citizen_id: $citizenId})-[:SUBMITTED_REPORT]->(r:TerritorialReport)
       RETURN r.report_id AS report_id`,
      { citizenId }
    ),
    runCypher<{ target_id: string }>(
      `MATCH (c:Citizen {citizen_id: $citizenId})-[:DELEGATED_TO]->(t:Citizen)
       RETURN t.citizen_id AS target_id`,
      { citizenId }
    ),
    runCypher<{ source_id: string }>(
      `MATCH (s:Citizen)-[:DELEGATED_TO]->(c:Citizen {citizen_id: $citizenId})
       RETURN s.citizen_id AS source_id`,
      { citizenId }
    ),
  ])

  return {
    citizen_id:        citizenId,
    delegates_to:      delegatesToRows.map((r) => r.target_id),
    delegated_from:    delegatedFromRows.map((r) => r.source_id),
    voted_on:          votedRows.map((r) => r.proposal_id),
    created_proposals: proposalRows.map((r) => r.proposal_id),
    submitted_reports: reportRows.map((r) => r.report_id),
  }
}

export async function recordDelegation(
  fromCitizenId: string,
  toCitizenId: string,
  domain: string | null
): Promise<void> {
  await runCypher(
    `MERGE (from:Citizen {citizen_id: $fromCitizenId})
     MERGE (to:Citizen {citizen_id: $toCitizenId})
     MERGE (from)-[r:DELEGATED_TO]->(to)
     ON CREATE SET r.domain = $domain, r.created_at = datetime()
     ON MATCH  SET r.domain = $domain, r.updated_at = datetime()`,
    { fromCitizenId, toCitizenId, domain }
  )
}

export async function removeDelegation(
  fromCitizenId: string,
  toCitizenId: string
): Promise<void> {
  await runCypher(
    `MATCH (from:Citizen {citizen_id: $fromCitizenId})-[r:DELEGATED_TO]->(to:Citizen {citizen_id: $toCitizenId})
     DELETE r`,
    { fromCitizenId, toCitizenId }
  )
}
