import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'

interface OperationsRow {
  code: string
  external_code: string | null
  name: string
  level: string
  parent_code: string | null
  activation_status: string
  operational_state: string | null
  target_active_citizens: number | null
  target_verified_actions: number | null
  target_local_leaders: number | null
  target_moderators: number | null
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

function ratio(n: number, d: number): number {
  return d <= 0 ? 0 : Math.round((n / d) * 1000) / 10
}

function score(m: {
  active: number; creators: number; verified: number; evidencePct: number;
  resolutionPct: number; leaders: number; moderators: number
}): number {
  return Math.min(100,
    Math.min(25, m.active * 2)
    + Math.min(15, m.creators * 3)
    + Math.min(20, m.verified * 5)
    + Math.min(10, m.evidencePct / 10)
    + Math.min(10, m.resolutionPct / 10)
    + Math.min(10, m.leaders * 5)
    + Math.min(10, m.moderators * 10),
  )
}

/** One query for the whole national operations board; no per-city fan-out. */
export async function getNationalLaunchOperations(limit = 50) {
  const rows = await prisma.$queryRaw<OperationsRow[]>(Prisma.sql`
    WITH citizen_metrics AS (
      SELECT territory_code,
        COUNT(*) FILTER (WHERE is_active = TRUE AND last_active_at >= NOW() - INTERVAL '30 days') AS active_citizens_30d,
        COUNT(*) FILTER (WHERE is_active = TRUE AND public_civic_profile = TRUE
          AND civic_profile_type IN ('social_leader','organization_rep')) AS local_leaders
      FROM citizens WHERE territory_code IS NOT NULL GROUP BY territory_code
    ),
    creator_metrics AS (
      SELECT territory_code, COUNT(DISTINCT actor_id) AS creators_30d
      FROM civic_actions
      WHERE territory_code IS NOT NULL AND created_at >= NOW() - INTERVAL '30 days' AND status <> 'cancelled'
      GROUP BY territory_code
    ),
    action_metrics AS (
      SELECT a.territory_code,
        COUNT(*) FILTER (WHERE a.created_at >= NOW() - INTERVAL '90 days' AND a.status = 'verified') AS verified_actions_90d,
        COUNT(*) FILTER (WHERE a.created_at >= NOW() - INTERVAL '90 days' AND a.status <> 'cancelled') AS total_actions_90d,
        COUNT(*) FILTER (WHERE a.created_at >= NOW() - INTERVAL '90 days' AND a.status <> 'cancelled'
          AND EXISTS (SELECT 1 FROM civic_action_evidence e WHERE e.action_id = a.id AND e.review_status <> 'rejected')) AS evidence_backed_actions_90d
      FROM civic_actions a WHERE a.territory_code IS NOT NULL GROUP BY a.territory_code
    ),
    report_metrics AS (
      SELECT territory_code,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '90 days' AND status = 'resolved') AS resolved_reports_90d,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '90 days' AND status NOT IN ('rejected','duplicate')) AS total_reports_90d
      FROM territorial_reports WHERE territory_code IS NOT NULL GROUP BY territory_code
    ),
    moderation_metrics AS (
      SELECT c.territory_code, COUNT(DISTINCT c.id) AS moderation_capacity
      FROM citizens c JOIN citizen_role_grants g ON g.citizen_id = c.id
      WHERE c.territory_code IS NOT NULL AND c.is_active = TRUE
        AND g.role IN ('moderator','admin','superadmin') AND g.revoked_at IS NULL
      GROUP BY c.territory_code
    ),
    cohort_metrics AS (
      SELECT territory_code, COUNT(DISTINCT citizen_id) AS active_cohort_members
      FROM territory_launch_cohort_members WHERE status = 'active' GROUP BY territory_code
    )
    SELECT t.code, t.external_code, t.name, t.level, t.parent_code, t.activation_status,
      lp.operational_state, lp.target_active_citizens, lp.target_verified_actions,
      lp.target_local_leaders, lp.target_moderators,
      COALESCE(cm.active_citizens_30d,0) AS active_citizens_30d,
      COALESCE(cr.creators_30d,0) AS creators_30d,
      COALESCE(am.verified_actions_90d,0) AS verified_actions_90d,
      COALESCE(am.evidence_backed_actions_90d,0) AS evidence_backed_actions_90d,
      COALESCE(am.total_actions_90d,0) AS total_actions_90d,
      COALESCE(rm.resolved_reports_90d,0) AS resolved_reports_90d,
      COALESCE(rm.total_reports_90d,0) AS total_reports_90d,
      COALESCE(cm.local_leaders,0) AS local_leaders,
      COALESCE(mm.moderation_capacity,0) AS moderation_capacity,
      COALESCE(co.active_cohort_members,0) AS active_cohort_members
    FROM territories t
    LEFT JOIN territory_launch_plans lp ON lp.territory_code = t.code
    LEFT JOIN citizen_metrics cm ON cm.territory_code = t.code
    LEFT JOIN creator_metrics cr ON cr.territory_code = t.code
    LEFT JOIN action_metrics am ON am.territory_code = t.code
    LEFT JOIN report_metrics rm ON rm.territory_code = t.code
    LEFT JOIN moderation_metrics mm ON mm.territory_code = t.code
    LEFT JOIN cohort_metrics co ON co.territory_code = t.code
    WHERE t.level IN ('municipality','district')
  `)

  return rows.map((row) => {
    const active = Number(row.active_citizens_30d)
    const creators = Number(row.creators_30d)
    const verified = Number(row.verified_actions_90d)
    const evidenceBacked = Number(row.evidence_backed_actions_90d)
    const totalActions = Number(row.total_actions_90d)
    const resolved = Number(row.resolved_reports_90d)
    const totalReports = Number(row.total_reports_90d)
    const leaders = Number(row.local_leaders)
    const moderators = Number(row.moderation_capacity)
    const evidencePct = ratio(evidenceBacked, totalActions)
    const resolutionPct = ratio(resolved, totalReports)
    const readiness = score({ active, creators, verified, evidencePct, resolutionPct, leaders, moderators })
    const targets = {
      active_citizens: row.target_active_citizens ?? 10,
      verified_actions: row.target_verified_actions ?? 3,
      local_leaders: row.target_local_leaders ?? 2,
      moderators: row.target_moderators ?? 1,
    }
    const blockers: string[] = []
    if (moderators < targets.moderators) blockers.push('moderation_capacity')
    if (active < targets.active_citizens) blockers.push('active_citizens')
    if (verified < targets.verified_actions) blockers.push('verified_actions')
    if (leaders < targets.local_leaders) blockers.push('local_leaders')

    return {
      territory_code: row.code,
      external_code: row.external_code,
      name: row.name,
      level: row.level,
      department_code: row.parent_code,
      activation_status: row.activation_status,
      operational_state: row.operational_state ?? 'observing',
      readiness_score: readiness,
      launch_ready: blockers.length === 0 && readiness >= 60,
      blockers,
      metrics: {
        active_citizens_30d: active,
        creators_30d: creators,
        verified_actions_90d: verified,
        evidence_completion_pct: evidencePct,
        report_resolution_pct: resolutionPct,
        local_leaders: leaders,
        moderation_capacity: moderators,
        active_cohort_members: Number(row.active_cohort_members),
      },
      targets,
      scoring_boundary: 'civic_and_operational_only',
    }
  })
    .sort((a, b) => b.readiness_score - a.readiness_score || a.name.localeCompare(b.name, 'es'))
    .slice(0, Math.max(1, Math.min(limit, 100)))
}
