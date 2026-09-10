import type { CommunityActivityType } from './api'

export const COMMUNITY_POLICY_VERSION = '2026-09-09.1' as const

export type CommunitySafetyTargetType = 'profile' | CommunityActivityType
export type CommunitySafetyReason =
  | 'harassment'
  | 'hate'
  | 'sexual_content'
  | 'violence'
  | 'spam'
  | 'impersonation'
  | 'privacy'
  | 'other'

export interface CommunityPolicyState {
  current_version: string
  accepted: boolean
  accepted_version: string | null
  accepted_at: string | null
  guidelines_url: string
}

export interface CommunityBlockState {
  blocked: boolean
}

export interface CommunitySafetyReportReceipt {
  id: string
  status: 'pending' | 'reviewing' | 'actioned' | 'dismissed'
  target_type: CommunitySafetyTargetType
  target_id: string
  created_at: string
}
