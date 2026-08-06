export interface CitizenPublicProfile {
  id: string
  did: string
  email: string | null
  neighborhood: string | null
  locality_id: number | null
  reputation_score: string
  verification_level: number
  created_at: Date
  last_active_at: Date | null
}

export interface AuthTokenResponse {
  access_token: string
  token_type: 'Bearer'
  expires_in: number
  citizen_id: string
}
