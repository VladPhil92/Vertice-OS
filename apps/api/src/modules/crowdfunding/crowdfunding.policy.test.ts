import { createCampaignDraftSchema } from './crowdfunding.schema'
import {
  CROWDFUNDING_FEE_POLICY,
  CROWDFUNDING_GUARDRAILS,
  defaultFundingPolicy,
  isAllowedFundingModel,
  isInvestmentLikeFundingModel,
  platformFeeBasisPoints,
  platformFeeCop,
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

  it('defaults donations to flexible and rewards to all-or-nothing', () => {
    expect(defaultFundingPolicy('donation')).toBe('flexible')
    expect(defaultFundingPolicy('reward')).toBe('all_or_nothing')
  })

  it('does not allow reward/prepurchase campaigns to opt into flexible funding', () => {
    const result = createCampaignDraftSchema.safeParse({
      ...validDraft,
      funding_model: 'reward',
      funding_policy: 'flexible',
    })
    expect(result.success).toBe(false)
  })

  it('allows milestone funding for donation campaigns', () => {
    expect(createCampaignDraftSchema.safeParse({
      ...validDraft,
      funding_policy: 'milestone',
    }).success).toBe(true)
  })

  it('charges 1% to verified social and emergency causes', () => {
    expect(platformFeeBasisPoints({
      category: 'social', fundingModel: 'donation', complianceStatus: 'verified',
    })).toBe(100)
    expect(platformFeeBasisPoints({
      category: 'emergency', fundingModel: 'donation', complianceStatus: 'verified',
    })).toBe(100)
  })

  it('charges 2.5% to standard donation/community/cultural/educational/civic campaigns', () => {
    expect(platformFeeBasisPoints({
      category: 'community', fundingModel: 'donation', complianceStatus: 'verified',
    })).toBe(250)
    expect(platformFeeBasisPoints({
      category: 'education', fundingModel: 'donation', complianceStatus: 'verified',
    })).toBe(250)
  })

  it('charges 3.5% to reward/prepurchase campaigns regardless of category', () => {
    expect(platformFeeBasisPoints({
      category: 'social', fundingModel: 'reward', complianceStatus: 'verified',
    })).toBe(350)
  })

  it('does not grant the 1% social/emergency rate before verification', () => {
    expect(platformFeeBasisPoints({
      category: 'social', fundingModel: 'donation', complianceStatus: 'pending',
    })).toBe(250)
  })

  it('calculates immutable COP fees using basis points', () => {
    expect(platformFeeCop(100_000, CROWDFUNDING_FEE_POLICY.socialEmergencyVerifiedBps)).toBe(1_000)
    expect(platformFeeCop(100_000, CROWDFUNDING_FEE_POLICY.standardDonationBps)).toBe(2_500)
    expect(platformFeeCop(100_000, CROWDFUNDING_FEE_POLICY.rewardPrepurchaseBps)).toBe(3_500)
  })
})
