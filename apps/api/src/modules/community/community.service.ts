import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import type {
  CivicActivityValidationInput,
  CivicProfileType,
  CommunityActivityType,
  CommunityFeedQuery,
  CommunityLeaderboardQuery,
  CommunityValidationStance,
  UpdateCivicProfileInput,
} from './community.schema'

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

export interface CommunityValidationSummary {
  corroborations: number
  disputes: number
  total: number
}

export interface CivicActivity {
  id: string
  type: CommunityActivityType
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
  community_validation: CommunityValidationSummary
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

export interface PublicCivicProfile extends CivicProfile {
  follower_count: number
  actions_count: number
  verified_actions: number
  evidence_count: number
  average_action_score: number
  recent_actions: CivicActivity[]
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

export interface FollowState {
  following: boolean
  follower_count: number
}

export interface ActivityValidationState extends CommunityValidationSummary {
  my_stance: CommunityValidationStance | null
  my_note: string | null
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function totalScore(dimensions: CivicScoreDimensions): number {
  return clamp(Object.values(dimensions).reduce((sum, value) => sum + value, 0), 0, 100)
}

function emptyCommunityValidation(): CommunityValidationSummary {
  return { corroborations: 0, disputes: 0, total: 0 }
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
    community_validation: emptyCommunityValidation(),
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
    community_validation: emptyCommunityValidation(),
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

async function attachCommunityValidation(activities: CivicActivity[]): Promise<CivicActivity[]> {
  if (activities.length === 0) return activities

  const ids = [...new Set(activities.map((activity) => activity.id))]
  const rows = await prisma.$queryRaw<Array<{
    activity_type: CommunityActivityType
    activity_id: string
    corroborations: bigint
    disputes: bigint
  }>>(Prisma.sql`
    SELECT
      activity_type,
      activity_id::text,
      COUNT(*) FILTER (WHERE stance = 'corroborate') AS corroborations,
      COUNT(*) FILTER (WHERE stance = 'dispute') AS disputes
    FROM civic_activity_validations
    WHERE activity_id::text IN (${Prisma.join(ids)})
    GROUP BY activity_type, activity_id
  `)

  const byActivity = new Map<string, CommunityValidationSummary>()
  for (const row of rows) {
    const corroborations = Number(row.corroborations)
    const disputes = Number(row.disputes)
    byActivity.set(`${row.activity_type}:${row.activity_id}`, {
      corroborations,
      disputes,
      total: corroborations + disputes,
    })
  }

  return activities.map((activity) => ({
    ...activity,
    community_validation: byActivity.get(`${activity.type}:${activity.id}`) ?? emptyCommunityValidation(),
  }))
}

async function loadActivities(
  input: CommunityFeedQuery,
  fetchLimit = input.limit,
  actorIds?: string[],
): Promise<CivicActivity[]> {
  if (actorIds && actorIds.length === 0) return []

  const neighborhoodFilter = input.neighborhood
    ? Prisma.sql`AND LOWER(COALESCE(source.neighborhood, actor.neighborhood, '')) = LOWER(${input.neighborhood})`
    : Prisma.empty
  const actorFilter = actorIds
    ? Prisma.sql`AND actor.id::text IN (${Prisma.join(actorIds)}) AND actor.public_civic_profile = TRUE`
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
      ${actorFilter}
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
      ${actorFilter}
    ORDER BY source.created_at DESC
    LIMIT ${fetchLimit}
  `)

  const activities = [...reportRows.map(reportToActivity), ...proposalRows.map(proposalToActivity)]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, input.limit)

  return attachCommunityValidation(activities)
}

export async function listCommunityFeed(input: CommunityFeedQuery): Promise<CivicActivity[]> {
  return loadActivities(input)
}

export async function listFollowingFeed(citizenId: string, input: CommunityFeedQuery): Promise<CivicActivity[]> {
  const rows = await prisma.$queryRaw<Array<{ followed_id: string }>>(Prisma.sql`
    SELECT follows.followed_id::text
    FROM civic_profile_follows follows
    JOIN citizens target ON target.id = follows.followed_id
    WHERE follows.follower_id = ${citizenId}::uuid
      AND target.is_active = TRUE
      AND target.public_civic_profile = TRUE
    ORDER BY follows.created_at DESC
  `)
  return loadActivities(input, Math.max(input.limit * 3, 60), rows.map((row) => row.followed_id))
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

async function requirePublicProfile(citizenId: string): Promise<CivicProfile> {
  const profile = await getCivicProfile(citizenId)
  if (!profile.public_profile) {
    throw Object.assign(new Error('Perfil cívico no publicado'), { statusCode: 404, code: 'CIVIC_PROFILE_NOT_PUBLIC' })
  }
  return profile
}

export async function getPublicCivicProfile(citizenId: string): Promise<PublicCivicProfile> {
  const profile = await requirePublicProfile(citizenId)
  const [followRows, recentActions] = await Promise.all([
    prisma.$queryRaw<Array<{ follower_count: bigint }>>(Prisma.sql`
      SELECT COUNT(*) AS follower_count
      FROM civic_profile_follows
      WHERE followed_id = ${citizenId}::uuid
    `),
    loadActivities({ limit: 12 }, 36, [citizenId]),
  ])

  const actionsCount = recentActions.length
  const verifiedActions = recentActions.filter((activity) => activity.verification_state === 'verified').length
  const evidenceCount = recentActions.reduce((sum, activity) => sum + activity.evidence_count, 0)
  const averageActionScore = actionsCount > 0
    ? Math.round(recentActions.reduce((sum, activity) => sum + activity.civic_score, 0) / actionsCount)
    : 0

  return {
    ...profile,
    follower_count: Number(followRows[0]?.follower_count ?? 0),
    actions_count: actionsCount,
    verified_actions: verifiedActions,
    evidence_count: evidenceCount,
    average_action_score: averageActionScore,
    recent_actions: recentActions,
  }
}

export async function updateCivicProfile(citizenId: string, input: UpdateCivicProfileInput): Promise<CivicProfile> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`
      UPDATE citizens
      SET
        civic_profile_type = ${input.profile_type},
        civic_bio = ${input.bio ?? null},
        civic_organization = ${input.organization ?? null},
        public_civic_profile = ${input.public_profile},
        last_active_at = NOW()
      WHERE id = ${citizenId}::uuid AND is_active = TRUE
    `)

    if (!input.public_profile) {
      await tx.$executeRaw(Prisma.sql`
        DELETE FROM civic_profile_follows
        WHERE followed_id = ${citizenId}::uuid
      `)
    }
  })
  return getCivicProfile(citizenId)
}

export async function getFollowState(viewerId: string, targetId: string): Promise<FollowState> {
  await requirePublicProfile(targetId)
  const rows = await prisma.$queryRaw<Array<{ following: boolean; follower_count: bigint }>>(Prisma.sql`
    SELECT
      EXISTS (
        SELECT 1
        FROM civic_profile_follows
        WHERE follower_id = ${viewerId}::uuid
          AND followed_id = ${targetId}::uuid
      ) AS following,
      (
        SELECT COUNT(*)
        FROM civic_profile_follows
        WHERE followed_id = ${targetId}::uuid
      ) AS follower_count
  `)
  return {
    following: Boolean(rows[0]?.following),
    follower_count: Number(rows[0]?.follower_count ?? 0),
  }
}

export async function followCivicProfile(viewerId: string, targetId: string): Promise<FollowState> {
  if (viewerId === targetId) {
    throw Object.assign(new Error('No puedes seguir tu propio perfil'), { statusCode: 409, code: 'SELF_FOLLOW_NOT_ALLOWED' })
  }
  await requirePublicProfile(targetId)
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO civic_profile_follows (follower_id, followed_id)
    VALUES (${viewerId}::uuid, ${targetId}::uuid)
    ON CONFLICT (follower_id, followed_id) DO NOTHING
  `)
  return getFollowState(viewerId, targetId)
}

export async function unfollowCivicProfile(viewerId: string, targetId: string): Promise<FollowState> {
  await prisma.$executeRaw(Prisma.sql`
    DELETE FROM civic_profile_follows
    WHERE follower_id = ${viewerId}::uuid
      AND followed_id = ${targetId}::uuid
  `)

  const rows = await prisma.$queryRaw<Array<{ public_civic_profile: boolean }>>(Prisma.sql`
    SELECT public_civic_profile
    FROM citizens
    WHERE id = ${targetId}::uuid AND is_active = TRUE
    LIMIT 1
  `)
  if (!rows[0]?.public_civic_profile) return { following: false, follower_count: 0 }
  return getFollowState(viewerId, targetId)
}

async function getActivityOwner(type: CommunityActivityType, activityId: string): Promise<string | null> {
  if (type === 'report') {
    const rows = await prisma.$queryRaw<Array<{ owner_id: string | null }>>(Prisma.sql`
      SELECT citizen_id::text AS owner_id
      FROM territorial_reports
      WHERE id = ${activityId}::uuid
        AND status NOT IN ('rejected', 'duplicate')
      LIMIT 1
    `)
    if (!rows[0]) throw Object.assign(new Error('Gestión no encontrada'), { statusCode: 404, code: 'CIVIC_ACTIVITY_NOT_FOUND' })
    return rows[0].owner_id
  }

  const rows = await prisma.$queryRaw<Array<{ owner_id: string | null }>>(Prisma.sql`
    SELECT author_id::text AS owner_id
    FROM proposals
    WHERE id = ${activityId}::uuid
      AND status <> 'archived'
    LIMIT 1
  `)
  if (!rows[0]) throw Object.assign(new Error('Iniciativa no encontrada'), { statusCode: 404, code: 'CIVIC_ACTIVITY_NOT_FOUND' })
  return rows[0].owner_id
}

export async function getActivityValidationState(
  type: CommunityActivityType,
  activityId: string,
  viewerId?: string,
): Promise<ActivityValidationState> {
  await getActivityOwner(type, activityId)
  const [summaryRows, viewerRows] = await Promise.all([
    prisma.$queryRaw<Array<{ corroborations: bigint; disputes: bigint }>>(Prisma.sql`
      SELECT
        COUNT(*) FILTER (WHERE stance = 'corroborate') AS corroborations,
        COUNT(*) FILTER (WHERE stance = 'dispute') AS disputes
      FROM civic_activity_validations
      WHERE activity_type = ${type}
        AND activity_id = ${activityId}::uuid
    `),
    viewerId
      ? prisma.$queryRaw<Array<{ stance: CommunityValidationStance; note: string | null }>>(Prisma.sql`
          SELECT stance, note
          FROM civic_activity_validations
          WHERE activity_type = ${type}
            AND activity_id = ${activityId}::uuid
            AND citizen_id = ${viewerId}::uuid
          LIMIT 1
        `)
      : Promise.resolve([]),
  ])

  const corroborations = Number(summaryRows[0]?.corroborations ?? 0)
  const disputes = Number(summaryRows[0]?.disputes ?? 0)
  return {
    corroborations,
    disputes,
    total: corroborations + disputes,
    my_stance: viewerRows[0]?.stance ?? null,
    my_note: viewerRows[0]?.note ?? null,
  }
}

export async function setActivityValidation(
  citizenId: string,
  type: CommunityActivityType,
  activityId: string,
  input: CivicActivityValidationInput,
): Promise<ActivityValidationState> {
  const ownerId = await getActivityOwner(type, activityId)
  if (ownerId === citizenId) {
    throw Object.assign(new Error('No puedes validar tu propia gestión'), { statusCode: 409, code: 'SELF_VALIDATION_NOT_ALLOWED' })
  }

  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO civic_activity_validations (
      activity_type, activity_id, citizen_id, stance, note
    ) VALUES (
      ${type}, ${activityId}::uuid, ${citizenId}::uuid, ${input.stance}, ${input.note ?? null}
    )
    ON CONFLICT (activity_type, activity_id, citizen_id)
    DO UPDATE SET
      stance = EXCLUDED.stance,
      note = EXCLUDED.note,
      updated_at = NOW()
  `)

  return getActivityValidationState(type, activityId, citizenId)
}

export async function removeActivityValidation(
  citizenId: string,
  type: CommunityActivityType,
  activityId: string,
): Promise<ActivityValidationState> {
  await getActivityOwner(type, activityId)
  await prisma.$executeRaw(Prisma.sql`
    DELETE FROM civic_activity_validations
    WHERE activity_type = ${type}
      AND activity_id = ${activityId}::uuid
      AND citizen_id = ${citizenId}::uuid
  `)
  return getActivityValidationState(type, activityId, citizenId)
}