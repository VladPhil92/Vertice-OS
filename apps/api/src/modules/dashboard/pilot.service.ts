import { prisma } from '../../lib/prisma'

interface PilotOverviewRow {
  active_citizens: bigint | number
  registered_7d: bigint | number
  active_7d: bigint | number
  verified_citizens: bigint | number
  federated_citizens: bigint | number
  public_profiles: bigint | number
  reports_7d: bigint | number
  proposals_7d: bigint | number
  endorsements_7d: bigint | number
  validations_7d: bigint | number
  follows_7d: bigint | number
  meaningful_participants_7d: bigint | number
  reports_open: bigint | number
  reports_in_progress: bigint | number
  reports_resolved: bigint | number
  proposals_debate: bigint | number
  proposals_voting: bigint | number
  corroborations_7d: bigint | number
  disputes_7d: bigint | number
  privileged_users: bigint | number
}

interface NeighborhoodRow {
  neighborhood: string
  citizen_count: bigint | number
}

const WINDOW_DAYS = 7
const PRIVACY_MIN_GROUP_SIZE = 3

function asNumber(value: bigint | number | undefined): number {
  return Number(value ?? 0)
}

function percentage(part: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((part / total) * 1000) / 10
}

/**
 * Aggregated operating view for a controlled VÉRTICE pilot.
 *
 * Privacy contract:
 * - no email, DID, wallet address, document hash, IP or citizen UUID is returned;
 * - neighborhood cohorts smaller than PRIVACY_MIN_GROUP_SIZE are suppressed;
 * - anonymous votes are intentionally not reverse-attributed to citizens;
 * - social popularity is reported as product activity only and never as reputation.
 */
export async function getPilotControlCenter() {
  const [overviewRows, neighborhoodRows] = await Promise.all([
    prisma.$queryRaw<PilotOverviewRow[]>`
      WITH meaningful_participants AS (
        SELECT citizen_id
        FROM territorial_reports
        WHERE citizen_id IS NOT NULL
          AND created_at >= NOW() - INTERVAL '7 days'
        UNION
        SELECT author_id AS citizen_id
        FROM proposals
        WHERE author_id IS NOT NULL
          AND created_at >= NOW() - INTERVAL '7 days'
        UNION
        SELECT citizen_id
        FROM proposal_endorsements
        WHERE created_at >= NOW() - INTERVAL '7 days'
        UNION
        SELECT citizen_id
        FROM civic_activity_validations
        WHERE created_at >= NOW() - INTERVAL '7 days'
        UNION
        SELECT follower_id AS citizen_id
        FROM civic_profile_follows
        WHERE created_at >= NOW() - INTERVAL '7 days'
      )
      SELECT
        (SELECT COUNT(*) FROM citizens WHERE is_active = TRUE) AS active_citizens,
        (SELECT COUNT(*) FROM citizens WHERE created_at >= NOW() - INTERVAL '7 days') AS registered_7d,
        (SELECT COUNT(*) FROM citizens WHERE is_active = TRUE AND last_active_at >= NOW() - INTERVAL '7 days') AS active_7d,
        (SELECT COUNT(*) FROM citizens WHERE is_active = TRUE AND verification_level >= 1) AS verified_citizens,
        (SELECT COUNT(DISTINCT citizen_id) FROM external_identities) AS federated_citizens,
        (SELECT COUNT(*) FROM citizens WHERE is_active = TRUE AND public_civic_profile = TRUE) AS public_profiles,
        (SELECT COUNT(*) FROM territorial_reports WHERE created_at >= NOW() - INTERVAL '7 days') AS reports_7d,
        (SELECT COUNT(*) FROM proposals WHERE created_at >= NOW() - INTERVAL '7 days') AS proposals_7d,
        (SELECT COUNT(*) FROM proposal_endorsements WHERE created_at >= NOW() - INTERVAL '7 days') AS endorsements_7d,
        (SELECT COUNT(*) FROM civic_activity_validations WHERE created_at >= NOW() - INTERVAL '7 days') AS validations_7d,
        (SELECT COUNT(*) FROM civic_profile_follows WHERE created_at >= NOW() - INTERVAL '7 days') AS follows_7d,
        (SELECT COUNT(*) FROM meaningful_participants) AS meaningful_participants_7d,
        (SELECT COUNT(*) FROM territorial_reports WHERE status = 'open') AS reports_open,
        (SELECT COUNT(*) FROM territorial_reports WHERE status = 'in_progress') AS reports_in_progress,
        (SELECT COUNT(*) FROM territorial_reports WHERE status = 'resolved') AS reports_resolved,
        (SELECT COUNT(*) FROM proposals WHERE status = 'debate') AS proposals_debate,
        (SELECT COUNT(*) FROM proposals WHERE status = 'voting') AS proposals_voting,
        (SELECT COUNT(*) FROM civic_activity_validations WHERE stance = 'corroborate' AND created_at >= NOW() - INTERVAL '7 days') AS corroborations_7d,
        (SELECT COUNT(*) FROM civic_activity_validations WHERE stance = 'dispute' AND created_at >= NOW() - INTERVAL '7 days') AS disputes_7d,
        (
          SELECT COUNT(DISTINCT citizen_id)
          FROM citizen_role_grants
          WHERE revoked_at IS NULL
            AND role IN ('moderator', 'admin', 'superadmin')
        ) AS privileged_users
    `,
    prisma.$queryRaw<NeighborhoodRow[]>`
      SELECT
        COALESCE(NULLIF(TRIM(neighborhood), ''), 'Sin barrio') AS neighborhood,
        COUNT(*) AS citizen_count
      FROM citizens
      WHERE is_active = TRUE
      GROUP BY COALESCE(NULLIF(TRIM(neighborhood), ''), 'Sin barrio')
      HAVING COUNT(*) >= 3
      ORDER BY citizen_count DESC, neighborhood ASC
      LIMIT 8
    `,
  ])

  const row = overviewRows[0]
  const cohort = {
    active_citizens: asNumber(row?.active_citizens),
    registered_7d: asNumber(row?.registered_7d),
    active_7d: asNumber(row?.active_7d),
    verified_citizens: asNumber(row?.verified_citizens),
    federated_citizens: asNumber(row?.federated_citizens),
    public_profiles: asNumber(row?.public_profiles),
  }

  const meaningfulParticipants = asNumber(row?.meaningful_participants_7d)

  return {
    window_days: WINDOW_DAYS,
    cohort: {
      ...cohort,
      verification_rate_pct: percentage(cohort.verified_citizens, cohort.active_citizens),
      federation_rate_pct: percentage(cohort.federated_citizens, cohort.active_citizens),
      weekly_active_rate_pct: percentage(cohort.active_7d, cohort.active_citizens),
      meaningful_participation_rate_pct: percentage(meaningfulParticipants, cohort.active_citizens),
    },
    participation: {
      meaningful_participants_7d: meaningfulParticipants,
      reports_7d: asNumber(row?.reports_7d),
      proposals_7d: asNumber(row?.proposals_7d),
      endorsements_7d: asNumber(row?.endorsements_7d),
      validations_7d: asNumber(row?.validations_7d),
      follows_7d: asNumber(row?.follows_7d),
      attribution_note: 'Los votos permanecen anónimos y no se reatribuyen a identidades para calcular participación.',
    },
    operations: {
      reports: {
        open: asNumber(row?.reports_open),
        in_progress: asNumber(row?.reports_in_progress),
        resolved: asNumber(row?.reports_resolved),
      },
      proposals: {
        debate: asNumber(row?.proposals_debate),
        voting: asNumber(row?.proposals_voting),
      },
      evidence: {
        corroborations_7d: asNumber(row?.corroborations_7d),
        disputes_7d: asNumber(row?.disputes_7d),
      },
      privileged_users: asNumber(row?.privileged_users),
    },
    geography: {
      privacy_min_group_size: PRIVACY_MIN_GROUP_SIZE,
      top_neighborhoods: neighborhoodRows.map((item) => ({
        neighborhood: item.neighborhood,
        citizen_count: asNumber(item.citizen_count),
      })),
      privacy_note: 'No se muestran cohortes territoriales con menos de 3 ciudadanos activos.',
    },
    score_policy: {
      social_popularity_affects_reputation: false,
      community_validation_affects_reputation: false,
      note: 'Seguimientos y corroboraciones son señales operativas; no alteran VÉRTICE Score.',
    },
    generated_at: new Date().toISOString(),
  }
}
