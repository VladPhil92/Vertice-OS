import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import type { CommunityActivityType } from './community.schema'

interface VisibleActivityShape {
  id: string
  type: CommunityActivityType
  actor: { id: string | null }
}

interface VisibleLeaderShape {
  citizen_id: string
}

interface IdentifiedTarget {
  id: string
}

async function hiddenTargetKeys(targetIds: string[]): Promise<Set<string>> {
  if (targetIds.length === 0) return new Set()
  const ids = [...new Set(targetIds)]
  const rows = await prisma.$queryRaw<Array<{ target_type: string; target_id: string }>>(Prisma.sql`
    SELECT target_type, target_id::text
    FROM community_moderation_visibility
    WHERE target_id::text IN (${Prisma.join(ids)})
  `)
  return new Set(rows.map((row) => `${row.target_type}:${row.target_id}`))
}

async function activityOwners(
  targetType: CommunityActivityType,
  targetIds: string[],
): Promise<Map<string, string>> {
  if (targetIds.length === 0) return new Map()
  const ids = [...new Set(targetIds)]
  let rows: Array<{ target_id: string; owner_id: string | null }>

  if (targetType === 'report') {
    rows = await prisma.$queryRaw(Prisma.sql`
      SELECT id::text AS target_id, citizen_id::text AS owner_id
      FROM territorial_reports
      WHERE id::text IN (${Prisma.join(ids)})
    `)
  } else if (targetType === 'proposal') {
    rows = await prisma.$queryRaw(Prisma.sql`
      SELECT id::text AS target_id, author_id::text AS owner_id
      FROM proposals
      WHERE id::text IN (${Prisma.join(ids)})
    `)
  } else {
    rows = await prisma.$queryRaw(Prisma.sql`
      SELECT id::text AS target_id, citizen_id::text AS owner_id
      FROM scheduled_civic_publications
      WHERE id::text IN (${Prisma.join(ids)})
    `)
  }

  return new Map(rows.flatMap((row) => row.owner_id ? [[row.target_id, row.owner_id] as const] : []))
}

export async function filterVisibleCommunityTargets<T extends IdentifiedTarget>(
  targetType: CommunityActivityType,
  items: T[],
): Promise<T[]> {
  if (items.length === 0) return items
  const targetIds = items.map((item) => item.id)
  const [hiddenTargets, owners] = await Promise.all([
    hiddenTargetKeys(targetIds),
    activityOwners(targetType, targetIds),
  ])
  const ownerIds = [...new Set(owners.values())]
  const hiddenOwners = await hiddenTargetKeys(ownerIds)

  return items.filter((item) => {
    if (hiddenTargets.has(`${targetType}:${item.id}`)) return false
    const ownerId = owners.get(item.id)
    return !ownerId || !hiddenOwners.has(`profile:${ownerId}`)
  })
}

export async function assertCommunityTargetVisible(
  targetType: CommunityActivityType,
  targetId: string,
): Promise<void> {
  const [hiddenTargets, owners] = await Promise.all([
    hiddenTargetKeys([targetId]),
    activityOwners(targetType, [targetId]),
  ])
  const ownerId = owners.get(targetId)
  const hiddenOwners = ownerId ? await hiddenTargetKeys([ownerId]) : new Set<string>()

  if (hiddenTargets.has(`${targetType}:${targetId}`) || (ownerId && hiddenOwners.has(`profile:${ownerId}`))) {
    throw Object.assign(new Error('Contenido cívico no disponible'), {
      statusCode: 404,
      code: 'CIVIC_ACTIVITY_NOT_FOUND',
    })
  }
}

export async function filterVisibleCommunityActivities<T extends VisibleActivityShape>(activities: T[]): Promise<T[]> {
  if (activities.length === 0) return activities
  const targetIds = activities.flatMap((activity) => [activity.id, ...(activity.actor.id ? [activity.actor.id] : [])])
  const hidden = await hiddenTargetKeys(targetIds)
  return activities.filter((activity) => (
    !hidden.has(`${activity.type}:${activity.id}`)
    && (!activity.actor.id || !hidden.has(`profile:${activity.actor.id}`))
  ))
}

export async function filterCommunityActivitiesForViewer<T extends VisibleActivityShape>(
  viewerId: string,
  activities: T[],
): Promise<T[]> {
  const visible = await filterVisibleCommunityActivities(activities)
  const actorIds = [...new Set(visible.map((item) => item.actor.id).filter((id): id is string => Boolean(id)))]
  if (actorIds.length === 0) return visible

  const rows = await prisma.$queryRaw<Array<{ other_id: string }>>(Prisma.sql`
    SELECT CASE
      WHEN blocker_id = ${viewerId}::uuid THEN blocked_id::text
      ELSE blocker_id::text
    END AS other_id
    FROM community_user_blocks
    WHERE (blocker_id = ${viewerId}::uuid AND blocked_id::text IN (${Prisma.join(actorIds)}))
       OR (blocked_id = ${viewerId}::uuid AND blocker_id::text IN (${Prisma.join(actorIds)}))
  `)
  const blockedActors = new Set(rows.map((row) => row.other_id))
  return visible.filter((activity) => !activity.actor.id || !blockedActors.has(activity.actor.id))
}

export async function filterVisibleCommunityLeaders<T extends VisibleLeaderShape>(leaders: T[]): Promise<T[]> {
  if (leaders.length === 0) return leaders
  const hidden = await hiddenTargetKeys(leaders.map((leader) => leader.citizen_id))
  return leaders.filter((leader) => !hidden.has(`profile:${leader.citizen_id}`))
}

export async function assertCommunityProfileVisible(citizenId: string): Promise<void> {
  const rows = await prisma.$queryRaw<Array<{ hidden: boolean }>>(Prisma.sql`
    SELECT EXISTS (
      SELECT 1
      FROM community_moderation_visibility
      WHERE target_type = 'profile'
        AND target_id = ${citizenId}::uuid
    ) AS hidden
  `)
  if (rows[0]?.hidden) {
    throw Object.assign(new Error('Perfil cívico no disponible'), {
      statusCode: 404,
      code: 'CIVIC_PROFILE_NOT_PUBLIC',
    })
  }
}

export async function assertCommunityInteractionAllowed(viewerId: string, targetId: string): Promise<void> {
  if (viewerId === targetId) return
  const rows = await prisma.$queryRaw<Array<{ blocked: boolean }>>(Prisma.sql`
    SELECT EXISTS (
      SELECT 1
      FROM community_user_blocks
      WHERE (blocker_id = ${viewerId}::uuid AND blocked_id = ${targetId}::uuid)
         OR (blocker_id = ${targetId}::uuid AND blocked_id = ${viewerId}::uuid)
    ) AS blocked
  `)
  if (rows[0]?.blocked) {
    throw Object.assign(new Error('La interacción entre estos perfiles está bloqueada.'), {
      statusCode: 409,
      code: 'COMMUNITY_INTERACTION_BLOCKED',
    })
  }
}
