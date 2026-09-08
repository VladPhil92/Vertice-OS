import { z } from 'zod'

export const CIVIC_PROFILE_TYPES = [
  'citizen',
  'social_leader',
  'candidate',
  'organization_rep',
  'public_official',
] as const

export const COMMUNITY_ACTIVITY_TYPES = ['report', 'proposal', 'publication'] as const
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

export const CivicAvatarBatchQuerySchema = z.object({
  ids: z.string().trim().min(1).transform((value) => (
    [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))]
  )).pipe(z.array(z.string().uuid()).min(1).max(50)),
})

export const ConfirmCivicAvatarSchema = z.object({
  asset_id: z.string().trim().regex(/^[A-Za-z0-9_-]{8,128}$/),
  policy_attestation: z.literal(true),
  client_checks: z.object({
    width: z.number().int().min(640).max(20000),
    height: z.number().int().min(640).max(20000),
    face_detector_available: z.boolean(),
    face_count: z.number().int().min(0).max(10).nullable(),
  }).superRefine((value, ctx) => {
    if (value.face_detector_available && value.face_count !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['face_count'],
        message: 'La foto debe contener exactamente un rostro visible.',
      })
    }
  }),
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
