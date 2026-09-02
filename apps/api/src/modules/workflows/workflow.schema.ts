import { z } from 'zod'
import { PROPOSAL_CATEGORIES, PROPOSAL_SCOPES } from '../governance/governance.types'

export const ListCivicCasesSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
})

export const EscalateProposalSchema = z.object({
  scope: z.enum(PROPOSAL_SCOPES).default('city'),
  title: z.string().min(10).max(200).optional(),
  category: z.enum(PROPOSAL_CATEGORIES).optional(),
})

export const EscalateControlSchema = z.object({
  evidence_description: z.string().max(2000).optional(),
  category: z.string().max(100).optional(),
})

export type ListCivicCasesInput = z.infer<typeof ListCivicCasesSchema>
export type EscalateProposalInput = z.infer<typeof EscalateProposalSchema>
export type EscalateControlInput = z.infer<typeof EscalateControlSchema>
