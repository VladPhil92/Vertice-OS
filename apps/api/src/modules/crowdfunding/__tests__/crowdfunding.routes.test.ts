jest.mock('../../../lib/redis', () => ({
  redis: { ping: jest.fn().mockResolvedValue('PONG'), get: jest.fn(), set: jest.fn(), del: jest.fn(), on: jest.fn() },
}))

const mockPrismaQueryRaw = jest.fn().mockResolvedValue([])
jest.mock('../../../lib/prisma', () => ({
  prisma: {
    citizen: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn() },
    $queryRaw: mockPrismaQueryRaw,
  },
}))

const mockGetEffectiveBillingAccess = jest.fn()
jest.mock('../../billing/billing.service', () => ({
  getEffectiveBillingAccess: mockGetEffectiveBillingAccess,
}))

const mockCreateCrowdfundingContributionCheckout = jest.fn()
jest.mock('../../billing/payment.service', () => ({
  createCrowdfundingContributionCheckout: mockCreateCrowdfundingContributionCheckout,
}))

const mockCreateCampaignDraft = jest.fn()
const mockListOwnCampaigns = jest.fn()
const mockListPublicCampaigns = jest.fn()
const mockGetCampaignAnalytics = jest.fn()
jest.mock('../crowdfunding.service', () => ({
  createCampaignDraft: mockCreateCampaignDraft,
  listOwnCampaigns: mockListOwnCampaigns,
  listPublicCampaigns: mockListPublicCampaigns,
  getCampaignAnalytics: mockGetCampaignAnalytics,
}))

const mockActivateCampaign = jest.fn()
const mockGetPayoutReadiness = jest.fn()
const mockListComplianceQueue = jest.fn()
const mockRequestPayoutReview = jest.fn()
const mockReviewCampaign = jest.fn()
const mockReviewPayoutProfile = jest.fn()
jest.mock('../crowdfunding.compliance.service', () => ({
  activateCampaign: mockActivateCampaign,
  getPayoutReadiness: mockGetPayoutReadiness,
  listComplianceQueue: mockListComplianceQueue,
  requestPayoutReview: mockRequestPayoutReview,
  reviewCampaign: mockReviewCampaign,
  reviewPayoutProfile: mockReviewPayoutProfile,
}))

const mockPreviewCampaignPayoutDestination = jest.fn()
const mockRegisterVerifiedPayoutDestination = jest.fn()
jest.mock('../../billing/crowdfunding-payout.service', () => ({
  previewCampaignPayoutDestination: mockPreviewCampaignPayoutDestination,
  registerVerifiedPayoutDestination: mockRegisterVerifiedPayoutDestination,
}))

jest.mock('../../../lib/idempotency', () => ({
  normalizeRequestedIdempotencyKey: (value: string | string[] | undefined): string | undefined => {
    const raw = Array.isArray(value) ? value[0] : value
    return raw?.trim() || undefined
  },
  executeIdempotentMutation: async <T>(
    options: IdempotentMutationOptions<T>,
  ): Promise<IdempotentMutationResult<T>> => ({
    value: await options.operation(options.requestedKey ?? 'test-idempotency-key'),
    statusCode: options.successStatus ?? 200,
    replayed: false,
    idempotencyKey: options.requestedKey ?? 'test-idempotency-key',
    keySource: options.requestedKey ? 'client' : 'derived',
  }),
}))

import type { IdempotentMutationOptions, IdempotentMutationResult } from '../../../lib/idempotency'
import { buildApp } from '../../../app'

const app = buildApp()
const CITIZEN_ID = '550e8400-e29b-41d4-a716-446655440001'
const ADMIN_ID = '550e8400-e29b-41d4-a716-446655440002'
const DID = 'did:vertice:550e8400-e29b-41d4-a716-446655440000'
const CAMPAIGN_ID = '660e8400-e29b-41d4-a716-446655440003'

let token: string
let adminToken: string

beforeAll(async () => {
  await app.ready()
  token = app.jwt.sign({ sub: CITIZEN_ID, did: DID, lvl: 1 })
  adminToken = app.jwt.sign({ sub: ADMIN_ID, did: DID, lvl: 1, role: 'admin', sid: 'session-1' })
})
afterAll(() => app.close())
beforeEach(() => {
  jest.resetAllMocks()
  mockPrismaQueryRaw.mockResolvedValue([{ ok: 1 }])
})

describe('GET /crowdfunding/config', () => {
  it('returns the public policy configuration without authentication', async () => {
    const res = await app.inject({ method: 'GET', url: '/crowdfunding/config' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.currency).toBe('COP')
    expect(body.categories).toContain('emergency')
    expect(body.fundingPolicies).toEqual(expect.arrayContaining(['flexible', 'all_or_nothing', 'milestone']))
    expect(body.feePolicy).toEqual(expect.objectContaining({
      socialEmergencyVerifiedPercent: 1,
      standardDonationPercent: 2.5,
      rewardPrepurchasePercent: 3.5,
    }))
  })
})

describe('GET /crowdfunding/campaigns', () => {
  it('lists public campaigns', async () => {
    mockListPublicCampaigns.mockResolvedValue([{ id: CAMPAIGN_ID }])
    const res = await app.inject({ method: 'GET', url: '/crowdfunding/campaigns' })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.payload).campaigns).toHaveLength(1)
  })
})

describe('POST /crowdfunding/campaigns', () => {
  const validBody = {
    title: 'Parque del barrio',
    summary: 'Recuperar el parque comunitario del sector',
    description: 'x'.repeat(100),
    category: 'public_space',
    goal_amount_cop: 1_000_000,
    budget: [{ label: 'Materiales', amount_cop: 500_000 }],
  }

  it('creates a campaign draft', async () => {
    mockCreateCampaignDraft.mockResolvedValue({ id: CAMPAIGN_ID })
    const res = await app.inject({
      method: 'POST', url: '/crowdfunding/campaigns',
      headers: { Authorization: `Bearer ${token}` }, payload: validBody,
    })
    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.payload)
    expect(body.activationRequiresReview).toBe(true)
  })

  it('accepts an explicit funding policy', async () => {
    mockCreateCampaignDraft.mockResolvedValue({ id: CAMPAIGN_ID, funding_policy: 'milestone' })
    const res = await app.inject({
      method: 'POST', url: '/crowdfunding/campaigns',
      headers: { Authorization: `Bearer ${token}` },
      payload: { ...validBody, funding_policy: 'milestone' },
    })
    expect(res.statusCode).toBe(201)
    expect(mockCreateCampaignDraft).toHaveBeenCalledWith(CITIZEN_ID, expect.objectContaining({ funding_policy: 'milestone' }))
  })

  it('rejects flexible funding for reward campaigns', async () => {
    const res = await app.inject({
      method: 'POST', url: '/crowdfunding/campaigns',
      headers: { Authorization: `Bearer ${token}` },
      payload: { ...validBody, funding_model: 'reward', funding_policy: 'flexible' },
    })
    expect(res.statusCode).toBe(400)
    expect(mockCreateCampaignDraft).not.toHaveBeenCalled()
  })

  it('returns 400 for an invalid draft', async () => {
    const res = await app.inject({
      method: 'POST', url: '/crowdfunding/campaigns',
      headers: { Authorization: `Bearer ${token}` }, payload: { ...validBody, title: 'x' },
    })
    expect(res.statusCode).toBe(400)
    expect(mockCreateCampaignDraft).not.toHaveBeenCalled()
  })

  it('returns 401 without a token', async () => {
    const res = await app.inject({ method: 'POST', url: '/crowdfunding/campaigns', payload: validBody })
    expect(res.statusCode).toBe(401)
  })
})

describe('POST /crowdfunding/me/campaigns/:campaignId/activate', () => {
  it('activates the campaign', async () => {
    mockActivateCampaign.mockResolvedValue({ id: CAMPAIGN_ID, status: 'active' })
    const res = await app.inject({
      method: 'POST', url: `/crowdfunding/me/campaigns/${CAMPAIGN_ID}/activate`,
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(mockActivateCampaign).toHaveBeenCalledWith(CITIZEN_ID, CAMPAIGN_ID)
  })

  it('returns 400 for a malformed campaign id', async () => {
    const res = await app.inject({
      method: 'POST', url: '/crowdfunding/me/campaigns/not-a-uuid/activate',
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('GET /crowdfunding/me/analytics', () => {
  it('returns analytics when the citizen holds the required entitlement', async () => {
    mockGetEffectiveBillingAccess.mockResolvedValue({ plan: { code: 'pro' } })
    mockGetCampaignAnalytics.mockResolvedValue({ campaign_count: 1 })

    const res = await app.inject({
      method: 'GET', url: '/crowdfunding/me/analytics',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
  })

  it('returns 403 when the plan lacks the entitlement', async () => {
    mockGetEffectiveBillingAccess.mockResolvedValue({ plan: { code: 'free' } })

    const res = await app.inject({
      method: 'GET', url: '/crowdfunding/me/analytics',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(403)
    const body = JSON.parse(res.payload)
    expect(body.code).toBe('PLAN_UPGRADE_REQUIRED')
    expect(mockGetCampaignAnalytics).not.toHaveBeenCalled()
  })

  it('returns 401 without a token', async () => {
    const res = await app.inject({ method: 'GET', url: '/crowdfunding/me/analytics' })
    expect(res.statusCode).toBe(401)
  })
})

describe('POST /crowdfunding/campaigns/:campaignId/contributions/checkout', () => {
  const validBody = { amount_cop: 20_000, platform_tip_cop: 2_000, is_anonymous: false }

  it('creates a contribution checkout when entitled', async () => {
    mockGetEffectiveBillingAccess.mockResolvedValue({ plan: { code: 'free' } })
    mockCreateCrowdfundingContributionCheckout.mockResolvedValue({ transactionId: 'tx-1', checkoutUrl: 'https://mp.example' })

    const res = await app.inject({
      method: 'POST', url: `/crowdfunding/campaigns/${CAMPAIGN_ID}/contributions/checkout`,
      headers: { Authorization: `Bearer ${token}`, 'idempotency-key': 'cf-key-1' },
      payload: validBody,
    })

    expect(res.statusCode).toBe(201)
    expect(mockCreateCrowdfundingContributionCheckout).toHaveBeenCalledWith(expect.objectContaining({
      citizenId: CITIZEN_ID, campaignId: CAMPAIGN_ID, requestedIdempotencyKey: 'cf-key-1',
    }))
  })

  it('returns 403 when the citizen lacks the contribution entitlement', async () => {
    mockGetEffectiveBillingAccess.mockResolvedValue({ plan: { code: 'blocked' } })
    const res = await app.inject({
      method: 'POST', url: `/crowdfunding/campaigns/${CAMPAIGN_ID}/contributions/checkout`,
      headers: { Authorization: `Bearer ${token}` }, payload: validBody,
    })
    expect(res.statusCode).toBe(403)
  })

  it('returns 400 for an invalid campaign id or body', async () => {
    mockGetEffectiveBillingAccess.mockResolvedValue({ plan: { code: 'free' } })

    const res = await app.inject({
      method: 'POST', url: '/crowdfunding/campaigns/not-a-uuid/contributions/checkout',
      headers: { Authorization: `Bearer ${token}` },
      payload: { amount_cop: -1 },
    })

    expect(res.statusCode).toBe(400)
    expect(mockCreateCrowdfundingContributionCheckout).not.toHaveBeenCalled()
  })
})

describe('GET /crowdfunding/admin/review-queue', () => {
  it('returns the compliance queue for an admin', async () => {
    mockListComplianceQueue.mockResolvedValue({ campaigns: [], payout_profiles: [] })
    const res = await app.inject({
      method: 'GET', url: '/crowdfunding/admin/review-queue',
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(res.statusCode).toBe(200)
  })

  it('returns 403 for a non-admin role', async () => {
    const res = await app.inject({
      method: 'GET', url: '/crowdfunding/admin/review-queue',
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
  })
})

describe('POST /crowdfunding/admin/campaigns/:campaignId/review', () => {
  it('reviews a campaign', async () => {
    mockReviewCampaign.mockResolvedValue({ id: CAMPAIGN_ID, status: 'verified' })
    const res = await app.inject({
      method: 'POST', url: `/crowdfunding/admin/campaigns/${CAMPAIGN_ID}/review`,
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { decision: 'approve' },
    })
    expect(res.statusCode).toBe(200)
  })

  it('returns 400 for an invalid review payload', async () => {
    const res = await app.inject({
      method: 'POST', url: `/crowdfunding/admin/campaigns/${CAMPAIGN_ID}/review`,
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { decision: 'not-a-decision' },
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('POST /crowdfunding/admin/payout-profiles/:citizenId/review', () => {
  it('reviews a payout profile', async () => {
    mockReviewPayoutProfile.mockResolvedValue({ verification_status: 'verified' })
    const res = await app.inject({
      method: 'POST', url: `/crowdfunding/admin/payout-profiles/${CITIZEN_ID}/review`,
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { decision: 'approve', provider_reference: 'ref-1' },
    })
    expect(res.statusCode).toBe(200)
    expect(mockReviewPayoutProfile).toHaveBeenCalledWith(ADMIN_ID, CITIZEN_ID, expect.objectContaining({ decision: 'approve' }))
  })

  it('returns 400 for an invalid citizen id', async () => {
    const res = await app.inject({
      method: 'POST', url: '/crowdfunding/admin/payout-profiles/not-a-uuid/review',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { decision: 'approve' },
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('GET /crowdfunding/me/payout-readiness', () => {
  it('returns payout readiness for the authenticated citizen', async () => {
    mockGetPayoutReadiness.mockResolvedValue({ identity_verified: true })
    const res = await app.inject({
      method: 'GET', url: '/crowdfunding/me/payout-readiness',
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
  })
})

describe('POST /crowdfunding/me/payout-readiness/request-review', () => {
  it('requests a payout review', async () => {
    mockRequestPayoutReview.mockResolvedValue({ verification_status: 'in_review' })
    const res = await app.inject({
      method: 'POST', url: '/crowdfunding/me/payout-readiness/request-review',
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
  })
})

describe('POST /crowdfunding/me/payout-destination/preview', () => {
  it('returns the masked destination preview', async () => {
    mockPreviewCampaignPayoutDestination.mockResolvedValue({ holderName: 'Juana Pérez' })
    const res = await app.inject({
      method: 'POST', url: '/crowdfunding/me/payout-destination/preview',
      headers: { Authorization: `Bearer ${token}` },
      payload: { keyType: 'MAIL', key: 'juana@example.com' },
    })
    expect(res.statusCode).toBe(200)
  })

  it('returns 400 for a malformed BRE-B key', async () => {
    const res = await app.inject({
      method: 'POST', url: '/crowdfunding/me/payout-destination/preview',
      headers: { Authorization: `Bearer ${token}` },
      payload: { keyType: 'PHONE', key: 'not-a-phone' },
    })
    expect(res.statusCode).toBe(400)
    expect(mockPreviewCampaignPayoutDestination).not.toHaveBeenCalled()
  })

  it('returns 401 without a token', async () => {
    const res = await app.inject({
      method: 'POST', url: '/crowdfunding/me/payout-destination/preview',
      payload: { keyType: 'MAIL', key: 'juana@example.com' },
    })
    expect(res.statusCode).toBe(401)
  })
})

describe('POST /crowdfunding/me/payout-destination', () => {
  const validBody = {
    keyType: 'MAIL', key: 'juana@example.com',
    confirmedHolderName: 'Juana Pérez', confirmedFinancialEntityCode: '1234',
  }

  it('registers the confirmed payout destination for the authenticated citizen', async () => {
    mockRegisterVerifiedPayoutDestination.mockResolvedValue({ registered: true, keyType: 'MAIL' })
    const res = await app.inject({
      method: 'POST', url: '/crowdfunding/me/payout-destination',
      headers: { Authorization: `Bearer ${token}` },
      payload: validBody,
    })
    expect(res.statusCode).toBe(200)
    expect(mockRegisterVerifiedPayoutDestination).toHaveBeenCalledWith(expect.objectContaining({
      citizenId: CITIZEN_ID, key: 'juana@example.com', keyType: 'MAIL',
    }))
  })

  it('returns 400 for a malformed BRE-B key', async () => {
    const res = await app.inject({
      method: 'POST', url: '/crowdfunding/me/payout-destination',
      headers: { Authorization: `Bearer ${token}` },
      payload: { ...validBody, keyType: 'PHONE', key: 'not-a-phone' },
    })
    expect(res.statusCode).toBe(400)
    expect(mockRegisterVerifiedPayoutDestination).not.toHaveBeenCalled()
  })

  it('returns 401 without a token', async () => {
    const res = await app.inject({
      method: 'POST', url: '/crowdfunding/me/payout-destination',
      payload: validBody,
    })
    expect(res.statusCode).toBe(401)
  })
})

describe('GET /crowdfunding/me/campaigns', () => {
  it('lists campaigns owned by the authenticated citizen', async () => {
    mockListOwnCampaigns.mockResolvedValue([{ id: CAMPAIGN_ID }])
    const res = await app.inject({
      method: 'GET', url: '/crowdfunding/me/campaigns',
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(mockListOwnCampaigns).toHaveBeenCalledWith(CITIZEN_ID)
  })
})
