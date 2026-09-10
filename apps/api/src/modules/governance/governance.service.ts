import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { delCache } from '../../lib/cache'
import { enqueueJob } from '../../lib/jobs'
import { createNotification } from '../notifications/notifications.service'
import { getOperationalCivicIdentityProviders } from '../identity/identity-proofing-provider-config'
import type { Proposal, ProposalRow, ProposalScope, ProposalStatus } from './governance.types'
import type { AdvanceStageInput } from './governance.schema'

export {
  createProposal,
  listProposals,
  getProposalById,
  endorseProposal,
  castVote,
  getVoteTally,
  createDelegation,
  revokeDelegation,
  getMyDelegations,
  getGovernanceStats,
  adminAdvanceProposal,
  adminArchiveProposal,
  adminListProposals,
} from './governance.service.legacy'

const ENDORSEMENTS_REQUIRED = 10

const QUORUM_CONFIG: Record<ProposalScope, {
  quorum: number
  approval: number
  minHours: number
  maxHours: number
  defaultHours: number
}> = {
  neighborhood: { quorum: 0.15, approval: 0.40, minHours: 24,  maxHours: 72,  defaultHours: 48  },
  locality:     { quorum: 0.20, approval: 0.50, minHours: 48,  maxHours: 96,  defaultHours: 72  },
  city:         { quorum: 0.25, approval: 0.55, minHours: 72,  maxHours: 168, defaultHours: 120 },
  regional:     { quorum: 0.30, approval: 0.60, minHours: 120, maxHours: 240, defaultHours: 168 },
  national:     { quorum: 0.40, approval: 0.66, minHours: 120, maxHours: 240, defaultHours: 168 },
}

function makeError(message: string, statusCode: number, code: string): Error {
  return Object.assign(new Error(message), { statusCode, code })
}

function normalizeProposal(row: ProposalRow): Proposal {
  return {
    ...row,
    scope: row.scope as ProposalScope,
    status: row.status as ProposalStatus,
    endorsement_count: Number(row.endorsement_count),
    comment_count: Number(row.comment_count),
    view_count: Number(row.view_count),
    total_votes: Number(row.total_votes),
    approve_votes_weighted: Number(row.approve_votes_weighted),
    reject_votes_weighted: Number(row.reject_votes_weighted),
    abstain_votes_weighted: Number(row.abstain_votes_weighted),
    quorum_required: row.quorum_required !== null ? Number(row.quorum_required) : null,
    approval_threshold: row.approval_threshold !== null ? Number(row.approval_threshold) : null,
    eligible_voters: row.eligible_voters !== null ? Number(row.eligible_voters) : null,
    execution_deadline: row.execution_deadline instanceof Date
      ? row.execution_deadline.toISOString().split('T')[0]
      : row.execution_deadline,
  }
}

/**
 * Phase 7G.2 voter-roll admission contract.
 *
 * Identity and (for every subnational scope) residence are evaluated from
 * current proof ledgers only until debate -> voting. The exact proof IDs and
 * validity timestamps are then frozen into proposal_voter_roll. From that
 * instant the roll, not mutable account state, is the voting authority.
 */
async function freezeProofBackedVoterRoll(
  tx: Prisma.TransactionClient,
  proposalId: string,
  proposal: Proposal,
): Promise<number> {
  const operationalProviders = getOperationalCivicIdentityProviders()
  if (operationalProviders.length === 0) {
    throw makeError(
      'La infraestructura de identity assurance cívica no está operacional',
      503,
      'CIVIC_IDENTITY_ASSURANCE_UNAVAILABLE',
    )
  }

  const subnational = proposal.scope !== 'national'
  if (subnational && !proposal.territory_code) {
    throw makeError(
      'La propuesta subnacional no tiene un territorio inmutable asociado',
      409,
      'PROPOSAL_TERRITORY_UNAVAILABLE',
    )
  }

  const assuranceJoin = subnational
    ? Prisma.sql`
      JOIN territory_assurance_requests territory_assurance
        ON territory_assurance.id = c.territory_assurance_request_id
       AND territory_assurance.citizen_id = c.id
       AND territory_assurance.territory_code = c.territory_code
       AND territory_assurance.status = 'verified'
       AND territory_assurance.requested_level >= 1
       AND territory_assurance.verified_at IS NOT NULL
       AND territory_assurance.verified_at <= NOW()
       AND territory_assurance.expires_at IS NOT NULL
       AND territory_assurance.expires_at > NOW()
    `
    : Prisma.empty

  let scopePredicate: Prisma.Sql
  let reason: string

  switch (proposal.scope) {
    case 'neighborhood':
      scopePredicate = Prisma.sql`
        c.territory_code = ${proposal.territory_code}
        AND c.neighborhood = ${proposal.neighborhood}
        AND (${proposal.locality_id}::int IS NULL OR c.locality_id = ${proposal.locality_id})
      `
      reason = 'neighborhood_residence_verified'
      break
    case 'locality':
      scopePredicate = Prisma.sql`
        c.territory_code = ${proposal.territory_code}
        AND c.locality_id = ${proposal.locality_id}
      `
      reason = 'locality_residence_verified'
      break
    case 'city':
      scopePredicate = Prisma.sql`c.territory_code = ${proposal.territory_code}`
      reason = 'city_residence_verified'
      break
    case 'regional':
      scopePredicate = Prisma.sql`
        EXISTS (
          SELECT 1
          FROM territories proposal_territory
          JOIN territories citizen_territory ON citizen_territory.code = c.territory_code
          WHERE proposal_territory.code = ${proposal.territory_code}
            AND proposal_territory.parent_code IS NOT NULL
            AND citizen_territory.parent_code = proposal_territory.parent_code
        )
      `
      reason = 'regional_residence_verified'
      break
    case 'national':
    default:
      scopePredicate = Prisma.sql`TRUE`
      reason = 'national_identity_assured'
  }

  const territorialProjection = subnational
    ? Prisma.sql`
      territory_assurance.territory_code,
      territory_assurance.requested_level,
      territory_assurance.id,
      territory_assurance.verified_at,
      territory_assurance.expires_at
    `
    : Prisma.sql`
      c.territory_code,
      c.territory_assurance_level,
      NULL::uuid,
      NULL::timestamptz,
      NULL::timestamptz
    `

  const inserted = await tx.$queryRaw<Array<{ citizen_id: string }>>(Prisma.sql`
    INSERT INTO proposal_voter_roll (
      proposal_id,
      citizen_id,
      neighborhood,
      locality_id,
      verification_level,
      eligibility_reason,
      territory_code,
      territory_assurance_level,
      territory_assurance_request_id,
      territory_verified_at,
      territory_assurance_expires_at,
      identity_proof_id,
      identity_provider,
      identity_verified_at,
      identity_expires_at
    )
    SELECT
      ${proposalId}::uuid,
      c.id,
      c.neighborhood,
      c.locality_id,
      c.verification_level,
      ${reason},
      ${territorialProjection},
      identity_proof.id,
      identity_proof.provider,
      identity_proof.verified_at,
      identity_proof.expires_at
    FROM citizens c
    JOIN LATERAL (
      SELECT cip.id, cip.provider, cip.verified_at, cip.expires_at
      FROM civic_identity_proofs cip
      WHERE cip.citizen_id = c.id
        AND cip.provider IN (${Prisma.join(operationalProviders)})
        AND cip.status = 'verified'
        AND cip.assurance_level >= 2
        AND cip.verified_at IS NOT NULL
        AND cip.verified_at <= NOW()
        AND cip.revoked_at IS NULL
        AND (cip.expires_at IS NULL OR cip.expires_at > NOW())
      ORDER BY cip.assurance_level DESC, cip.verified_at DESC, cip.id
      LIMIT 1
    ) identity_proof ON TRUE
    ${assuranceJoin}
    WHERE c.verification_level >= 2
      AND ${scopePredicate}
    ON CONFLICT (proposal_id, citizen_id) DO NOTHING
    RETURNING citizen_id
  `)

  return inserted.length
}

function computeVotingResult(proposal: Proposal): 'approved' | 'rejected' | 'quorum_failed' {
  const cfg = QUORUM_CONFIG[proposal.scope]
  const eligibleVoters = proposal.eligible_voters ?? 0

  if (eligibleVoters === 0) return 'quorum_failed'

  const participationRate = proposal.total_votes / eligibleVoters
  if (participationRate < cfg.quorum) return 'quorum_failed'

  const totalWeighted =
    proposal.approve_votes_weighted +
    proposal.reject_votes_weighted +
    proposal.abstain_votes_weighted

  const approvalRate = totalWeighted > 0
    ? proposal.approve_votes_weighted / totalWeighted
    : 0

  return approvalRate >= cfg.approval ? 'approved' : 'rejected'
}

/**
 * Canonical proposal lifecycle. P0.3 changed the debate→voting electorate
 * source; P0.4 requires operational identity proofing; Phase 7G.2 adds current
 * territorial assurance for subnational admission and freezes both proof chains.
 */
export async function advanceProposalStage(
  proposalId: string,
  citizenId: string,
  options: AdvanceStageInput = {},
): Promise<Proposal> {
  const rows = await prisma.$queryRaw<ProposalRow[]>(Prisma.sql`
    SELECT * FROM proposals WHERE id = ${proposalId}::uuid
  `)

  if (rows.length === 0) {
    throw makeError('Propuesta no encontrada', 404, 'PROPOSAL_NOT_FOUND')
  }

  const proposal = normalizeProposal(rows[0])
  const isVotingFinalization = proposal.status === 'voting' &&
    proposal.voting_ends_at !== null &&
    new Date() >= proposal.voting_ends_at

  if (!isVotingFinalization && proposal.author_id !== citizenId) {
    throw makeError('Solo el autor puede avanzar la propuesta', 403, 'NOT_AUTHOR')
  }

  let updatedRows: ProposalRow[]

  switch (proposal.status) {
    case 'idea': {
      if (proposal.endorsement_count < ENDORSEMENTS_REQUIRED) {
        throw makeError(
          `Se requieren al menos ${ENDORSEMENTS_REQUIRED} avales para avanzar`,
          400,
          'INSUFFICIENT_ENDORSEMENTS',
        )
      }
      updatedRows = await prisma.$queryRaw<ProposalRow[]>(Prisma.sql`
        UPDATE proposals SET status = 'draft', draft_started_at = NOW()
        WHERE id = ${proposalId}::uuid RETURNING *
      `)
      break
    }

    case 'draft': {
      updatedRows = await prisma.$queryRaw<ProposalRow[]>(Prisma.sql`
        UPDATE proposals SET status = 'debate', debate_started_at = NOW()
        WHERE id = ${proposalId}::uuid RETURNING *
      `)
      break
    }

    case 'debate': {
      const cfg = QUORUM_CONFIG[proposal.scope]
      const durationHours = options.voting_duration_hours ?? cfg.defaultHours
      const clampedHours = Math.max(cfg.minHours, Math.min(cfg.maxHours, durationHours))
      const votingEndsAt = new Date(Date.now() + clampedHours * 3600 * 1000)

      updatedRows = await prisma.$transaction(async (tx) => {
        const eligibleVoters = await freezeProofBackedVoterRoll(tx, proposalId, proposal)
        return tx.$queryRaw<ProposalRow[]>(Prisma.sql`
          UPDATE proposals
          SET status = 'voting',
              voting_starts_at = NOW(),
              voting_ends_at = ${votingEndsAt},
              quorum_required = ${cfg.quorum},
              approval_threshold = ${cfg.approval},
              eligible_voters = ${eligibleVoters}
          WHERE id = ${proposalId}::uuid
            AND status = 'debate'
          RETURNING *
        `)
      })

      if (updatedRows.length === 0) {
        const current = await prisma.$queryRaw<ProposalRow[]>(Prisma.sql`
          SELECT * FROM proposals WHERE id = ${proposalId}::uuid
        `)
        if (current.length === 0) {
          throw makeError('Propuesta no encontrada', 404, 'PROPOSAL_NOT_FOUND')
        }
        return normalizeProposal(current[0])
      }
      break
    }

    case 'voting': {
      if (!isVotingFinalization) {
        throw makeError('La votación aún está activa', 400, 'VOTING_STILL_ACTIVE')
      }

      const result = computeVotingResult(proposal)
      const closed = await prisma.$transaction(async (tx) => {
        const closedRows = await tx.$queryRaw<ProposalRow[]>(Prisma.sql`
          UPDATE proposals
          SET status = ${result}, decided_at = NOW()
          WHERE id = ${proposalId}::uuid AND status = 'voting'
          RETURNING *
        `)
        if (closedRows.length === 0) return null

        await enqueueJob('record_voting_result', {
          proposalId: proposal.id,
          title: proposal.title,
          description: proposal.description,
          totalVotes: proposal.total_votes,
          approveWeighted: proposal.approve_votes_weighted,
          rejectWeighted: proposal.reject_votes_weighted,
          abstainWeighted: proposal.abstain_votes_weighted,
          result,
          ipfsResultUri: proposal.ipfs_result_uri,
        }, tx)

        return closedRows
      })

      if (closed === null) {
        const current = await prisma.$queryRaw<ProposalRow[]>(Prisma.sql`
          SELECT * FROM proposals WHERE id = ${proposalId}::uuid
        `)
        if (current.length === 0) {
          throw makeError('Propuesta no encontrada', 404, 'PROPOSAL_NOT_FOUND')
        }
        return normalizeProposal(current[0])
      }

      updatedRows = closed
      break
    }

    default:
      throw makeError(`Estado '${proposal.status}' no permite avance manual`, 400, 'TERMINAL_STATUS')
  }

  await delCache('proposal', proposalId)
  await delCache('stats', 'global')

  const advanced = normalizeProposal(updatedRows[0])
  const STAGE_LABEL: Record<string, string> = {
    draft: 'Borrador',
    debate: 'En debate',
    voting: 'En votación',
    approved: 'Aprobada',
    rejected: 'Rechazada',
    quorum_failed: 'Sin quórum',
  }

  if (advanced.author_id && STAGE_LABEL[advanced.status]) {
    createNotification(
      advanced.author_id,
      'proposal_stage',
      `Propuesta avanzó a: ${STAGE_LABEL[advanced.status]}`,
      `"${advanced.title}" cambió de etapa a ${STAGE_LABEL[advanced.status]}.`,
      `/dashboard/governance/${advanced.id}`,
    ).catch(() => null)
  }

  return advanced
}
