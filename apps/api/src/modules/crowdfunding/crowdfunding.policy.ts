export const CROWDFUNDING_CATEGORIES = [
  'social',
  'emergency',
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

export const FUNDING_POLICIES = ['flexible', 'all_or_nothing', 'milestone'] as const
export type FundingPolicy = typeof FUNDING_POLICIES[number]

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

export const CROWDFUNDING_FEE_POLICY = Object.freeze({
  version: '2026-09-v1',
  socialEmergencyVerifiedBps: 100,
  standardDonationBps: 250,
  rewardPrepurchaseBps: 350,
  socialEmergencyVerifiedPercent: 1,
  standardDonationPercent: 2.5,
  rewardPrepurchasePercent: 3.5,
  tipIsOptional: true,
  platformFeeIsDeductedFromContribution: true,
  providerProcessingFeeIsSeparate: true,
})

export const CROWDFUNDING_GUARDRAILS = Object.freeze({
  allowsPoliticalCampaignFinance: false,
  allowsEquity: false,
  allowsDebt: false,
  allowsProfitShare: false,
  allowsRevenueShare: false,
  contributionChangesReputation: false,
  amountRaisedChangesReputation: false,
  requiresComplianceReviewBeforeActivation: true,
  flexibleCampaignsCanWithdrawBeforeGoal: true,
  rewardsDefaultToAllOrNothing: true,
  pendingContributionsDoNotBlockSettledBalance: true,
})

export function isAllowedFundingModel(value: string): value is AllowedFundingModel {
  return (ALLOWED_FUNDING_MODELS as readonly string[]).includes(value)
}

export function isInvestmentLikeFundingModel(value: string): boolean {
  return (PROHIBITED_INVESTMENT_MODELS as readonly string[]).includes(value)
}

export function defaultFundingPolicy(fundingModel: AllowedFundingModel): FundingPolicy {
  return fundingModel === 'reward' ? 'all_or_nothing' : 'flexible'
}

export function platformFeeBasisPoints(input: {
  category: string
  fundingModel: string
  complianceStatus: string
}): number {
  if (input.fundingModel === 'reward') return CROWDFUNDING_FEE_POLICY.rewardPrepurchaseBps
  if (
    input.complianceStatus === 'verified'
    && (input.category === 'social' || input.category === 'emergency')
  ) {
    return CROWDFUNDING_FEE_POLICY.socialEmergencyVerifiedBps
  }
  return CROWDFUNDING_FEE_POLICY.standardDonationBps
}

export function platformFeeCop(amountCop: number, basisPoints: number): number {
  if (!Number.isSafeInteger(amountCop) || amountCop <= 0) {
    throw new Error('INVALID_CROWDFUNDING_AMOUNT')
  }
  if (!Number.isSafeInteger(basisPoints) || basisPoints < 0 || basisPoints > 10_000) {
    throw new Error('INVALID_PLATFORM_FEE_BPS')
  }
  return Math.round((amountCop * basisPoints) / 10_000)
}
