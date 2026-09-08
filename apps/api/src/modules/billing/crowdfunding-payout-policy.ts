import type { FundingPolicy } from '../crowdfunding/crowdfunding.policy'

export type CampaignFundingSnapshot = {
  status: string
  fundingPolicy: FundingPolicy
  goalAmountCop: number
  raisedAmountCop: number
}

export type FundingEligibility = {
  eligible: boolean
  code: 'CAMPAIGN_NOT_PAYOUT_READY' | 'CAMPAIGN_GOAL_NOT_REACHED' | null
  shouldMarkFunded: boolean
}

export function evaluateFundingEligibility(input: CampaignFundingSnapshot): FundingEligibility {
  if (!['active', 'funded', 'executing'].includes(input.status)) {
    return { eligible: false, code: 'CAMPAIGN_NOT_PAYOUT_READY', shouldMarkFunded: false }
  }

  if (input.fundingPolicy === 'all_or_nothing') {
    if (input.raisedAmountCop < input.goalAmountCop) {
      return { eligible: false, code: 'CAMPAIGN_GOAL_NOT_REACHED', shouldMarkFunded: false }
    }
    return {
      eligible: true,
      code: null,
      shouldMarkFunded: input.status === 'active',
    }
  }

  return { eligible: true, code: null, shouldMarkFunded: false }
}

export function computeDisbursableAmount(input: {
  netPaidCop: number
  disbursedCop: number
  fundingPolicy: FundingPolicy
  verifiedMilestoneCapCop?: number | null
}): number {
  const settledAvailable = Math.max(0, input.netPaidCop - input.disbursedCop)
  if (input.fundingPolicy !== 'milestone') return settledAvailable

  const milestoneCap = Math.max(0, input.verifiedMilestoneCapCop ?? 0)
  const milestoneAvailable = Math.max(0, milestoneCap - input.disbursedCop)
  return Math.min(settledAvailable, milestoneAvailable)
}
