import { createHmac } from 'crypto'
import { Prisma } from '@prisma/client'
import { config } from '../../config'
import { prisma } from '../../lib/prisma'
import { getCitizenProfile } from '../auth/auth.service'
import { listMyCivicActions } from '../civic-actions/civic-actions.service'
import { getGovernanceStats } from '../governance/governance.service'
import { getReputationProfile } from '../reputation/reputation.service'
import { getTerritorialStats } from '../territorial/territorial.service'
import { listCivicCases } from '../workflows/workflow.service'

interface RecentReportRow {
  id: string
  title: string
  category: string
  status: string
  neighborhood: string | null
  created_at: Date
  updated_at: Date
}

interface RecentProposalRow {
  id: string
  title: string
  category: string
  scope: string
  status: string
  endorsement_count: number | bigint
  total_votes: number | bigint
  voting_ends_at: Date | null
  created_at: Date
}

interface RecentLegalRow {
  id: string
  legal_type: string
  status: string
  urgency: string
  created_at: Date
  submitted_at: Date | null
}

interface VotingCandidateRow {
  id: string
  title: string
  category: string
  scope: string
  voting_ends_at: Date | null
  created_at: Date
}

interface WorkflowMetricsRow {
  total: bigint
  active: bigint
}

interface CivicActionMetricsRow {
  total: bigint
  active: bigint
  verified: bigint
  needs_evidence: bigint
  awaiting_verification: bigint
}

function voteNullifier(citizenId: string, proposalId: string): string {
  const key = config.VOTE_NULLIFIER_SECRET ?? config.JWT_SECRET
  return createHmac('sha256', key)
    .update(`${citizenId}:${proposalId}`)
    .digest('hex')
}

function countByStatus(rows: Array<{ status: string; count: bigint }>): Record<string, number> {
  return Object.fromEntries(rows.map((row) => [row.status, Number(row.count)]))
}

export async function getCitizenCommandCenter(citizenId: string) {
  const [
    profile,
    reputation,
    territorialStats,
    governanceStats,
    reportStatusRows,
    recentReports,
    proposalStatusRows,
    recentProposals,
    legalStatusRows,
    recentLegal,
    eligibleVotingRows,
    endorsementRows,
    workflowMetricsRows,
    civicActionMetricsRows,
    civicCases,
    recentCivicActions,
  ] = await Promise.all([
    getCitizenProfile(citizenId),
    getReputationProfile(citizenId),
    getTerritorialStats(),
    getGovernanceStats(),
    prisma.$queryRaw<Array<{ status: string; count: bigint }>>(Prisma.sql`
      SELECT status, COUNT(*) AS count
      FROM territorial_reports
      WHERE citizen_id = ${citizenId}::uuid
      GROUP BY status
    `),
    prisma.$queryRaw<RecentReportRow[]>(Prisma.sql`
      SELECT id::text, title, category, status, neighborhood, created_at, updated_at
      FROM territorial_reports
      WHERE citizen_id = ${citizenId}::uuid
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 5
    `),
    prisma.$queryRaw<Array<{ status: string; count: bigint }>>(Prisma.sql`
      SELECT status, COUNT(*) AS count
      FROM proposals
      WHERE author_id = ${citizenId}::uuid
      GROUP BY status
    `),
    prisma.$queryRaw<RecentProposalRow[]>(Prisma.sql`
      SELECT id::text, title, category, scope, status, endorsement_count,
             total_votes, voting_ends_at, created_at
      FROM proposals
      WHERE author_id = ${citizenId}::uuid
      ORDER BY created_at DESC
      LIMIT 5
    `),
    prisma.$queryRaw<Array<{ status: string; count: bigint }>>(Prisma.sql`
      SELECT status, COUNT(*) AS count
      FROM legal_documents
      WHERE citizen_id = ${citizenId}::uuid
      GROUP BY status
    `),
    prisma.$queryRaw<RecentLegalRow[]>(Prisma.sql`
      SELECT id::text, legal_type, status, urgency, created_at, submitted_at
      FROM legal_documents
      WHERE citizen_id = ${citizenId}::uuid
      ORDER BY created_at DESC
      LIMIT 5
    `),
    prisma.$queryRaw<VotingCandidateRow[]>(Prisma.sql`
      SELECT p.id::text, p.title, p.category, p.scope, p.voting_ends_at, p.created_at
      FROM proposal_voter_roll pvr
      INNER JOIN proposals p ON p.id = pvr.proposal_id
      WHERE pvr.citizen_id = ${citizenId}::uuid
        AND p.status = 'voting'
        AND (p.voting_ends_at IS NULL OR p.voting_ends_at > NOW())
      ORDER BY p.voting_ends_at ASC NULLS LAST, p.created_at DESC
      LIMIT 20
    `),
    prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*) AS count
      FROM proposal_endorsements
      WHERE citizen_id = ${citizenId}::uuid
    `),
    prisma.$queryRaw<WorkflowMetricsRow[]>(Prisma.sql`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (
          WHERE NOT (
            (c.proposal_id IS NOT NULL OR c.legal_document_id IS NOT NULL)
            AND (c.proposal_id IS NULL OR p.status IN ('approved', 'rejected', 'quorum_failed', 'executed', 'failed_execution'))
            AND (c.legal_document_id IS NULL OR l.status IN ('responded', 'closed'))
          )
        ) AS active
      FROM civic_cases c
      LEFT JOIN proposals p ON p.id = c.proposal_id
      LEFT JOIN legal_documents l ON l.id = c.legal_document_id
      WHERE c.citizen_id = ${citizenId}::uuid
    `),
    prisma.$queryRaw<CivicActionMetricsRow[]>(Prisma.sql`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (
          WHERE a.status NOT IN ('verified', 'not_completed', 'cancelled')
        ) AS active,
        COUNT(*) FILTER (WHERE a.status = 'verified') AS verified,
        COUNT(*) FILTER (
          WHERE a.status IN ('in_progress', 'result_declared', 'under_verification', 'no_evidence', 'disputed')
            AND NOT EXISTS (
              SELECT 1
              FROM civic_action_evidence e
              WHERE e.action_id = a.id
                AND e.review_status <> 'rejected'
            )
        ) AS needs_evidence,
        COUNT(*) FILTER (
          WHERE a.status IN ('result_declared', 'under_verification')
        ) AS awaiting_verification
      FROM civic_actions a
      WHERE a.actor_id = ${citizenId}::uuid
    `),
    listCivicCases(citizenId, 5),
    listMyCivicActions(citizenId, { limit: 5 }),
  ])

  const reportByStatus = countByStatus(reportStatusRows)
  const proposalByStatus = countByStatus(proposalStatusRows)
  const legalByStatus = countByStatus(legalStatusRows)

  const candidateNullifiers = eligibleVotingRows.map((proposal) => ({
    proposal,
    nullifier: voteNullifier(citizenId, proposal.id),
  }))

  let votedNullifiers = new Set<string>()
  if (candidateNullifiers.length > 0) {
    const hashes = candidateNullifiers.map(({ nullifier }) => nullifier)
    const votedRows = await prisma.$queryRaw<Array<{ nullifier_hash: string }>>(Prisma.sql`
      SELECT nullifier_hash
      FROM votes
      WHERE nullifier_hash IN (${Prisma.join(hashes)})
    `)
    votedNullifiers = new Set(votedRows.map((row) => row.nullifier_hash))
  }

  const pendingVotes = candidateNullifiers
    .filter(({ nullifier }) => !votedNullifiers.has(nullifier))
    .map(({ proposal }) => ({
      ...proposal,
      voting_ends_at: proposal.voting_ends_at?.toISOString() ?? null,
      created_at: proposal.created_at.toISOString(),
    }))

  const reportTotal = Object.values(reportByStatus).reduce((sum, value) => sum + value, 0)
  const proposalTotal = Object.values(proposalByStatus).reduce((sum, value) => sum + value, 0)
  const legalTotal = Object.values(legalByStatus).reduce((sum, value) => sum + value, 0)

  const legalNeedsAction = (legalByStatus.draft ?? 0) + (legalByStatus.ready ?? 0)
  const reportInProgress = reportByStatus.in_progress ?? 0
  const workflowTotal = Number(workflowMetricsRows[0]?.total ?? 0)
  const workflowActive = Number(workflowMetricsRows[0]?.active ?? 0)
  const civicActionTotal = Number(civicActionMetricsRows[0]?.total ?? 0)
  const civicActionActive = Number(civicActionMetricsRows[0]?.active ?? 0)
  const civicActionVerified = Number(civicActionMetricsRows[0]?.verified ?? 0)
  const civicActionNeedsEvidence = Number(civicActionMetricsRows[0]?.needs_evidence ?? 0)
  const civicActionAwaitingVerification = Number(civicActionMetricsRows[0]?.awaiting_verification ?? 0)

  return {
    profile: {
      id: profile.id,
      email: profile.email,
      neighborhood: profile.neighborhood,
      locality_id: profile.locality_id,
      verification_level: profile.verification_level,
      created_at: profile.created_at,
    },
    reputation: {
      score: reputation.reputation_score,
      level: reputation.level,
      total_votes: reputation.total_votes,
      total_proposals: reputation.total_proposals,
      total_reports: reputation.total_reports,
      badges_count: reputation.badges_count,
      endorsements_given: Number(endorsementRows[0]?.count ?? 0),
    },
    attention: {
      verification_required: profile.verification_level < 1,
      pending_votes: pendingVotes,
      legal_needs_action: legalNeedsAction,
      reports_in_progress: reportInProgress,
      civic_actions_needing_evidence: civicActionNeedsEvidence,
      total_items:
        (profile.verification_level < 1 ? 1 : 0) +
        pendingVotes.length +
        legalNeedsAction +
        reportInProgress +
        civicActionNeedsEvidence,
    },
    mine: {
      civic_actions: {
        total: civicActionTotal,
        active: civicActionActive,
        verified: civicActionVerified,
        needs_evidence: civicActionNeedsEvidence,
        awaiting_verification: civicActionAwaitingVerification,
        recent: recentCivicActions,
      },
      reports: {
        total: reportTotal,
        by_status: reportByStatus,
        recent: recentReports.map((report) => ({
          ...report,
          created_at: report.created_at.toISOString(),
          updated_at: report.updated_at.toISOString(),
        })),
      },
      proposals: {
        total: proposalTotal,
        by_status: proposalByStatus,
        recent: recentProposals.map((proposal) => ({
          ...proposal,
          endorsement_count: Number(proposal.endorsement_count),
          total_votes: Number(proposal.total_votes),
          voting_ends_at: proposal.voting_ends_at?.toISOString() ?? null,
          created_at: proposal.created_at.toISOString(),
        })),
      },
      legal: {
        total: legalTotal,
        by_status: legalByStatus,
        recent: recentLegal.map((document) => ({
          ...document,
          created_at: document.created_at.toISOString(),
          submitted_at: document.submitted_at?.toISOString() ?? null,
        })),
      },
      workflows: {
        total: workflowTotal,
        active: workflowActive,
        recent: civicCases,
      },
    },
    city: {
      reports: territorialStats,
      governance: governanceStats,
    },
    generated_at: new Date().toISOString(),
  }
}
