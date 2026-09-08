jest.mock('../../lib/prisma', () => ({
  prisma: {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
    $transaction: jest.fn(),
  },
}))

jest.mock('./billing.service', () => ({
  getEffectiveBillingAccess: jest.fn(),
}))

jest.mock('../../config', () => ({
  config: {
    PAYMENTS_WEB_URL: 'https://vertice.example',
    CROWDFUNDING_PAYMENTS_ENABLED: true,
  },
}))

jest.mock('./mercadopago.provider', () => {
  const actual = jest.requireActual('./mercadopago.provider')
  const mockCreateCheckoutSession = jest.fn()
  const mockCancelSubscription = jest.fn()
  return {
    __mockCreateCheckoutSession: mockCreateCheckoutSession,
    __mockCancelSubscription: mockCancelSubscription,
    MercadoPagoApiError: actual.MercadoPagoApiError,
    MercadoPagoBillingProvider: jest.fn().mockImplementation(() => ({
      name: 'mercadopago',
      createCheckoutSession: mockCreateCheckoutSession,
      cancelSubscription: mockCancelSubscription,
    })),
    createMercadoPagoOrder: jest.fn(),
    getMercadoPagoAuthorizedPayment: jest.fn(),
    getMercadoPagoConfigurationState: jest.fn(),
    getMercadoPagoOrder: jest.fn(),
    getMercadoPagoPayment: jest.fn(),
    getMercadoPagoSubscription: jest.fn(),
    verifyMercadoPagoWebhookSignature: jest.fn(),
  }
})

import { config } from '../../config'
import { prisma } from '../../lib/prisma'
import { getEffectiveBillingAccess } from './billing.service'
import * as mercadoPagoProvider from './mercadopago.provider'
import {
  MercadoPagoApiError,
  createMercadoPagoOrder,
  getMercadoPagoAuthorizedPayment,
  getMercadoPagoConfigurationState,
  getMercadoPagoOrder,
  getMercadoPagoPayment,
  getMercadoPagoSubscription,
  verifyMercadoPagoWebhookSignature,
} from './mercadopago.provider'
import {
  cancelMyProSubscription,
  createCrowdfundingContributionCheckout,
  createProCheckout,
  processMercadoPagoWebhook,
  reconcileMyBilling,
} from './payment.service'

const mockQueryRaw = prisma.$queryRaw as jest.Mock
const mockExecuteRaw = prisma.$executeRaw as jest.Mock
const mockTransaction = prisma.$transaction as jest.Mock
const mockGetEffectiveBillingAccess = getEffectiveBillingAccess as jest.Mock
const mockGetMercadoPagoConfigurationState = getMercadoPagoConfigurationState as jest.Mock
const mockGetMercadoPagoSubscription = getMercadoPagoSubscription as jest.Mock
const mockCreateMercadoPagoOrder = createMercadoPagoOrder as jest.Mock
const mockVerifySignature = verifyMercadoPagoWebhookSignature as jest.Mock
const mockCreateCheckoutSession = (mercadoPagoProvider as unknown as {
  __mockCreateCheckoutSession: jest.Mock
}).__mockCreateCheckoutSession
const mockCancelSubscription = (mercadoPagoProvider as unknown as {
  __mockCancelSubscription: jest.Mock
}).__mockCancelSubscription

const FREE_ACCESS = { plan: { code: 'free' }, subscription: null, reputationNeutrality: {} }
const PRO_ACCESS = { plan: { code: 'pro' }, subscription: null, reputationNeutrality: {} }

beforeEach(() => {
  jest.clearAllMocks()
  mockGetMercadoPagoConfigurationState.mockReturnValue('ready')
  mockGetEffectiveBillingAccess.mockResolvedValue(FREE_ACCESS)
  mockExecuteRaw.mockResolvedValue(undefined)
  mockTransaction.mockImplementation(async (callback: (tx: typeof prisma) => unknown) =>
    callback({ $queryRaw: mockQueryRaw, $executeRaw: mockExecuteRaw } as unknown as typeof prisma),
  )
  ;(config as unknown as { CROWDFUNDING_PAYMENTS_ENABLED: boolean }).CROWDFUNDING_PAYMENTS_ENABLED = true
})

describe('createProCheckout', () => {
  it('fails closed when the provider is not ready', async () => {
    mockGetMercadoPagoConfigurationState.mockReturnValue('disabled')

    await expect(createProCheckout('citizen-1', 'monthly')).rejects.toMatchObject({
      statusCode: 503,
      code: 'PAYMENT_PROVIDER_UNAVAILABLE',
    })
    expect(mockGetEffectiveBillingAccess).not.toHaveBeenCalled()
  })

  it('rejects when the citizen already has an active Pro plan', async () => {
    mockGetEffectiveBillingAccess.mockResolvedValue(PRO_ACCESS)

    await expect(createProCheckout('citizen-1', 'monthly')).rejects.toMatchObject({
      statusCode: 409,
      code: 'SUBSCRIPTION_ALREADY_ACTIVE',
    })
    expect(mockQueryRaw).not.toHaveBeenCalled()
  })

  it('rejects a malformed idempotency key before touching the ledger', async () => {
    await expect(
      createProCheckout('citizen-1', 'monthly', 'bad key!'),
    ).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_IDEMPOTENCY_KEY' })
    expect(mockQueryRaw).not.toHaveBeenCalled()
  })

  it('reuses an existing checkout when one is already provisioned for the idempotency key', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      { id: 'tx-1', status: 'pending', metadata: { checkout_url: 'https://mp.example/checkout/existing' } },
    ])

    const result = await createProCheckout('citizen-1', 'monthly', 'checkout-key-reuse')

    expect(result).toEqual({
      transactionId: 'tx-1',
      checkoutUrl: 'https://mp.example/checkout/existing',
      provider: 'mercadopago',
      reused: true,
    })
    expect(mockQueryRaw).toHaveBeenCalledTimes(1)
    expect(mockCreateCheckoutSession).not.toHaveBeenCalled()
  })

  it('blocks retrying while a prior checkout is pending reconciliation', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ id: 'tx-2', status: 'pending', metadata: {} }])

    await expect(
      createProCheckout('citizen-1', 'monthly', 'checkout-key-pending'),
    ).rejects.toMatchObject({ statusCode: 409, code: 'PAYMENT_RECONCILIATION_REQUIRED' })
  })

  it('blocks a second checkout while a recent one is still open', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'tx-3' }])

    await expect(
      createProCheckout('citizen-1', 'monthly', 'checkout-key-recent'),
    ).rejects.toMatchObject({ statusCode: 409, code: 'SUBSCRIPTION_CHECKOUT_PENDING' })
  })

  it('creates a new checkout session and persists the provider reference', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ email: 'citizen@example.com' }])
      .mockResolvedValueOnce([{ id: 'tx-4' }])
    mockCreateCheckoutSession.mockResolvedValue({
      provider: 'mercadopago',
      checkoutUrl: 'https://mp.example/checkout/new',
      externalSessionId: 'ext-1',
    })

    const result = await createProCheckout('citizen-1', 'annual', 'checkout-key-new')

    expect(result).toEqual({
      transactionId: 'tx-4',
      checkoutUrl: 'https://mp.example/checkout/new',
      provider: 'mercadopago',
      reused: false,
    })
    expect(mockCreateCheckoutSession).toHaveBeenCalledWith(expect.objectContaining({
      citizenId: 'citizen-1',
      payerEmail: 'citizen@example.com',
      billingCycle: 'annual',
      externalReference: 'sub_tx-4',
    }))
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1)
  })

  it('marks the checkout for reconciliation when the provider response is unverifiable', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ email: 'citizen@example.com' }])
      .mockResolvedValueOnce([{ id: 'tx-5' }])
    mockCreateCheckoutSession.mockRejectedValue(new MercadoPagoApiError(true))

    await expect(
      createProCheckout('citizen-1', 'monthly', 'checkout-key-retryable'),
    ).rejects.toMatchObject({ statusCode: 503, code: 'PAYMENT_RECONCILIATION_REQUIRED' })
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1)
  })

  it('fails the transaction and rethrows on a definitive provider error', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ email: 'citizen@example.com' }])
      .mockResolvedValueOnce([{ id: 'tx-6' }])
    const providerError = new Error('rejected by provider')
    mockCreateCheckoutSession.mockRejectedValue(providerError)

    await expect(
      createProCheckout('citizen-1', 'monthly', 'checkout-key-failed'),
    ).rejects.toBe(providerError)
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1)
  })

  it('requires the citizen to have an email on file before checkout', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    await expect(
      createProCheckout('citizen-1', 'monthly', 'checkout-key-no-email'),
    ).rejects.toMatchObject({ statusCode: 422, code: 'PAYMENT_EMAIL_REQUIRED' })
  })
})

describe('cancelMyProSubscription', () => {
  it('cancels an active provider-backed subscription', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      { id: 'sub-1', provider_subscription_id: 'psub-1', current_period_end: new Date(Date.now() + 100_000) },
    ])
    mockGetEffectiveBillingAccess.mockResolvedValue(FREE_ACCESS)

    const result = await cancelMyProSubscription('citizen-1')

    expect(mockCancelSubscription).toHaveBeenCalledWith('psub-1')
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1)
    expect(result).toBe(FREE_ACCESS)
  })

  it('cancels a pending mandate when no active subscription exists yet', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'tx-1', provider_transaction_id: 'ptx-1' }])

    await cancelMyProSubscription('citizen-1')

    expect(mockCancelSubscription).toHaveBeenCalledWith('ptx-1')
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1)
  })

  it('reports nothing to cancel when there is no subscription or pending mandate', async () => {
    mockQueryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([])

    await expect(cancelMyProSubscription('citizen-1')).rejects.toMatchObject({
      statusCode: 404,
      code: 'SUBSCRIPTION_NOT_FOUND',
    })
    expect(mockCancelSubscription).not.toHaveBeenCalled()
  })
})

describe('reconcileMyBilling', () => {
  it('returns current access without contacting the provider when nothing needs reconciliation', async () => {
    mockQueryRaw.mockResolvedValueOnce([])

    const result = await reconcileMyBilling('citizen-1')

    expect(mockGetMercadoPagoSubscription).not.toHaveBeenCalled()
    expect(result).toBe(FREE_ACCESS)
  })

  it('resyncs every known provider resource', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ provider_subscription_id: 'psub-1' }])
    mockGetMercadoPagoSubscription.mockResolvedValue({
      id: 'psub-1',
      status: 'authorized',
      external_reference: null,
    })

    await reconcileMyBilling('citizen-1')

    expect(mockGetMercadoPagoSubscription).toHaveBeenCalledWith('psub-1')
  })
})

describe('processMercadoPagoWebhook', () => {
  beforeEach(() => {
    mockVerifySignature.mockReturnValue({ timestamp: '1700000000' })
  })

  it('short-circuits duplicate webhook deliveries', async () => {
    mockQueryRaw.mockResolvedValueOnce([])

    const result = await processMercadoPagoWebhook({
      xSignature: 'sig', xRequestId: 'req', dataId: 'data-1', body: { type: 'payment' },
    })

    expect(result).toEqual({ duplicate: true, processed: false })
    expect(mockExecuteRaw).not.toHaveBeenCalled()
  })

  it('ignores webhook types it does not understand', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ id: 'evt-1' }])

    const result = await processMercadoPagoWebhook({
      xSignature: 'sig', xRequestId: 'req', dataId: 'data-1', body: { type: 'unsupported_event' },
    })

    expect(result).toEqual({ duplicate: false, processed: false, ignored: true })
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1)
  })

  it('fails closed when the webhook carries no resource id', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ id: 'evt-2' }])

    await expect(
      processMercadoPagoWebhook({ xSignature: 'sig', xRequestId: 'req', dataId: undefined, body: { type: 'payment' } }),
    ).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_WEBHOOK_RESOURCE' })
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1)
  })

  it('processes a subscription preapproval notification', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ id: 'evt-3' }])
    mockGetMercadoPagoSubscription.mockResolvedValue({
      id: 'psub-1',
      status: 'authorized',
      external_reference: null,
    })

    const result = await processMercadoPagoWebhook({
      xSignature: 'sig', xRequestId: 'req', dataId: 'psub-1', body: { type: 'subscription_preapproval' },
    })

    expect(result).toEqual({ duplicate: false, processed: true })
    expect(mockGetMercadoPagoSubscription).toHaveBeenCalledWith('psub-1')
  })

  it('processes an authorized payment notification', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ id: 'evt-4' }])
    ;(getMercadoPagoAuthorizedPayment as jest.Mock).mockResolvedValue({
      id: 'invoice-1',
      preapproval_id: null,
      payment: { id: 'pay-1', status: 'approved' },
    })

    const result = await processMercadoPagoWebhook({
      xSignature: 'sig', xRequestId: 'req', dataId: 'invoice-1', body: { type: 'subscription_authorized_payment' },
    })

    expect(result).toEqual({ duplicate: false, processed: true })
  })

  it('processes an order notification for crowdfunding contributions', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ id: 'evt-5' }])
    ;(getMercadoPagoOrder as jest.Mock).mockResolvedValue({
      id: 'ord-1',
      status: 'processed',
      external_reference: null,
    })

    const result = await processMercadoPagoWebhook({
      xSignature: 'sig', xRequestId: 'req', dataId: 'ord-1', body: { type: 'order' },
    })

    expect(result).toEqual({ duplicate: false, processed: true })
  })

  it('processes a payment notification for crowdfunding contributions', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ id: 'evt-6' }])
    ;(getMercadoPagoPayment as jest.Mock).mockResolvedValue({
      id: 'pay-2',
      status: 'approved',
      external_reference: null,
    })

    const result = await processMercadoPagoWebhook({
      xSignature: 'sig', xRequestId: 'req', dataId: 'pay-2', body: { type: 'payment' },
    })

    expect(result).toEqual({ duplicate: false, processed: true })
  })

  const SUB_TX_ID = '550e8400-e29b-41d4-a716-446655440099'
  const SUBSCRIPTION_TX_ROW = {
    id: SUB_TX_ID,
    citizen_id: 'citizen-1',
    amount_cop: 15_000n,
    metadata: { billing_cycle: 'monthly' },
    status: 'pending',
    provider_transaction_id: null,
  }

  it('records an authorized mandate for a known subscription checkout', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ id: 'evt-7' }])
      .mockResolvedValueOnce([SUBSCRIPTION_TX_ROW])
    mockGetMercadoPagoSubscription.mockResolvedValue({
      id: 'psub-1',
      status: 'authorized',
      external_reference: `sub_${SUB_TX_ID}`,
      payer_id: 'payer-1',
      auto_recurring: { currency_id: 'COP', transaction_amount: 15_000 },
    })

    const result = await processMercadoPagoWebhook({
      xSignature: 'sig', xRequestId: 'req', dataId: 'psub-1', body: { type: 'subscription_preapproval' },
    })

    expect(result).toEqual({ duplicate: false, processed: true })
    expect(mockExecuteRaw).toHaveBeenCalledTimes(3)
  })

  it('cancels the local ledger when the provider mandate is cancelled', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ id: 'evt-8' }])
      .mockResolvedValueOnce([SUBSCRIPTION_TX_ROW])
    mockGetMercadoPagoSubscription.mockResolvedValue({
      id: 'psub-1',
      status: 'cancelled',
      external_reference: `sub_${SUB_TX_ID}`,
      auto_recurring: { currency_id: 'COP', transaction_amount: 15_000 },
    })

    const result = await processMercadoPagoWebhook({
      xSignature: 'sig', xRequestId: 'req', dataId: 'psub-1', body: { type: 'subscription_preapproval' },
    })

    expect(result).toEqual({ duplicate: false, processed: true })
    expect(mockExecuteRaw).toHaveBeenCalledTimes(3)
  })

  it('fails closed when the provider mandate amount does not match the local ledger', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ id: 'evt-9' }])
      .mockResolvedValueOnce([SUBSCRIPTION_TX_ROW])
    mockGetMercadoPagoSubscription.mockResolvedValue({
      id: 'psub-1',
      status: 'authorized',
      external_reference: `sub_${SUB_TX_ID}`,
      auto_recurring: { currency_id: 'COP', transaction_amount: 999_999 },
    })

    await expect(processMercadoPagoWebhook({
      xSignature: 'sig', xRequestId: 'req', dataId: 'psub-1', body: { type: 'subscription_preapproval' },
    })).rejects.toMatchObject({ statusCode: 409, code: 'PAYMENT_LEDGER_MISMATCH' })
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1)
  })

  it('marks a recurring subscription as past due on a rejected authorized payment', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ id: 'evt-10' }])
      .mockResolvedValueOnce([SUBSCRIPTION_TX_ROW])
    ;(getMercadoPagoAuthorizedPayment as jest.Mock).mockResolvedValue({
      id: 'invoice-1',
      preapproval_id: 'psub-2',
      transaction_amount: 15_000,
      currency_id: 'COP',
      payment: { id: 'pay-1', status: 'rejected', status_detail: 'cc_rejected' },
    })
    mockGetMercadoPagoSubscription.mockResolvedValue({
      id: 'psub-2',
      status: 'authorized',
      external_reference: `sub_${SUB_TX_ID}`,
    })

    const result = await processMercadoPagoWebhook({
      xSignature: 'sig', xRequestId: 'req', dataId: 'invoice-1', body: { type: 'subscription_authorized_payment' },
    })

    expect(result).toEqual({ duplicate: false, processed: true })
    expect(mockExecuteRaw).toHaveBeenCalledTimes(3)
  })

  it('activates Pro on an approved recurring charge', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ id: 'evt-11' }])
      .mockResolvedValueOnce([SUBSCRIPTION_TX_ROW])
      .mockResolvedValueOnce([{ status: 'pending', provider_transaction_id: null }])
      .mockResolvedValueOnce([{ id: 'sub-row-1' }])
    ;(getMercadoPagoAuthorizedPayment as jest.Mock).mockResolvedValue({
      id: 'invoice-2',
      preapproval_id: 'psub-3',
      transaction_amount: 15_000,
      currency_id: 'COP',
      payment: { id: 'pay-2', status: 'approved', status_detail: 'accredited' },
      debit_date: '2026-09-01T00:00:00.000Z',
    })
    mockGetMercadoPagoSubscription.mockResolvedValue({
      id: 'psub-3',
      status: 'authorized',
      external_reference: `sub_${SUB_TX_ID}`,
      payer_id: 'payer-1',
      next_payment_date: '2026-10-01T00:00:00.000Z',
    })

    const result = await processMercadoPagoWebhook({
      xSignature: 'sig', xRequestId: 'req', dataId: 'invoice-2', body: { type: 'subscription_authorized_payment' },
    })

    expect(result).toEqual({ duplicate: false, processed: true })
    expect(mockTransaction).toHaveBeenCalledTimes(1)
  })

  const CF_TX_ID = '660e8400-e29b-41d4-a716-446655440088'

  it('applies a paid crowdfunding order to the campaign ledger', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ id: 'evt-12' }])
      .mockResolvedValueOnce([{ amount_cop: 22_000n }])
      .mockResolvedValueOnce([{
        tx_amount: 22_000n, contribution_id: 'contrib-1', campaign_id: 'campaign-1', contribution_amount: 20_000n,
      }])
      .mockResolvedValueOnce([{ status: 'pending' }])
    ;(getMercadoPagoOrder as jest.Mock).mockResolvedValue({
      id: 'ord-1',
      status: 'processed',
      external_reference: `cf_${CF_TX_ID}`,
      total_amount: '22000',
      total_paid_amount: '22000',
      currency: 'COP',
    })

    const result = await processMercadoPagoWebhook({
      xSignature: 'sig', xRequestId: 'req', dataId: 'ord-1', body: { type: 'order' },
    })

    expect(result).toEqual({ duplicate: false, processed: true })
    expect(mockTransaction).toHaveBeenCalledTimes(1)
    expect(mockExecuteRaw).toHaveBeenCalledTimes(4)
  })

  it('reverses a chargeback on a previously paid crowdfunding contribution', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ id: 'evt-13' }])
      .mockResolvedValueOnce([{ amount_cop: 22_000n }])
      .mockResolvedValueOnce([{
        tx_amount: 22_000n, contribution_id: 'contrib-1', campaign_id: 'campaign-1', contribution_amount: 20_000n,
      }])
      .mockResolvedValueOnce([{ status: 'paid' }])
    ;(getMercadoPagoPayment as jest.Mock).mockResolvedValue({
      id: 'pay-3',
      status: 'charged_back',
      external_reference: `cf_${CF_TX_ID}`,
      transaction_amount: 22_000,
      currency_id: 'COP',
    })

    const result = await processMercadoPagoWebhook({
      xSignature: 'sig', xRequestId: 'req', dataId: 'pay-3', body: { type: 'payment' },
    })

    expect(result).toEqual({ duplicate: false, processed: true })
    expect(mockExecuteRaw).toHaveBeenCalledTimes(4)
  })
})

describe('createCrowdfundingContributionCheckout', () => {
  const baseInput = {
    citizenId: 'citizen-1',
    campaignId: 'campaign-1',
    amountCop: 20_000,
    platformTipCop: 2_000,
    isAnonymous: false,
  }
  const activeCampaign = {
    title: 'Parque del barrio',
    status: 'active',
    compliance_status: 'verified',
    creator_citizen_id: 'creator-1',
    ends_at: null,
  }
  const eligiblePayout = { verification_status: 'verified', payout_status: 'eligible' }

  it('fails closed when crowdfunding payments are disabled', async () => {
    ;(config as unknown as { CROWDFUNDING_PAYMENTS_ENABLED: boolean }).CROWDFUNDING_PAYMENTS_ENABLED = false

    await expect(createCrowdfundingContributionCheckout(baseInput)).rejects.toMatchObject({
      statusCode: 503,
      code: 'CROWDFUNDING_PAYMENTS_DISABLED',
    })
  })

  it('rejects a malformed idempotency key', async () => {
    await expect(
      createCrowdfundingContributionCheckout({ ...baseInput, requestedIdempotencyKey: 'bad key!' }),
    ).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_IDEMPOTENCY_KEY' })
  })

  it('rejects contributions to a campaign that does not exist', async () => {
    mockQueryRaw.mockResolvedValueOnce([])

    await expect(
      createCrowdfundingContributionCheckout({ ...baseInput, requestedIdempotencyKey: 'cf-key-missing' }),
    ).rejects.toMatchObject({ statusCode: 404, code: 'CAMPAIGN_NOT_FOUND' })
  })

  it('rejects contributions to a campaign that is not currently payable', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ ...activeCampaign, status: 'draft' }])

    await expect(
      createCrowdfundingContributionCheckout({ ...baseInput, requestedIdempotencyKey: 'cf-key-draft' }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'CAMPAIGN_NOT_PAYABLE' })
  })

  it('rejects contributions when the beneficiary payout profile is not ready', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([activeCampaign])
      .mockResolvedValueOnce([{ verification_status: 'pending', payout_status: 'ineligible' }])

    await expect(
      createCrowdfundingContributionCheckout({ ...baseInput, requestedIdempotencyKey: 'cf-key-payout' }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'CAMPAIGN_PAYOUT_NOT_READY' })
  })

  it('reuses an existing checkout for the same idempotency key', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([activeCampaign])
      .mockResolvedValueOnce([eligiblePayout])
      .mockResolvedValueOnce([{ id: 'tx-cf-1', metadata: { checkout_url: 'https://mp.example/cf/existing' } }])

    const result = await createCrowdfundingContributionCheckout({
      ...baseInput, requestedIdempotencyKey: 'cf-key-reuse',
    })

    expect(result).toEqual({ transactionId: 'tx-cf-1', checkoutUrl: 'https://mp.example/cf/existing', reused: true })
    expect(mockCreateMercadoPagoOrder).not.toHaveBeenCalled()
  })

  it('blocks retrying while a prior contribution checkout is pending reconciliation', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([activeCampaign])
      .mockResolvedValueOnce([eligiblePayout])
      .mockResolvedValueOnce([{ id: 'tx-cf-2', metadata: {} }])

    await expect(
      createCrowdfundingContributionCheckout({ ...baseInput, requestedIdempotencyKey: 'cf-key-pending' }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'PAYMENT_RECONCILIATION_REQUIRED' })
  })

  it('creates a new contribution checkout end to end', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([activeCampaign])
      .mockResolvedValueOnce([eligiblePayout])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ email: 'donor@example.com' }])
      .mockResolvedValueOnce([{ id: 'tx-cf-3' }])
    mockCreateMercadoPagoOrder.mockResolvedValue({ orderId: 'ord-9', checkoutUrl: 'https://mp.example/cf/new' })

    const result = await createCrowdfundingContributionCheckout({
      ...baseInput, requestedIdempotencyKey: 'cf-key-new',
    })

    expect(result).toEqual({ transactionId: 'tx-cf-3', checkoutUrl: 'https://mp.example/cf/new', reused: false })
    expect(mockCreateMercadoPagoOrder).toHaveBeenCalledWith(expect.objectContaining({
      externalReference: 'cf_tx-cf-3',
      payerEmail: 'donor@example.com',
      amountCop: 22_000,
    }))
  })

  it('marks the contribution for reconciliation on an unverifiable provider response', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([activeCampaign])
      .mockResolvedValueOnce([eligiblePayout])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ email: 'donor@example.com' }])
      .mockResolvedValueOnce([{ id: 'tx-cf-4' }])
    mockCreateMercadoPagoOrder.mockRejectedValue(new MercadoPagoApiError(true))

    await expect(
      createCrowdfundingContributionCheckout({ ...baseInput, requestedIdempotencyKey: 'cf-key-retryable' }),
    ).rejects.toMatchObject({ statusCode: 503, code: 'PAYMENT_RECONCILIATION_REQUIRED' })
    expect(mockTransaction).toHaveBeenCalledTimes(1)
  })

  it('fails the contribution and rethrows on a definitive provider error', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([activeCampaign])
      .mockResolvedValueOnce([eligiblePayout])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ email: 'donor@example.com' }])
      .mockResolvedValueOnce([{ id: 'tx-cf-5' }])
    const providerError = new Error('rejected by provider')
    mockCreateMercadoPagoOrder.mockRejectedValue(providerError)

    await expect(
      createCrowdfundingContributionCheckout({ ...baseInput, requestedIdempotencyKey: 'cf-key-failed' }),
    ).rejects.toBe(providerError)
    expect(mockTransaction).toHaveBeenCalledTimes(2)
  })
})
