import type { BillingCycle, PlanCode } from './billing.catalog'

export interface CheckoutSessionRequest {
  citizenId: string
  planCode: Exclude<PlanCode, 'free'>
  billingCycle: BillingCycle
  successUrl: string
  cancelUrl: string
}

export interface CheckoutSession {
  provider: string
  checkoutUrl: string
  externalSessionId: string
}

export interface BillingProvider {
  readonly name: string
  createCheckoutSession(input: CheckoutSessionRequest): Promise<CheckoutSession>
  cancelSubscription(externalSubscriptionId: string): Promise<void>
}

/**
 * Deliberately fails closed until a provider adapter and signed webhook flow
 * are configured. VÉRTICE must never mark a citizen Pro from a browser-only
 * callback or an unverified payment response.
 */
export class BillingProviderUnavailableError extends Error {
  readonly code = 'BILLING_PROVIDER_UNAVAILABLE'

  constructor() {
    super('El proveedor de pagos aún no está habilitado.')
  }
}
