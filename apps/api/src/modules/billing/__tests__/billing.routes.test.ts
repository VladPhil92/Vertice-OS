jest.mock('../../../lib/redis', () => ({
  redis: { ping: jest.fn().mockResolvedValue('PONG'), get: jest.fn(), set: jest.fn(), del: jest.fn(), on: jest.fn() },
}))

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    citizen: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn() },
    $queryRaw: jest.fn().mockResolvedValue([]),
  },
}))

const mockGetBillingCatalog = jest.fn()
const mockGetEffectiveBillingAccess = jest.fn()
jest.mock('../billing.service', () => ({
  getBillingCatalog: mockGetBillingCatalog,
  getEffectiveBillingAccess: mockGetEffectiveBillingAccess,
}))

const mockCreateProCheckout = jest.fn()
const mockCancelMyProSubscription = jest.fn()
const mockReconcileMyBilling = jest.fn()
const mockProcessMercadoPagoWebhook = jest.fn()
jest.mock('../payment.service', () => ({
  createProCheckout: mockCreateProCheckout,
  cancelMyProSubscription: mockCancelMyProSubscription,
  reconcileMyBilling: mockReconcileMyBilling,
  processMercadoPagoWebhook: mockProcessMercadoPagoWebhook,
}))

const mockProcessWompiPayoutWebhook = jest.fn()
jest.mock('../crowdfunding-payout.service', () => ({
  processWompiPayoutWebhook: mockProcessWompiPayoutWebhook,
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
import { prisma } from '../../../lib/prisma'

const app = buildApp()
const CITIZEN_ID = '550e8400-e29b-41d4-a716-446655440001'
const DID = 'did:vertice:550e8400-e29b-41d4-a716-446655440000'

let token: string

beforeAll(async () => {
  await app.ready()
  token = app.jwt.sign({ sub: CITIZEN_ID, did: DID, lvl: 1 })
})
afterAll(() => app.close())
beforeEach(() => {
  jest.resetAllMocks()
  // Default finance runtime control state: capability enabled. Routes that
  // call assertFinancialCapabilityEnabled() (e.g. POST /billing/checkout)
  // hit this via prisma.$queryRaw, which resetAllMocks() strips back to a
  // bare jest.fn() with no return value each test.
  ;(prisma.$queryRaw as jest.Mock).mockResolvedValue([{ emergency_stop: false, reason: null }])
})

describe('GET /billing/plans', () => {
  it('returns the public catalog without authentication', async () => {
    mockGetBillingCatalog.mockReturnValue({ currency: 'COP', plans: [], reputationNeutrality: {} })

    const res = await app.inject({ method: 'GET', url: '/billing/plans' })

    expect(res.statusCode).toBe(200)
    expect(mockGetBillingCatalog).toHaveBeenCalled()
  })
})

describe('GET /billing/me', () => {
  it('returns effective billing access for the authenticated citizen', async () => {
    mockGetEffectiveBillingAccess.mockResolvedValue({ plan: { code: 'free' }, subscription: null })

    const res = await app.inject({
      method: 'GET',
      url: '/billing/me',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    expect(mockGetEffectiveBillingAccess).toHaveBeenCalledWith(CITIZEN_ID)
  })

  it('returns 401 without a token', async () => {
    const res = await app.inject({ method: 'GET', url: '/billing/me' })
    expect(res.statusCode).toBe(401)
  })
})

describe('POST /billing/checkout', () => {
  it('creates a checkout session and forwards the idempotency key header', async () => {
    mockCreateProCheckout.mockResolvedValue({ transactionId: 'tx-1', checkoutUrl: 'https://mp.example/checkout' })

    const res = await app.inject({
      method: 'POST',
      url: '/billing/checkout',
      headers: { Authorization: `Bearer ${token}`, 'idempotency-key': 'key-1' },
      payload: { billingCycle: 'monthly' },
    })

    expect(res.statusCode).toBe(201)
    expect(mockCreateProCheckout).toHaveBeenCalledWith(CITIZEN_ID, 'monthly', 'key-1')
  })

  it('returns 400 for an invalid billing cycle', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/billing/checkout',
      headers: { Authorization: `Bearer ${token}` },
      payload: { billingCycle: 'weekly' },
    })

    expect(res.statusCode).toBe(400)
    const body = JSON.parse(res.payload)
    expect(body.code).toBe('INVALID_BILLING_CYCLE')
    expect(mockCreateProCheckout).not.toHaveBeenCalled()
  })

  it('returns 401 without a token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/billing/checkout',
      payload: { billingCycle: 'monthly' },
    })
    expect(res.statusCode).toBe(401)
  })
})

describe('POST /billing/cancel', () => {
  it('cancels the active subscription for the authenticated citizen', async () => {
    mockCancelMyProSubscription.mockResolvedValue({ plan: { code: 'free' } })

    const res = await app.inject({
      method: 'POST',
      url: '/billing/cancel',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    expect(mockCancelMyProSubscription).toHaveBeenCalledWith(CITIZEN_ID)
  })

  it('returns 401 without a token', async () => {
    const res = await app.inject({ method: 'POST', url: '/billing/cancel' })
    expect(res.statusCode).toBe(401)
  })
})

describe('POST /billing/reconcile', () => {
  it('reconciles billing state for the authenticated citizen', async () => {
    mockReconcileMyBilling.mockResolvedValue({ plan: { code: 'pro' } })

    const res = await app.inject({
      method: 'POST',
      url: '/billing/reconcile',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    expect(mockReconcileMyBilling).toHaveBeenCalledWith(CITIZEN_ID)
  })

  it('returns 401 without a token', async () => {
    const res = await app.inject({ method: 'POST', url: '/billing/reconcile' })
    expect(res.statusCode).toBe(401)
  })
})

describe('POST /billing/webhooks/mercadopago', () => {
  it('is reachable without a session token and forwards signature headers', async () => {
    mockProcessMercadoPagoWebhook.mockResolvedValue({ duplicate: false, processed: true })

    const res = await app.inject({
      method: 'POST',
      url: '/billing/webhooks/mercadopago?data.id=abc123',
      headers: { 'x-signature': 'ts=1,v1=deadbeef', 'x-request-id': 'req-1' },
      payload: { type: 'payment' },
    })

    expect(res.statusCode).toBe(200)
    expect(mockProcessMercadoPagoWebhook).toHaveBeenCalledWith({
      xSignature: 'ts=1,v1=deadbeef',
      xRequestId: 'req-1',
      dataId: 'abc123',
      body: { type: 'payment' },
    })
  })

  it('reads the resource id from the body when absent from the query', async () => {
    mockProcessMercadoPagoWebhook.mockResolvedValue({ duplicate: false, processed: true })

    const res = await app.inject({
      method: 'POST',
      url: '/billing/webhooks/mercadopago',
      headers: { 'x-signature': 'ts=1,v1=deadbeef' },
      payload: { type: 'payment', data: { id: 999 } },
    })

    expect(res.statusCode).toBe(200)
    expect(mockProcessMercadoPagoWebhook).toHaveBeenCalledWith(expect.objectContaining({ dataId: '999' }))
  })
})

describe('POST /billing/webhooks/wompi-payouts', () => {
  it('is reachable without a session token and forwards the checksum header', async () => {
    mockProcessWompiPayoutWebhook.mockResolvedValue({ duplicate: false, processed: true })

    const res = await app.inject({
      method: 'POST',
      url: '/billing/webhooks/wompi-payouts',
      headers: { 'x-event-checksum': 'a'.repeat(64) },
      payload: { event: 'payout.updated' },
    })

    expect(res.statusCode).toBe(200)
    expect(mockProcessWompiPayoutWebhook).toHaveBeenCalledWith({
      xEventChecksum: 'a'.repeat(64),
      body: { event: 'payout.updated' },
    })
  })
})
