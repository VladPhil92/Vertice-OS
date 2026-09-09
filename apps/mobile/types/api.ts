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

export type CivicProfileType = 'citizen' | 'social_leader' | 'candidate' | 'organization_rep' | 'public_official'
export type CommunityActivityType = 'report' | 'proposal' | 'publication'
export type CommunityValidationStance = 'corroborate' | 'dispute'

export interface CommunityValidationSummary {
  corroborations: number
  disputes: number
  total: number
}

export interface CivicActivity {
  id: string
  type: CommunityActivityType
  actor: {
    id: string | null
    display_name: string
    neighborhood: string | null
    actor_kind: CivicProfileType
    organization: string | null
    public_profile: boolean
    platform_reputation_score: number | null
  }
  title: string
  summary: string
  category: string
  status: string
  neighborhood: string | null
  evidence_count: number
  verification_state: 'declared' | 'evidence_backed' | 'verified'
  civic_score: number
  community_validation: CommunityValidationSummary
  created_at: string
  updated_at: string
  href: string
}

export interface CommunityFeedAvailability {
  reports: 'available' | 'degraded'
  proposals: 'available' | 'degraded'
  degraded: boolean
}

export interface CommunityFeedScoring {
  version: string
  note: string
}

export interface CommunityFeedResponse {
  data: CivicActivity[]
  count: number
  availability: CommunityFeedAvailability
  scoring: CommunityFeedScoring
}

export interface CivicProfile {
  citizen_id: string
  display_name: string | null
  neighborhood: string | null
  profile_type: CivicProfileType
  bio: string | null
  organization: string | null
  public_profile: boolean
  reputation_score: number
}

export interface PublicCivicProfile extends CivicProfile {
  follower_count: number
  actions_count: number
  verified_actions: number
  evidence_count: number
  average_action_score: number
  recent_actions: CivicActivity[]
}

export interface FollowState {
  following: boolean
  follower_count: number
}

export interface CivicLeaderEntry {
  citizen_id: string
  display_name: string
  neighborhood: string | null
  actor_kind: CivicProfileType
  organization: string | null
  leader_score: number
  platform_reputation_score: number
  actions_count: number
  verified_actions: number
  evidence_count: number
  average_action_score: number
  verification_rate: number
  rank: number
}

export type TerritoryActivationStatus =
  | 'available'
  | 'emerging'
  | 'community_active'
  | 'pilot_ready'
  | 'verified_network'

export type TerritoryLaunchState = 'observing' | 'recruiting' | 'launch_ready' | 'launched' | 'paused'
export type TerritoryInterestRole = 'ambassador' | 'organizer' | 'observer'
export type TerritoryInterestStatus = 'pending' | 'approved' | 'declined' | 'withdrawn'

export interface MyTerritory {
  territory_code: string | null
  neighborhood: string | null
  locality_id: number | null
  territory_name: string | null
  territory_level: string | null
  activation_status: TerritoryActivationStatus | null
  department_code: string | null
  department_name: string | null
}

export interface TerritoryActivationInterest {
  id: string
  citizen_id?: string
  territory_code: string
  interest_role: TerritoryInterestRole
  status: TerritoryInterestStatus
  message: string | null
  reviewed_by?: string | null
  review_reason?: string | null
  created_at: string
  updated_at: string
}

export interface PublicCityFeedItem {
  id: string
  title: string
  category: string
  status: string
  neighborhood?: string | null
  scope?: string
  created_at: string
}

export interface PublicCityOverview {
  territory: {
    code: string
    external_code: string | null
    name: string
    activation_status: TerritoryActivationStatus
  }
  activation: {
    momentum_score: number
    activation_status: TerritoryActivationStatus
    registered_citizens: number
    active_citizens_30d: number
    civic_actions_30d: number
    verified_actions_90d: number
    reports_30d: number
    proposals_30d: number
  }
  launch: {
    operational_state: TerritoryLaunchState
    active_cohort_members: number
    pending_interest_count: number
    accepting_interest: boolean
  }
  feed: {
    actions: PublicCityFeedItem[]
    reports: PublicCityFeedItem[]
    proposals: PublicCityFeedItem[]
    empty_state: string | null
  }
  authority_boundary: 'public_discovery_only'
  interest_boundary: 'voluntary_interest_grants_no_authority'
  excluded_signals: string[]
}
