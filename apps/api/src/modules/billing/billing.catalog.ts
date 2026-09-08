export const ENTITLEMENTS = {
  CIVIC_CORE: 'civic:core',
  COMMUNITY_PARTICIPATION: 'community:participation',
  REPUTATION_CORE: 'reputation:core',
  CROWDFUNDING_CONTRIBUTE: 'crowdfunding:contribute',
  PROJECTS_EXTENDED: 'projects:extended',
  ANALYTICS_ADVANCED: 'analytics:advanced',
  EXPORT_REPORTS: 'exports:reports',
  AI_EXTENDED: 'ai:extended',
  PUBLISHING_AUTOMATION: 'publishing:automation',
  CAMPAIGN_ANALYTICS: 'crowdfunding:analytics',
} as const

export type EntitlementKey = typeof ENTITLEMENTS[keyof typeof ENTITLEMENTS]
export type PlanCode = 'free' | 'pro'
export type BillingCycle = 'monthly' | 'annual'

export interface PlanLimits {
  activeProjects: number
  evidenceStorageMb: number
  aiRequestsPerMonth: number
  scheduledPostsPerMonth: number
}

export interface BillingPlan {
  code: PlanCode
  name: string
  description: string
  priceCop: {
    monthly: number
    annual: number
  }
  entitlements: readonly EntitlementKey[]
  limits: PlanLimits
}

const CORE_ENTITLEMENTS = [
  ENTITLEMENTS.CIVIC_CORE,
  ENTITLEMENTS.COMMUNITY_PARTICIPATION,
  ENTITLEMENTS.REPUTATION_CORE,
  ENTITLEMENTS.CROWDFUNDING_CONTRIBUTE,
] as const satisfies readonly EntitlementKey[]

export const BILLING_PLANS: Record<PlanCode, BillingPlan> = {
  free: {
    code: 'free',
    name: 'Vértice Free',
    description: 'Participa, demuestra impacto y construye reputación cívica sin costo.',
    priceCop: { monthly: 0, annual: 0 },
    entitlements: CORE_ENTITLEMENTS,
    limits: {
      activeProjects: 3,
      evidenceStorageMb: 250,
      aiRequestsPerMonth: 20,
      scheduledPostsPerMonth: 0,
    },
  },
  pro: {
    code: 'pro',
    name: 'Vértice Pro',
    description: 'Herramientas avanzadas de gestión, analítica, IA y reportes para aumentar capacidad operativa.',
    priceCop: { monthly: 15_000, annual: 150_000 },
    entitlements: [
      ...CORE_ENTITLEMENTS,
      ENTITLEMENTS.PROJECTS_EXTENDED,
      ENTITLEMENTS.ANALYTICS_ADVANCED,
      ENTITLEMENTS.EXPORT_REPORTS,
      ENTITLEMENTS.AI_EXTENDED,
      ENTITLEMENTS.PUBLISHING_AUTOMATION,
      ENTITLEMENTS.CAMPAIGN_ANALYTICS,
    ],
    limits: {
      activeProjects: 50,
      evidenceStorageMb: 5_000,
      aiRequestsPerMonth: 500,
      scheduledPostsPerMonth: 100,
    },
  },
}

export const REPUTATION_NEUTRALITY_POLICY = Object.freeze({
  subscriptionChangesScore: false,
  paymentsChangeScore: false,
  donationsChangeScore: false,
  campaignRevenueChangesScore: false,
  sponsorshipChangesScore: false,
})

export function getPlan(planCode: PlanCode): BillingPlan {
  return BILLING_PLANS[planCode]
}

export function planHasEntitlement(planCode: PlanCode, entitlement: EntitlementKey): boolean {
  return BILLING_PLANS[planCode]?.entitlements.includes(entitlement) ?? false
}
