import {
  computeDisbursableAmount,
  evaluateFundingEligibility,
} from '../crowdfunding-payout-policy'

describe('crowdfunding payout funding policy', () => {
  it('allows a flexible campaign to withdraw settled balance before reaching its goal', () => {
    expect(evaluateFundingEligibility({
      status: 'active',
      fundingPolicy: 'flexible',
      goalAmountCop: 5_000_000,
      raisedAmountCop: 350_000,
    })).toEqual({ eligible: true, code: null, shouldMarkFunded: false })
  })

  it('blocks an all-or-nothing campaign until the goal is reached', () => {
    expect(evaluateFundingEligibility({
      status: 'active',
      fundingPolicy: 'all_or_nothing',
      goalAmountCop: 5_000_000,
      raisedAmountCop: 4_999_999,
    })).toEqual({
      eligible: false,
      code: 'CAMPAIGN_GOAL_NOT_REACHED',
      shouldMarkFunded: false,
    })
  })

  it('marks an active all-or-nothing campaign funded once the goal is reached', () => {
    expect(evaluateFundingEligibility({
      status: 'active',
      fundingPolicy: 'all_or_nothing',
      goalAmountCop: 5_000_000,
      raisedAmountCop: 5_000_000,
    })).toEqual({ eligible: true, code: null, shouldMarkFunded: true })
  })

  it('blocks draft and other non-payout lifecycle states', () => {
    expect(evaluateFundingEligibility({
      status: 'draft',
      fundingPolicy: 'flexible',
      goalAmountCop: 1_000_000,
      raisedAmountCop: 500_000,
    }).code).toBe('CAMPAIGN_NOT_PAYOUT_READY')
  })

  it('uses net paid principal after platform fees for flexible payouts', () => {
    expect(computeDisbursableAmount({
      netPaidCop: 975_000,
      disbursedCop: 200_000,
      fundingPolicy: 'flexible',
    })).toBe(775_000)
  })

  it('allows repeated flexible payouts by subtracting already disbursed balance', () => {
    expect(computeDisbursableAmount({
      netPaidCop: 2_500_000,
      disbursedCop: 1_750_000,
      fundingPolicy: 'flexible',
    })).toBe(750_000)
  })

  it('caps milestone payouts at verified milestone capacity', () => {
    expect(computeDisbursableAmount({
      netPaidCop: 4_000_000,
      disbursedCop: 500_000,
      fundingPolicy: 'milestone',
      verifiedMilestoneCapCop: 1_500_000,
    })).toBe(1_000_000)
  })

  it('does not release milestone funds without verified milestone capacity', () => {
    expect(computeDisbursableAmount({
      netPaidCop: 4_000_000,
      disbursedCop: 0,
      fundingPolicy: 'milestone',
      verifiedMilestoneCapCop: 0,
    })).toBe(0)
  })
})
