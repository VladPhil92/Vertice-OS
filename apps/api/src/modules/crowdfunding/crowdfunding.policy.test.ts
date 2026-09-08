import { createCampaignDraftSchema } from './crowdfunding.schema'
import {
  CROWDFUNDING_GUARDRAILS,
  isAllowedFundingModel,
  isInvestmentLikeFundingModel,
} from './crowdfunding.policy'

const validDraft = {
  title: 'Recuperemos la biblioteca comunitaria',
  summary: 'Una campaña comunitaria para recuperar libros, mobiliario y espacios de lectura.',
  description: 'La biblioteca del barrio requiere recuperación de mobiliario, adquisición de libros y adecuaciones básicas para volver a prestar servicios de lectura, formación y encuentro comunitario.',
  category: 'education' as const,
  funding_model: 'donation' as const,
  goal_amount_cop: 8_500_000,
  neighborhood: 'Manga',
  budget: [
    { label: 'Libros y material educativo', amount_cop: 4_000_000 },
    { label: 'Mobiliario y adecuaciones', amount_cop: 3_500_000 },
  ],
}

describe('crowdfunding policy', () => {
  it('accepts donation and reward models', () => {
    expect(isAllowedFundingModel('donation')).toBe(true)
    expect(isAllowedFundingModel('reward')).toBe(true)
    expect(createCampaignDraftSchema.safeParse(validDraft).success).toBe(true)
  })

  it.each(['equity', 'debt', 'profit_share', 'revenue_share', 'token_sale'])(
    'rejects investment-like model %s',
    (model) => {
      expect(isInvestmentLikeFundingModel(model)).toBe(true)
      expect(createCampaignDraftSchema.safeParse({ ...validDraft, funding_model: model }).success).toBe(false)
    },
  )

  it('keeps money separate from civic reputation', () => {
    expect(CROWDFUNDING_GUARDRAILS.contributionChangesReputation).toBe(false)
    expect(CROWDFUNDING_GUARDRAILS.amountRaisedChangesReputation).toBe(false)
    expect(CROWDFUNDING_GUARDRAILS.allowsPoliticalCampaignFinance).toBe(false)
  })

  it('rejects budgets above the funding goal', () => {
    const result = createCampaignDraftSchema.safeParse({
      ...validDraft,
      budget: [{ label: 'Presupuesto sobredimensionado', amount_cop: 9_000_000 }],
    })
    expect(result.success).toBe(false)
  })
})
