import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { delCache } from '../../lib/cache'
import { recordAuditEvent } from '../../lib/audit'
import type { Proposal, ProposalRow, ProposalStatus } from './governance.types'

const ARCHIVABLE_STATUSES = new Set<ProposalStatus>(['idea', 'draft', 'debate'])

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
 * Moderation may archive a proposal only before a civic vote has opened.
 * Once voting_starts_at exists, the consultation is part of the immutable
 * decision record and cannot be hidden by changing its status to `archived`.
 *
 * Successful archival and its admin audit row are committed in the same DB
 * transaction, so a state-changing moderation command cannot succeed without
 * leaving durable actor/reason evidence.
 */
export async function adminArchiveProposalSafely(
  proposalId: string,
  actorId: string,
  reason: string,
): Promise<Proposal> {
  const result = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{
      id: string
      status: string
      voting_starts_at: Date | null
    }>>(Prisma.sql`
      SELECT id, status, voting_starts_at
      FROM proposals
      WHERE id = ${proposalId}::uuid
      FOR UPDATE
    `)

    if (rows.length === 0) return { kind: 'not_found' as const }

    const current = rows[0]
    const status = current.status as ProposalStatus
    if (current.voting_starts_at !== null || !ARCHIVABLE_STATUSES.has(status)) {
      return { kind: 'rejected' as const, status }
    }

    const updated = await tx.$queryRaw<ProposalRow[]>(Prisma.sql`
      UPDATE proposals
      SET status = 'archived'
      WHERE id = ${proposalId}::uuid
        AND voting_starts_at IS NULL
        AND status IN ('idea', 'draft', 'debate')
      RETURNING *
    `)

    if (updated.length === 0) {
      return { kind: 'rejected' as const, status }
    }

    await tx.$queryRaw(Prisma.sql`
      INSERT INTO admin_audit_log (
        actor_id, action, target_type, target_id, result, reason, metadata
      )
      VALUES (
        ${actorId}::uuid,
        'admin_archive_proposal',
        'proposal',
        ${proposalId},
        'success',
        ${reason},
        ${JSON.stringify({ from: status, to: 'archived', durable: true })}::jsonb
      )
    `)

    return { kind: 'success' as const, proposal: normalizeProposal(updated[0]) }
  })

  if (result.kind === 'not_found') {
    await recordAuditEvent({
      actorId,
      action: 'admin_archive_proposal',
      targetType: 'proposal',
      targetId: proposalId,
      result: 'not_found',
      reason,
    })
    throw makeError('Propuesta no encontrada', 404, 'PROPOSAL_NOT_FOUND')
  }

  if (result.kind === 'rejected') {
    await recordAuditEvent({
      actorId,
      action: 'admin_archive_proposal',
      targetType: 'proposal',
      targetId: proposalId,
      result: 'rejected',
      reason,
      metadata: { status: result.status, civic_decision_immutable: true },
    })
    throw makeError(
      'Una propuesta que ya abrió votación o alcanzó un estado terminal no puede archivarse',
      409,
      'CIVIC_DECISION_IMMUTABLE',
    )
  }

  await delCache('proposal', proposalId)
  await delCache('stats', 'global')
  return result.proposal
}
