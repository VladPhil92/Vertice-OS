import { z } from 'zod'

export const CIVIC_ACTION_STATUSES = [
  'proposed',
  'preparing',
  'in_progress',
  'result_declared',
  'under_verification',
  'verified',
  'not_completed',
  'no_evidence',
  'disputed',
  'cancelled',
] as const

export const OWNER_CIVIC_ACTION_STATUSES = [
  'preparing',
  'in_progress',
  'result_declared',
  'not_completed',
  'cancelled',
] as const

export const CIVIC_EVIDENCE_TYPES = [
  'photo',
  'video',
  'document',
  'location',
  'external_record',
] as const

export const CIVIC_ACTION_VALIDATION_STANCES = ['corroborate', 'dispute'] as const
export const CIVIC_ACTION_REVIEW_DECISIONS = [
  'under_verification',
  'verified',
  'disputed',
  'no_evidence',
] as const

export const CivicActionListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(40),
  status: z.enum(CIVIC_ACTION_STATUSES).optional(),
  neighborhood: z.string().trim().min(2).max(120).optional(),
  category: z.string().trim().min(2).max(80).optional(),
})

export const CivicActionLeaderboardQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  neighborhood: z.string().trim().min(2).max(120).optional(),
})

export const CivicActionParamsSchema = z.object({
  actionId: z.string().uuid(),
})

export const CreateCivicActionSchema = z.object({
  title: z.string().trim().min(8).max(180),
  problem: z.string().trim().min(20).max(4000),
  objective: z.string().trim().min(10).max(2000),
  category: z.string().trim().min(2).max(80),
  neighborhood: z.string().trim().min(2).max(120).nullable().optional(),
  locality_id: z.coerce.number().int().positive().nullable().optional(),
  beneficiaries_estimate: z.coerce.number().int().min(0).max(10_000_000).nullable().optional(),
  target_date: z.string().date().nullable().optional(),
})

export const UpdateCivicActionSchema = z.object({
  title: z.string().trim().min(8).max(180).optional(),
  problem: z.string().trim().min(20).max(4000).optional(),
  objective: z.string().trim().min(10).max(2000).optional(),
  category: z.string().trim().min(2).max(80).optional(),
  neighborhood: z.string().trim().min(2).max(120).nullable().optional(),
  locality_id: z.coerce.number().int().positive().nullable().optional(),
  beneficiaries_estimate: z.coerce.number().int().min(0).max(10_000_000).nullable().optional(),
  target_date: z.string().date().nullable().optional(),
  result_summary: z.string().trim().min(10).max(4000).nullable().optional(),
  status: z.enum(OWNER_CIVIC_ACTION_STATUSES).optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'Debes enviar al menos un cambio.',
})

export const CivicActionEvidenceSchema = z.object({
  evidence_type: z.enum(CIVIC_EVIDENCE_TYPES),
  evidence_url: z.string().url().max(2048),
  description: z.string().trim().max(600).nullable().optional(),
  source_url: z.string().url().max(2048).nullable().optional(),
  content_hash: z.string().trim().regex(/^[a-fA-F0-9]{64}$/).transform((value) => value.toLowerCase()).nullable().optional(),
}).superRefine((value, ctx) => {
  if (value.evidence_type === 'external_record' && !value.source_url) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['source_url'],
      message: 'La evidencia externa requiere la URL de la fuente.',
    })
  }
})

export const CivicActionValidationSchema = z.object({
  stance: z.enum(CIVIC_ACTION_VALIDATION_STANCES),
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

export const CivicActionReviewSchema = z.object({
  decision: z.enum(CIVIC_ACTION_REVIEW_DECISIONS),
  note: z.string().trim().max(1000).nullable().optional(),
}).superRefine((value, ctx) => {
  if (['disputed', 'no_evidence'].includes(value.decision) && (!value.note || value.note.length < 10)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['note'],
      message: 'Esta decisión requiere una justificación de al menos 10 caracteres.',
    })
  }
})

export type CivicActionStatus = typeof CIVIC_ACTION_STATUSES[number]
export type CivicActionOwnerStatus = typeof OWNER_CIVIC_ACTION_STATUSES[number]
export type CivicEvidenceType = typeof CIVIC_EVIDENCE_TYPES[number]
export type CivicActionValidationStance = typeof CIVIC_ACTION_VALIDATION_STANCES[number]
export type CivicActionReviewDecision = typeof CIVIC_ACTION_REVIEW_DECISIONS[number]
export type CivicActionListQuery = z.infer<typeof CivicActionListQuerySchema>
export type CivicActionLeaderboardQuery = z.infer<typeof CivicActionLeaderboardQuerySchema>
export type CreateCivicActionInput = z.infer<typeof CreateCivicActionSchema>
export type UpdateCivicActionInput = z.infer<typeof UpdateCivicActionSchema>
export type CivicActionEvidenceInput = z.infer<typeof CivicActionEvidenceSchema>
export type CivicActionValidationInput = z.infer<typeof CivicActionValidationSchema>
export type CivicActionReviewInput = z.infer<typeof CivicActionReviewSchema>
