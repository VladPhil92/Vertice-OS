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
