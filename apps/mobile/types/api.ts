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
