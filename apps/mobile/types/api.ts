export interface MobileTokenResponse {
  access_token: string
  refresh_token: string
  token_type: 'Bearer'
  expires_in: number
  citizen_id: string
}

export interface RefreshTokenResponse {
  access_token: string
  token_type: 'Bearer'
  expires_in: number
}

export interface CitizenProfile {
  id: string
  did: string
  email: string
  neighborhood: string | null
  locality_id: number | null
  reputation_score: string
  verification_level: number
  created_at: string
  last_active_at: string | null
}

export interface CitizenDashboard {
  profile: {
    id: string
    email: string
    neighborhood: string | null
    locality_id: number | null
    verification_level: number
    created_at: string
  }
  reputation: {
    score: string
    level: string
    total_votes: number
    total_proposals: number
    total_reports: number
    badges_count: number
    endorsements_given: number
  }
  attention: {
    verification_required: boolean
    pending_votes: Array<{ id: string; title: string }>
    legal_needs_action: number
    reports_in_progress: number
    civic_actions_needing_evidence: number
    total_items: number
  }
  mine: {
    civic_actions: { total: number; active: number; verified: number }
    reports: { total: number }
    proposals: { total: number }
    legal: { total: number }
    workflows: { total: number; active: number }
  }
  generated_at: string
}

export type CivicActionStatus =
  | 'proposed'
  | 'preparing'
  | 'in_progress'
  | 'result_declared'
  | 'under_verification'
  | 'verified'
  | 'not_completed'
  | 'no_evidence'
  | 'disputed'
  | 'cancelled'

export interface CivicActionSummary {
  id: string
  title: string
  problem: string
  objective: string
  category: string
  neighborhood: string | null
  locality_id: number | null
  beneficiaries_estimate: number | null
  status: CivicActionStatus
  evidence_count: number
  civic_score: number
  confidence_score: number
  created_at: string
  updated_at: string
}

export interface CivicEvidence {
  id: string
  evidence_type: 'photo' | 'video' | 'document' | 'location' | 'external_record'
  evidence_url: string
  description: string | null
  source_url: string | null
  review_status: string
  created_at: string
}

export type ReportCategory =
  | 'infraestructura'
  | 'servicios_publicos'
  | 'seguridad'
  | 'medio_ambiente'
  | 'transporte'
  | 'salud'
  | 'educacion'
  | 'cultura'
  | 'otro'

export type ReportStatus = 'open' | 'in_progress' | 'resolved' | 'rejected' | 'duplicate'

export interface TerritorialReportSummary {
  id: string
  category: ReportCategory
  title: string
  description?: string
  lat: number
  lng: number
  neighborhood: string | null
  status: ReportStatus
  urgency_score: number | null
  media_urls: string[]
  created_at: string
}

export interface NearbyTerritorialReport extends TerritorialReportSummary {
  description: string
  distance_meters: number
}

export interface TerritorialReportDetail {
  id: string
  citizen_id: string | null
  category: ReportCategory
  subcategory: string | null
  title: string
  description: string
  lat: number
  lng: number
  neighborhood: string | null
  locality_id: number | null
  address_reference: string | null
  urgency_score: number | null
  status: ReportStatus
  media_urls: string[]
  created_at: string
  updated_at: string
  resolved_at: string | null
}

export interface ReportMediaUploadIntent {
  media_asset_id: string
  upload_url: string
}

export interface ReportMediaState {
  media_asset_id: string
  url: string
  status: 'confirmed' | 'attached'
}

export type ProposalStatus =
  | 'idea'
  | 'draft'
  | 'debate'
  | 'voting'
  | 'approved'
  | 'rejected'
  | 'archived'
  | 'executed'
  | 'failed_execution'
  | 'quorum_failed'

export type ProposalScope = 'neighborhood' | 'locality' | 'city' | 'regional' | 'national'

export interface GovernanceProposal {
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
  voting_ends_at: string | null
  created_at: string
}

export interface EndorseResult {
  proposal_id: string
  endorsement_count: number
  status: ProposalStatus
  advanced: boolean
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
  voting_ends_at: string | null
}

export interface ApiList<T> {
  data: T[]
  count: number
}
