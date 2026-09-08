import { z } from 'zod'
import { addBrebKeyIssue, brebKeyTypeSchema } from '../billing/breb-key.schema'
import {
  ALLOWED_FUNDING_MODELS,
  CROWDFUNDING_CATEGORIES,
  FUNDING_POLICIES,
} from './crowdfunding.policy'

const budgetItemSchema = z.object({
  label: z.string().trim().min(3).max(120),
  amount_cop: z.number().int().positive(),
})

export const createCampaignDraftSchema = z.object({
  title: z.string().trim().min(8).max(120),
  summary: z.string().trim().min(20).max(280),
  description: z.string().trim().min(80).max(8_000),
  category: z.enum(CROWDFUNDING_CATEGORIES),
  funding_model: z.enum(ALLOWED_FUNDING_MODELS).default('donation'),
  funding_policy: z.enum(FUNDING_POLICIES).optional(),
  goal_amount_cop: z.number().int().min(50_000).max(2_000_000_000),
  locality_id: z.number().int().positive().optional(),
  neighborhood: z.string().trim().min(2).max(120).optional(),
  budget: z.array(budgetItemSchema).min(1).max(50),
}).superRefine((input, ctx) => {
  const budgetTotal = input.budget.reduce((sum, item) => sum + item.amount_cop, 0)
  if (budgetTotal > input.goal_amount_cop) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['budget'],
      message: 'El presupuesto desglosado no puede superar la meta de recaudo.',
    })
  }
  if (input.funding_model === 'reward' && input.funding_policy === 'flexible') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['funding_policy'],
      message: 'Las campañas con recompensas o preventas no pueden usar financiación flexible.',
    })
  }
})

export const campaignIdParamsSchema = z.object({
  campaignId: z.string().uuid(),
})

export const citizenIdParamsSchema = z.object({
  citizenId: z.string().uuid(),
})

export const contributionCheckoutSchema = z.object({
  amount_cop: z.number().int().min(1_000).max(20_000_000),
  platform_tip_cop: z.number().int().min(0).max(500_000).default(0),
  is_anonymous: z.boolean().default(false),
})

export const campaignReviewSchema = z.object({
  decision: z.enum(['approve', 'reject', 'suspend']),
  notes: z.string().trim().max(2_000).optional(),
})

export const payoutProfileReviewSchema = z.object({
  decision: z.enum(['approve', 'reject', 'suspend']),
  provider_reference: z.string().trim().min(3).max(191).optional(),
  notes: z.string().trim().max(2_000).optional(),
})

export const payoutDestinationPreviewSchema = z.object({
  keyType: brebKeyTypeSchema,
  key: z.string().trim().min(1).max(254),
}).superRefine(addBrebKeyIssue)

export const payoutDestinationRegistrationSchema = z.object({
  keyType: brebKeyTypeSchema,
  key: z.string().trim().min(1).max(254),
  confirmedHolderName: z.string().trim().min(2).max(180),
  confirmedFinancialEntityCode: z.string().trim().min(1).max(20),
}).superRefine(addBrebKeyIssue)

export type CreateCampaignDraftInput = z.infer<typeof createCampaignDraftSchema>
export type CampaignReviewInput = z.infer<typeof campaignReviewSchema>
export type PayoutProfileReviewInput = z.infer<typeof payoutProfileReviewSchema>
export type PayoutDestinationRegistrationInput = z.infer<typeof payoutDestinationRegistrationSchema>
