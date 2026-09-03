import { z } from 'zod'
import { PROPOSAL_CATEGORIES, PROPOSAL_SCOPES, PROPOSAL_STATUSES, DELEGATION_TYPES } from './governance.types'

export const CreateProposalSchema = z.object({
  title: z.string().min(10, 'El título debe tener al menos 10 caracteres').max(200),
  description: z.string().min(50, 'La descripción debe tener al menos 50 caracteres').max(10000),
  executive_summary: z.string().max(500).optional(),
  category: z.enum(PROPOSAL_CATEGORIES),
  scope: z.enum(PROPOSAL_SCOPES),
})

export const ListProposalsSchema = z.object({
  status: z.enum(PROPOSAL_STATUSES).optional(),
  category: z.enum(PROPOSAL_CATEGORIES).optional(),
  scope: z.enum(PROPOSAL_SCOPES).optional(),
  author_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

// Moderation historically loaded up to 200 proposals in one queue and the
// current admin UI does not yet expose pagination controls. Preserve that
// operational contract while still validating every filter/offset parameter.
export const AdminListProposalsSchema = ListProposalsSchema.extend({
  limit: z.coerce.number().int().min(1).max(200).default(200),
  offset: z.coerce.number().int().min(0).default(0),
})

export const CastVoteSchema = z.object({
  vote_value: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
})

export const AdvanceStageSchema = z.object({
  voting_duration_hours: z.number().int().min(24).max(240).optional(),
})

export const AdminArchiveSchema = z.object({
  reason: z.string()
    .trim()
    .min(3, 'Debes registrar una razón de moderación')
    .max(1000, 'La razón de moderación es demasiado extensa'),
})

export const CreateDelegationSchema = z.object({
  delegate_id: z.string().uuid(),
  delegation_type: z.enum(DELEGATION_TYPES),
  domain: z.string().max(100).optional(),
  proposal_id: z.string().uuid().optional(),
  valid_until: z.string().datetime().optional(),
}).refine(
  data => {
    if (data.delegation_type === 'domain' && !data.domain) return false
    if (data.delegation_type === 'proposal' && !data.proposal_id) return false
    return true
  },
  {
    message:
      'domain requerido para delegación por dominio; proposal_id requerido para delegación por propuesta',
  },
)

export type CreateProposalInput = z.infer<typeof CreateProposalSchema>
export type ListProposalsInput = z.infer<typeof ListProposalsSchema>
export type AdminListProposalsInput = z.infer<typeof AdminListProposalsSchema>
export type CastVoteInput = z.infer<typeof CastVoteSchema>
export type AdvanceStageInput = z.infer<typeof AdvanceStageSchema>
export type AdminArchiveInput = z.infer<typeof AdminArchiveSchema>
export type CreateDelegationInput = z.infer<typeof CreateDelegationSchema>
