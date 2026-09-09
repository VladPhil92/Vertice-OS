import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { getTerritoryFeed } from './territories.feed'
import { getActivationMetrics, getTerritory } from './territories.service'

interface PublicLaunchRow {
  operational_state: 'observing' | 'recruiting' | 'launch_ready' | 'launched' | 'paused'
  active_cohort_members: bigint
  pending_interest_count: bigint
}

/**
 * Public projection for a municipal/district node.
 *
 * This deliberately excludes internal blockers, moderation capacity, operator
 * notes, audit actors and target thresholds. The public surface communicates
 * community maturity without leaking the operations control plane.
 */
export async function getPublicCityOverview(territoryCode: string, feedLimit = 8) {
  const territory = await getTerritory(territoryCode)
  if (!['municipality', 'district'].includes(territory.level)) {
    throw Object.assign(new Error('La experiencia pública opera a nivel municipal/distrital'), {
      statusCode: 400,
      code: 'PUBLIC_CITY_LEVEL_UNSUPPORTED',
    })
  }

  const [activation, feed, launchRows] = await Promise.all([
    getActivationMetrics(territoryCode),
    getTerritoryFeed(territoryCode, Math.max(1, Math.min(feedLimit, 12))),
    prisma.$queryRaw<PublicLaunchRow[]>(Prisma.sql`
      SELECT
        COALESCE(lp.operational_state, 'observing')::text AS operational_state,
        (SELECT COUNT(DISTINCT m.citizen_id)
         FROM territory_launch_cohort_members m
         WHERE m.territory_code = ${territoryCode} AND m.status = 'active') AS active_cohort_members,
        (SELECT COUNT(*)
         FROM territory_activation_interests i
         WHERE i.territory_code = ${territoryCode} AND i.status = 'pending') AS pending_interest_count
      FROM territories t
      LEFT JOIN territory_launch_plans lp ON lp.territory_code = t.code
      WHERE t.code = ${territoryCode}
    `),
  ])

  const launch = launchRows[0] ?? {
    operational_state: 'observing' as const,
    active_cohort_members: 0n,
    pending_interest_count: 0n,
  }

  const acceptingInterest = launch.operational_state !== 'paused'

  return {
    territory,
    activation: {
      momentum_score: activation.momentum_score,
      activation_status: territory.activation_status,
      registered_citizens: activation.registered_citizens,
      active_citizens_30d: activation.active_citizens_30d,
      civic_actions_30d: activation.civic_actions_30d,
      verified_actions_90d: activation.verified_actions_90d,
      reports_30d: activation.reports_30d,
      proposals_30d: activation.proposals_30d,
    },
    launch: {
      operational_state: launch.operational_state,
      active_cohort_members: Number(launch.active_cohort_members),
      pending_interest_count: Number(launch.pending_interest_count),
      accepting_interest: acceptingInterest,
    },
    feed,
    authority_boundary: 'public_discovery_only',
    interest_boundary: 'voluntary_interest_grants_no_authority',
    excluded_signals: ['payments', 'donations', 'payouts', 'subscription', 'kyc_kyb', 'ideology'],
  }
}
