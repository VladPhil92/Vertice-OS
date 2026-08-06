import { z } from 'zod'
import { REPUTATION_EVENTS } from './reputation.types'

export const RecordEventSchema = z.object({
  citizen_id:   z.string().uuid(),
  event_type:   z.enum(REPUTATION_EVENTS),
  reference_id: z.string().max(36).optional(),
})

export const GetProfileSchema = z.object({
  citizen_id: z.string().uuid(),
})

export const LeaderboardQuerySchema = z.object({
  limit:     z.coerce.number().int().min(1).max(100).default(20),
  offset:    z.coerce.number().int().min(0).default(0),
  locality:  z.string().max(120).optional(),
})

export type RecordEventInput   = z.infer<typeof RecordEventSchema>
export type GetProfileInput    = z.infer<typeof GetProfileSchema>
export type LeaderboardInput   = z.infer<typeof LeaderboardQuerySchema>
