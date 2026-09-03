import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { delCache } from '../../lib/cache'
import { enqueueJob } from '../../lib/jobs'
import { createNotification } from '../notifications/notifications.service'
import { advanceProposalStage } from './governance.service'
import type { AdvanceStageInput } from './governance.schema'
import type { Proposal, ProposalRow, ProposalStatus } from './governance.types'

function makeError(message: string, statusCode: number, code: string): Error {
  return Object.assign(new Error(message), { statusCode, code })
}

function normalizeProposal(row: ProposalRow): Proposal {
  return {
    ...row,
    scope: row.scope as Proposal['scope'],
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

function frozenVotingResult(proposal: Proposal): 'approved' | 'rejected' | 'quorum_failed' {
  const eligibleVoters = proposal.eligible_voters ?? 0
  const quorumRequired = proposal.quorum_required
  const approvalThreshold = proposal.approval_threshold

  if (eligibleVoters <= 0 || quorumRequired === null || approvalThreshold === null) {
    return 'quorum_failed'
  }

  const participationRate = proposal.total_votes / eligibleVoters
  if (participationRate < quorumRequired) return 'quorum_failed'

  const totalWeighted =
    proposal.approve_votes_weighted +
    proposal.reject_votes_weighted +
    proposal.abstain_votes_weighted

  const approvalRate = totalWeighted > 0
    ? proposal.approve_votes_weighted / totalWeighted
    : 0

  return approvalRate >= approvalThreshold ? 'approved' : 'rejected'
}

/**
 * Finalize an expired vote from the election contract that was frozen when the
 * proposal entered `voting`. Runtime QUORUM_CONFIG changes must never rewrite
 * the rules of an already-open consultation.
 *
 * The proposal row is locked for the whole close + durable job enqueue so only
 * one caller can produce the transition and its blockchain-result job.
 */
async function finalizeFrozenVote(proposalId: string): Promise<Proposal> {
  const result = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<ProposalRow[]>(Prisma.sql`
      SELECT *
      FROM proposals
      WHERE id = ${proposalId}::uuid
      FOR UPDATE
    `)

    if (rows.length === 0) {
      throw makeError('Propuesta no encontrada', 404, 'PROPOSAL_NOT_FOUND')
    }

    const proposal = normalizeProposal(rows[0])
    if (proposal.status !== 'voting') {
      return { proposal, changed: false }
    }

    if (!proposal.voting_ends_at || new Date() < proposal.voting_ends_at) {
      throw makeError('La votación aún está activa', 400, 'VOTING_STILL_ACTIVE')
    }

    const status = frozenVotingResult(proposal)
    const closedRows = await tx.$queryRaw<ProposalRow[]>(Prisma.sql`
      UPDATE proposals
      SET status = ${status}, decided_at = NOW()
      WHERE id = ${proposalId}::uuid
        AND status = 'voting'
      RETURNING *
    `)

    if (closedRows.length === 0) {
      const currentRows = await tx.$queryRaw<ProposalRow[]>(Prisma.sql`
        SELECT * FROM proposals WHERE id = ${proposalId}::uuid
      `)
      return { proposal: normalizeProposal(currentRows[0]), changed: false }
    }

    await enqueueJob('record_voting_result', {
      proposalId: proposal.id,
      title: proposal.title,
      description: proposal.description,
      totalVotes: proposal.total_votes,
      approveWeighted: proposal.approve_votes_weighted,
      rejectWeighted: proposal.reject_votes_weighted,
      abstainWeighted: proposal.abstain_votes_weighted,
      result: status,
      ipfsResultUri: proposal.ipfs_result_uri,
    }, tx)

    return { proposal: normalizeProposal(closedRows[0]), changed: true }
  })

  await delCache('proposal', proposalId)
  await delCache('stats', 'global')

  if (result.changed && result.proposal.author_id) {
    const label: Record<string, string> = {
      approved: 'Aprobada',
      rejected: 'Rechazada',
      quorum_failed: 'Sin quórum',
    }
    const stageLabel = label[result.proposal.status]
    if (stageLabel) {
      createNotification(
        result.proposal.author_id,
        'proposal_stage',
        `Propuesta avanzó a: ${stageLabel}`,
        `"${result.proposal.title}" cambió de etapa a ${stageLabel}.`,
        `/dashboard/governance/${result.proposal.id}`,
      ).catch(() => null)
    }
  }

  return result.proposal
}

/**
 * Canonical lifecycle entrypoint used by both citizens and administrative
 * moderation. Pre-vote stages continue through the existing transition engine;
 * expired votes use the frozen election contract above.
 */
export async function advanceProposalStageSafely(
  proposalId: string,
  citizenId: string,
  options: AdvanceStageInput = {},
): Promise<Proposal> {
  const rows = await prisma.$queryRaw<Array<{ status: string }>>(Prisma.sql`
    SELECT status FROM proposals WHERE id = ${proposalId}::uuid
  `)

  if (rows.length === 0) {
    throw makeError('Propuesta no encontrada', 404, 'PROPOSAL_NOT_FOUND')
  }

  if (rows[0].status === 'voting') {
    return finalizeFrozenVote(proposalId)
  }

  return advanceProposalStage(proposalId, citizenId, options)
}
