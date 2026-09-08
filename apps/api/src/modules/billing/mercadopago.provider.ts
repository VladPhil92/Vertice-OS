import { createHmac, timingSafeEqual } from 'node:crypto'
import { config } from '../../config'
import { getPlan, type BillingCycle } from './billing.catalog'
import type { BillingProvider, CheckoutSession, CheckoutSessionRequest } from './billing.provider'

const API_BASE = 'https://api.mercadopago.com'

export type PaymentProviderState = 'ready' | 'disabled' | 'misconfigured'

export interface MercadoPagoSubscription {
  id: string
  status: string
  external_reference?: string | number | null
  payer_id?: string | number | null
  next_payment_date?: string | null
  auto_recurring?: {
    frequency?: number
    frequency_type?: string
    transaction_amount?: number | string
    currency_id?: string
  }
  init_point?: string | null
}

export interface MercadoPagoOrder {
  id: string
  status: string
  status_detail?: string | null
  external_reference?: string | null
  total_amount?: string | number
  total_paid_amount?: string | number
  currency?: string
  checkout_url?: string | null
}

export interface MercadoPagoPayment {
  id: string | number
  status: string
  status_detail?: string | null
  external_reference?: string | null
  transaction_amount?: string | number
  currency_id?: string
  date_approved?: string | null
}

export interface MercadoPagoAuthorizedPayment {
  id: string | number
  preapproval_id?: string | null
  external_reference?: string | number | null
  currency_id?: string
  transaction_amount?: string | number
  debit_date?: string | null
  summarized?: string | null
  payment?: {
    id?: string | number
    status?: string
    status_detail?: string | null
  } | null
}

export interface MercadoPagoRefund {
  id?: string | number | null
  status?: string | null
  amount?: string | number | null
}

export class MercadoPagoApiError extends Error {
  readonly code = 'MERCADOPAGO_API_ERROR'
  readonly statusCode = 503

  constructor(readonly retryable: boolean) {
    super('Mercado Pago no pudo completar la operación de forma verificable.')
  }
}

function hasHttpsUrl(value: string | undefined): boolean {
  if (!value) return false
  if (config.NODE_ENV !== 'production') return true
  return value.startsWith('https://')
}

export function getMercadoPagoConfigurationState(): PaymentProviderState {
  const values = [
    config.MERCADOPAGO_ACCESS_TOKEN,
    config.MERCADOPAGO_WEBHOOK_SECRET,
    config.PAYMENTS_WEB_URL,
    config.PAYMENTS_WEBHOOK_URL,
  ]
  if (values.every((value) => !value)) return 'disabled'

  if (
    !config.MERCADOPAGO_ACCESS_TOKEN
    || !config.MERCADOPAGO_WEBHOOK_SECRET
    || !hasHttpsUrl(config.PAYMENTS_WEB_URL)
    || !hasHttpsUrl(config.PAYMENTS_WEBHOOK_URL)
  ) return 'misconfigured'

  return 'ready'
}

function requireAccessToken(): string {
  if (getMercadoPagoConfigurationState() !== 'ready' || !config.MERCADOPAGO_ACCESS_TOKEN) {
    throw Object.assign(new Error('Los pagos están deshabilitados mientras se completa la configuración del proveedor.'), {
      statusCode: 503,
      code: 'PAYMENT_PROVIDER_UNAVAILABLE',
    })
  }
  return config.MERCADOPAGO_ACCESS_TOKEN
}

async function mercadoPagoRequest<T>(
  path: string,
  options: { method?: 'GET' | 'POST' | 'PUT'; body?: unknown; idempotencyKey?: string } = {},
): Promise<T> {
  const token = requireAccessToken()
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.idempotencyKey ? { 'X-Idempotency-Key': options.idempotencyKey } : {}),
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    throw new MercadoPagoApiError(true)
  }

  if (!response.ok) {
    throw new MercadoPagoApiError(response.status >= 500 || response.status === 429)
  }

  return await response.json() as T
}

export class MercadoPagoBillingProvider implements BillingProvider {
  readonly name = 'mercadopago'

  async createCheckoutSession(input: CheckoutSessionRequest): Promise<CheckoutSession> {
    const plan = getPlan(input.planCode)
    const amount = input.billingCycle === 'annual' ? plan.priceCop.annual : plan.priceCop.monthly
    const frequency = input.billingCycle === 'annual' ? 12 : 1

    const subscription = await mercadoPagoRequest<MercadoPagoSubscription>('/preapproval', {
      method: 'POST',
      body: {
        reason: `VÉRTICE Pro · ${input.billingCycle === 'annual' ? 'Anual' : 'Mensual'}`,
        external_reference: input.externalReference,
        payer_email: input.payerEmail,
        auto_recurring: {
          frequency,
          frequency_type: 'months',
          transaction_amount: amount,
          currency_id: 'COP',
        },
        back_url: input.successUrl,
        status: 'pending',
      },
    })

    if (!subscription.id || !subscription.init_point) {
      throw new MercadoPagoApiError(false)
    }

    return {
      provider: this.name,
      checkoutUrl: subscription.init_point,
      externalSessionId: subscription.id,
    }
  }

  async cancelSubscription(externalSubscriptionId: string): Promise<void> {
    await mercadoPagoRequest(`/preapproval/${encodeURIComponent(externalSubscriptionId)}`, {
      method: 'PUT',
      body: { status: 'cancelled' },
    })
  }
}

export async function createMercadoPagoOrder(input: {
  externalReference: string
  idempotencyKey: string
  payerEmail: string
  title: string
  amountCop: number
  successUrl: string
  pendingUrl: string
  failureUrl: string
}): Promise<{ orderId: string; checkoutUrl: string }> {
  const order = await mercadoPagoRequest<MercadoPagoOrder>('/v1/orders', {
    method: 'POST',
    idempotencyKey: input.idempotencyKey,
    body: {
      type: 'online',
      processing_mode: 'manual',
      capture_mode: 'automatic_async',
      total_amount: input.amountCop.toFixed(2),
      external_reference: input.externalReference,
      payer: { email: input.payerEmail },
      items: [{
        title: input.title,
        unit_price: input.amountCop.toFixed(2),
        quantity: 1,
        unit_measure: 'unit',
        total_amount: input.amountCop.toFixed(2),
      }],
      config: {
        notification_url: config.PAYMENTS_WEBHOOK_URL,
        online: {
          success_url: input.successUrl,
          pending_url: input.pendingUrl,
          failure_url: input.failureUrl,
          auto_return: 'all',
        },
      },
    },
  })

  if (!order.id || !order.checkout_url) throw new MercadoPagoApiError(false)
  return { orderId: order.id, checkoutUrl: order.checkout_url }
}

export function getMercadoPagoSubscription(id: string) {
  return mercadoPagoRequest<MercadoPagoSubscription>(`/preapproval/${encodeURIComponent(id)}`)
}

export function getMercadoPagoOrder(id: string) {
  return mercadoPagoRequest<MercadoPagoOrder>(`/v1/orders/${encodeURIComponent(id)}`)
}

export function refundMercadoPagoOrder(orderId: string, idempotencyKey: string) {
  return mercadoPagoRequest<MercadoPagoRefund>(`/v1/orders/${encodeURIComponent(orderId)}/refund`, {
    method: 'POST',
    idempotencyKey,
  })
}

export function getMercadoPagoPayment(id: string) {
  return mercadoPagoRequest<MercadoPagoPayment>(`/v1/payments/${encodeURIComponent(id)}`)
}

export function getMercadoPagoAuthorizedPayment(id: string) {
  return mercadoPagoRequest<MercadoPagoAuthorizedPayment>(`/authorized_payments/${encodeURIComponent(id)}`)
}

export function verifyMercadoPagoWebhookSignature(input: {
  xSignature: string | undefined
  xRequestId: string | undefined
  dataId: string | undefined
  nowMs?: number
}): { timestamp: string } {
  if (!config.MERCADOPAGO_WEBHOOK_SECRET || !input.xSignature || !input.dataId) {
    throw Object.assign(new Error('Firma de webhook inválida.'), { statusCode: 401, code: 'INVALID_WEBHOOK_SIGNATURE' })
  }

  const parts = Object.fromEntries(
    input.xSignature.split(',').map((part) => {
      const [key, ...rest] = part.trim().split('=')
      return [key, rest.join('=')]
    }),
  )
  const timestamp = parts.ts
  const signature = parts.v1
  if (!timestamp || !signature || !/^[a-f0-9]{64}$/i.test(signature)) {
    throw Object.assign(new Error('Firma de webhook inválida.'), { statusCode: 401, code: 'INVALID_WEBHOOK_SIGNATURE' })
  }

  const numericTimestamp = Number(timestamp)
  if (!Number.isFinite(numericTimestamp)) {
    throw Object.assign(new Error('Firma de webhook inválida.'), { statusCode: 401, code: 'INVALID_WEBHOOK_SIGNATURE' })
  }
  const timestampMs = numericTimestamp > 10_000_000_000 ? numericTimestamp : numericTimestamp * 1000
  const nowMs = input.nowMs ?? Date.now()
  if (Math.abs(nowMs - timestampMs) > config.MERCADOPAGO_WEBHOOK_TOLERANCE_SECONDS * 1000) {
    throw Object.assign(new Error('Webhook expirado.'), { statusCode: 401, code: 'WEBHOOK_TIMESTAMP_OUT_OF_RANGE' })
  }

  const manifest = [
    `id:${input.dataId.toLowerCase()};`,
    ...(input.xRequestId ? [`request-id:${input.xRequestId};`] : []),
    `ts:${timestamp};`,
  ].join('')
  const expected = createHmac('sha256', config.MERCADOPAGO_WEBHOOK_SECRET).update(manifest).digest()
  const supplied = Buffer.from(signature, 'hex')
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw Object.assign(new Error('Firma de webhook inválida.'), { statusCode: 401, code: 'INVALID_WEBHOOK_SIGNATURE' })
  }

  return { timestamp }
}
