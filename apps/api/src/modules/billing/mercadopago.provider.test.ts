import { createHmac } from 'node:crypto'
import { config } from '../../config'
import {
  getMercadoPagoConfigurationState,
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
