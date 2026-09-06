import { z } from 'zod'

export const CIVIC_PROFILE_TYPES = [
  'citizen',
  'social_leader',
  'candidate',
  'organization_rep',
  'public_official',
] as const

export const CommunityFeedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(40),
  neighborhood: z.string().trim().min(2).max(120).optional(),
  type: z.enum(['report', 'proposal']).optional(),
})

export const CommunityLeaderboardQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  neighborhood: z.string().trim().min(2).max(120).optional(),
})

export const UpdateCivicProfileSchema = z.object({
  profile_type: z.enum(CIVIC_PROFILE_TYPES),
  bio: z.string().trim().max(600).nullable().optional(),
  organization: z.string().trim().max(180).nullable().optional(),
  public_profile: z.boolean(),
})

export type CommunityFeedQuery = z.infer<typeof CommunityFeedQuerySchema>
export type CommunityLeaderboardQuery = z.infer<typeof CommunityLeaderboardQuerySchema>
export type UpdateCivicProfileInput = z.infer<typeof UpdateCivicProfileSchema>
export type CivicProfileType = typeof CIVIC_PROFILE_TYPES[number]
