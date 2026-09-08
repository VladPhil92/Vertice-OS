import { z } from 'zod'
import { ALLOWED_FUNDING_MODELS, CROWDFUNDING_CATEGORIES } from './crowdfunding.policy'

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
})

export type CreateCampaignDraftInput = z.infer<typeof createCampaignDraftSchema>
