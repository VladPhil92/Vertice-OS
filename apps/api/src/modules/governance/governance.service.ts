import { Prisma } from '@prisma/client'
import { createHmac } from 'crypto'
import { prisma } from '../../lib/prisma'
import { getCache, setCache, delCache, TTL } from '../../lib/cache'
import { redis } from '../../lib/redis'
import { config } from '../../config'
import {
  Proposal,
  ProposalSummary,
  ProposalRow,
  VoteTally,
  VoteReceipt,
  VoteRow,
  EndorseResult,
  Delegation,
  DelegationRow,
  GovernanceStats,
  StatsCountRow,
  ProposalScope,
  ProposalStatus,
} from './governance.types'
import type { CreateProposalInput, ListProposalsInput, AdvanceStageInput, CreateDelegationInput } from './governance.schema'

// ── Config ────────────────────────────────────────────────────────────────────

const QUORUM_CONFIG: Record<ProposalScope, {
  quorum: number; approval: number
  minHours: number; maxHours: number; defaultHours: number
}> = {
  neighborhood: { quorum: 0.15, approval: 0.40, minHours: 24,  maxHours: 72,  defaultHours: 48  },
  locality:     { quorum: 0.20, approval: 0.50, minHours: 48,  maxHours: 96,  defaultHours: 72  },
  city:         { quorum: 0.25, approval: 0.55, minHours: 72,  maxHours: 168, defaultHours: 120 },
  regional:     { quorum: 0.30, approval: 0.60, minHours: 120, maxHours: 240, defaultHours: 168 },
  national:     { quorum: 0.40, approval: 0.66, minHours: 120, maxHours: 240, defaultHours: 168 },
}

const ENDORSEMENTS_REQUIRED = 10

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function normalizeProposalSummary(row: ProposalRow): ProposalSummary {
  return {
    id: row.id,
    author_id: row.author_id,
    title: row.title,
    category: row.category,
    scope: row.scope as ProposalScope,
    status: row.status as ProposalStatus,
    endorsement_count: Number(row.endorsement_count),
    total_votes: Number(row.total_votes),
    approve_votes_weighted: Number(row.approve_votes_weighted),
    reject_votes_weighted: Number(row.reject_votes_weighted),
    voting_ends_at: row.voting_ends_at,
    created_at: row.created_at,
  }
}

function normalizeDelegation(row: DelegationRow): Delegation {
  return row as Delegation
}

function makeError(message: string, statusCode: number, code: string): Error {
  return Object.assign(new Error(message), { statusCode, code })
}

function voteNullifier(citizenId: string, proposalId: string): string {
  return createHmac('sha256', config.JWT_SECRET)
    .update(`${citizenId}:${proposalId}`)
    .digest('hex')
}

function computeVoteWeight(reputationScore: number): number {
  const normalized = Math.min(reputationScore / 100, 1.0)
  return Math.min(1.0 + normalized * 0.5, 1.5)
}

// ── createProposal ─────────────────────────────────────────────────────────────

export async function createProposal(
  authorId: string,
  data: CreateProposalInput,
): Promise<Proposal> {
  const rows = await prisma.$queryRaw<ProposalRow[]>(Prisma.sql`
    INSERT INTO proposals (author_id, title, description, executive_summary, category, scope)
    VALUES (
      ${authorId}::uuid,
      ${data.title},
      ${data.description},
      ${data.executive_summary ?? null},
      ${data.category},
      ${data.scope}
    )
    RETURNING *
  `)
  return normalizeProposal(rows[0])
}

// ── listProposals ──────────────────────────────────────────────────────────────

export async function listProposals(filters: ListProposalsInput): Promise<ProposalSummary[]> {
  const conditions: Prisma.Sql[] = []

  if (filters.status) conditions.push(Prisma.sql`status = ${filters.status}`)
  if (filters.category) conditions.push(Prisma.sql`category = ${filters.category}`)
  if (filters.scope) conditions.push(Prisma.sql`scope = ${filters.scope}`)
  if (filters.author_id) conditions.push(Prisma.sql`author_id = ${filters.author_id}::uuid`)

  const where = conditions.length > 0
    ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
    : Prisma.sql``

  const rows = await prisma.$queryRaw<ProposalRow[]>(Prisma.sql`
    SELECT id, author_id, title, category, scope, status,
           endorsement_count, total_votes, approve_votes_weighted,
           reject_votes_weighted, voting_ends_at, created_at
    FROM proposals
    ${where}
    ORDER BY
      CASE WHEN status IN ('idea', 'draft') THEN endorsement_count END DESC NULLS LAST,
      created_at DESC
    LIMIT ${filters.limit} OFFSET ${filters.offset}
  `)

  return rows.map(normalizeProposalSummary)
}

// ── getProposalById ────────────────────────────────────────────────────────────

export async function getProposalById(id: string): Promise<Proposal> {
  const cached = await getCache<Proposal>('proposal', id)
  if (cached) return cached

  const rows = await prisma.$queryRaw<ProposalRow[]>(Prisma.sql`
    SELECT * FROM proposals WHERE id = ${id}::uuid
  `)

  if (rows.length === 0) throw makeError('Propuesta no encontrada', 404, 'PROPOSAL_NOT_FOUND')

  const proposal = normalizeProposal(rows[0])
  await setCache('proposal', id, proposal, TTL.REPORT)

  // fire-and-forget view increment
  prisma.$queryRaw(Prisma.sql`
    UPDATE proposals SET view_count = view_count + 1 WHERE id = ${id}::uuid
  `).catch(() => undefined)

  return proposal
}

// ── endorseProposal ────────────────────────────────────────────────────────────

export async function endorseProposal(
  proposalId: string,
  citizenId: string,
): Promise<EndorseResult> {
  const rows = await prisma.$queryRaw<Pick<ProposalRow, 'id' | 'status' | 'endorsement_count'>[]>(Prisma.sql`
    SELECT id, status, endorsement_count FROM proposals WHERE id = ${proposalId}::uuid
  `)

  if (rows.length === 0) throw makeError('Propuesta no encontrada', 404, 'PROPOSAL_NOT_FOUND')

  const proposal = rows[0]
  if (!['idea', 'draft'].includes(proposal.status)) {
    throw makeError('Solo se pueden avalar propuestas en fase idea o borrador', 400, 'WRONG_STATUS')
  }

  const endorseKey = `vertice:endorsed:${proposalId}`
  const alreadyEndorsed = await redis.sismember(endorseKey, citizenId)
  if (alreadyEndorsed) {
    throw makeError('Ya avalaste esta propuesta', 409, 'ALREADY_ENDORSED')
  }

  await redis.sadd(endorseKey, citizenId)

  const updated = await prisma.$queryRaw<Pick<ProposalRow, 'endorsement_count' | 'status'>[]>(Prisma.sql`
    UPDATE proposals
    SET endorsement_count = endorsement_count + 1
    WHERE id = ${proposalId}::uuid
    RETURNING endorsement_count, status
  `)

  let currentStatus = updated[0].status as ProposalStatus
  let advanced = false
  const newCount = Number(updated[0].endorsement_count)

  if (newCount >= ENDORSEMENTS_REQUIRED && currentStatus === 'idea') {
    const advanced_rows = await prisma.$queryRaw<Pick<ProposalRow, 'status'>[]>(Prisma.sql`
      UPDATE proposals
      SET status = 'draft', draft_started_at = NOW()
      WHERE id = ${proposalId}::uuid AND status = 'idea'
      RETURNING status
    `)
    if (advanced_rows.length > 0) {
      currentStatus = 'draft'
      advanced = true
    }
  }

  await delCache('proposal', proposalId)

  return { proposal_id: proposalId, endorsement_count: newCount, status: currentStatus, advanced }
}

// ── advanceProposalStage ───────────────────────────────────────────────────────

export async function advanceProposalStage(
  proposalId: string,
  citizenId: string,
  options: AdvanceStageInput = {},
): Promise<Proposal> {
  const rows = await prisma.$queryRaw<ProposalRow[]>(Prisma.sql`
    SELECT * FROM proposals WHERE id = ${proposalId}::uuid
  `)

  if (rows.length === 0) throw makeError('Propuesta no encontrada', 404, 'PROPOSAL_NOT_FOUND')

  const proposal = normalizeProposal(rows[0])

  // voting finalization is open to anyone once the period expires
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
      const scope = proposal.scope
      const cfg = QUORUM_CONFIG[scope]
      const durationHours = options.voting_duration_hours ?? cfg.defaultHours
      const clampedHours = Math.max(cfg.minHours, Math.min(cfg.maxHours, durationHours))
      const votingEndsAt = new Date(Date.now() + clampedHours * 3600 * 1000)

      const countRows = await prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
        SELECT COUNT(*) as count FROM citizens WHERE verification_level >= 1
      `)
      const eligibleVoters = Number(countRows[0].count)

      updatedRows = await prisma.$queryRaw<ProposalRow[]>(Prisma.sql`
        UPDATE proposals
        SET status = 'voting',
            voting_starts_at = NOW(),
            voting_ends_at = ${votingEndsAt},
            quorum_required = ${cfg.quorum},
            approval_threshold = ${cfg.approval},
            eligible_voters = ${eligibleVoters}
        WHERE id = ${proposalId}::uuid RETURNING *
      `)
      break
    }

    case 'voting': {
      if (!isVotingFinalization) {
        throw makeError('La votación aún está activa', 400, 'VOTING_STILL_ACTIVE')
      }

      const result = computeVotingResult(proposal)
      updatedRows = await prisma.$queryRaw<ProposalRow[]>(Prisma.sql`
        UPDATE proposals
        SET status = ${result}, decided_at = NOW()
        WHERE id = ${proposalId}::uuid RETURNING *
      `)
      break
    }

    default:
      throw makeError(`Estado '${proposal.status}' no permite avance manual`, 400, 'TERMINAL_STATUS')
  }

  await delCache('proposal', proposalId)
  await delCache('stats', 'global')

  return normalizeProposal(updatedRows[0])
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

// ── castVote ──────────────────────────────────────────────────────────────────

export async function castVote(
  proposalId: string,
  citizenId: string,
  voteValue: -1 | 0 | 1,
): Promise<VoteReceipt> {
  const rows = await prisma.$queryRaw<ProposalRow[]>(Prisma.sql`
    SELECT id, status, voting_ends_at FROM proposals WHERE id = ${proposalId}::uuid
  `)

  if (rows.length === 0) throw makeError('Propuesta no encontrada', 404, 'PROPOSAL_NOT_FOUND')

  const proposal = rows[0]

  if (proposal.status !== 'voting') {
    throw makeError('La propuesta no está en período de votación', 400, 'WRONG_STATUS')
  }

  if (proposal.voting_ends_at && new Date() >= proposal.voting_ends_at) {
    throw makeError('El período de votación ha cerrado', 400, 'VOTING_CLOSED')
  }

  const nullifier = voteNullifier(citizenId, proposalId)

  // Get citizen reputation and check for double vote in one query
  const checkRows = await prisma.$queryRaw<Array<{
    already_voted: bigint | number
    reputation_score: string | number
  }>>(Prisma.sql`
    SELECT
      (SELECT COUNT(*) FROM votes WHERE nullifier_hash = ${nullifier})::int AS already_voted,
      c.reputation_score
    FROM citizens c
    WHERE c.id = ${citizenId}::uuid
  `)

  if (checkRows.length === 0) throw makeError('Ciudadano no encontrado', 404, 'CITIZEN_NOT_FOUND')

  if (Number(checkRows[0].already_voted) > 0) {
    throw makeError('Ya has votado en esta propuesta', 409, 'ALREADY_VOTED')
  }

  const voteWeight = computeVoteWeight(Number(checkRows[0].reputation_score))

  // Insert with ON CONFLICT DO NOTHING as race-condition safety net
  const voteRows = await prisma.$queryRaw<VoteRow[]>(Prisma.sql`
    INSERT INTO votes (proposal_id, nullifier_hash, vote_weight, vote_value)
    VALUES (${proposalId}::uuid, ${nullifier}, ${voteWeight}, ${voteValue})
    ON CONFLICT (nullifier_hash) DO NOTHING
    RETURNING id, vote_weight, vote_value, created_at
  `)

  if (voteRows.length === 0) {
    throw makeError('Ya has votado en esta propuesta', 409, 'ALREADY_VOTED')
  }

  // ── Liquid democracy: aggregate delegated weight ───────────────────────────
  // Find delegators who trust this citizen (general or domain delegation)
  // and have NOT already voted directly — their weight is added to this vote.
  const delegators = await prisma.$queryRaw<Array<{
    delegator_id: string
    reputation_score: string
  }>>(Prisma.sql`
    SELECT d.delegator_id, c.reputation_score
    FROM delegations d
    JOIN citizens c ON c.id = d.delegator_id
    WHERE d.delegate_id   = ${citizenId}::uuid
      AND d.is_active     = true
      AND d.delegation_type IN ('general', 'domain')
      AND NOT EXISTS (
        SELECT 1 FROM votes v
        WHERE v.nullifier_hash = encode(
          hmac(
            concat(d.delegator_id::text, ':', ${proposalId}),
            ${config.JWT_SECRET},
            'sha256'
          ), 'hex'
        )
      )
  `)

  const delegatedWeight = delegators.reduce(
    (sum, d) => sum + computeVoteWeight(Number(d.reputation_score)),
    0,
  )
  const totalWeight = voteWeight + delegatedWeight

  // Update weighted tally on proposal with combined weight
  await prisma.$queryRaw(Prisma.sql`
    UPDATE proposals SET
      total_votes = total_votes + 1,
      approve_votes_weighted  = approve_votes_weighted  + CASE WHEN ${voteValue} =  1 THEN ${totalWeight}::decimal ELSE 0 END,
      reject_votes_weighted   = reject_votes_weighted   + CASE WHEN ${voteValue} = -1 THEN ${totalWeight}::decimal ELSE 0 END,
      abstain_votes_weighted  = abstain_votes_weighted  + CASE WHEN ${voteValue} =  0 THEN ${totalWeight}::decimal ELSE 0 END
    WHERE id = ${proposalId}::uuid
  `)

  await delCache('proposal', proposalId)

  const vote = voteRows[0]
  return {
    vote_id: vote.id,
    vote_weight: totalWeight,
    vote_value: vote.vote_value,
    proposal_id: proposalId,
    created_at: vote.created_at,
    delegated_count: delegators.length,
  }
}

// ── getVoteTally ──────────────────────────────────────────────────────────────

export async function getVoteTally(proposalId: string): Promise<VoteTally> {
  const rows = await prisma.$queryRaw<ProposalRow[]>(Prisma.sql`
    SELECT id, status, total_votes, approve_votes_weighted, reject_votes_weighted,
           abstain_votes_weighted, quorum_required, approval_threshold, eligible_voters,
           voting_ends_at
    FROM proposals WHERE id = ${proposalId}::uuid
  `)

  if (rows.length === 0) throw makeError('Propuesta no encontrada', 404, 'PROPOSAL_NOT_FOUND')

  const row = rows[0]
  const totalVotes = Number(row.total_votes)
  const approveW = Number(row.approve_votes_weighted)
  const rejectW = Number(row.reject_votes_weighted)
  const abstainW = Number(row.abstain_votes_weighted)
  const eligibleVoters = row.eligible_voters !== null ? Number(row.eligible_voters) : null
  const quorumRequired = row.quorum_required !== null ? Number(row.quorum_required) : null

  let quorumReached: boolean | null = null
  let approvalPercentage: number | null = null

  if (quorumRequired !== null && eligibleVoters !== null && eligibleVoters > 0) {
    quorumReached = totalVotes / eligibleVoters >= quorumRequired
  }

  const totalW = approveW + rejectW + abstainW
  if (totalW > 0) {
    approvalPercentage = Math.round((approveW / totalW) * 10000) / 100
  }

  return {
    proposal_id: proposalId,
    status: row.status as ProposalStatus,
    total_votes: totalVotes,
    approve_weighted: approveW,
    reject_weighted: rejectW,
    abstain_weighted: abstainW,
    quorum_required: quorumRequired,
    approval_threshold: row.approval_threshold !== null ? Number(row.approval_threshold) : null,
    eligible_voters: eligibleVoters,
    quorum_reached: quorumReached,
    approval_percentage: approvalPercentage,
    voting_ends_at: row.voting_ends_at,
  }
}

// ── createDelegation ──────────────────────────────────────────────────────────

export async function createDelegation(
  delegatorId: string,
  data: CreateDelegationInput,
): Promise<Delegation> {
  if (delegatorId === data.delegate_id) {
    throw makeError('No puedes delegarte a ti mismo', 400, 'SELF_DELEGATION')
  }

  // Check 1-level circular: does delegate already delegate back to delegator?
  const circular = await prisma.$queryRaw<Array<{ exists: boolean }>>(Prisma.sql`
    SELECT EXISTS(
      SELECT 1 FROM delegations
      WHERE delegator_id = ${data.delegate_id}::uuid
        AND delegate_id = ${delegatorId}::uuid
        AND is_active = true
    ) AS exists
  `)

  if (circular[0].exists) {
    throw makeError('Esta delegación crearía un ciclo', 400, 'CIRCULAR_DELEGATION')
  }

  // Deactivate conflicting active delegation (same type + scope)
  if (data.delegation_type === 'general') {
    await prisma.$queryRaw(Prisma.sql`
      UPDATE delegations SET is_active = false, revoked_at = NOW()
      WHERE delegator_id = ${delegatorId}::uuid
        AND delegation_type = 'general'
        AND is_active = true
    `)
  } else if (data.delegation_type === 'domain' && data.domain) {
    await prisma.$queryRaw(Prisma.sql`
      UPDATE delegations SET is_active = false, revoked_at = NOW()
      WHERE delegator_id = ${delegatorId}::uuid
        AND delegation_type = 'domain'
        AND domain = ${data.domain}
        AND is_active = true
    `)
  } else if (data.delegation_type === 'proposal' && data.proposal_id) {
    await prisma.$queryRaw(Prisma.sql`
      UPDATE delegations SET is_active = false, revoked_at = NOW()
      WHERE delegator_id = ${delegatorId}::uuid
        AND delegation_type = 'proposal'
        AND proposal_id = ${data.proposal_id}::uuid
        AND is_active = true
    `)
  }

  const validUntil = data.valid_until ? new Date(data.valid_until) : null

  const rows = await prisma.$queryRaw<DelegationRow[]>(Prisma.sql`
    INSERT INTO delegations (delegator_id, delegate_id, delegation_type, domain, proposal_id, valid_until)
    VALUES (
      ${delegatorId}::uuid,
      ${data.delegate_id}::uuid,
      ${data.delegation_type},
      ${data.domain ?? null},
      ${data.proposal_id ? Prisma.sql`${data.proposal_id}::uuid` : Prisma.sql`NULL`},
      ${validUntil}
    )
    RETURNING *
  `)

  return normalizeDelegation(rows[0])
}

// ── revokeDelegation ──────────────────────────────────────────────────────────

export async function revokeDelegation(delegationId: string, citizenId: string): Promise<void> {
  const rows = await prisma.$queryRaw<Array<{ id: string; delegator_id: string }>>(Prisma.sql`
    SELECT id, delegator_id FROM delegations WHERE id = ${delegationId}::uuid AND is_active = true
  `)

  if (rows.length === 0) throw makeError('Delegación no encontrada', 404, 'DELEGATION_NOT_FOUND')
  if (rows[0].delegator_id !== citizenId) {
    throw makeError('No puedes revocar una delegación que no te pertenece', 403, 'NOT_DELEGATOR')
  }

  await prisma.$queryRaw(Prisma.sql`
    UPDATE delegations SET is_active = false, revoked_at = NOW()
    WHERE id = ${delegationId}::uuid
  `)
}

// ── getMyDelegations ──────────────────────────────────────────────────────────

export async function getMyDelegations(citizenId: string): Promise<Delegation[]> {
  const rows = await prisma.$queryRaw<DelegationRow[]>(Prisma.sql`
    SELECT * FROM delegations
    WHERE delegator_id = ${citizenId}::uuid AND is_active = true
    ORDER BY created_at DESC
  `)
  return rows.map(normalizeDelegation)
}

// ── getGovernanceStats ─────────────────────────────────────────────────────────

export async function getGovernanceStats(): Promise<GovernanceStats> {
  const cached = await getCache<GovernanceStats>('stats', 'global')
  if (cached) return cached

  const [statusRows, categoryRows, countsRow] = await Promise.all([
    prisma.$queryRaw<StatsCountRow[]>(Prisma.sql`
      SELECT status, COUNT(*) as count FROM proposals GROUP BY status
    `),
    prisma.$queryRaw<StatsCountRow[]>(Prisma.sql`
      SELECT category, COUNT(*) as count FROM proposals GROUP BY category
    `),
    prisma.$queryRaw<Array<{ active_votes: bigint | number; total_votes_cast: bigint | number }>>(Prisma.sql`
      SELECT
        (SELECT COUNT(*) FROM proposals WHERE status = 'voting')   AS active_votes,
        (SELECT COUNT(*) FROM votes)                               AS total_votes_cast
    `),
  ])

  const byStatus = statusRows.map(r => ({
    status: r.status as string,
    count: Number(r.count),
  }))

  const totalProposals = byStatus.reduce((sum, r) => sum + r.count, 0)

  const stats: GovernanceStats = {
    total_proposals: totalProposals,
    by_status: byStatus,
    by_category: categoryRows.map(r => ({ category: r.category as string, count: Number(r.count) })),
    active_votes: Number(countsRow[0].active_votes),
    total_votes_cast: Number(countsRow[0].total_votes_cast),
  }

  await setCache('stats', 'global', stats, TTL.STATS)
  return stats
}
