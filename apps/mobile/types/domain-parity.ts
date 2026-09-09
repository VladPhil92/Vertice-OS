export interface CivicCase {
  id: string
  stage: string
  stored_stage: string
  created_at: string
  updated_at: string
  report: {
    id: string
    title: string
    category: string
    status: string
    neighborhood: string | null
    created_at: string
  }
  analysis: null | { audit_id: string; result: unknown }
  proposal: null | {
    id: string
    title: string | null
    status: string | null
    scope: string | null
    voting_ends_at: string | null
    policy_draft_audit_id: string | null
  }
  control: null | {
    id: string
    legal_type: string | null
    status: string | null
    urgency: string | null
    submitted_at: string | null
  }
}

export interface CivicCaseListResponse {
  data: CivicCase[]
  count: number
}

export interface CivicIdentityAssurance {
  citizen_id: string
  assured: boolean
  status: 'assured' | 'required'
  governance_eligible: boolean
  verification_level: number
  provider: string | null
  provider_verified_at: string | null
  provider_expires_at: string | null
  requirements: {
    contact_verified: boolean
    provider_ingress_operational: boolean
    active_identity_proof: boolean
    provider_external_certified: boolean
  }
}

export interface CivicIdentityProof {
  id: string
  provider: string
  status: string
  assurance_level: number
  verified_at: string | null
  expires_at: string | null
  revoked_at: string | null
  updated_at: string
}

export interface CivicIdentityProofingResponse {
  proofs: CivicIdentityProof[]
}

export interface IdentityProviderAvailability {
  providers: Array<{
    provider: string
    session_bootstrap_available: boolean
  }>
}

export interface IdentityProviderSession {
  provider: string
  session_id: string
  url: string
}

export type ReadinessState = 'ready' | 'action_required' | 'pending_review' | 'platform_blocked' | 'blocked'

export interface ReadinessBlocker {
  code: string
  scope: 'user' | 'campaign' | 'platform'
  message: string
  action_href: string | null
}

export interface CrowdfundingCampaignReadiness {
  id: string
  title: string
  status: string
  compliance_status: string
  review_notes: string | null
  lifecycle_ready: boolean
  can_activate: boolean
  can_accept_contributions: boolean
  blockers: ReadinessBlocker[]
}

export interface CrowdfundingReadiness {
  generated_at: string
  identity: { state: ReadinessState; verified: boolean }
  payout_profile: {
    state: ReadinessState
    verification_status: string
    payout_status: string
    requested_at: string | null
    verified_at: string | null
    review_notes: string | null
    can_request_review: boolean
  }
  payout_destination: {
    state: ReadinessState
    registered: boolean
    key_type: string | null
  }
  platform: {
    ctg_one_federation: string
    collection_provider: string
    crowdfunding_collection: string
    payout_provider: string
    payout_execution: string
    payout_certification: string
  }
  blockers: ReadinessBlocker[]
  user_ready: boolean
  platform_ready: boolean
  ready_for_campaign_activation: boolean
  campaigns: CrowdfundingCampaignReadiness[]
}

export interface CrowdfundingCampaign {
  id: string
  creator_citizen_id: string
  title: string
  slug: string
  summary: string
  description: string
  category: string
  funding_model: string
  funding_policy: string
  status: string
  compliance_status: string
  goal_amount_cop: number
  raised_amount_cop: number
  currency: string
  locality_id: number | null
  neighborhood: string | null
  budget: unknown
  starts_at: string | null
  ends_at: string | null
  created_at: string
  updated_at: string
}

export interface OwnCampaignsResponse {
  campaigns: CrowdfundingCampaign[]
}
