import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { recordAuditEvent } from '../../lib/audit'
import { advanceProposalStageSafely } from './governance.lifecycle'
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

/**
 * Administrative lifecycle changes reuse the same canonical entrypoint as
 * citizen-authored proposals. Moderation authority may initiate the command,
 * but it cannot bypass endorsements, frozen voter-roll construction, frozen
 * quorum/approval thresholds or voting-window finalization.
 */
export async function adminAdvanceProposalSafely(
  proposalId: string,
  actorId: string,
): Promise<Proposal> {
  const rows = await prisma.$queryRaw<ProposalRow[]>(Prisma.sql`
    SELECT *
    FROM proposals
    WHERE id = ${proposalId}::uuid
  `)

  if (rows.length === 0) {
    await recordAuditEvent({
      actorId,
      action: 'admin_advance_proposal',
      targetType: 'proposal',
      targetId: proposalId,
      result: 'not_found',
    })
    throw makeError('Propuesta no encontrada', 404, 'PROPOSAL_NOT_FOUND')
  }

  const proposal = normalizeProposal(rows[0])
  const isFrozenVoteFinalization = proposal.status === 'voting'

  // Pre-vote stages still use the author as the lifecycle principal expected
  // by the canonical proposal service. A vote that already opened no longer
  // depends on the continued existence of the author account: its electorate,
  // thresholds and window are frozen and can be finalized independently.
  if (!isFrozenVoteFinalization && !proposal.author_id) {
    await recordAuditEvent({
      actorId,
      action: 'admin_advance_proposal',
      targetType: 'proposal',
      targetId: proposalId,
      result: 'rejected',
      reason: 'proposal has no author; pre-vote canonical lifecycle cannot be impersonated safely',
      metadata: { from: proposal.status },
    })
    throw makeError(
      'La propuesta no tiene autor y no puede avanzar por una ruta que preserve las invariantes cívicas',
      409,
      'AUTHOR_REQUIRED_FOR_CANONICAL_TRANSITION',
    )
  }

  const lifecyclePrincipal = proposal.author_id ?? actorId

  try {
    const advanced = await advanceProposalStageSafely(proposalId, lifecyclePrincipal, {})

    await recordAuditEvent({
      actorId,
      action: 'admin_advance_proposal',
      targetType: 'proposal',
      targetId: proposalId,
      result: 'success',
      metadata: {
        from: proposal.status,
        to: advanced.status,
        lifecycle_principal: isFrozenVoteFinalization ? null : proposal.author_id,
        canonical_transition: true,
        frozen_result_contract: isFrozenVoteFinalization,
      },
    })

    return advanced
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : ''

    await recordAuditEvent({
      actorId,
      action: 'admin_advance_proposal',
      targetType: 'proposal',
      targetId: proposalId,
      result: 'rejected',
      reason: code || (error instanceof Error ? error.message : 'canonical transition rejected'),
      metadata: { from: proposal.status, canonical_transition: true },
    })

    throw error
  }
}
