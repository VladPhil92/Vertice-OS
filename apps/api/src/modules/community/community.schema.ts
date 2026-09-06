import { z } from 'zod'

export const CommunityFeedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(40),
  neighborhood: z.string().trim().min(2).max(120).optional(),
  type: z.enum(['report', 'proposal']).optional(),
})

export const CommunityLeaderboardQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  neighborhood: z.string().trim().min(2).max(120).optional(),
})

export type CommunityFeedQuery = z.infer<typeof CommunityFeedQuerySchema>
export type CommunityLeaderboardQuery = z.infer<typeof CommunityLeaderboardQuerySchema>
