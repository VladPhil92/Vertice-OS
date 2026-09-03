import { Prisma } from '@prisma/client'
import { createHmac } from 'crypto'
import { delCache } from '../../lib/cache'
import { getVoteNullifierSecret } from '../../lib/feature-secrets'
import { logger } from '../../lib/logger'
import { prisma } from '../../lib/prisma'
import { publish } from '../../lib/pubsub'
import { recordReputationEvent } from '../reputation/reputation.service'
import type { VoteReceipt } from './governance.types'

type VoteContextRow = {
  id: string
  status: string
  voting_ends_at: Date | null
  roll_exists: boolean
  eligible: boolean
}

type LedgerVoteRow = {
  id: string
  vote_weight: string | number
  vote_value: number
  is_delegated: boolean
  created_at: Date
}

type DelegatorRow = {
  delegator_id: string
}

function makeError(message: string, statusCode: number, code: string): Error {
  return Object.assign(new Error(message), { statusCode, code })
}

function voteNullifier(citizenId: string, proposalId: string): string {
  return createHmac('sha256', getVoteNullifierSecret())
    .update(`${citizenId}:${proposalId}`)
    .digest('hex')
}

function fireReputation(citizenId: string, proposalId: string): void {
  recordReputationEvent({
    citizen_id: citizenId,
    event_type: 'vote_cast',
    reference_id: proposalId,
  }).catch((err: unknown) => logger.error('[governance] reputation event failed', err))
}

async function rebuildProposalTally(tx: Prisma.TransactionClient, proposalId: string): Promise<void> {
  await tx.$queryRaw(Prisma.sql`
    WITH ledger AS (
      SELECT
        COUNT(*)::int AS total_votes,
        COALESCE(SUM(vote_weight) FILTER (WHERE vote_value = 1), 0)::decimal(12, 4) AS approve_weighted,
        COALESCE(SUM(vote_weight) FILTER (WHERE vote_value = -1), 0)::decimal(12, 4) AS reject_weighted,
        COALESCE(SUM(vote_weight) FILTER (WHERE vote_value = 0), 0)::decimal(12, 4) AS abstain_weighted
      FROM votes
      WHERE proposal_id = ${proposalId}::uuid
    )
    UPDATE proposals p
    SET
      total_votes = ledger.total_votes,
      approve_votes_weighted = ledger.approve_weighted,
      reject_votes_weighted = ledger.reject_weighted,
      abstain_votes_weighted = ledger.abstain_weighted
    FROM ledger
    WHERE p.id = ${proposalId}::uuid
  `)
}

/**
 * Canonical voting ledger for direct + delegated participation.
 *
 * Invariants:
 * - one frozen-roll citizen = one durable vote row per proposal;
 * - delegated participation is persisted with the delegator nullifier;
 * - effective delegation is read exclusively from the voter-roll snapshot
 *   frozen when the proposal entered voting, never from live delegations;
 * - a later direct vote overrides that citizen's delegated row instead of
 *   double-counting participation;
 * - proposal tallies are rebuilt from the durable vote ledger, never from
 *   incremental arithmetic that can drift after retries or concurrency;
 * - the proposal row is locked for the transaction so admission, delegation
 *   claims and tally rebuild form one serializable operation per proposal.
 */
export async function castVoteLedger(
  proposalId: string,
  citizenId: string,
  voteValue: -1 | 0 | 1,
): Promise<VoteReceipt> {
  const nullifier = voteNullifier(citizenId, proposalId)

  const result = await prisma.$transaction(async (tx) => {
    const proposalRows = await tx.$queryRaw<VoteContextRow[]>(Prisma.sql`
      SELECT
        p.id,
        p.status,
        p.voting_ends_at,
        EXISTS(
          SELECT 1
          FROM proposal_voter_roll pvr
          WHERE pvr.proposal_id = p.id
        ) AS roll_exists,
        EXISTS(
          SELECT 1
          FROM proposal_voter_roll pvr
          WHERE pvr.proposal_id = p.id
            AND pvr.citizen_id = ${citizenId}::uuid
        ) AS eligible
      FROM proposals p
      WHERE p.id = ${proposalId}::uuid
      FOR UPDATE
    `)

    if (proposalRows.length === 0) {
      throw makeError('Propuesta no encontrada', 404, 'PROPOSAL_NOT_FOUND')
    }

    const proposal = proposalRows[0]
    if (proposal.status !== 'voting') {
      throw makeError('La propuesta no está en período de votación', 400, 'WRONG_STATUS')
    }
    if (proposal.voting_ends_at && new Date() >= proposal.voting_ends_at) {
      throw makeError('El período de votación ha cerrado', 400, 'VOTING_CLOSED')
    }
    if (!proposal.roll_exists) {
      throw makeError(
        'La votación no tiene un padrón electoral congelado y no puede aceptar votos de forma segura',
        409,
        'VOTER_ROLL_UNAVAILABLE',
      )
    }
    if (!proposal.eligible) {
      throw makeError('No perteneces al padrón electoral de esta propuesta', 403, 'NOT_ELIGIBLE_VOTER')
    }

    const existingRows = await tx.$queryRaw<LedgerVoteRow[]>(Prisma.sql`
      SELECT id, vote_weight, vote_value, is_delegated, created_at
      FROM votes
      WHERE nullifier_hash = ${nullifier}
      FOR UPDATE
    `)

    const existing = existingRows[0]
    let directVote: LedgerVoteRow

    if (existing && !existing.is_delegated) {
      throw makeError('Ya has votado en esta propuesta', 409, 'ALREADY_VOTED')
    }

    if (existing?.is_delegated) {
      // Liquid-democracy override: personal participation always supersedes a
      // prior delegated choice, but remains the same ledger participant.
      const updated = await tx.$queryRaw<LedgerVoteRow[]>(Prisma.sql`
        UPDATE votes
        SET
          vote_weight = 1.0000,
          vote_value = ${voteValue},
          is_delegated = false,
          delegation_depth = 0
        WHERE id = ${existing.id}::uuid
        RETURNING id, vote_weight, vote_value, is_delegated, created_at
      `)
      directVote = updated[0]
    } else {
      const inserted = await tx.$queryRaw<LedgerVoteRow[]>(Prisma.sql`
        INSERT INTO votes (
          proposal_id,
          nullifier_hash,
          vote_weight,
          vote_value,
          is_delegated,
          delegation_depth
        )
        VALUES (${proposalId}::uuid, ${nullifier}, 1.0000, ${voteValue}, false, 0)
        ON CONFLICT (nullifier_hash) DO NOTHING
        RETURNING id, vote_weight, vote_value, is_delegated, created_at
      `)

      if (inserted.length === 0) {
        throw makeError('Ya has votado en esta propuesta', 409, 'ALREADY_VOTED')
      }
      directVote = inserted[0]
    }

    // Delegation is frozen at debate -> voting by the database transition
    // trigger. Live changes to `delegations` after that moment must not mutate
    // the electorate or change whose ballot can represent a frozen voter.
    const delegatorRows = await tx.$queryRaw<DelegatorRow[]>(Prisma.sql`
      SELECT pvr.citizen_id AS delegator_id
      FROM proposal_voter_roll pvr
      WHERE pvr.proposal_id = ${proposalId}::uuid
        AND pvr.effective_delegate_id = ${citizenId}::uuid
        AND pvr.citizen_id <> ${citizenId}::uuid
        AND pvr.delegation_frozen_at IS NOT NULL
      ORDER BY pvr.citizen_id
    `)

    const delegatedValues = delegatorRows.map(({ delegator_id }) => Prisma.sql`
      (
        ${proposalId}::uuid,
        ${voteNullifier(delegator_id, proposalId)},
        1.0000,
        ${voteValue},
        true,
        1
      )
    `)

    let delegatedCount = 0
    if (delegatedValues.length > 0) {
      const delegatedRows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        INSERT INTO votes (
          proposal_id,
          nullifier_hash,
          vote_weight,
          vote_value,
          is_delegated,
          delegation_depth
        )
        VALUES ${Prisma.join(delegatedValues)}
        ON CONFLICT (nullifier_hash) DO NOTHING
        RETURNING id
      `)
      delegatedCount = delegatedRows.length
    }

    // A single authoritative recomputation makes retries, direct overrides and
    // delegated claims converge to the exact same aggregate state.
    await rebuildProposalTally(tx, proposalId)

    return { directVote, delegatedCount }
  })

  await delCache('proposal', proposalId)
  fireReputation(citizenId, proposalId)
  publish('governance', 'proposal:vote_cast', {
    proposal_id: proposalId,
    vote_value: voteValue,
    delegated_count: result.delegatedCount,
  }).catch(() => null)

  return {
    vote_id: result.directVote.id,
    vote_weight: 1 + result.delegatedCount,
    vote_value: result.directVote.vote_value,
    proposal_id: proposalId,
    created_at: result.directVote.created_at,
    delegated_count: result.delegatedCount,
  }
}