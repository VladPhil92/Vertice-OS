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

export type CrowdfundingCategoryDefinition = Readonly<{
  id: CrowdfundingCategory
  label: string
  description: string
  suggestedFundingPolicy: FundingPolicy
}>

export const CROWDFUNDING_CATEGORY_CATALOG: readonly CrowdfundingCategoryDefinition[] = Object.freeze([
  { id: 'social', label: 'Ayuda social', description: 'Apoyo a personas, familias o colectivos ante necesidades sociales verificables.', suggestedFundingPolicy: 'flexible' },
  { id: 'emergency', label: 'Emergencias', description: 'Respuesta urgente a contingencias, desastres o necesidades humanitarias verificadas.', suggestedFundingPolicy: 'flexible' },
  { id: 'community', label: 'Proyectos comunitarios', description: 'Iniciativas colectivas de barrio, localidad o comunidad con resultados medibles.', suggestedFundingPolicy: 'milestone' },
  { id: 'culture', label: 'Cultura', description: 'Producción, circulación o preservación de iniciativas culturales con presupuesto definido.', suggestedFundingPolicy: 'all_or_nothing' },
  { id: 'education', label: 'Educación', description: 'Programas, dotaciones y experiencias educativas con entregables verificables.', suggestedFundingPolicy: 'milestone' },
  { id: 'environment', label: 'Medio ambiente', description: 'Conservación, recuperación y acción ambiental con evidencias de ejecución.', suggestedFundingPolicy: 'milestone' },
  { id: 'animal_welfare', label: 'Bienestar animal', description: 'Rescate, atención, protección y bienestar animal con trazabilidad del uso de recursos.', suggestedFundingPolicy: 'flexible' },
  { id: 'sports', label: 'Deporte', description: 'Actividades, equipos, eventos o infraestructura deportiva con una meta económica definida.', suggestedFundingPolicy: 'all_or_nothing' },
  { id: 'public_space', label: 'Espacio público', description: 'Recuperación, mejoramiento o apropiación responsable de espacios de uso colectivo.', suggestedFundingPolicy: 'milestone' },
  { id: 'technology_civic', label: 'Tecnología cívica', description: 'Herramientas digitales orientadas a resolver problemas públicos o comunitarios.', suggestedFundingPolicy: 'milestone' },
  { id: 'social_entrepreneurship', label: 'Emprendimiento social', description: 'Proyectos productivos con propósito social; recaudo sin ofrecer participación, deuda ni rentabilidad.', suggestedFundingPolicy: 'milestone' },
  { id: 'heritage', label: 'Patrimonio', description: 'Protección, restauración y divulgación de patrimonio material o inmaterial.', suggestedFundingPolicy: 'milestone' },
])

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