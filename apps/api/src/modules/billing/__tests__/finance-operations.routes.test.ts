jest.mock('../../../lib/redis', () => ({
  redis: { ping: jest.fn().mockResolvedValue('PONG'), get: jest.fn(), set: jest.fn(), del: jest.fn(), on: jest.fn() },
}))

const mockPrismaQueryRaw = jest.fn().mockResolvedValue([{ ok: 1 }])
jest.mock('../../../lib/prisma', () => ({
  prisma: {
    citizen: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn() },
    $queryRaw: mockPrismaQueryRaw,
  },
}))

const mockEnqueueJob = jest.fn()
jest.mock('../../../lib/jobs', () => ({ enqueueJob: mockEnqueueJob }))

const mockGetFinanceOperationsStatus = jest.fn()
const mockListFinanceRiskFlags = jest.fn()
const mockReconcileFinanceLedger = jest.fn()
const mockRequestCrowdfundingRefund = jest.fn()
const mockReviewFinanceRiskFlag = jest.fn()
const mockScanFinanceRisk = jest.fn()
const mockBuildAccountingExport = jest.fn()
jest.mock('../finance-operations.service', () => ({
  buildAccountingExport: mockBuildAccountingExport,
  getFinanceOperationsStatus: mockGetFinanceOperationsStatus,
  listFinanceRiskFlags: mockListFinanceRiskFlags,
  reconcileFinanceLedger: mockReconcileFinanceLedger,
  requestCrowdfundingRefund: mockRequestCrowdfundingRefund,
  reviewFinanceRiskFlag: mockReviewFinanceRiskFlag,
  scanFinanceRisk: mockScanFinanceRisk,
}))

const mockListCampaignPayouts = jest.fn()
const mockPreviewCampaignPayoutDestination = jest.fn()
const mockReconcileCampaignPayout = jest.fn()
jest.mock('../crowdfunding-payout.service', () => ({
  listCampaignPayouts: mockListCampaignPayouts,
  previewCampaignPayoutDestination: mockPreviewCampaignPayoutDestination,
  reconcileCampaignPayout: mockReconcileCampaignPayout,
}))

const mockRequestFlexibleCampaignPayout = jest.fn()
jest.mock('../crowdfunding-flexible-payout.service', () => ({
  requestFlexibleCampaignPayout: mockRequestFlexibleCampaignPayout,
}))

const mockCertifyCrowdfundingPayoutOperations = jest.fn()
const mockGetCrowdfundingPayoutOperationsStatus = jest.fn()
jest.mock('../payout-operations.service', () => ({
  certifyCrowdfundingPayoutOperations: mockCertifyCrowdfundingPayoutOperations,
  getCrowdfundingPayoutOperationsStatus: mockGetCrowdfundingPayoutOperationsStatus,
}))

import { buildApp } from '../../../app'

const app = buildApp()
const ADMIN_ID = '550e8400-e29b-41d4-a716-446655440002'
const CITIZEN_ID = '550e8400-e29b-41d4-a716-446655440001'
const DID = 'did:vertice:550e8400-e29b-41d4-a716-446655440000'
const TX_ID = '660e8400-e29b-41d4-a716-446655440003'
const FLAG_ID = '660e8400-e29b-41d4-a716-446655440004'
const CAMPAIGN_ID = '660e8400-e29b-41d4-a716-446655440005'
const PAYOUT_ID = '660e8400-e29b-41d4-a716-446655440006'

let adminToken: string
let citizenToken: string

beforeAll(async () => {
  await app.ready()
  adminToken = app.jwt.sign({ sub: ADMIN_ID, did: DID, lvl: 1, role: 'admin', sid: 'session-1' })
  citizenToken = app.jwt.sign({ sub: CITIZEN_ID, did: DID, lvl: 1 })
})
afterAll(() => app.close())
beforeEach(() => {
  jest.resetAllMocks()
  mockPrismaQueryRaw.mockResolvedValue([{ ok: 1 }])
})

describe('GET /finance/status', () => {
  it('returns finance operations status for an admin', async () => {
    mockGetFinanceOperationsStatus.mockResolvedValue({ ready: true })
    const res = await app.inject({ method: 'GET', url: '/billing/admin/finance/status', headers: { Authorization: `Bearer ${adminToken}` } })
    expect(res.statusCode).toBe(200)
  })

  it('returns 403 for a non-admin role', async () => {
    const res = await app.inject({ method: 'GET', url: '/billing/admin/finance/status', headers: { Authorization: `Bearer ${citizenToken}` } })
    expect(res.statusCode).toBe(403)
  })

  it('returns 401 without a token', async () => {
    const res = await app.inject({ method: 'GET', url: '/billing/admin/finance/status' })
    expect(res.statusCode).toBe(401)
  })
})

describe('POST /finance/reconcile', () => {
  it('reconciles the finance ledger', async () => {
    mockReconcileFinanceLedger.mockResolvedValue({ reconciled: true })
    const res = await app.inject({ method: 'POST', url: '/billing/admin/finance/reconcile', headers: { Authorization: `Bearer ${adminToken}` } })
    expect(res.statusCode).toBe(200)
    expect(mockReconcileFinanceLedger).toHaveBeenCalledWith({ actorId: ADMIN_ID, triggerKind: 'manual' })
  })
})

describe('POST /finance/reconcile/enqueue', () => {
  it('enqueues a reconciliation job', async () => {
    const res = await app.inject({ method: 'POST', url: '/billing/admin/finance/reconcile/enqueue', headers: { Authorization: `Bearer ${adminToken}` } })
    expect(res.statusCode).toBe(202)
    expect(mockEnqueueJob).toHaveBeenCalledWith('reconcile_payment_ledger', { requestedByCitizenId: ADMIN_ID })
  })
})

describe('POST /finance/risk/scan', () => {
  it('scans finance risk', async () => {
    mockScanFinanceRisk.mockResolvedValue({ flagged: 0 })
    const res = await app.inject({ method: 'POST', url: '/billing/admin/finance/risk/scan', headers: { Authorization: `Bearer ${adminToken}` } })
    expect(res.statusCode).toBe(200)
    expect(mockScanFinanceRisk).toHaveBeenCalledWith(ADMIN_ID)
  })
})

describe('GET /finance/risk', () => {
  it('lists risk flags with the default limit', async () => {
    mockListFinanceRiskFlags.mockResolvedValue([])
    const res = await app.inject({ method: 'GET', url: '/billing/admin/finance/risk', headers: { Authorization: `Bearer ${adminToken}` } })
    expect(res.statusCode).toBe(200)
    expect(mockListFinanceRiskFlags).toHaveBeenCalledWith(100)
  })

  it('returns 400 for an invalid limit', async () => {
    const res = await app.inject({ method: 'GET', url: '/billing/admin/finance/risk?limit=0', headers: { Authorization: `Bearer ${adminToken}` } })
    expect(res.statusCode).toBe(400)
  })
})

describe('POST /finance/risk/:flagId/review', () => {
  it('reviews a risk flag', async () => {
    mockReviewFinanceRiskFlag.mockResolvedValue({ id: FLAG_ID, status: 'reviewed' })
    const res = await app.inject({
      method: 'POST', url: `/billing/admin/finance/risk/${FLAG_ID}/review`,
      headers: { Authorization: `Bearer ${adminToken}` }, payload: { status: 'reviewed' },
    })
    expect(res.statusCode).toBe(200)
  })

  it('returns 400 for an invalid review payload', async () => {
    const res = await app.inject({
      method: 'POST', url: `/billing/admin/finance/risk/${FLAG_ID}/review`,
      headers: { Authorization: `Bearer ${adminToken}` }, payload: { status: 'not-a-status' },
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('POST /finance/refunds/:transactionId', () => {
  it('requests a crowdfunding refund', async () => {
    mockRequestCrowdfundingRefund.mockResolvedValue({ status: 'pending' })
    const res = await app.inject({
      method: 'POST', url: `/billing/admin/finance/refunds/${TX_ID}`,
      headers: { Authorization: `Bearer ${adminToken}`, 'idempotency-key': 'refund-key-1' },
      payload: { reason: 'Solicitud del contribuyente por cargo duplicado' },
    })
    expect(res.statusCode).toBe(202)
    expect(mockRequestCrowdfundingRefund).toHaveBeenCalledWith(expect.objectContaining({
      transactionId: TX_ID, requestedIdempotencyKey: 'refund-key-1',
    }))
  })

  it('returns 400 for an invalid refund request', async () => {
    const res = await app.inject({
      method: 'POST', url: `/billing/admin/finance/refunds/${TX_ID}`,
      headers: { Authorization: `Bearer ${adminToken}` }, payload: { reason: 'corto' },
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('GET /finance/export.csv', () => {
  it('exports accounting data for a valid range', async () => {
    mockBuildAccountingExport.mockResolvedValue('id,amount\n1,100\n')
    const res = await app.inject({
      method: 'GET', url: '/billing/admin/finance/export.csv?from=2026-08-01&to=2026-08-31',
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/csv')
  })

  it('returns 400 for a malformed date range', async () => {
    const res = await app.inject({
      method: 'GET', url: '/billing/admin/finance/export.csv?from=not-a-date&to=2026-08-31',
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when the range exceeds 92 days', async () => {
    const res = await app.inject({
      method: 'GET', url: '/billing/admin/finance/export.csv?from=2026-01-01&to=2026-08-31',
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(res.statusCode).toBe(400)
    expect(mockBuildAccountingExport).not.toHaveBeenCalled()
  })

  it('returns 400 when the range is inverted', async () => {
    const res = await app.inject({
      method: 'GET', url: '/billing/admin/finance/export.csv?from=2026-08-31&to=2026-08-01',
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('POST /finance/payout-certification', () => {
  it('certifies payout operations', async () => {
    mockCertifyCrowdfundingPayoutOperations.mockResolvedValue({ id: 'cert-1', status: 'verified' })
    const res = await app.inject({
      method: 'POST', url: '/billing/admin/finance/payout-certification',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { status: 'verified', evidenceReference: 'wompi-ticket-123' },
    })
    expect(res.statusCode).toBe(201)
  })

  it('returns 400 for an invalid certification payload', async () => {
    const res = await app.inject({
      method: 'POST', url: '/billing/admin/finance/payout-certification',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { status: 'not-a-status' },
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('GET /finance/payouts/status', () => {
  it('returns payout operations status', async () => {
    mockGetCrowdfundingPayoutOperationsStatus.mockResolvedValue({ readiness: 'blocked' })
    const res = await app.inject({ method: 'GET', url: '/billing/admin/finance/payouts/status', headers: { Authorization: `Bearer ${adminToken}` } })
    expect(res.statusCode).toBe(200)
  })
})

describe('GET /finance/payouts', () => {
  it('lists campaign payouts with the default limit', async () => {
    mockListCampaignPayouts.mockResolvedValue([])
    const res = await app.inject({ method: 'GET', url: '/billing/admin/finance/payouts', headers: { Authorization: `Bearer ${adminToken}` } })
    expect(res.statusCode).toBe(200)
    expect(mockListCampaignPayouts).toHaveBeenCalledWith(100)
  })

  it('returns 400 for an invalid query', async () => {
    const res = await app.inject({ method: 'GET', url: '/billing/admin/finance/payouts?limit=0', headers: { Authorization: `Bearer ${adminToken}` } })
    expect(res.statusCode).toBe(400)
  })
})

describe('POST /finance/payouts/destinations/preview', () => {
  it('previews a valid BRE-B destination', async () => {
    mockPreviewCampaignPayoutDestination.mockResolvedValue({ holderName: 'Juana Pérez' })
    const res = await app.inject({
      method: 'POST', url: '/billing/admin/finance/payouts/destinations/preview',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { keyType: 'MAIL', key: 'juana@example.com' },
    })
    expect(res.statusCode).toBe(200)
  })

  it('returns 400 for a malformed BRE-B key', async () => {
    const res = await app.inject({
      method: 'POST', url: '/billing/admin/finance/payouts/destinations/preview',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { keyType: 'PHONE', key: 'not-a-phone' },
    })
    expect(res.statusCode).toBe(400)
    const body = JSON.parse(res.payload)
    expect(body.code).toBe('INVALID_BREB_DESTINATION')
  })
})

describe('POST /finance/payouts/campaigns/:campaignId', () => {
  const validBody = {
    destination: {
      keyType: 'MAIL', key: 'juana@example.com', name: 'Juana Pérez', email: 'juana@example.com',
      confirmedHolderName: 'Juana Pérez', confirmedFinancialEntityCode: '1234',
    },
  }

  it('requests a campaign payout through the flexible policy service', async () => {
    mockRequestFlexibleCampaignPayout.mockResolvedValue({ id: PAYOUT_ID, status: 'requested' })
    const res = await app.inject({
      method: 'POST', url: `/billing/admin/finance/payouts/campaigns/${CAMPAIGN_ID}`,
      headers: { Authorization: `Bearer ${adminToken}`, 'idempotency-key': 'payout-key-1' },
      payload: validBody,
    })
    expect(res.statusCode).toBe(202)
    expect(mockRequestFlexibleCampaignPayout).toHaveBeenCalledWith(expect.objectContaining({
      campaignId: CAMPAIGN_ID, requestedIdempotencyKey: 'payout-key-1',
    }))
  })

  it('returns 400 for an invalid campaign id or destination', async () => {
    const res = await app.inject({
      method: 'POST', url: '/billing/admin/finance/payouts/campaigns/not-a-uuid',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: validBody,
    })
    expect(res.statusCode).toBe(400)
    expect(mockRequestFlexibleCampaignPayout).not.toHaveBeenCalled()
  })
})

describe('POST /finance/payouts/:payoutRequestId/reconcile', () => {
  it('reconciles a payout request', async () => {
    mockReconcileCampaignPayout.mockResolvedValue({ id: PAYOUT_ID, status: 'paid' })
    const res = await app.inject({
      method: 'POST', url: `/billing/admin/finance/payouts/${PAYOUT_ID}/reconcile`,
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(res.statusCode).toBe(200)
    expect(mockReconcileCampaignPayout).toHaveBeenCalledWith({ payoutRequestId: PAYOUT_ID, actorId: ADMIN_ID })
  })

  it('returns 400 for an invalid payout id', async () => {
    const res = await app.inject({
      method: 'POST', url: '/billing/admin/finance/payouts/not-a-uuid/reconcile',
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('POST /finance/payouts/:payoutRequestId/reconcile/enqueue', () => {
  it('enqueues a payout reconciliation job', async () => {
    const res = await app.inject({
      method: 'POST', url: `/billing/admin/finance/payouts/${PAYOUT_ID}/reconcile/enqueue`,
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(res.statusCode).toBe(202)
    expect(mockEnqueueJob).toHaveBeenCalledWith('reconcile_crowdfunding_payout', {
      payoutRequestId: PAYOUT_ID, requestedByCitizenId: ADMIN_ID,
    })
  })

  it('returns 400 for an invalid payout id', async () => {
    const res = await app.inject({
      method: 'POST', url: '/billing/admin/finance/payouts/not-a-uuid/reconcile/enqueue',
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(res.statusCode).toBe(400)
  })
})
