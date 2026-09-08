import {
  evaluateCampaignReadiness,
  evaluateFundingReadiness,
  type FundingReadinessSnapshot,
} from './crowdfunding.readiness.service'

function baseSnapshot(overrides: Partial<FundingReadinessSnapshot> = {}): FundingReadinessSnapshot {
  return {
    identityVerified: true,
    payoutProfile: {
      verification_status: 'verified',
      payout_status: 'eligible',
      destination_fingerprint: 'fingerprint',
      destination_key_type: 'PHONE',
      requested_at: null,
      verified_at: null,
      review_notes: null,
    },
    capabilities: {
      ctg_one_federation: 'ready',
      payments: 'ready',
      crowdfunding_payments: 'ready',
      payouts: 'ready',
      crowdfunding_payouts: 'disabled',
    },
    payoutCertificationStatus: 'verified',
    ...overrides,
  }
}

describe('evaluateFundingReadiness', () => {
  it('is ready only when user and platform collection prerequisites are complete', () => {
    const result = evaluateFundingReadiness(baseSnapshot())

    expect(result.user_ready).toBe(true)
    expect(result.platform_ready).toBe(true)
    expect(result.ready_for_campaign_activation).toBe(true)
    expect(result.blockers).toEqual([])
  })

  it('fails closed when collection and payout providers are disabled', () => {
    const result = evaluateFundingReadiness(baseSnapshot({
      capabilities: {
        ctg_one_federation: 'ready',
        payments: 'disabled',
        crowdfunding_payments: 'disabled',
        payouts: 'disabled',
        crowdfunding_payouts: 'disabled',
      },
      payoutCertificationStatus: null,
    }))

    expect(result.ready_for_campaign_activation).toBe(false)
    expect(result.blockers.map((item) => item.code)).toEqual(expect.arrayContaining([
      'COLLECTION_RAIL_DISABLED',
      'PAYOUT_PROVIDER_DISABLED',
    ]))
  })

  it('requires identity before payout profile review can become actionable', () => {
    const result = evaluateFundingReadiness(baseSnapshot({
      identityVerified: false,
      payoutProfile: null,
    }))

    expect(result.identity.state).toBe('action_required')
    expect(result.payout_profile.can_request_review).toBe(false)
    expect(result.blockers[0].code).toBe('IDENTITY_VERIFICATION_REQUIRED')
  })

  it('reports an in-review payout profile as pending instead of reusable action', () => {
    const result = evaluateFundingReadiness(baseSnapshot({
      payoutProfile: {
        verification_status: 'in_review',
        payout_status: 'disabled',
        destination_fingerprint: null,
        destination_key_type: null,
        requested_at: null,
        verified_at: null,
        review_notes: null,
      },
    }))

    expect(result.payout_profile.state).toBe('pending_review')
    expect(result.payout_profile.can_request_review).toBe(false)
    expect(result.blockers.some((item) => item.code === 'PAYOUT_PROFILE_REVIEW_PENDING')).toBe(true)
  })

  it('requires a beneficiary-bound BRE-B destination after profile approval', () => {
    const result = evaluateFundingReadiness(baseSnapshot({
      payoutProfile: {
        verification_status: 'verified',
        payout_status: 'eligible',
        destination_fingerprint: null,
        destination_key_type: null,
        requested_at: null,
        verified_at: null,
        review_notes: null,
      },
    }))

    expect(result.payout_destination.state).toBe('action_required')
    expect(result.blockers.some((item) => item.code === 'PAYOUT_DESTINATION_REQUIRED')).toBe(true)
  })

  it('requires a verified payout certification even when provider credentials are ready', () => {
    const result = evaluateFundingReadiness(baseSnapshot({ payoutCertificationStatus: 'pending' }))

    expect(result.platform_ready).toBe(false)
    expect(result.blockers.some((item) => item.code === 'PAYOUT_CERTIFICATION_REQUIRED')).toBe(true)
  })
})

describe('evaluateCampaignReadiness', () => {
  it('requires formal review for drafts', () => {
    const funding = evaluateFundingReadiness(baseSnapshot())
    const result = evaluateCampaignReadiness({
      id: 'campaign-1',
      title: 'Campaña',
      status: 'draft',
      compliance_status: 'pending',
      review_notes: null,
    }, funding)

    expect(result.can_activate).toBe(false)
    expect(result.blockers[0].code).toBe('CAMPAIGN_REVIEW_REQUIRED')
  })

  it('activates only a verified campaign with complete funding readiness', () => {
    const funding = evaluateFundingReadiness(baseSnapshot())
    const result = evaluateCampaignReadiness({
      id: 'campaign-1',
      title: 'Campaña',
      status: 'verified',
      compliance_status: 'verified',
      review_notes: null,
    }, funding)

    expect(result.lifecycle_ready).toBe(true)
    expect(result.can_activate).toBe(true)
  })

  it('never reports contribution checkout ready when collection rail is disabled', () => {
    const funding = evaluateFundingReadiness(baseSnapshot({
      capabilities: {
        ctg_one_federation: 'ready',
        payments: 'disabled',
        crowdfunding_payments: 'disabled',
        payouts: 'ready',
        crowdfunding_payouts: 'disabled',
      },
    }))
    const result = evaluateCampaignReadiness({
      id: 'campaign-1',
      title: 'Campaña',
      status: 'active',
      compliance_status: 'verified',
      review_notes: null,
    }, funding)

    expect(result.can_accept_contributions).toBe(false)
    expect(result.blockers.some((item) => item.code === 'COLLECTION_RAIL_DISABLED')).toBe(true)
  })
})
