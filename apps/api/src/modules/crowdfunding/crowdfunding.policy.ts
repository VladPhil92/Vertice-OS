export const CROWDFUNDING_CATEGORIES = [
  'social',
  'community',
  'culture',
  'education',
  'environment',
  'animal_welfare',
  'sports',
  'public_space',
  'technology_civic',
  'social_entrepreneurship',
  'heritage',
] as const

export type CrowdfundingCategory = typeof CROWDFUNDING_CATEGORIES[number]

export const ALLOWED_FUNDING_MODELS = ['donation', 'reward'] as const
export type AllowedFundingModel = typeof ALLOWED_FUNDING_MODELS[number]

export const PROHIBITED_INVESTMENT_MODELS = [
  'equity',
  'debt',
  'profit_share',
  'revenue_share',
  'token_sale',
] as const

export const CAMPAIGN_STATUSES = [
  'draft',
  'review',
  'verified',
  'active',
  'funded',
  'executing',
  'verifying',
  'completed',
  'suspended',
  'investigation',
] as const

export type CampaignStatus = typeof CAMPAIGN_STATUSES[number]

export const PUBLIC_CAMPAIGN_STATUSES: readonly CampaignStatus[] = [
  'verified',
  'active',
  'funded',
  'executing',
  'verifying',
  'completed',
]

export const CROWDFUNDING_GUARDRAILS = Object.freeze({
  allowsPoliticalCampaignFinance: false,
  allowsEquity: false,
  allowsDebt: false,
  allowsProfitShare: false,
  allowsRevenueShare: false,
  contributionChangesReputation: false,
  amountRaisedChangesReputation: false,
  requiresComplianceReviewBeforeActivation: true,
})

export function isAllowedFundingModel(value: string): value is AllowedFundingModel {
  return (ALLOWED_FUNDING_MODELS as readonly string[]).includes(value)
}

export function isInvestmentLikeFundingModel(value: string): boolean {
  return (PROHIBITED_INVESTMENT_MODELS as readonly string[]).includes(value)
}
