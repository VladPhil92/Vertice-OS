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

  type Existing = { id: string; status: string; metadata: unknown; provider_transaction_id: string | null; created_at: Date }
  const existingRows = await prisma.$queryRaw<Existing[]>(Prisma.sql`
    SELECT id, status, metadata, provider_transaction_id, created_at
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
    if (existing.status === 'pending') {
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
      AND status = 'pending'
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
  if (!subscription?.provider_subscription_id) {
    throw httpError('No hay una suscripción Pro cancelable.', 'SUBSCRIPTION_NOT_FOUND', 404)
  }

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

async function syncSubscription(resource: MercadoPagoSubscription): Promise<void> {
  const transactionId = transactionIdFromReference(resource.external_reference, 'sub_')
  if (!transactionId) return

  type Tx = { id: string; citizen_id: string | null; amount_cop: bigint; metadata: unknown }
  const txRows = await prisma.$queryRaw<Tx[]>(Prisma.sql`
    SELECT id, citizen_id, amount_cop, metadata
    FROM payment_transactions
    WHERE id = ${transactionId}::uuid AND kind = 'subscription' AND provider = ${PROVIDER}
    LIMIT 1
  `)
  const tx = txRows[0]
  if (!tx?.citizen_id) return

  const cycleRaw = metadataValue(tx.metadata, 'billing_cycle')
  const cycle: BillingCycle = cycleRaw === 'annual' ? 'annual' : 'monthly'
  const providerAmount = asNumber(resource.auto_recurring?.transaction_amount)
  if (
    resource.auto_recurring?.currency_id && resource.auto_recurring.currency_id !== 'COP'
    || (providerAmount !== null && providerAmount !== Number(tx.amount_cop))
  ) {
    throw httpError('El monto/currency del proveedor no coincide con el ledger local.', 'PAYMENT_LEDGER_MISMATCH', 409)
  }

  if (resource.status === 'authorized') {
    const periodEnd = resource.next_payment_date ? new Date(resource.next_payment_date) : fallbackPeriodEnd(cycle)
    if (!Number.isFinite(periodEnd.getTime())) throw httpError('Periodo de suscripción inválido.', 'INVALID_PROVIDER_PERIOD', 409)

    await prisma.$transaction(async (db) => {
      await db.$executeRaw(Prisma.sql`
        UPDATE payment_transactions
        SET status = 'paid', occurred_at = COALESCE(occurred_at, NOW()), updated_at = NOW()
        WHERE id = ${transactionId}::uuid
      `)
      const updated = await db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        UPDATE subscriptions
        SET status = 'active', plan_code = 'pro', billing_cycle = ${cycle},
            provider_customer_id = ${resource.payer_id ? String(resource.payer_id) : null},
            current_period_start = COALESCE(current_period_start, NOW()),
            current_period_end = ${periodEnd}, cancel_at_period_end = FALSE,
            last_provider_sync_at = NOW(), updated_at = NOW()
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
            ${tx.citizen_id}::uuid, 'pro', 'active', ${cycle}, ${PROVIDER},
            ${resource.payer_id ? String(resource.payer_id) : null}, ${resource.id},
            NOW(), ${periodEnd}, FALSE, NOW()
          )
        `)
      }
    })
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
        SET status = CASE WHEN status = 'pending' THEN 'cancelled' ELSE status END, updated_at = NOW()
        WHERE id = ${transactionId}::uuid
      `)
    }
  }
}

async function syncAuthorizedPayment(invoice: MercadoPagoAuthorizedPayment): Promise<void> {
  if (!invoice.preapproval_id) return
  let subscriptions = await prisma.$queryRaw<Array<{ citizen_id: string; billing_cycle: BillingCycle | null }>>(Prisma.sql`
    SELECT citizen_id, billing_cycle
    FROM subscriptions
    WHERE provider = ${PROVIDER} AND provider_subscription_id = ${invoice.preapproval_id}
    LIMIT 1
  `)
  if (!subscriptions[0]) {
    await syncSubscription(await getMercadoPagoSubscription(invoice.preapproval_id))
    subscriptions = await prisma.$queryRaw<Array<{ citizen_id: string; billing_cycle: BillingCycle | null }>>(Prisma.sql`
      SELECT citizen_id, billing_cycle FROM subscriptions
      WHERE provider = ${PROVIDER} AND provider_subscription_id = ${invoice.preapproval_id}
      LIMIT 1
    `)
  }
  const subscription = subscriptions[0]
  if (!subscription || !invoice.payment?.id) return

  const amount = asNumber(invoice.transaction_amount)
  if (amount === null || amount < 0 || (invoice.currency_id && invoice.currency_id !== 'COP')) {
    throw httpError('Factura recurrente inválida.', 'PAYMENT_LEDGER_MISMATCH', 409)
  }
  const paymentStatus = invoice.payment.status === 'approved'
    ? 'paid'
    : invoice.payment.status === 'cancelled'
      ? 'cancelled'
      : invoice.payment.status === 'rejected'
        ? 'failed'
        : 'pending'
  const renewalMetadata = JSON.stringify({
    invoice_id: String(invoice.id),
    preapproval_id: invoice.preapproval_id,
    status_detail: invoice.payment.status_detail ?? null,
  })
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO payment_transactions (
      citizen_id, kind, status, provider, provider_transaction_id,
      amount_cop, currency, metadata, occurred_at
    ) VALUES (
      ${subscription.citizen_id}::uuid, 'subscription', ${paymentStatus}, ${PROVIDER}, ${String(invoice.payment.id)},
      ${Math.round(amount)}, 'COP', ${renewalMetadata}::jsonb,
      ${invoice.debit_date ? new Date(invoice.debit_date) : null}
    )
    ON CONFLICT (provider, provider_transaction_id) WHERE provider_transaction_id IS NOT NULL
    DO UPDATE SET status = EXCLUDED.status, metadata = payment_transactions.metadata || EXCLUDED.metadata, updated_at = NOW()
  `)
  if (paymentStatus === 'paid') {
    await syncSubscription(await getMercadoPagoSubscription(invoice.preapproval_id))
  }
}

function contributionStateFromProvider(status: string, paidEnough: boolean): 'pending' | 'paid' | 'failed' | 'refunded' | 'chargeback' | 'cancelled' {
  if ((status === 'processed' || status === 'approved') && paidEnough) return 'paid'
  if (status === 'refunded') return 'refunded'
  if (status === 'charged_back' || status === 'charged_backed') return 'chargeback'
  if (status === 'cancelled' || status === 'canceled') return 'cancelled'
  if (status === 'failed' || status === 'rejected') return 'failed'
  return 'pending'
}

async function applyContributionState(transactionId: string, target: ReturnType<typeof contributionStateFromProvider>, providerAmount: number | null, currency: string | undefined) {
  type Row = { tx_amount: bigint; contribution_id: string; campaign_id: string; contribution_amount: bigint; contribution_status: string }
  const rows = await prisma.$queryRaw<Row[]>(Prisma.sql`
    SELECT tx.amount_cop AS tx_amount, c.id AS contribution_id, c.campaign_id,
           c.amount_cop AS contribution_amount, c.status AS contribution_status
    FROM payment_transactions tx
    JOIN crowdfunding_contributions c ON c.payment_transaction_id = tx.id
    WHERE tx.id = ${transactionId}::uuid AND tx.kind = 'crowdfunding_contribution' AND tx.provider = ${PROVIDER}
    LIMIT 1
  `)
  const row = rows[0]
  if (!row) return
  if ((currency && currency !== 'COP') || (providerAmount !== null && providerAmount !== Number(row.tx_amount))) {
    throw httpError('El pago recibido no coincide con el aporte esperado.', 'PAYMENT_LEDGER_MISMATCH', 409)
  }

  await prisma.$transaction(async (db) => {
    const current = await db.$queryRaw<Array<{ status: string }>>(Prisma.sql`
      SELECT status FROM crowdfunding_contributions WHERE id = ${row.contribution_id}::uuid FOR UPDATE
    `)
    const previous = current[0]?.status
    if (!previous) return

    await db.$executeRaw(Prisma.sql`
      UPDATE payment_transactions SET status = ${target}, occurred_at = CASE WHEN ${target} = 'paid' THEN COALESCE(occurred_at, NOW()) ELSE occurred_at END, updated_at = NOW()
      WHERE id = ${transactionId}::uuid
    `)
    await db.$executeRaw(Prisma.sql`
      UPDATE crowdfunding_contributions SET status = ${target}, updated_at = NOW() WHERE id = ${row.contribution_id}::uuid
    `)

    if (target === 'paid' && previous !== 'paid') {
      await db.$executeRaw(Prisma.sql`
        UPDATE crowdfunding_campaigns
        SET raised_amount_cop = raised_amount_cop + ${Number(row.contribution_amount)}, updated_at = NOW()
        WHERE id = ${row.campaign_id}::uuid
      `)
    } else if ((target === 'refunded' || target === 'chargeback') && previous === 'paid') {
      await db.$executeRaw(Prisma.sql`
        UPDATE crowdfunding_campaigns
        SET raised_amount_cop = GREATEST(0, raised_amount_cop - ${Number(row.contribution_amount)}), updated_at = NOW()
        WHERE id = ${row.campaign_id}::uuid
      `)
    }
  })
}

async function syncOrder(order: MercadoPagoOrder): Promise<void> {
  const transactionId = transactionIdFromReference(order.external_reference, 'cf_')
  if (!transactionId) return
  const total = asNumber(order.total_amount)
  const paid = asNumber(order.total_paid_amount)
  const expectedRows = await prisma.$queryRaw<Array<{ amount_cop: bigint }>>(Prisma.sql`
    SELECT amount_cop FROM payment_transactions WHERE id = ${transactionId}::uuid LIMIT 1
  `)
  const expected = expectedRows[0] ? Number(expectedRows[0].amount_cop) : null
  const state = contributionStateFromProvider(order.status, expected !== null && paid !== null && paid >= expected)
  await applyContributionState(transactionId, state, total, order.currency)
}

async function syncPayment(payment: MercadoPagoPayment): Promise<void> {
  const transactionId = transactionIdFromReference(payment.external_reference, 'cf_')
  if (!transactionId) return
  const amount = asNumber(payment.transaction_amount)
  const expectedRows = await prisma.$queryRaw<Array<{ amount_cop: bigint }>>(Prisma.sql`
    SELECT amount_cop FROM payment_transactions WHERE id = ${transactionId}::uuid LIMIT 1
  `)
  const expected = expectedRows[0] ? Number(expectedRows[0].amount_cop) : null
  const state = contributionStateFromProvider(payment.status, expected !== null && amount !== null && amount >= expected)
  await applyContributionState(transactionId, state, amount, payment.currency_id)
}

export async function processMercadoPagoWebhook(input: {
  xSignature: string | undefined
  xRequestId: string | undefined
  dataId: string | undefined
  body: unknown
}) {
  const verified = verifyMercadoPagoWebhookSignature(input)
  const body = input.body && typeof input.body === 'object' ? input.body as Record<string, unknown> : {}
  const type = typeof body.type === 'string' ? body.type : ''
  const eventId = body.id !== undefined ? String(body.id) : `${type}:${input.dataId}:${verified.timestamp}`
  const payload = JSON.stringify({
    id: body.id ?? null,
    type,
    action: body.action ?? null,
    live_mode: body.live_mode ?? null,
    data_id: input.dataId ?? null,
  })

  const inserted = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    INSERT INTO payment_webhook_events (
      provider, provider_event_id, provider_request_id, resource_type, resource_id,
      signature_timestamp, status, payload
    ) VALUES (
      ${PROVIDER}, ${eventId}, ${input.xRequestId ?? null}, ${type || 'unknown'}, ${input.dataId ?? 'unknown'},
      ${verified.timestamp}, 'received', ${payload}::jsonb
    )
    ON CONFLICT (provider, provider_event_id) DO NOTHING
    RETURNING id
  `)
  if (!inserted[0]) return { duplicate: true, processed: false }
  const eventDbId = inserted[0].id

  try {
    if (!input.dataId) throw httpError('Webhook sin recurso.', 'INVALID_WEBHOOK_RESOURCE', 400)
    if (type === 'subscription_preapproval') {
      await syncSubscription(await getMercadoPagoSubscription(input.dataId))
    } else if (type === 'subscription_authorized_payment') {
      await syncAuthorizedPayment(await getMercadoPagoAuthorizedPayment(input.dataId))
    } else if (type === 'order') {
      await syncOrder(await getMercadoPagoOrder(input.dataId))
    } else if (type === 'payment') {
      await syncPayment(await getMercadoPagoPayment(input.dataId))
    } else {
      await prisma.$executeRaw(Prisma.sql`
        UPDATE payment_webhook_events SET status = 'ignored', processed_at = NOW() WHERE id = ${eventDbId}::uuid
      `)
      return { duplicate: false, processed: false, ignored: true }
    }

    await prisma.$executeRaw(Prisma.sql`
      UPDATE payment_webhook_events SET status = 'processed', processed_at = NOW() WHERE id = ${eventDbId}::uuid
    `)
    return { duplicate: false, processed: true }
  } catch (error) {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE payment_webhook_events SET status = 'failed', processed_at = NOW() WHERE id = ${eventDbId}::uuid
    `)
    throw error
  }
}

export async function reconcileMyBilling(citizenId: string) {
  ensureProviderReady()
  const resources = await prisma.$queryRaw<Array<{ provider_transaction_id: string }>>(Prisma.sql`
    SELECT DISTINCT provider_transaction_id
    FROM payment_transactions
    WHERE citizen_id = ${citizenId}::uuid
      AND kind = 'subscription'
      AND provider = ${PROVIDER}
      AND provider_transaction_id IS NOT NULL
      AND created_at > NOW() - INTERVAL '400 days'
    ORDER BY provider_transaction_id
    LIMIT 20
  `)
  for (const resource of resources) {
    await syncSubscription(await getMercadoPagoSubscription(resource.provider_transaction_id))
  }
  return getEffectiveBillingAccess(citizenId)
}

export async function createCrowdfundingContributionCheckout(input: {
  citizenId: string
  campaignId: string
  amountCop: number
  platformTipCop: number
  isAnonymous: boolean
  requestedIdempotencyKey?: string
}) {
  ensureProviderReady()
  if (!config.CROWDFUNDING_PAYMENTS_ENABLED) {
    throw httpError('Los aportes monetarios están deshabilitados hasta completar certificación KYC/KYB y operación de desembolsos.', 'CROWDFUNDING_PAYMENTS_DISABLED', 503)
  }
  const idempotencyKey = input.requestedIdempotencyKey?.trim() || randomUUID()
  if (!/^[A-Za-z0-9._:-]{8,80}$/.test(idempotencyKey)) throw httpError('Idempotency-Key inválido.', 'INVALID_IDEMPOTENCY_KEY', 400)

  type Campaign = { title: string; status: string; compliance_status: string; creator_citizen_id: string; ends_at: Date | null }
  const campaigns = await prisma.$queryRaw<Campaign[]>(Prisma.sql`
    SELECT title, status, compliance_status, creator_citizen_id, ends_at
    FROM crowdfunding_campaigns WHERE id = ${input.campaignId}::uuid LIMIT 1
  `)
  const campaign = campaigns[0]
  if (!campaign) throw httpError('Campaña no encontrada.', 'CAMPAIGN_NOT_FOUND', 404)
  if (campaign.status !== 'active' || campaign.compliance_status !== 'verified' || (campaign.ends_at && campaign.ends_at <= new Date())) {
    throw httpError('La campaña no está habilitada para recibir aportes.', 'CAMPAIGN_NOT_PAYABLE', 409)
  }
  const payout = await prisma.$queryRaw<Array<{ verification_status: string; payout_status: string }>>(Prisma.sql`
    SELECT verification_status, payout_status
    FROM crowdfunding_payout_profiles
    WHERE citizen_id = ${campaign.creator_citizen_id}::uuid
    LIMIT 1
  `)
  if (payout[0]?.verification_status !== 'verified' || payout[0]?.payout_status !== 'eligible') {
    throw httpError('La campaña todavía no tiene un beneficiario habilitado para desembolsos.', 'CAMPAIGN_PAYOUT_NOT_READY', 409)
  }

  const existing = await prisma.$queryRaw<Array<{ id: string; metadata: unknown }>>(Prisma.sql`
    SELECT id, metadata FROM payment_transactions
    WHERE citizen_id = ${input.citizenId}::uuid
      AND kind = 'crowdfunding_contribution'
      AND idempotency_key = ${idempotencyKey}
    LIMIT 1
  `)
  if (existing[0]) {
    const checkoutUrl = metadataValue(existing[0].metadata, 'checkout_url')
    if (typeof checkoutUrl === 'string') return { transactionId: existing[0].id, checkoutUrl, reused: true }
    throw httpError('El aporte está pendiente de conciliación.', 'PAYMENT_RECONCILIATION_REQUIRED', 409)
  }

  const email = await citizenEmail(input.citizenId)
  const total = input.amountCop + input.platformTipCop
  const metadata = JSON.stringify({ campaign_id: input.campaignId, platform_tip_cop: input.platformTipCop })
  const created = await prisma.$transaction(async (db) => {
    const txRows = await db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      INSERT INTO payment_transactions (
        citizen_id, kind, status, provider, amount_cop, platform_fee_cop, currency, idempotency_key, metadata
      ) VALUES (
        ${input.citizenId}::uuid, 'crowdfunding_contribution', 'pending', ${PROVIDER}, ${total}, 0, 'COP', ${idempotencyKey}, ${metadata}::jsonb
      ) RETURNING id
    `)
    const transactionId = txRows[0].id
    await db.$executeRaw(Prisma.sql`
      INSERT INTO crowdfunding_contributions (
        campaign_id, contributor_citizen_id, payment_transaction_id, amount_cop, platform_tip_cop, status, is_anonymous
      ) VALUES (
        ${input.campaignId}::uuid, ${input.citizenId}::uuid, ${transactionId}::uuid,
        ${input.amountCop}, ${input.platformTipCop}, 'pending', ${input.isAnonymous}
      )
    `)
    return transactionId
  })

  try {
    const order = await createMercadoPagoOrder({
      externalReference: `cf_${created}`,
      idempotencyKey: created,
      payerEmail: email,
      title: `Aporte · ${campaign.title}`.slice(0, 120),
      amountCop: total,
      successUrl: `${config.PAYMENTS_WEB_URL}/dashboard?crowdfunding=success`,
      pendingUrl: `${config.PAYMENTS_WEB_URL}/dashboard?crowdfunding=pending`,
      failureUrl: `${config.PAYMENTS_WEB_URL}/dashboard?crowdfunding=failure`,
    })
    const checkoutMetadata = JSON.stringify({ checkout_url: order.checkoutUrl, provider_order_id: order.orderId })
    await prisma.$executeRaw(Prisma.sql`
      UPDATE payment_transactions
      SET provider_transaction_id = ${order.orderId}, metadata = metadata || ${checkoutMetadata}::jsonb, updated_at = NOW()
      WHERE id = ${created}::uuid
    `)
    return { transactionId: created, checkoutUrl: order.checkoutUrl, reused: false }
  } catch (error) {
    if (error instanceof MercadoPagoApiError && error.retryable) {
      throw httpError('El aporte quedó pendiente de conciliación; no se generará un segundo cobro.', 'PAYMENT_RECONCILIATION_REQUIRED', 503)
    }
    await prisma.$transaction(async (db) => {
      await db.$executeRaw(Prisma.sql`UPDATE payment_transactions SET status = 'failed', updated_at = NOW() WHERE id = ${created}::uuid`)
      await db.$executeRaw(Prisma.sql`UPDATE crowdfunding_contributions SET status = 'failed', updated_at = NOW() WHERE payment_transaction_id = ${created}::uuid`)
    })
    throw error
  }
}
