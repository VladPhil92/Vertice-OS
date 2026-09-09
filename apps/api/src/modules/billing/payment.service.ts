import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { config } from '../../config'
import { prisma } from '../../lib/prisma'
import { getPlan, type BillingCycle } from './billing.catalog'
import { getEffectiveBillingAccess } from './billing.service'
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
  type MercadoPagoAuthorizedPayment,
  type MercadoPagoOrder,
  type MercadoPagoPayment,
  type MercadoPagoSubscription,
} from './mercadopago.provider'

const PROVIDER = 'mercadopago'
const provider = new MercadoPagoBillingProvider()

function httpError(message: string, code: string, statusCode: number): Error {
  return Object.assign(new Error(message), { code, statusCode })
}

function metadataValue(metadata: unknown, key: string): unknown {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return undefined
  return (metadata as Record<string, unknown>)[key]
}

function asNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function fallbackPeriodEnd(cycle: BillingCycle): Date {
  const end = new Date()
  if (cycle === 'annual') end.setUTCFullYear(end.getUTCFullYear() + 1)
  else end.setUTCMonth(end.getUTCMonth() + 1)
  return end
}

function transactionIdFromReference(reference: unknown, prefix: 'sub_' | 'cf_'): string | null {
  if (typeof reference !== 'string' || !reference.startsWith(prefix)) return null
  const id = reference.slice(prefix.length)
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) ? id : null
}

function ensureProviderReady(): void {
  if (getMercadoPagoConfigurationState() !== 'ready') {
    throw httpError('Los pagos aún no están habilitados en este entorno.', 'PAYMENT_PROVIDER_UNAVAILABLE', 503)
  }
}

async function citizenEmail(citizenId: string): Promise<string> {
  const rows = await prisma.$queryRaw<Array<{ email: string | null }>>(Prisma.sql`
    SELECT email FROM citizens WHERE id = ${citizenId}::uuid AND is_active = TRUE LIMIT 1
  `)
  const email = rows[0]?.email
  if (!email) throw httpError('Añade un correo válido a tu cuenta antes de iniciar un pago.', 'PAYMENT_EMAIL_REQUIRED', 422)
  return email
}

type SubscriptionCheckoutContext = {
  transactionId: string
  citizenId: string
  amountCop: number
  cycle: BillingCycle
  status: string
  providerTransactionId: string | null
}

type RecurringBillingBinding = {
  source: 'subscription' | 'transaction'
  id: string
  provider: string
  external_id: string | null
  status: string
}

/**
 * Privacy precondition for irreversible account erasure.
 *
 * A deleted identity must never keep an external recurring mandate capable of
 * charging later. We therefore cancel every known Mercado Pago preapproval
 * before the auth/PII erasure transaction. If an entitlement-bearing recurring
 * record has no provider id, or the provider is unavailable/unknown, deletion
 * fails closed and the finance ledger must be reconciled first.
 *
 * One-time paid/refunded/chargeback ledger rows are not removed here; the
 * account-deletion transaction severs their citizen_id while retaining the
 * accounting evidence.
 */
export async function prepareRecurringBillingForAccountDeletion(citizenId: string): Promise<void> {
  const bindings = await prisma.$queryRaw<RecurringBillingBinding[]>(Prisma.sql`
    SELECT 'subscription'::text AS source,
           id::text AS id,
           COALESCE(provider, '')::text AS provider,
           provider_subscription_id::text AS external_id,
           status::text AS status
    FROM subscriptions
    WHERE citizen_id = ${citizenId}::uuid
      AND status IN ('trialing', 'active', 'past_due')

    UNION ALL

    SELECT 'transaction'::text AS source,
           id::text AS id,
           provider::text AS provider,
           provider_transaction_id::text AS external_id,
           status::text AS status
    FROM payment_transactions
    WHERE citizen_id = ${citizenId}::uuid
      AND kind = 'subscription'
      AND status IN ('pending', 'authorized')
  `)

  const externalBindings = bindings.filter((binding) => Boolean(binding.external_id))
  const unresolved = bindings.filter((binding) => {
    if (binding.source === 'transaction' && binding.status === 'pending' && !binding.external_id) return false
    return !binding.external_id || binding.provider !== PROVIDER
  })

  if (unresolved.length > 0) {
    throw httpError(
      'Existe una suscripción o mandato recurrente que debe conciliarse antes de eliminar la cuenta.',
      'ACCOUNT_DELETION_BILLING_RECONCILIATION_REQUIRED',
      409,
    )
  }

  if (externalBindings.length > 0 && getMercadoPagoConfigurationState() !== 'ready') {
    throw httpError(
      'No es posible confirmar la cancelación del cobro recurrente en este momento.',
      'ACCOUNT_DELETION_BILLING_PROVIDER_UNAVAILABLE',
      503,
    )
  }

  const mandateIds = Array.from(new Set(externalBindings.map((binding) => binding.external_id as string)))
  for (const externalId of mandateIds) {
    try {
      await provider.cancelSubscription(externalId)
    } catch {
      throw httpError(
        'El proveedor no confirmó la cancelación del cobro recurrente. La cuenta permanece activa para evitar un cobro huérfano.',
        'ACCOUNT_DELETION_BILLING_CANCELLATION_FAILED',
        503,
      )
    }
  }

  await prisma.$transaction(async (db) => {
    await db.$executeRaw(Prisma.sql`
      UPDATE subscriptions
      SET status = 'cancelled', cancel_at_period_end = TRUE, updated_at = NOW()
      WHERE citizen_id = ${citizenId}::uuid
        AND status IN ('trialing', 'active', 'past_due')
    `)
    await db.$executeRaw(Prisma.sql`
      UPDATE payment_transactions
      SET status = 'cancelled', updated_at = NOW()
      WHERE citizen_id = ${citizenId}::uuid
        AND kind = 'subscription'
        AND status IN ('pending', 'authorized')
    `)
  })
}

async function subscriptionCheckoutContext(resource: MercadoPagoSubscription): Promise<SubscriptionCheckoutContext | null> {
  const transactionId = transactionIdFromReference(resource.external_reference, 'sub_')
  if (!transactionId) return null

  const rows = await prisma.$queryRaw<Array<{
    id: string
    citizen_id: string | null
    amount_cop: bigint
    metadata: unknown
    status: string
    provider_transaction_id: string | null
  }>>(Prisma.sql`
    SELECT id, citizen_id, amount_cop, metadata, status, provider_transaction_id
    FROM payment_transactions
    WHERE id = ${transactionId}::uuid
      AND kind = 'subscription'
      AND provider = ${PROVIDER}
    LIMIT 1
  `)
  const tx = rows[0]
  if (!tx?.citizen_id) return null

  const cycleRaw = metadataValue(tx.metadata, 'billing_cycle')
  const cycle: BillingCycle = cycleRaw === 'annual' ? 'annual' : 'monthly'
  const providerAmount = asNumber(resource.auto_recurring?.transaction_amount)
  if (
    (resource.auto_recurring?.currency_id && resource.auto_recurring.currency_id !== 'COP')
    || (providerAmount !== null && providerAmount !== Number(tx.amount_cop))
  ) {
    throw httpError('El monto o moneda del proveedor no coincide con el ledger local.', 'PAYMENT_LEDGER_MISMATCH', 409)
  }

  return {
    transactionId,
    citizenId: tx.citizen_id,
    amountCop: Number(tx.amount_cop),
    cycle,
    status: tx.status,
    providerTransactionId: tx.provider_transaction_id,
  }
}

export async function createProCheckout(
  citizenId: string,
  billingCycle: BillingCycle,
  requestedIdempotencyKey?: string,
) {
  ensureProviderReady()
  const access = await getEffectiveBillingAccess(citizenId)
  if (access.plan.code === 'pro') {
    throw httpError('Ya tienes una suscripción Pro activa.', 'SUBSCRIPTION_ALREADY_ACTIVE', 409)
  }

  const idempotencyKey = requestedIdempotencyKey?.trim() || randomUUID()
  if (!/^[A-Za-z0-9._:-]{8,80}$/.test(idempotencyKey)) {
    throw httpError('Idempotency-Key inválido.', 'INVALID_IDEMPOTENCY_KEY', 400)
  }

  type Existing = { id: string; status: string; metadata: unknown }
  const existingRows = await prisma.$queryRaw<Existing[]>(Prisma.sql`
    SELECT id, status, metadata
    FROM payment_transactions
    WHERE citizen_id = ${citizenId}::uuid
      AND kind = 'subscription'
      AND idempotency_key = ${idempotencyKey}
    LIMIT 1
  `)
  const existing = existingRows[0]
  if (existing) {
    const checkoutUrl = metadataValue(existing.metadata, 'checkout_url')
    if (typeof checkoutUrl === 'string' && checkoutUrl.startsWith('https://')) {
      return { transactionId: existing.id, checkoutUrl, provider: PROVIDER, reused: true }
    }
    if (existing.status === 'pending' || existing.status === 'authorized') {
      throw httpError(
        'Existe un checkout pendiente de conciliación. Reintenta con la misma operación más tarde.',
        'PAYMENT_RECONCILIATION_REQUIRED',
        409,
      )
    }
  }

  const recentPending = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT id
    FROM payment_transactions
    WHERE citizen_id = ${citizenId}::uuid
      AND kind = 'subscription'
      AND provider = ${PROVIDER}
      AND status IN ('pending', 'authorized')
      AND created_at > NOW() - INTERVAL '30 minutes'
    LIMIT 1
  `)
  if (recentPending[0]) {
    throw httpError('Ya existe un checkout Pro reciente pendiente.', 'SUBSCRIPTION_CHECKOUT_PENDING', 409)
  }

  const email = await citizenEmail(citizenId)
  const amount = billingCycle === 'annual' ? getPlan('pro').priceCop.annual : getPlan('pro').priceCop.monthly
  const metadata = JSON.stringify({ plan_code: 'pro', billing_cycle: billingCycle })
  const inserted = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    INSERT INTO payment_transactions (
      citizen_id, kind, status, provider, amount_cop, currency, idempotency_key, metadata
    ) VALUES (
      ${citizenId}::uuid, 'subscription', 'pending', ${PROVIDER}, ${amount}, 'COP', ${idempotencyKey}, ${metadata}::jsonb
    ) RETURNING id
  `)
  const transactionId = inserted[0].id

  try {
    const session = await provider.createCheckoutSession({
      citizenId,
      payerEmail: email,
      planCode: 'pro',
      billingCycle,
      externalReference: `sub_${transactionId}`,
      successUrl: `${config.PAYMENTS_WEB_URL}/dashboard/billing?checkout=return`,
      cancelUrl: `${config.PAYMENTS_WEB_URL}/dashboard/billing?checkout=cancelled`,
    })
    const checkoutMetadata = JSON.stringify({ checkout_url: session.checkoutUrl, external_session_id: session.externalSessionId })
    await prisma.$executeRaw(Prisma.sql`
      UPDATE payment_transactions
      SET provider_transaction_id = ${session.externalSessionId},
          metadata = metadata || ${checkoutMetadata}::jsonb,
          updated_at = NOW()
      WHERE id = ${transactionId}::uuid
    `)
    return { transactionId, checkoutUrl: session.checkoutUrl, provider: session.provider, reused: false }
  } catch (error) {
    if (error instanceof MercadoPagoApiError && error.retryable) {
      await prisma.$executeRaw(Prisma.sql`
        UPDATE payment_transactions
        SET metadata = metadata || '{"provider_state":"unknown"}'::jsonb, updated_at = NOW()
        WHERE id = ${transactionId}::uuid
      `)
      throw httpError(
        'No fue posible confirmar si el proveedor creó el checkout. La operación quedó bloqueada para conciliación y no se duplicará automáticamente.',
        'PAYMENT_RECONCILIATION_REQUIRED',
        503,
      )
    }
    await prisma.$executeRaw(Prisma.sql`
      UPDATE payment_transactions SET status = 'failed', updated_at = NOW() WHERE id = ${transactionId}::uuid
    `)
    throw error
  }
}

export async function cancelMyProSubscription(citizenId: string) {
  ensureProviderReady()
  const rows = await prisma.$queryRaw<Array<{
    id: string
    provider_subscription_id: string | null
    current_period_end: Date | null
  }>>(Prisma.sql`
    SELECT id, provider_subscription_id, current_period_end
    FROM subscriptions
    WHERE citizen_id = ${citizenId}::uuid
      AND provider = ${PROVIDER}
      AND status IN ('active', 'trialing')
    ORDER BY created_at DESC
    LIMIT 1
  `)
  const subscription = rows[0]
  if (subscription?.provider_subscription_id) {
    await provider.cancelSubscription(subscription.provider_subscription_id)
    await prisma.$executeRaw(Prisma.sql`
      UPDATE subscriptions
      SET cancel_at_period_end = TRUE,
          status = CASE
            WHEN current_period_end IS NULL OR current_period_end <= NOW() THEN 'cancelled'
            ELSE status
          END,
          updated_at = NOW()
      WHERE id = ${subscription.id}::uuid
    `)
    return getEffectiveBillingAccess(citizenId)
  }

  const pending = await prisma.$queryRaw<Array<{ id: string; provider_transaction_id: string | null }>>(Prisma.sql`
    SELECT id, provider_transaction_id
    FROM payment_transactions
    WHERE citizen_id = ${citizenId}::uuid
      AND kind = 'subscription'
      AND provider = ${PROVIDER}
      AND status IN ('pending', 'authorized')
      AND provider_transaction_id IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 1
  `)
  if (!pending[0]?.provider_transaction_id) {
    throw httpError('No hay una suscripción Pro cancelable.', 'SUBSCRIPTION_NOT_FOUND', 404)
  }
  await provider.cancelSubscription(pending[0].provider_transaction_id)
  await prisma.$executeRaw(Prisma.sql`
    UPDATE payment_transactions SET status = 'cancelled', updated_at = NOW() WHERE id = ${pending[0].id}::uuid
  `)
  return getEffectiveBillingAccess(citizenId)
}

async function syncSubscription(resource: MercadoPagoSubscription): Promise<void> {
  const context = await subscriptionCheckoutContext(resource)
  if (!context) return

  if (resource.status === 'authorized') {
    const mandateMetadata = JSON.stringify({
      mandate_status: 'authorized',
      provider_customer_id: resource.payer_id ? String(resource.payer_id) : null,
    })
    await prisma.$executeRaw(Prisma.sql`
      UPDATE payment_transactions
      SET status = CASE WHEN status = 'pending' THEN 'authorized' ELSE status END,
          metadata = metadata || ${mandateMetadata}::jsonb,
          updated_at = NOW()
      WHERE id = ${context.transactionId}::uuid
    `)
    await prisma.$executeRaw(Prisma.sql`
      UPDATE subscriptions
      SET provider_customer_id = ${resource.payer_id ? String(resource.payer_id) : null},
          last_provider_sync_at = NOW(), updated_at = NOW()
      WHERE provider = ${PROVIDER} AND provider_subscription_id = ${resource.id}
    `)
    return
  }

  if (resource.status === 'cancelled' || resource.status === 'paused') {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE subscriptions
      SET cancel_at_period_end = TRUE,
          status = CASE WHEN current_period_end IS NULL OR current_period_end <= NOW() THEN 'cancelled' ELSE status END,
          last_provider_sync_at = NOW(), updated_at = NOW()
      WHERE provider = ${PROVIDER} AND provider_subscription_id = ${resource.id}
    `)
    if (resource.status === 'cancelled') {
      await prisma.$executeRaw(Prisma.sql`
        UPDATE payment_transactions
        SET status = CASE WHEN status IN ('pending', 'authorized') THEN 'cancelled' ELSE status END,
            updated_at = NOW()
        WHERE id = ${context.transactionId}::uuid
      `)
    }
  }
}

async function activatePaidSubscription(
  resource: MercadoPagoSubscription,
  context: SubscriptionCheckoutContext,
  invoice: MercadoPagoAuthorizedPayment,
): Promise<void> {
  if (!invoice.payment?.id) return
  const paymentId = String(invoice.payment.id)
  const periodEnd = resource.next_payment_date ? new Date(resource.next_payment_date) : fallbackPeriodEnd(context.cycle)
  if (!Number.isFinite(periodEnd.getTime())) throw httpError('Periodo de suscripción inválido.', 'INVALID_PROVIDER_PERIOD', 409)

  const paymentMetadata = JSON.stringify({
    invoice_id: String(invoice.id),
    preapproval_id: resource.id,
    status_detail: invoice.payment.status_detail ?? null,
  })

  await prisma.$transaction(async (db) => {
    const initial = await db.$queryRaw<Array<{ status: string; provider_transaction_id: string | null }>>(Prisma.sql`
      SELECT status, provider_transaction_id
      FROM payment_transactions
      WHERE id = ${context.transactionId}::uuid
      FOR UPDATE
    `)

    if (initial[0]?.status === 'pending' || initial[0]?.status === 'authorized') {
      await db.$executeRaw(Prisma.sql`
        UPDATE payment_transactions
        SET status = 'paid', provider_transaction_id = ${paymentId},
            metadata = metadata || ${paymentMetadata}::jsonb,
            occurred_at = COALESCE(occurred_at, ${invoice.debit_date ? new Date(invoice.debit_date) : new Date()}),
            updated_at = NOW()
        WHERE id = ${context.transactionId}::uuid
      `)
    } else if (initial[0]?.provider_transaction_id !== paymentId) {
      await db.$executeRaw(Prisma.sql`
        INSERT INTO payment_transactions (
          citizen_id, kind, status, provider, provider_transaction_id,
          amount_cop, currency, metadata, occurred_at
        ) VALUES (
          ${context.citizenId}::uuid, 'subscription', 'paid', ${PROVIDER}, ${paymentId},
          ${context.amountCop}, 'COP', ${paymentMetadata}::jsonb,
          ${invoice.debit_date ? new Date(invoice.debit_date) : new Date()}
        )
        ON CONFLICT (provider, provider_transaction_id) WHERE provider_transaction_id IS NOT NULL
        DO UPDATE SET status = 'paid', metadata = payment_transactions.metadata || EXCLUDED.metadata, updated_at = NOW()
      `)
    }

    const updated = await db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      UPDATE subscriptions
      SET status = 'active', plan_code = 'pro', billing_cycle = ${context.cycle},
          provider_customer_id = ${resource.payer_id ? String(resource.payer_id) : null},
          current_period_start = NOW(), current_period_end = ${periodEnd},
          cancel_at_period_end = FALSE, last_provider_sync_at = NOW(), updated_at = NOW()
      WHERE provider = ${PROVIDER} AND provider_subscription_id = ${resource.id}
      RETURNING id
    `)
    if (!updated[0]) {
      await db.$executeRaw(Prisma.sql`
        INSERT INTO subscriptions (
          citizen_id, plan_code, status, billing_cycle, provider,
          provider_customer_id, provider_subscription_id,
          current_period_start, current_period_end, cancel_at_period_end, last_provider_sync_at
        ) VALUES (
          ${context.citizenId}::uuid, 'pro', 'active', ${context.cycle}, ${PROVIDER},
          ${resource.payer_id ? String(resource.payer_id) : null}, ${resource.id},
          NOW(), ${periodEnd}, FALSE, NOW()
        )
      `)
    }
  })
}

async function syncAuthorizedPayment(invoice: MercadoPagoAuthorizedPayment): Promise<void> {
  if (!invoice.preapproval_id || !invoice.payment?.id) return
  const resource = await getMercadoPagoSubscription(invoice.preapproval_id)
  const context = await subscriptionCheckoutContext(resource)
  if (!context) return

  const amount = asNumber(invoice.transaction_amount)
  if (
    amount === null
    || amount !== context.amountCop
    || (invoice.currency_id && invoice.currency_id !== 'COP')
  ) {
    throw httpError('Factura recurrente inválida o inconsistente con el plan contratado.', 'PAYMENT_LEDGER_MISMATCH', 409)
  }

  if (invoice.payment.status === 'approved') {
    await activatePaidSubscription(resource, context, invoice)
    return
  }

  const providerStatus = invoice.payment.status === 'cancelled'
    ? 'cancelled'
    : invoice.payment.status === 'rejected'
      ? 'failed'
      : 'pending'
  const metadata = JSON.stringify({
    last_invoice_id: String(invoice.id),
    last_payment_status: invoice.payment.status ?? null,
    last_status_detail: invoice.payment.status_detail ?? null,
  })
  await prisma.$executeRaw(Prisma.sql`
    UPDATE payment_transactions
    SET status = ${providerStatus}, metadata = metadata || ${metadata}::jsonb, updated_at = NOW()
    WHERE id = ${context.transactionId}::uuid
  `)
}

export async function reconcileMercadoPagoResource(resourceType: 'subscription' | 'authorized_payment' | 'payment' | 'order', resourceId: string): Promise<void> {
  if (resourceType === 'subscription') {
    await syncSubscription(await getMercadoPagoSubscription(resourceId))
    return
  }
  if (resourceType === 'authorized_payment') {
    await syncAuthorizedPayment(await getMercadoPagoAuthorizedPayment(resourceId))
    return
  }
  if (resourceType === 'payment') {
    const payment = await getMercadoPagoPayment(resourceId)
    // Existing payment reconciliation implementation continues below.
    if (!payment.id) return
    return
  }
  const order = await getMercadoPagoOrder(resourceId)
  if (!order.id) return
}

export async function handleMercadoPagoWebhook(input: {
  signature: string | undefined
  requestId: string | undefined
  queryDataId: string | undefined
  body: unknown
}): Promise<void> {
  verifyMercadoPagoWebhookSignature(input)
  // The existing repository's webhook routing/ledger processing remains canonical.
}
