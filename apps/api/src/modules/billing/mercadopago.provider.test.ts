import { createHmac } from 'node:crypto'
import { config } from '../../config'
import {
  MercadoPagoApiError,
  MercadoPagoBillingProvider,
  createMercadoPagoOrder,
  getMercadoPagoAuthorizedPayment,
  getMercadoPagoConfigurationState,
  getMercadoPagoOrder,
  getMercadoPagoPayment,
  getMercadoPagoSubscription,
  verifyMercadoPagoWebhookSignature,
} from './mercadopago.provider'

describe('Mercado Pago provider security contract', () => {
  const original = {
    accessToken: config.MERCADOPAGO_ACCESS_TOKEN,
    webhookSecret: config.MERCADOPAGO_WEBHOOK_SECRET,
    webUrl: config.PAYMENTS_WEB_URL,
    webhookUrl: config.PAYMENTS_WEBHOOK_URL,
    tolerance: config.MERCADOPAGO_WEBHOOK_TOLERANCE_SECONDS,
  }

  afterEach(() => {
    config.MERCADOPAGO_ACCESS_TOKEN = original.accessToken
    config.MERCADOPAGO_WEBHOOK_SECRET = original.webhookSecret
    config.PAYMENTS_WEB_URL = original.webUrl
    config.PAYMENTS_WEBHOOK_URL = original.webhookUrl
    config.MERCADOPAGO_WEBHOOK_TOLERANCE_SECONDS = original.tolerance
  })

  it('fails closed when provider configuration is absent or partial', () => {
    config.MERCADOPAGO_ACCESS_TOKEN = undefined
    config.MERCADOPAGO_WEBHOOK_SECRET = undefined
    config.PAYMENTS_WEB_URL = undefined
    config.PAYMENTS_WEBHOOK_URL = undefined
    expect(getMercadoPagoConfigurationState()).toBe('disabled')

    config.MERCADOPAGO_ACCESS_TOKEN = 'APP_USR_test_access_token_at_least_20_chars'
    expect(getMercadoPagoConfigurationState()).toBe('misconfigured')
  })

  it('reports ready only when the complete provider contract is configured', () => {
    config.MERCADOPAGO_ACCESS_TOKEN = 'APP_USR_test_access_token_at_least_20_chars'
    config.MERCADOPAGO_WEBHOOK_SECRET = 'webhook-secret-at-least-16'
    config.PAYMENTS_WEB_URL = 'https://vertice.example'
    config.PAYMENTS_WEBHOOK_URL = 'https://vertice.example/api/billing/webhooks/mercadopago'
    expect(getMercadoPagoConfigurationState()).toBe('ready')
  })

  it('accepts a valid signed webhook and lowercases data.id in the manifest', () => {
    const secret = 'webhook-secret-at-least-16'
    const dataId = 'ABC123'
    const requestId = 'request-123'
    const nowMs = 1_800_000_000_000
    const timestamp = String(Math.floor(nowMs / 1000))
    const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${timestamp};`
    const signature = createHmac('sha256', secret).update(manifest).digest('hex')

    config.MERCADOPAGO_WEBHOOK_SECRET = secret
    config.MERCADOPAGO_WEBHOOK_TOLERANCE_SECONDS = 300

    expect(verifyMercadoPagoWebhookSignature({
      xSignature: `ts=${timestamp},v1=${signature}`,
      xRequestId: requestId,
      dataId,
      nowMs,
    })).toEqual({ timestamp })
  })

  it('rejects forged and stale webhook signatures', () => {
    const secret = 'webhook-secret-at-least-16'
    const nowMs = 1_800_000_000_000
    config.MERCADOPAGO_WEBHOOK_SECRET = secret
    config.MERCADOPAGO_WEBHOOK_TOLERANCE_SECONDS = 60

    expect(() => verifyMercadoPagoWebhookSignature({
      xSignature: `ts=${Math.floor(nowMs / 1000)},v1=${'00'.repeat(32)}`,
      xRequestId: 'request-123',
      dataId: '123',
      nowMs,
    })).toThrow('Firma de webhook inválida')

    const staleTimestamp = String(Math.floor((nowMs - 120_000) / 1000))
    const staleManifest = `id:123;request-id:request-123;ts:${staleTimestamp};`
    const staleSignature = createHmac('sha256', secret).update(staleManifest).digest('hex')
    expect(() => verifyMercadoPagoWebhookSignature({
      xSignature: `ts=${staleTimestamp},v1=${staleSignature}`,
      xRequestId: 'request-123',
      dataId: '123',
      nowMs,
    })).toThrow('Webhook expirado')
  })
})

describe('Mercado Pago provider network contract', () => {
  const original = {
    accessToken: config.MERCADOPAGO_ACCESS_TOKEN,
    webhookSecret: config.MERCADOPAGO_WEBHOOK_SECRET,
    webUrl: config.PAYMENTS_WEB_URL,
    webhookUrl: config.PAYMENTS_WEBHOOK_URL,
  }
  const originalFetch = global.fetch

  beforeEach(() => {
    config.MERCADOPAGO_ACCESS_TOKEN = 'APP_USR_test_access_token_at_least_20_chars'
    config.MERCADOPAGO_WEBHOOK_SECRET = 'webhook-secret-at-least-16'
    config.PAYMENTS_WEB_URL = 'https://vertice.example'
    config.PAYMENTS_WEBHOOK_URL = 'https://vertice.example/api/billing/webhooks/mercadopago'
  })

  afterEach(() => {
    config.MERCADOPAGO_ACCESS_TOKEN = original.accessToken
    config.MERCADOPAGO_WEBHOOK_SECRET = original.webhookSecret
    config.PAYMENTS_WEB_URL = original.webUrl
    config.PAYMENTS_WEBHOOK_URL = original.webhookUrl
    global.fetch = originalFetch
  })

  it('fails closed when the provider is not ready', async () => {
    config.MERCADOPAGO_ACCESS_TOKEN = undefined

    await expect(getMercadoPagoSubscription('sub-1')).rejects.toMatchObject({
      statusCode: 503,
      code: 'PAYMENT_PROVIDER_UNAVAILABLE',
    })
  })

  it('marks a network failure as retryable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch

    await expect(getMercadoPagoSubscription('sub-1')).rejects.toMatchObject({
      code: 'MERCADOPAGO_API_ERROR',
      retryable: true,
    })
  })

  it('marks a 5xx provider response as retryable and a 4xx as definitive', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response(null, { status: 500 })) as unknown as typeof fetch
    await expect(getMercadoPagoOrder('ord-1')).rejects.toMatchObject({ retryable: true })

    global.fetch = jest.fn().mockResolvedValue(new Response(null, { status: 404 })) as unknown as typeof fetch
    await expect(getMercadoPagoPayment('pay-1')).rejects.toMatchObject({ retryable: false })
  })

  it('marks a 429 rate limit response as retryable', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response(null, { status: 429 })) as unknown as typeof fetch
    await expect(getMercadoPagoAuthorizedPayment('auth-1')).rejects.toMatchObject({ retryable: true })
  })

  it('parses a successful provider response', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'sub-1', status: 'authorized' }), { status: 200 }),
    ) as unknown as typeof fetch

    const result = await getMercadoPagoSubscription('sub-1')
    expect(result).toEqual({ id: 'sub-1', status: 'authorized' })
  })

  it('creates a checkout session with the expected recurring configuration', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'sub-1', init_point: 'https://mp.example/checkout/sub-1' }), { status: 200 }),
    ) as unknown as typeof fetch

    const provider = new MercadoPagoBillingProvider()
    const session = await provider.createCheckoutSession({
      citizenId: 'citizen-1',
      payerEmail: 'citizen@example.com',
      planCode: 'pro',
      billingCycle: 'annual',
      externalReference: 'sub_tx-1',
      successUrl: 'https://vertice.example/return',
      cancelUrl: 'https://vertice.example/cancel',
    })

    expect(session).toEqual({
      provider: 'mercadopago',
      checkoutUrl: 'https://mp.example/checkout/sub-1',
      externalSessionId: 'sub-1',
    })
  })

  it('rejects a checkout session response missing the required fields', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'sub-1' }), { status: 200 }),
    ) as unknown as typeof fetch

    const provider = new MercadoPagoBillingProvider()
    await expect(provider.createCheckoutSession({
      citizenId: 'citizen-1',
      payerEmail: 'citizen@example.com',
      planCode: 'pro',
      billingCycle: 'monthly',
      externalReference: 'sub_tx-1',
      successUrl: 'https://vertice.example/return',
      cancelUrl: 'https://vertice.example/cancel',
    })).rejects.toBeInstanceOf(MercadoPagoApiError)
  })

  it('cancels a subscription', async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'cancelled' }), { status: 200 }))
    global.fetch = fetchMock as unknown as typeof fetch

    const provider = new MercadoPagoBillingProvider()
    await provider.cancelSubscription('psub-1')

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/preapproval/psub-1'),
      expect.objectContaining({ method: 'PUT' }),
    )
  })

  it('creates an order and rejects one missing required fields', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'ord-1', checkout_url: 'https://mp.example/cf/ord-1' }), { status: 200 }),
    ) as unknown as typeof fetch

    const order = await createMercadoPagoOrder({
      externalReference: 'cf_tx-1',
      idempotencyKey: 'tx-1',
      payerEmail: 'donor@example.com',
      title: 'Aporte',
      amountCop: 20_000,
      successUrl: 'https://vertice.example/success',
      pendingUrl: 'https://vertice.example/pending',
      failureUrl: 'https://vertice.example/failure',
    })
    expect(order).toEqual({ orderId: 'ord-1', checkoutUrl: 'https://mp.example/cf/ord-1' })

    global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })) as unknown as typeof fetch
    await expect(createMercadoPagoOrder({
      externalReference: 'cf_tx-2',
      idempotencyKey: 'tx-2',
      payerEmail: 'donor@example.com',
      title: 'Aporte',
      amountCop: 20_000,
      successUrl: 'https://vertice.example/success',
      pendingUrl: 'https://vertice.example/pending',
      failureUrl: 'https://vertice.example/failure',
    })).rejects.toBeInstanceOf(MercadoPagoApiError)
  })
})
