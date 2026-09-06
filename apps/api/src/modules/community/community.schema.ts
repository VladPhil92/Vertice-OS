import { z } from 'zod'

export const CIVIC_PROFILE_TYPES = [
  'citizen',
  'social_leader',
  'candidate',
  'organization_rep',
  'public_official',
] as const

export const COMMUNITY_ACTIVITY_TYPES = ['report', 'proposal'] as const
export const COMMUNITY_VALIDATION_STANCES = ['corroborate', 'dispute'] as const

export const CommunityFeedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(40),
  neighborhood: z.string().trim().min(2).max(120).optional(),
  type: z.enum(COMMUNITY_ACTIVITY_TYPES).optional(),
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

export const CivicProfileParamsSchema = z.object({
  citizenId: z.string().uuid(),
})

export const CivicActivityParamsSchema = z.object({
  type: z.enum(COMMUNITY_ACTIVITY_TYPES),
  activityId: z.string().uuid(),
})

export const CivicActivityValidationSchema = z.object({
  stance: z.enum(COMMUNITY_VALIDATION_STANCES),
  note: z.string().trim().max(280).nullable().optional(),
}).superRefine((value, ctx) => {
  if (value.stance === 'dispute' && (!value.note || value.note.length < 10)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['note'],
      message: 'Una disputa requiere una explicación de al menos 10 caracteres.',
    })
  }
})

export type CommunityFeedQuery = z.infer<typeof CommunityFeedQuerySchema>
export type CommunityLeaderboardQuery = z.infer<typeof CommunityLeaderboardQuerySchema>
export type UpdateCivicProfileInput = z.infer<typeof UpdateCivicProfileSchema>
export type CivicActivityValidationInput = z.infer<typeof CivicActivityValidationSchema>
export type CivicProfileType = typeof CIVIC_PROFILE_TYPES[number]
export type CommunityActivityType = typeof COMMUNITY_ACTIVITY_TYPES[number]
export type CommunityValidationStance = typeof COMMUNITY_VALIDATION_STANCES[number]