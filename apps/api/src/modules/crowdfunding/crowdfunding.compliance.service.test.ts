jest.mock('../../lib/prisma', () => ({
  prisma: { $queryRaw: jest.fn(), $executeRaw: jest.fn() },
}))

import { prisma } from '../../lib/prisma'
import {
  activateCampaign,
  getPayoutReadiness,
  listComplianceQueue,
  requestPayoutReview,
  reviewCampaign,
  reviewPayoutProfile,
} from './crowdfunding.compliance.service'

const mockQueryRaw = prisma.$queryRaw as jest.Mock
const mockExecuteRaw = prisma.$executeRaw as jest.Mock

beforeEach(() => {
  jest.resetAllMocks()
  mockExecuteRaw.mockResolvedValue(undefined)
})

describe('getPayoutReadiness', () => {
  it('fails when the citizen does not exist', async () => {
    mockQueryRaw.mockResolvedValueOnce([])

    await expect(getPayoutReadiness('citizen-1')).rejects.toMatchObject({
      statusCode: 404, code: 'CITIZEN_NOT_FOUND',
    })
  })

  it('reports unverified identity with no payout profile as not eligible', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ verification_level: 0 }])
      .mockResolvedValueOnce([])

    const readiness = await getPayoutReadiness('citizen-1')

    expect(readiness).toEqual({
      identity_verified: false,
      verification_status: 'pending',
      payout_status: 'disabled',
      requested_at: null,
      verified_at: null,
      review_notes: null,
      can_request_review: false,
      can_activate_campaign: false,
    })
  })

  it('allows requesting review once identity is verified and no profile exists yet', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ verification_level: 1 }])
      .mockResolvedValueOnce([])

    const readiness = await getPayoutReadiness('citizen-1')

    expect(readiness.can_request_review).toBe(true)
    expect(readiness.can_activate_campaign).toBe(false)
  })

  it('reports full activation readiness once the payout profile is verified and eligible', async () => {
    const requestedAt = new Date('2026-08-01T00:00:00.000Z')
    const verifiedAt = new Date('2026-08-05T00:00:00.000Z')
    mockQueryRaw
      .mockResolvedValueOnce([{ verification_level: 1 }])
      .mockResolvedValueOnce([{
        verification_status: 'verified',
        payout_status: 'eligible',
        requested_at: requestedAt,
        verified_at: verifiedAt,
        review_notes: 'OK',
      }])

    const readiness = await getPayoutReadiness('citizen-1')

    expect(readiness.can_request_review).toBe(false)
    expect(readiness.can_activate_campaign).toBe(true)
    expect(readiness.requested_at).toBe(requestedAt.toISOString())
    expect(readiness.verified_at).toBe(verifiedAt.toISOString())
  })
})

describe('requestPayoutReview', () => {
  it('rejects when identity is not verified', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ verification_level: 0 }])
      .mockResolvedValueOnce([])

    await expect(requestPayoutReview('citizen-1')).rejects.toMatchObject({
      statusCode: 403, code: 'IDENTITY_NOT_VERIFIED',
    })
    expect(mockExecuteRaw).not.toHaveBeenCalled()
  })

  it('returns readiness as-is when already verified', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ verification_level: 1 }])
      .mockResolvedValueOnce([{ verification_status: 'verified', payout_status: 'eligible', requested_at: null, verified_at: null, review_notes: null }])

    const result = await requestPayoutReview('citizen-1')

    expect(result.verification_status).toBe('verified')
    expect(mockExecuteRaw).not.toHaveBeenCalled()
  })

  it('returns readiness as-is when already in review', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ verification_level: 1 }])
      .mockResolvedValueOnce([{ verification_status: 'in_review', payout_status: 'disabled', requested_at: null, verified_at: null, review_notes: null }])

    await requestPayoutReview('citizen-1')

    expect(mockExecuteRaw).not.toHaveBeenCalled()
  })

  it('rejects when the profile is suspended', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ verification_level: 1 }])
      .mockResolvedValueOnce([{ verification_status: 'suspended', payout_status: 'blocked', requested_at: null, verified_at: null, review_notes: null }])

    await expect(requestPayoutReview('citizen-1')).rejects.toMatchObject({
      statusCode: 409, code: 'PAYOUT_PROFILE_SUSPENDED',
    })
  })

  it('opens a new review when pending or rejected', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ verification_level: 1 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ verification_level: 1 }])
      .mockResolvedValueOnce([{ verification_status: 'in_review', payout_status: 'disabled', requested_at: new Date(), verified_at: null, review_notes: null }])

    const result = await requestPayoutReview('citizen-1')

    expect(mockExecuteRaw).toHaveBeenCalledTimes(1)
    expect(result.verification_status).toBe('in_review')
  })
})

describe('reviewPayoutProfile', () => {
  it('fails when the target citizen does not exist', async () => {
    mockQueryRaw.mockResolvedValueOnce([])

    await expect(
      reviewPayoutProfile('reviewer-1', 'target-1', { decision: 'approve', provider_reference: 'ref-1' } as never),
    ).rejects.toMatchObject({ statusCode: 404, code: 'CITIZEN_NOT_FOUND' })
  })

  it('rejects approval without verified identity', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ verification_level: 0 }])

    await expect(
      reviewPayoutProfile('reviewer-1', 'target-1', { decision: 'approve', provider_reference: 'ref-1' } as never),
    ).rejects.toMatchObject({ statusCode: 409, code: 'IDENTITY_NOT_VERIFIED' })
  })

  it('rejects approval without a provider reference', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ verification_level: 1 }])

    await expect(
      reviewPayoutProfile('reviewer-1', 'target-1', { decision: 'approve' } as never),
    ).rejects.toMatchObject({ statusCode: 400, code: 'PROVIDER_REFERENCE_REQUIRED' })
  })

  it('approves and grants eligible payout status', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ verification_level: 1 }])
      .mockResolvedValueOnce([{ verification_level: 1 }])
      .mockResolvedValueOnce([{
        verification_status: 'verified', payout_status: 'eligible',
        requested_at: null, verified_at: new Date(), review_notes: null,
      }])

    const result = await reviewPayoutProfile('reviewer-1', 'target-1', {
      decision: 'approve', provider_reference: 'ref-1',
    } as never)

    expect(mockExecuteRaw).toHaveBeenCalledTimes(1)
    expect(result.payout_status).toBe('eligible')
  })

  it('suspends a profile', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ verification_level: 1 }])
      .mockResolvedValueOnce([{ verification_level: 1 }])
      .mockResolvedValueOnce([{
        verification_status: 'suspended', payout_status: 'blocked',
        requested_at: null, verified_at: null, review_notes: 'Suspendido',
      }])

    const result = await reviewPayoutProfile('reviewer-1', 'target-1', { decision: 'suspend' } as never)

    expect(result.verification_status).toBe('suspended')
  })

  it('rejects a profile', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ verification_level: 1 }])
      .mockResolvedValueOnce([{ verification_level: 1 }])
      .mockResolvedValueOnce([{
        verification_status: 'rejected', payout_status: 'blocked',
        requested_at: null, verified_at: null, review_notes: null,
      }])

    const result = await reviewPayoutProfile('reviewer-1', 'target-1', { decision: 'reject' } as never)

    expect(result.verification_status).toBe('rejected')
  })
})

describe('listComplianceQueue', () => {
  it('lists formally submitted campaigns and payout profiles in parallel', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{
        id: 'c1', creator_citizen_id: 'u1', title: 'X', category: 'infra', funding_model: 'donation',
        goal_amount_cop: 100n, compliance_status: 'in_review', status: 'review', created_at: new Date('2026-09-01T00:00:00.000Z'),
      }])
      .mockResolvedValueOnce([{
        citizen_id: 'u2', verification_status: 'in_review', payout_status: 'disabled', requested_at: null,
      }])

    const result = await listComplianceQueue()

    expect(result.campaigns[0].status).toBe('review')
    expect(result.campaigns[0].goal_amount_cop).toBe(100)
    expect(result.payout_profiles[0].requested_at).toBeNull()
  })
})

describe('reviewCampaign', () => {
  it('fails when the campaign does not exist', async () => {
    mockQueryRaw.mockResolvedValueOnce([])

    await expect(reviewCampaign('campaign-1', { decision: 'approve' } as never)).rejects.toMatchObject({
      statusCode: 404, code: 'CAMPAIGN_NOT_FOUND',
    })
  })

  it('does not approve a draft that was never submitted', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ id: 'campaign-1', status: 'draft', compliance_status: 'pending' }])

    await expect(reviewCampaign('campaign-1', { decision: 'approve' } as never)).rejects.toMatchObject({
      statusCode: 409, code: 'CAMPAIGN_NOT_IN_REVIEW',
    })
    expect(mockExecuteRaw).not.toHaveBeenCalled()
  })

  it('approves a formally submitted campaign', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ id: 'campaign-1', status: 'review', compliance_status: 'in_review' }])
      .mockResolvedValueOnce([{ id: 'campaign-1', status: 'verified', compliance_status: 'verified', review_notes: null }])

    const result = await reviewCampaign('campaign-1', { decision: 'approve' } as never)

    expect(result.status).toBe('verified')
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1)
  })

  it('rejects a campaign only with review notes', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ id: 'campaign-1', status: 'review', compliance_status: 'in_review' }])
      .mockResolvedValueOnce([{ id: 'campaign-1', status: 'review', compliance_status: 'rejected', review_notes: 'No cumple' }])

    const result = await reviewCampaign('campaign-1', { decision: 'reject', notes: 'No cumple' } as never)

    expect(result.compliance_status).toBe('rejected')
  })

  it('requires notes before suspension', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ id: 'campaign-1', status: 'review', compliance_status: 'in_review' }])

    await expect(reviewCampaign('campaign-1', { decision: 'suspend' } as never)).rejects.toMatchObject({
      statusCode: 400, code: 'CAMPAIGN_REVIEW_NOTES_REQUIRED',
    })
  })

  it('suspends a campaign with a documented reason', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ id: 'campaign-1', status: 'review', compliance_status: 'in_review' }])
      .mockResolvedValueOnce([{ id: 'campaign-1', status: 'suspended', compliance_status: 'suspended', review_notes: 'Riesgo documental detectado.' }])

    const result = await reviewCampaign('campaign-1', { decision: 'suspend', notes: 'Riesgo documental detectado.' } as never)

    expect(result.status).toBe('suspended')
  })
})

describe('activateCampaign', () => {
  it('rejects activation when payout readiness is not met', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ verification_level: 0 }])
      .mockResolvedValueOnce([])

    await expect(activateCampaign('citizen-1', 'campaign-1')).rejects.toMatchObject({
      statusCode: 409, code: 'PAYOUT_PROFILE_NOT_READY',
    })
  })

  it('activates a campaign that meets every condition', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ verification_level: 1 }])
      .mockResolvedValueOnce([{ verification_status: 'verified', payout_status: 'eligible', requested_at: null, verified_at: null, review_notes: null }])
      .mockResolvedValueOnce([{ id: 'campaign-1', status: 'active', starts_at: new Date('2026-09-01T00:00:00.000Z'), ends_at: null }])

    const result = await activateCampaign('citizen-1', 'campaign-1')

    expect(result).toEqual({
      id: 'campaign-1', status: 'active', starts_at: '2026-09-01T00:00:00.000Z', ends_at: null,
    })
  })

  it('rejects activation when the campaign row does not satisfy the update conditions', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ verification_level: 1 }])
      .mockResolvedValueOnce([{ verification_status: 'verified', payout_status: 'eligible', requested_at: null, verified_at: null, review_notes: null }])
      .mockResolvedValueOnce([])

    await expect(activateCampaign('citizen-1', 'campaign-1')).rejects.toMatchObject({
      statusCode: 409, code: 'CAMPAIGN_NOT_ACTIVATABLE',
    })
  })
})
