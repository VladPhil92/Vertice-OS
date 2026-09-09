import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import type { ActivationStatus, TerritoryRow } from './territories.service'

interface RankingRow extends TerritoryRow {
  registered_citizens: bigint
  active_citizens_30d: bigint
  civic_actions_30d: bigint
  verified_actions_90d: bigint
  reports_30d: bigint
  proposals_30d: bigint
}

function recommendedStatus(score: number): ActivationStatus {
  if (score >= 85) return 'verified_network'
  if (score >= 65) return 'pilot_ready'
  if (score >= 40) return 'community_active'
  if (score >= 20) return 'emerging'
  return 'available'
}

function score(row: RankingRow): number {
  return Math.min(100,
    Math.min(25, Number(row.registered_citizens) * 2)
    + Math.min(20, Number(row.active_citizens_30d) * 3)
    + Math.min(20, Number(row.civic_actions_30d) * 4)
    + Math.min(15, Number(row.verified_actions_90d) * 5)
    + Math.min(10, Number(row.reports_30d) * 2)
    + Math.min(10, Number(row.proposals_30d) * 2),
  )
}

/**
 * National ranking is intentionally one set-based query. The first Phase 7A
 * draft evaluated each municipality with six follow-up queries, which would
 * become an N+1 operational failure after the full DIVIPOLA catalog sync.
 */
export async function getNationalActivationRanking(limit = 25) {
  const rows = await prisma.$queryRaw<RankingRow[]>(Prisma.sql`
    WITH citizen_metrics AS (
      SELECT territory_code,
             COUNT(*) AS registered_citizens,
             COUNT(*) FILTER (WHERE is_active = TRUE AND last_active_at >= NOW() - INTERVAL '30 days') AS active_citizens_30d
      FROM citizens WHERE territory_code IS NOT NULL GROUP BY territory_code
    ),
    action_metrics AS (
      SELECT territory_code,
             COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days' AND status <> 'cancelled') AS civic_actions_30d,
             COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '90 days' AND status = 'verified') AS verified_actions_90d
      FROM civic_actions WHERE territory_code IS NOT NULL GROUP BY territory_code
    ),
    report_metrics AS (
      SELECT territory_code,
             COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS reports_30d
      FROM territorial_reports WHERE territory_code IS NOT NULL GROUP BY territory_code
    ),
    proposal_metrics AS (
      SELECT territory_code,
             COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days' AND status <> 'archived') AS proposals_30d
      FROM proposals WHERE territory_code IS NOT NULL GROUP BY territory_code
    )
    SELECT t.code, t.external_code, t.name, t.level, t.parent_code, t.country_code,
           t.slug, t.activation_status, t.source, t.source_version, t.activated_at,
           COALESCE(c.registered_citizens, 0) AS registered_citizens,
           COALESCE(c.active_citizens_30d, 0) AS active_citizens_30d,
           COALESCE(a.civic_actions_30d, 0) AS civic_actions_30d,
           COALESCE(a.verified_actions_90d, 0) AS verified_actions_90d,
           COALESCE(r.reports_30d, 0) AS reports_30d,
           COALESCE(p.proposals_30d, 0) AS proposals_30d
    FROM territories t
    LEFT JOIN citizen_metrics c ON c.territory_code = t.code
    LEFT JOIN action_metrics a ON a.territory_code = t.code
    LEFT JOIN report_metrics r ON r.territory_code = t.code
    LEFT JOIN proposal_metrics p ON p.territory_code = t.code
    WHERE t.level IN ('municipality','district')
  `)

  return rows.map((row) => {
    const momentumScore = score(row)
    return {
      code: row.code,
      external_code: row.external_code,
      name: row.name,
      level: row.level,
      parent_code: row.parent_code,
      country_code: row.country_code,
      slug: row.slug,
      activation_status: row.activation_status,
      source: row.source,
      source_version: row.source_version,
      activated_at: row.activated_at,
      territory_code: row.code,
      registered_citizens: Number(row.registered_citizens),
      active_citizens_30d: Number(row.active_citizens_30d),
      civic_actions_30d: Number(row.civic_actions_30d),
      verified_actions_90d: Number(row.verified_actions_90d),
      reports_30d: Number(row.reports_30d),
      proposals_30d: Number(row.proposals_30d),
      momentum_score: momentumScore,
      recommended_status: recommendedStatus(momentumScore),
    }
  })
    .sort((a, b) => b.momentum_score - a.momentum_score || a.name.localeCompare(b.name, 'es'))
    .slice(0, Math.max(1, Math.min(limit, 100)))
}
