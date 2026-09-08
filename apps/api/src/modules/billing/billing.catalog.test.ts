import {
  BILLING_PLANS,
  ENTITLEMENTS,
  REPUTATION_NEUTRALITY_POLICY,
  planHasEntitlement,
} from './billing.catalog'

describe('billing catalog', () => {
  it('keeps the agreed Vértice Pro launch pricing', () => {
    expect(BILLING_PLANS.free.priceCop.monthly).toBe(0)
    expect(BILLING_PLANS.pro.priceCop.monthly).toBe(15_000)
    expect(BILLING_PLANS.pro.priceCop.annual).toBe(150_000)
  })

  it('keeps civic participation and reputation available on Free', () => {
    expect(planHasEntitlement('free', ENTITLEMENTS.CIVIC_CORE)).toBe(true)
    expect(planHasEntitlement('free', ENTITLEMENTS.COMMUNITY_PARTICIPATION)).toBe(true)
    expect(planHasEntitlement('free', ENTITLEMENTS.REPUTATION_CORE)).toBe(true)
    expect(planHasEntitlement('free', ENTITLEMENTS.CROWDFUNDING_CONTRIBUTE)).toBe(true)
  })

  it('reserves productivity capabilities for Pro', () => {
    expect(planHasEntitlement('free', ENTITLEMENTS.ANALYTICS_ADVANCED)).toBe(false)
    expect(planHasEntitlement('free', ENTITLEMENTS.EXPORT_REPORTS)).toBe(false)
    expect(planHasEntitlement('pro', ENTITLEMENTS.ANALYTICS_ADVANCED)).toBe(true)
    expect(planHasEntitlement('pro', ENTITLEMENTS.EXPORT_REPORTS)).toBe(true)
  })

  it('never sells civic reputation or ranking power', () => {
    expect(REPUTATION_NEUTRALITY_POLICY).toEqual({
      subscriptionChangesScore: false,
      paymentsChangeScore: false,
      donationsChangeScore: false,
      campaignRevenueChangesScore: false,
      sponsorshipChangesScore: false,
    })
  })
})
