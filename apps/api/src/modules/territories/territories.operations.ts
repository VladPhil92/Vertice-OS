import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { recordAuditEvent } from '../../lib/audit'
import { getTerritory } from './territories.service'
import { getNationalActivationRanking } from './territories.ranking'

export const LAUNCH_STATES = ['observing', 'recruiting', 'launch_ready', 'launched', 'paused'] as const
export const COHORT_ROLES = ['ambassador', 'organizer', 'observer'] as const
export type LaunchState = typeof LAUNCH_STATES[number]
export type CohortRole = typeof COHORT_ROLES[number]

interface OpsMetricRow {
  active_citizens_30d: bigint
  creators_30d: bigint
  verified_actions_90d: bigint
  evidence_backed_actions_90d: bigint
  total_actions_90d: bigint
  resolved_reports_90d: bigint
  total_reports_90d: bigint
  local_leaders: bigint
  moderation_capacity: bigint
  active_cohort_members: bigint
}

interface LaunchPlanRow {
  territory_code: string
  operational_state: LaunchState
  target_active_citizens: number
  target_verified_actions: number
  target_local_leaders: number
  target_moderators: number
  launch_window_start: Date | null
  launch_window_end: Date | null
  notes: string | null
  updated_by: string | null
  created_at: Date
  updated_at: Date
}

function makeError(message: string, statusCode: number, code: string): Error {
  return Object.assign(new Error(message), { statusCode, code })
}

function ratio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0
  return Math.round((numerator / denominator) * 1000) / 10
}

async function rawOperationalMetrics(territoryCode: string) {
  const rows = await prisma.$queryRaw<OpsMetricRow[]>(Prisma.sql`
    SELECT
      (SELECT COUNT(*) FROM citizens c
       WHERE c.territory_code = ${territoryCode}
         AND c.is_active = TRUE
         AND c.last_active_at >= NOW() - INTERVAL '30 days') AS active_citizens_30d,
      (SELECT COUNT(DISTINCT actor_id) FROM civic_actions a
       WHERE a.territory_code = ${territoryCode}
         AND a.created_at >= NOW() - INTERVAL '30 days'
         AND a.status <> 'cancelled') AS creators_30d,
      (SELECT COUNT(*) FROM civic_actions a
       WHERE a.territory_code = ${territoryCode}
         AND a.created_at >= NOW() - INTERVAL '90 days'
         AND a.status = 'verified') AS verified_actions_90d,
      (SELECT COUNT(*) FROM civic_actions a
       WHERE a.territory_code = ${territoryCode}
         AND a.created_at >= NOW() - INTERVAL '90 days'
         AND a.status <> 'cancelled'
         AND EXISTS (
           SELECT 1 FROM civic_action_evidence e
           WHERE e.action_id = a.id AND e.review_status <> 'rejected'
         )) AS evidence_backed_actions_90d,
      (SELECT COUNT(*) FROM civic_actions a
       WHERE a.territory_code = ${territoryCode}
         AND a.created_at >= NOW() - INTERVAL '90 days'
         AND a.status <> 'cancelled') AS total_actions_90d,
      (SELECT COUNT(*) FROM territorial_reports r
       WHERE r.territory_code = ${territoryCode}
         AND r.created_at >= NOW() - INTERVAL '90 days'
         AND r.status = 'resolved') AS resolved_reports_90d,
      (SELECT COUNT(*) FROM territorial_reports r
       WHERE r.territory_code = ${territoryCode}
         AND r.created_at >= NOW() - INTERVAL '90 days'
         AND r.status NOT IN ('rejected','duplicate')) AS total_reports_90d,
      (SELECT COUNT(*) FROM citizens c
       WHERE c.territory_code = ${territoryCode}
         AND c.is_active = TRUE
         AND c.public_civic_profile = TRUE
         AND c.civic_profile_type IN ('social_leader','organization_rep')) AS local_leaders,
      (SELECT COUNT(DISTINCT c.id)
       FROM citizens c
       JOIN citizen_role_grants g ON g.citizen_id = c.id
       WHERE c.territory_code = ${territoryCode}
         AND c.is_active = TRUE
         AND g.role IN ('moderator','admin','superadmin')
         AND g.revoked_at IS NULL) AS moderation_capacity,
      (SELECT COUNT(DISTINCT m.citizen_id)
       FROM territory_launch_cohort_members m
       WHERE m.territory_code = ${territoryCode}
         AND m.status = 'active') AS active_cohort_members
  `)
  const row = rows[0]
  const activeCitizens = Number(row?.active_citizens_30d ?? 0)
  const creators = Number(row?.creators_30d ?? 0)
  const verifiedActions = Number(row?.verified_actions_90d ?? 0)
  const evidenceBacked = Number(row?.evidence_backed_actions_90d ?? 0)
  const totalActions = Number(row?.total_actions_90d ?? 0)
  const resolvedReports = Number(row?.resolved_reports_90d ?? 0)
  const totalReports = Number(row?.total_reports_90d ?? 0)
  const localLeaders = Number(row?.local_leaders ?? 0)
  const moderationCapacity = Number(row?.moderation_capacity ?? 0)
  const cohortMembers = Number(row?.active_cohort_members ?? 0)

  return {
    active_citizens_30d: activeCitizens,
    creators_30d: creators,
    verified_actions_90d: verifiedActions,
    evidence_backed_actions_90d: evidenceBacked,
    evidence_completion_pct: ratio(evidenceBacked, totalActions),
    resolved_reports_90d: resolvedReports,
    report_resolution_pct: ratio(resolvedReports, totalReports),
    local_leaders: localLeaders,
    moderation_capacity: moderationCapacity,
    active_cohort_members: cohortMembers,
  }
}

function readinessScore(metrics: Awaited<ReturnType<typeof rawOperationalMetrics>>): number {
  return Math.min(100,
    Math.min(25, metrics.active_citizens_30d * 2)
    + Math.min(15, metrics.creators_30d * 3)
    + Math.min(20, metrics.verified_actions_90d * 5)
    + Math.min(10, metrics.evidence_completion_pct / 10)
    + Math.min(10, metrics.report_resolution_pct / 10)
    + Math.min(10, metrics.local_leaders * 5)
    + Math.min(10, metrics.moderation_capacity * 10),
  )
}

export async function getLaunchPlan(territoryCode: string) {
  const territory = await getTerritory(territoryCode)
  if (!['municipality', 'district'].includes(territory.level)) {
    throw makeError('El plan de lanzamiento opera a nivel municipal/distrital', 400, 'LAUNCH_LEVEL_UNSUPPORTED')
  }
  const rows = await prisma.$queryRaw<LaunchPlanRow[]>(Prisma.sql`
    SELECT territory_code, operational_state, target_active_citizens,
           target_verified_actions, target_local_leaders, target_moderators,
           launch_window_start, launch_window_end, notes, updated_by,
           created_at, updated_at
    FROM territory_launch_plans
    WHERE territory_code = ${territoryCode}
  `)
  const plan = rows[0] ?? {
    territory_code: territoryCode,
    operational_state: 'observing' as LaunchState,
    target_active_citizens: 10,
    target_verified_actions: 3,
    target_local_leaders: 2,
    target_moderators: 1,
    launch_window_start: null,
    launch_window_end: null,
    notes: null,
    updated_by: null,
    created_at: new Date(0),
    updated_at: new Date(0),
  }
  const metrics = await rawOperationalMetrics(territoryCode)
  const score = readinessScore(metrics)
  const blockers: string[] = []
  if (metrics.moderation_capacity < plan.target_moderators) blockers.push('moderation_capacity')
  if (metrics.active_citizens_30d < plan.target_active_citizens) blockers.push('active_citizens')
  if (metrics.verified_actions_90d < plan.target_verified_actions) blockers.push('verified_actions')
  if (metrics.local_leaders < plan.target_local_leaders) blockers.push('local_leaders')

  return {
    territory,
    plan,
    metrics,
    readiness_score: score,
    launch_ready: blockers.length === 0 && score >= 60,
    blockers,
    authority_boundary: 'operational_only',
  }
}

export async function listNationalLaunchOperations(limit = 50) {
  const ranking = await getNationalActivationRanking(Math.max(1, Math.min(limit, 100)))
  return Promise.all(ranking.map(async (territory) => {
    const launch = await getLaunchPlan(territory.code)
    return { ...territory, launch }
  }))
}

export async function upsertLaunchPlan(params: {
  actorId: string
  territoryCode: string
  operationalState: LaunchState
  reason: string
  targetActiveCitizens?: number
  targetVerifiedActions?: number
  targetLocalLeaders?: number
  targetModerators?: number
  launchWindowStart?: string | null
  launchWindowEnd?: string | null
  notes?: string | null
}) {
  const before = await getLaunchPlan(params.territoryCode)
  const start = params.launchWindowStart ? new Date(`${params.launchWindowStart}T00:00:00Z`) : null
  const end = params.launchWindowEnd ? new Date(`${params.launchWindowEnd}T00:00:00Z`) : null
  if (start && end && end < start) throw makeError('La ventana de lanzamiento es inválida', 400, 'INVALID_LAUNCH_WINDOW')
  if (params.operationalState === 'launched' && !before.launch_ready) {
    throw makeError('El territorio aún tiene bloqueadores operativos para lanzamiento', 409, 'LAUNCH_READINESS_BLOCKED')
  }

  const rows = await prisma.$queryRaw<LaunchPlanRow[]>(Prisma.sql`
    INSERT INTO territory_launch_plans (
      territory_code, operational_state, target_active_citizens,
      target_verified_actions, target_local_leaders, target_moderators,
      launch_window_start, launch_window_end, notes, updated_by
    ) VALUES (
      ${params.territoryCode}, ${params.operationalState},
      ${params.targetActiveCitizens ?? before.plan.target_active_citizens},
      ${params.targetVerifiedActions ?? before.plan.target_verified_actions},
      ${params.targetLocalLeaders ?? before.plan.target_local_leaders},
      ${params.targetModerators ?? before.plan.target_moderators},
      ${start}, ${end}, ${params.notes ?? before.plan.notes}, ${params.actorId}::uuid
    )
    ON CONFLICT (territory_code) DO UPDATE SET
      operational_state = EXCLUDED.operational_state,
      target_active_citizens = EXCLUDED.target_active_citizens,
      target_verified_actions = EXCLUDED.target_verified_actions,
      target_local_leaders = EXCLUDED.target_local_leaders,
      target_moderators = EXCLUDED.target_moderators,
      launch_window_start = EXCLUDED.launch_window_start,
      launch_window_end = EXCLUDED.launch_window_end,
      notes = EXCLUDED.notes,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW()
    RETURNING *
  `)

  await prisma.$queryRaw(Prisma.sql`
    INSERT INTO territory_launch_events (
      territory_code, actor_id, event_type, previous_state, next_state, reason, metrics_snapshot
    ) VALUES (
      ${params.territoryCode}, ${params.actorId}::uuid, 'operational_state_changed',
      ${before.plan.operational_state}, ${params.operationalState}, ${params.reason},
      ${JSON.stringify({ readiness_score: before.readiness_score, blockers: before.blockers, metrics: before.metrics })}::jsonb
    )
  `)
  await recordAuditEvent({
    actorId: params.actorId,
    action: 'territory_launch_plan_updated',
    targetType: 'territory',
    targetId: params.territoryCode,
    result: params.operationalState,
    reason: params.reason,
    metadata: { readiness_score: before.readiness_score, blockers: before.blockers },
  })
  return { ...(await getLaunchPlan(params.territoryCode)), persisted_plan: rows[0] }
}

export async function assignLaunchCohortMember(params: {
  actorId: string
  territoryCode: string
  citizenId: string
  cohortRole: CohortRole
  notes?: string | null
}) {
  const territory = await getTerritory(params.territoryCode)
  if (!['municipality', 'district'].includes(territory.level)) {
    throw makeError('La cohorte opera a nivel municipal/distrital', 400, 'LAUNCH_LEVEL_UNSUPPORTED')
  }
  const citizens = await prisma.$queryRaw<Array<{ id: string; territory_code: string | null }>>(Prisma.sql`
    SELECT id::text, territory_code FROM citizens WHERE id = ${params.citizenId}::uuid AND is_active = TRUE
  `)
  if (!citizens[0]) throw makeError('Ciudadano no encontrado', 404, 'CITIZEN_NOT_FOUND')
  if (citizens[0].territory_code !== params.territoryCode) {
    throw makeError('La persona no pertenece al nodo territorial seleccionado', 409, 'COHORT_TERRITORY_MISMATCH')
  }

  await prisma.$queryRaw(Prisma.sql`
    INSERT INTO territory_launch_cohort_members
      (territory_code, citizen_id, cohort_role, status, assigned_by, notes)
    VALUES (${params.territoryCode}, ${params.citizenId}::uuid, ${params.cohortRole}, 'active', ${params.actorId}::uuid, ${params.notes ?? null})
    ON CONFLICT (territory_code, citizen_id, cohort_role) DO UPDATE SET
      status = 'active', assigned_by = EXCLUDED.assigned_by, assigned_at = NOW(), ended_at = NULL, notes = EXCLUDED.notes
  `)
  await recordAuditEvent({
    actorId: params.actorId,
    action: 'territory_launch_cohort_assigned',
    targetType: 'citizen',
    targetId: params.citizenId,
    result: params.cohortRole,
    metadata: { territory_code: params.territoryCode, authority_effect: 'none' },
  })
  return { territory_code: params.territoryCode, citizen_id: params.citizenId, cohort_role: params.cohortRole, authority_effect: 'none' }
}
