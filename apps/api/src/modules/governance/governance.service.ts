import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { config } from '../../config'
import { delCache } from '../../lib/cache'
import { createNotification } from '../notifications/notifications.service'
import * as legacy from './governance.service.legacy'
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
 * P0.3 voter-roll convergence.
 *
 * The frozen electorate is derived from the exact same durable proof ledger
 * used by /identity/assurance. ExternalIdentity remains federation/account
 * linkage only and can no longer create governance eligibility.
 */
async function freezeProofBackedVoterRoll(
  tx: Prisma.TransactionClient,
  proposalId: string,
  proposal: Proposal,
): Promise<number> {
  const trustedProviders = config.CIVIC_IDENTITY_ASSURANCE_PROVIDERS
  if (trustedProviders.length === 0) return 0

  const assuredIdentity = Prisma.sql`
    c.verification_level >= 2
    AND EXISTS (
      SELECT 1
      FROM civic_identity_proofs cip
      WHERE cip.citizen_id = c.id
        AND cip.provider IN (${Prisma.join(trustedProviders)})
        AND cip.status = 'verified'
        AND cip.assurance_level >= 2
        AND cip.verified_at IS NOT NULL
        AND cip.verified_at <= NOW()
        AND cip.revoked_at IS NULL
        AND (cip.expires_at IS NULL OR cip.expires_at > NOW())
    )
  `

  let whereClause: Prisma.Sql
  let reason: string

  switch (proposal.scope) {
    case 'neighborhood':
      whereClause = Prisma.sql`WHERE ${assuredIdentity} AND c.neighborhood = ${proposal.neighborhood}`
      reason = 'neighborhood_match'
      break
    case 'locality':
      whereClause = Prisma.sql`WHERE ${assuredIdentity} AND c.locality_id = ${proposal.locality_id}`
      reason = 'locality_match'
      break
    case 'city':
    case 'regional':
    case 'national':
    default:
      whereClause = Prisma.sql`WHERE ${assuredIdentity}`
      reason = 'citywide'
  }

  const inserted = await tx.$queryRaw<Array<{ citizen_id: string }>>(Prisma.sql`
    INSERT INTO proposal_voter_roll
      (proposal_id, citizen_id, neighborhood, locality_id, verification_level, eligibility_reason)
    SELECT ${proposalId}::uuid, c.id, c.neighborhood, c.locality_id, c.verification_level, ${reason}
    FROM citizens c
    ${whereClause}
    ON CONFLICT (proposal_id, citizen_id) DO NOTHING
    RETURNING citizen_id
  `)

  return inserted.length
}

/**
 * Compatibility facade: all governance behavior except debate→voting is
 * delegated unchanged to the certified legacy implementation. The single
 * intercepted transition freezes the electorate from civic_identity_proofs.
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

  if (proposal.status !== 'debate') {
    return legacy.advanceProposalStage(proposalId, citizenId, options)
  }

  if (proposal.author_id !== citizenId) {
    throw makeError('Solo el autor puede avanzar la propuesta', 403, 'NOT_AUTHOR')
  }

  const cfg = QUORUM_CONFIG[proposal.scope]
  const durationHours = options.voting_duration_hours ?? cfg.defaultHours
  const clampedHours = Math.max(cfg.minHours, Math.min(cfg.maxHours, durationHours))
  const votingEndsAt = new Date(Date.now() + clampedHours * 3600 * 1000)

  const updatedRows = await prisma.$transaction(async (tx) => {
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

  await delCache('proposal', proposalId)
  await delCache('stats', 'global')

  const advanced = normalizeProposal(updatedRows[0])
  createNotification(
    advanced.author_id,
    'proposal_stage',
    'Propuesta avanzó a: En votación',
    `"${advanced.title}" cambió de etapa a En votación.`,
    `/dashboard/governance/${advanced.id}`,
  ).catch(() => null)

  return advanced
}
