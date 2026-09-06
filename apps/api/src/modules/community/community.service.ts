import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import type { CommunityFeedQuery, CommunityLeaderboardQuery } from './community.schema'

type ActivityType = 'report' | 'proposal'
type VerificationState = 'declared' | 'evidence_backed' | 'verified'

type CivicScoreDimensions = {
  evidence: number
  results: number
  impact: number
  validation: number
  transparency: number
  collaboration: number
  continuity: number
  confidence: number
}

export interface CivicActivity {
  id: string
  type: ActivityType
  actor: {
    id: string
    display_name: string
    neighborhood: string | null
    actor_kind: 'citizen' | 'social_leader' | 'candidate' | 'public_official'
    platform_reputation_score: number
  }
  title: string
  summary: string
  category: string
  status: string
  neighborhood: string | null
  evidence_count: number
  verification_state: VerificationState
  civic_score: number
  score_dimensions: CivicScoreDimensions
  created_at: string
  updated_at: string
  href: string
}

interface ReportActivityRow {
  id: string
  actor_id: string
  display_name: string | null
  actor_neighborhood: string | null
  role: string
  reputation_score: number
  title: string
  description: string
  category: string
  status: string
  neighborhood: string | null
  media_urls: string[] | null
  urgency_score: number | null
  created_at: Date
  updated_at: Date
}

interface ProposalActivityRow {
  id: string
  actor_id: string
  display_name: string | null
  actor_neighborhood: string | null
  role: string
  reputation_score: number
  title: string
  description: string
  executive_summary: string | null
  category: string
  status: string
  neighborhood: string | null
  endorsement_count: number
  comment_count: number
  ipfs_proposal_uri: string | null
  ipfs_result_uri: string | null
  created_at: Date
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function totalScore(dimensions: CivicScoreDimensions): number {
  return clamp(
    dimensions.evidence
      + dimensions.results
      + dimensions.impact
      + dimensions.validation
      + dimensions.transparency
      + dimensions.collaboration
      + dimensions.continuity
      + dimensions.confidence,
    0,
    100,
  )
}

function actorKind(role: string, reputationScore: number): CivicActivity['actor']['actor_kind'] {
  if (role === 'candidate') return 'candidate'
  if (role === 'social_leader' || role === 'leader') return 'social_leader'
  if (['authority', 'public_official'].includes(role)) return 'public_official'
  if (reputationScore >= 100) return 'social_leader'
  return 'citizen'
}

function reportToActivity(row: ReportActivityRow): CivicActivity {
  const evidenceCount = row.media_urls?.length ?? 0
  const urgency = row.urgency_score ?? 0.4
  const ageDays = Math.max(0, Math.floor((Date.now() - row.created_at.getTime()) / 86400000))
  const dimensions: CivicScoreDimensions = {
    evidence: evidenceCount === 0 ? 0 : clamp(10 + evidenceCount * 5, 0, 25),
    results: row.status === 'resolved' ? 20 : row.status === 'in_progress' ? 10 : 4,
    impact: clamp(Math.round(urgency * 15), 3, 15),
    validation: 0,
    transparency: clamp(1 + (row.description.length >= 80 ? 2 : 1) + (row.neighborhood ? 2 : 0), 0, 5),
    collaboration: 0,
    continuity: row.status === 'resolved' ? 5 : ageDays >= 7 ? 4 : 2,
    confidence: evidenceCount === 0 ? 0 : clamp(5 + evidenceCount * 3 + (row.status === 'resolved' ? 4 : 0), 0, 15),
  }
  const verified = row.status === 'resolved' && evidenceCount > 0
  return {
    id: row.id,
    type: 'report',
    actor: {
      id: row.actor_id,
      display_name: row.display_name ?? 'Ciudadano VÉRTICE',
      neighborhood: row.actor_neighborhood,
      actor_kind: actorKind(row.role, row.reputation_score),
      platform_reputation_score: Number(row.reputation_score),
    },
    title: row.title,
    summary: row.description,
    category: row.category,
    status: row.status,
    neighborhood: row.neighborhood,
    evidence_count: evidenceCount,
    verification_state: verified ? 'verified' : evidenceCount > 0 ? 'evidence_backed' : 'declared',
    civic_score: totalScore(dimensions),
    score_dimensions: dimensions,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
    href: `/dashboard/reports/${row.id}`,
  }
}

function proposalToActivity(row: ProposalActivityRow): CivicActivity {
  const evidenceCount = Number(Boolean(row.ipfs_proposal_uri)) + Number(Boolean(row.ipfs_result_uri))
  const resultPoints: Record<string, number> = {
    executed: 20,
    approved: 15,
    voting: 8,
    debate: 6,
    draft: 4,
    idea: 3,
    rejected: 2,
    quorum_failed: 2,
  }
  const dimensions: CivicScoreDimensions = {
    evidence: evidenceCount === 2 ? 25 : evidenceCount === 1 ? 13 : 0,
    results: resultPoints[row.status] ?? 3,
    impact: clamp(3 + Math.round(row.endorsement_count / 2), 3, 15),
    validation: clamp(Math.round(row.endorsement_count / 2), 0, 10),
    transparency: clamp(2 + (row.executive_summary ? 2 : 0) + (row.description.length >= 120 ? 1 : 0), 0, 5),
    collaboration: clamp(Math.round((row.endorsement_count + row.comment_count) / 5), 0, 5),
    continuity: row.status === 'executed' ? 5 : row.status === 'approved' ? 4 : 2,
    confidence: row.ipfs_result_uri ? 15 : row.ipfs_proposal_uri ? 8 : ['approved', 'executed'].includes(row.status) ? 5 : 0,
  }
  const verified = row.status === 'executed' && Boolean(row.ipfs_result_uri)
  return {
    id: row.id,
    type: 'proposal',
    actor: {
      id: row.actor_id,
      display_name: row.display_name ?? 'Ciudadano VÉRTICE',
      neighborhood: row.actor_neighborhood,
      actor_kind: actorKind(row.role, row.reputation_score),
      platform_reputation_score: Number(row.reputation_score),
    },
    title: row.title,
    summary: row.executive_summary ?? row.description,
    category: row.category,
    status: row.status,
    neighborhood: row.neighborhood,
    evidence_count: evidenceCount,
    verification_state: verified ? 'verified' : evidenceCount > 0 ? 'evidence_backed' : 'declared',
    civic_score: totalScore(dimensions),
    score_dimensions: dimensions,
    created_at: row.created_at.toISOString(),
    updated_at: row.created_at.toISOString(),
    href: `/dashboard/proposals/${row.id}`,
  }
}

async function loadActivities(input: CommunityFeedQuery, fetchLimit = input.limit): Promise<CivicActivity[]> {
  const neighborhoodFilter = input.neighborhood
    ? Prisma.sql`AND LOWER(COALESCE(source.neighborhood, actor.neighborhood, '')) = LOWER(${input.neighborhood})`
    : Prisma.empty

  const reportRows = input.type === 'proposal' ? [] : await prisma.$queryRaw<ReportActivityRow[]>(Prisma.sql`
    SELECT
      source.id::text,
      actor.id::text AS actor_id,
      actor.display_name,
      actor.neighborhood AS actor_neighborhood,
      actor.role,
      actor.reputation_score::float8 AS reputation_score,
      source.title,
      source.description,
      source.category,
      source.status,
      source.neighborhood,
      source.media_urls,
      source.urgency_score::float8 AS urgency_score,
      source.created_at,
      source.updated_at
    FROM territorial_reports source
    JOIN citizens actor ON actor.id = source.citizen_id
    WHERE source.status NOT IN ('rejected', 'duplicate')
      ${neighborhoodFilter}
    ORDER BY source.updated_at DESC
    LIMIT ${fetchLimit}
  `)

  const proposalRows = input.type === 'report' ? [] : await prisma.$queryRaw<ProposalActivityRow[]>(Prisma.sql`
    SELECT
      source.id::text,
      actor.id::text AS actor_id,
      actor.display_name,
      actor.neighborhood AS actor_neighborhood,
      actor.role,
      actor.reputation_score::float8 AS reputation_score,
      source.title,
      source.description,
      source.executive_summary,
      source.category,
      source.status,
      source.neighborhood,
      source.endorsement_count,
      source.comment_count,
      source.ipfs_proposal_uri,
      source.ipfs_result_uri,
      source.created_at
    FROM proposals source
    JOIN citizens actor ON actor.id = source.author_id
    WHERE source.status NOT IN ('archived')
      ${neighborhoodFilter}
    ORDER BY source.created_at DESC
    LIMIT ${fetchLimit}
  `)

  return [
    ...reportRows.map(reportToActivity),
    ...proposalRows.map(proposalToActivity),
  ]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, input.limit)
}

export async function listCommunityFeed(input: CommunityFeedQuery): Promise<CivicActivity[]> {
  return loadActivities(input)
}

export interface CivicLeaderEntry {
  citizen_id: string
  display_name: string
  neighborhood: string | null
  actor_kind: CivicActivity['actor']['actor_kind']
  leader_score: number
  platform_reputation_score: number
  actions_count: number
  verified_actions: number
  evidence_count: number
  average_action_score: number
  verification_rate: number
  rank: number
}

export async function getCommunityLeaderboard(input: CommunityLeaderboardQuery): Promise<CivicLeaderEntry[]> {
  const activities = await loadActivities({
    limit: 100,
    neighborhood: input.neighborhood,
  }, 500)

  const grouped = new Map<string, Omit<CivicLeaderEntry, 'rank' | 'leader_score' | 'average_action_score' | 'verification_rate'>>()
  const scoreTotals = new Map<string, number>()

  for (const activity of activities) {
    const current = grouped.get(activity.actor.id) ?? {
      citizen_id: activity.actor.id,
      display_name: activity.actor.display_name,
      neighborhood: activity.actor.neighborhood,
      actor_kind: activity.actor.actor_kind,
      platform_reputation_score: activity.actor.platform_reputation_score,
      actions_count: 0,
      verified_actions: 0,
      evidence_count: 0,
    }
    current.actions_count += 1
    current.verified_actions += activity.verification_state === 'verified' ? 1 : 0
    current.evidence_count += activity.evidence_count
    grouped.set(activity.actor.id, current)
    scoreTotals.set(activity.actor.id, (scoreTotals.get(activity.actor.id) ?? 0) + activity.civic_score)
  }

  return [...grouped.values()]
    .map((entry) => {
      const averageActionScore = Math.round((scoreTotals.get(entry.citizen_id) ?? 0) / Math.max(1, entry.actions_count))
      const verificationRate = Math.round((entry.verified_actions / Math.max(1, entry.actions_count)) * 100)
      const evidenceCoverage = clamp(Math.round((entry.evidence_count / Math.max(1, entry.actions_count)) * 20), 0, 100)
      const leaderScore = Math.round(averageActionScore * 0.7 + verificationRate * 0.2 + evidenceCoverage * 0.1)
      return {
        ...entry,
        leader_score: clamp(leaderScore, 0, 100),
        average_action_score: averageActionScore,
        verification_rate: verificationRate,
      }
    })
    .sort((a, b) => b.leader_score - a.leader_score || b.verified_actions - a.verified_actions)
    .slice(0, input.limit)
    .map((entry, index) => ({ ...entry, rank: index + 1 }))
}
