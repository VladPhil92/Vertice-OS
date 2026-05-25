export const PROPOSAL_CATEGORIES = [
  'movilidad',
  'infraestructura',
  'educacion',
  'salud',
  'seguridad',
  'medio_ambiente',
  'cultura',
  'servicios_publicos',
  'gobernanza',
  'otro',
] as const

export const PROPOSAL_SCOPES = [
  'neighborhood',
  'locality',
  'city',
  'regional',
  'national',
] as const

export const PROPOSAL_STATUSES = [
  'idea',
  'draft',
  'debate',
  'voting',
  'approved',
  'rejected',
  'archived',
  'executed',
  'failed_execution',
  'quorum_failed',
] as const

export const DELEGATION_TYPES = [
  'general',
  'domain',
  'proposal',
  'temporal',
] as const

export type ProposalCategory = typeof PROPOSAL_CATEGORIES[number]
export type ProposalScope = typeof PROPOSAL_SCOPES[number]
export type ProposalStatus = typeof PROPOSAL_STATUSES[number]
export type DelegationType = typeof DELEGATION_TYPES[number]

export interface Proposal {
  id: string
  author_id: string | null
  title: string
  description: string
  executive_summary: string | null
  category: string
  scope: ProposalScope
  status: ProposalStatus
  endorsement_count: number
  comment_count: number
  view_count: number
  quorum_required: number | null
  approval_threshold: number | null
  eligible_voters: number | null
  total_votes: number
  approve_votes_weighted: number
  reject_votes_weighted: number
  abstain_votes_weighted: number
  assigned_executor: string | null
  execution_deadline: string | null
  rejection_reason: string | null
  blockchain_tx_hash: string | null
  ipfs_proposal_uri: string | null
  ipfs_result_uri: string | null
  created_at: Date
  draft_started_at: Date | null
  debate_started_at: Date | null
  voting_starts_at: Date | null
  voting_ends_at: Date | null
  decided_at: Date | null
}

export interface ProposalSummary {
  id: string
  author_id: string | null
  title: string
  category: string
  scope: ProposalScope
  status: ProposalStatus
  endorsement_count: number
  total_votes: number
  approve_votes_weighted: number
  reject_votes_weighted: number
  voting_ends_at: Date | null
  created_at: Date
}

export interface VoteTally {
  proposal_id: string
  status: ProposalStatus
  total_votes: number
  approve_weighted: number
  reject_weighted: number
  abstain_weighted: number
  quorum_required: number | null
  approval_threshold: number | null
  eligible_voters: number | null
  quorum_reached: boolean | null
  approval_percentage: number | null
  voting_ends_at: Date | null
}

export interface VoteReceipt {
  vote_id: string
  vote_weight: number
  vote_value: number
  proposal_id: string
  created_at: Date
  delegated_count: number
}

export interface EndorseResult {
  proposal_id: string
  endorsement_count: number
  status: ProposalStatus
  advanced: boolean
}

export interface Delegation {
  id: string
  delegator_id: string
  delegate_id: string
  delegation_type: DelegationType
  domain: string | null
  proposal_id: string | null
  is_active: boolean
  valid_from: Date
  valid_until: Date | null
  created_at: Date
  revoked_at: Date | null
}

export interface GovernanceStats {
  total_proposals: number
  by_status: Array<{ status: string; count: number }>
  by_category: Array<{ category: string; count: number }>
  active_votes: number
  total_votes_cast: number
}

// Raw DB row shapes (before normalization)

export interface ProposalRow {
  id: string
  author_id: string | null
  title: string
  description: string
  executive_summary: string | null
  category: string
  scope: string
  status: string
  endorsement_count: bigint | number
  comment_count: bigint | number
  view_count: bigint | number
  quorum_required: string | number | null
  approval_threshold: string | number | null
  eligible_voters: bigint | number | null
  total_votes: bigint | number
  approve_votes_weighted: string | number
  reject_votes_weighted: string | number
  abstain_votes_weighted: string | number
  assigned_executor: string | null
  execution_deadline: Date | string | null
  rejection_reason: string | null
  blockchain_tx_hash: string | null
  ipfs_proposal_uri: string | null
  ipfs_result_uri: string | null
  created_at: Date
  draft_started_at: Date | null
  debate_started_at: Date | null
  voting_starts_at: Date | null
  voting_ends_at: Date | null
  decided_at: Date | null
}

export interface VoteRow {
  id: string
  vote_weight: string | number
  vote_value: number
  created_at: Date
}

export interface DelegationRow {
  id: string
  delegator_id: string
  delegate_id: string
  delegation_type: string
  domain: string | null
  proposal_id: string | null
  is_active: boolean
  valid_from: Date
  valid_until: Date | null
  created_at: Date
  revoked_at: Date | null
}

export interface StatsCountRow {
  status?: string
  category?: string
  count: bigint
}

export interface CountRow {
  count: bigint | number
}
