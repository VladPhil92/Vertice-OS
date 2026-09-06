import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import type {
  CivicProfileType,
  CommunityFeedQuery,
  CommunityLeaderboardQuery,
  UpdateCivicProfileInput,
} from './community.schema'

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

interface ActorFields {
  actor_id: string
  display_name: string | null
  actor_neighborhood: string | null
  civic_profile_type: CivicProfileType
  civic_organization: string | null
  public_civic_profile: boolean
  reputation_score: number
}

interface ReportActivityRow extends ActorFields {
  id: string
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

interface ProposalActivityRow extends ActorFields {
  id: string
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

export interface CivicActivity {
  id: string
  type: ActivityType
  actor: {
    id: string | null
    display_name: string
    neighborhood: string | null
    actor_kind: CivicProfileType
    organization: string | null
    public_profile: boolean
    platform_reputation_score: number | null
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

export interface CivicProfile {
  citizen_id: string
  display_name: string | null
  neighborhood: string | null
  profile_type: CivicProfileType
  bio: string | null
  organization: string | null
  public_profile: boolean
  reputation_score: number
}

export interface CivicLeaderEntry {
  citizen_id: string
  display_name: string
  neighborhood: string | null
  actor_kind: CivicProfileType
  organization: string | null
  leader_score: number
  platform_reputation_score: number
  actions_count: number
  verified_actions: number
  evidence_count: number
  average_action_score: number
  verification_rate: number
  rank: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function totalScore(dimensions: CivicScoreDimensions): number {
  return clamp(Object.values(dimensions).reduce((sum, value) => sum + value, 0), 0, 100)
}

function publicActor(row: ActorFields): CivicActivity['actor'] {
  if (!row.public_civic_profile) {
    return {
      id: null,
      display_name: 'Ciudadano VÉRTICE',
      neighborhood: null,
      actor_kind: 'citizen',
      organization: null,
      public_profile: false,
      platform_reputation_score: null,
    }
  }

  return {
    id: row.actor_id,
    display_name: row.display_name ?? 'Perfil cívico VÉRTICE',
    neighborhood: row.actor_neighborhood,
    actor_kind: row.civic_profile_type,
    organization: row.civic_organization,
    public_profile: true,
    platform_reputation_score: Number(row.reputation_score),
  }
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
    actor: publicActor(row),
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
    actor: publicActor(row),
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

function actorProjection() {
  return Prisma.sql`
    actor.id::text AS actor_id,
    actor.display_name,
    actor.neighborhood AS actor_neighborhood,
    actor.civic_profile_type,
    actor.civic_organization,
    actor.public_civic_profile,
    actor.reputation_score::float8 AS reputation_score
  `
}

async function loadActivities(input: CommunityFeedQuery, fetchLimit = input.limit): Promise<CivicActivity[]> {
  const neighborhoodFilter = input.neighborhood
    ? Prisma.sql`AND LOWER(COALESCE(source.neighborhood, actor.neighborhood, '')) = LOWER(${input.neighborhood})`
    : Prisma.empty

  const reportRows = input.type === 'proposal' ? [] : await prisma.$queryRaw<ReportActivityRow[]>(Prisma.sql`
    SELECT
      source.id::text,
      ${actorProjection()},
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
      ${actorProjection()},
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
    WHERE source.status <> 'archived'
      ${neighborhoodFilter}
    ORDER BY source.created_at DESC
    LIMIT ${fetchLimit}
  `)

  return [...reportRows.map(reportToActivity), ...proposalRows.map(proposalToActivity)]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, input.limit)
}

export async function listCommunityFeed(input: CommunityFeedQuery): Promise<CivicActivity[]> {
  return loadActivities(input)
}

export async function getCommunityLeaderboard(input: CommunityLeaderboardQuery): Promise<CivicLeaderEntry[]> {
  const activities = await loadActivities({ limit: 100, neighborhood: input.neighborhood }, 500)
  const publicActivities = activities.filter((activity) => activity.actor.public_profile && activity.actor.id)
  const grouped = new Map<string, {
    citizen_id: string
    display_name: string
    neighborhood: string | null
    actor_kind: CivicProfileType
    organization: string | null
    platform_reputation_score: number
    actions_count: number
    verified_actions: number
    evidence_count: number
    score_total: number
  }>()

  for (const activity of publicActivities) {
    const citizenId = activity.actor.id as string
    const current = grouped.get(citizenId) ?? {
      citizen_id: citizenId,
      display_name: activity.actor.display_name,
      neighborhood: activity.actor.neighborhood,
      actor_kind: activity.actor.actor_kind,
      organization: activity.actor.organization,
      platform_reputation_score: activity.actor.platform_reputation_score ?? 0,
      actions_count: 0,
      verified_actions: 0,
      evidence_count: 0,
      score_total: 0,
    }
    current.actions_count += 1
    current.verified_actions += activity.verification_state === 'verified' ? 1 : 0
    current.evidence_count += activity.evidence_count
    current.score_total += activity.civic_score
    grouped.set(citizenId, current)
  }

  return [...grouped.values()]
    .map((entry) => {
      const averageActionScore = Math.round(entry.score_total / Math.max(1, entry.actions_count))
      const verificationRate = Math.round((entry.verified_actions / Math.max(1, entry.actions_count)) * 100)
      const evidenceCoverage = clamp(Math.round((entry.evidence_count / Math.max(1, entry.actions_count)) * 20), 0, 100)
      const leaderScore = Math.round(averageActionScore * 0.7 + verificationRate * 0.2 + evidenceCoverage * 0.1)
      const { score_total: _scoreTotal, ...publicEntry } = entry
      return {
        ...publicEntry,
        leader_score: clamp(leaderScore, 0, 100),
        average_action_score: averageActionScore,
        verification_rate: verificationRate,
      }
    })
    .sort((a, b) => b.leader_score - a.leader_score || b.verified_actions - a.verified_actions)
    .slice(0, input.limit)
    .map((entry, index) => ({ ...entry, rank: index + 1 }))
}

export async function getCivicProfile(citizenId: string): Promise<CivicProfile> {
  const rows = await prisma.$queryRaw<Array<{
    citizen_id: string
    display_name: string | null
    neighborhood: string | null
    civic_profile_type: CivicProfileType
    civic_bio: string | null
    civic_organization: string | null
    public_civic_profile: boolean
    reputation_score: number
  }>>(Prisma.sql`
    SELECT
      id::text AS citizen_id,
      display_name,
      neighborhood,
      civic_profile_type,
      civic_bio,
      civic_organization,
      public_civic_profile,
      reputation_score::float8 AS reputation_score
    FROM citizens
    WHERE id = ${citizenId}::uuid AND is_active = TRUE
    LIMIT 1
  `)

  const row = rows[0]
  if (!row) throw Object.assign(new Error('Perfil cívico no encontrado'), { statusCode: 404, code: 'CIVIC_PROFILE_NOT_FOUND' })

  return {
    citizen_id: row.citizen_id,
    display_name: row.display_name,
    neighborhood: row.neighborhood,
    profile_type: row.civic_profile_type,
    bio: row.civic_bio,
    organization: row.civic_organization,
    public_profile: row.public_civic_profile,
    reputation_score: Number(row.reputation_score),
  }
}

export async function updateCivicProfile(citizenId: string, input: UpdateCivicProfileInput): Promise<CivicProfile> {
  await prisma.$executeRaw(Prisma.sql`
    UPDATE citizens
    SET
      civic_profile_type = ${input.profile_type},
      civic_bio = ${input.bio ?? null},
      civic_organization = ${input.organization ?? null},
      public_civic_profile = ${input.public_profile},
      last_active_at = NOW()
    WHERE id = ${citizenId}::uuid AND is_active = TRUE
  `)
  return getCivicProfile(citizenId)
}
