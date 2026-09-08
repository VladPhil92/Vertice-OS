import { createHmac, randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { config } from '../../config'
import { recordAuditEvent } from '../../lib/audit'
import { prisma } from '../../lib/prisma'
import {
  WompiPayoutApiError,
  createWompiBankPayout,
  findWompiPayoutByReference,
  getWompiPayout,
  getWompiPayoutConfigurationState,
  getWompiPayoutTransactions,
  verifyWompiPayoutWebhook,
  type WompiBankDestination,
  type WompiPayoutTransaction,
} from './wompi-payouts.provider'

export const CROWDFUNDING_PAYOUT_PROVIDER = 'wompi_payouts'

type LocalPayoutStatus =
  | 'requested'
  | 'pending_approval'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'not_approved'
  | 'cancelled'
  | 'reconciliation_required'

type PayoutRow = {
  id: string
  campaign_id: string
  beneficiary_citizen_id: string
  provider_payout_id: string | null
  provider_reference: string
  amount_cop: bigint
  status: LocalPayoutStatus
  provider_status: string | null
}

function httpError(message: string, code: string, statusCode: number): Error {
  return Object.assign(new Error(message), { code, statusCode })
}

function ensurePayoutExecutionReady(): void {
  if (getWompiPayoutConfigurationState() !== 'ready') {
    throw httpError('El proveedor de desembolsos no está listo.', 'PAYOUT_PROVIDER_UNAVAILABLE', 503)
  }
  if (!config.CROWDFUNDING_PAYOUTS_ENABLED) {
    throw httpError(
      'Los desembolsos están deshabilitados hasta completar la certificación operativa.',
      'CROWDFUNDING_PAYOUTS_DISABLED',
      503,
    )
  }
}

function idempotencyKey(requested?: string): string {
  const value = requested?.trim() || randomUUID()
  if (!/^[A-Za-z0-9-]{8,64}$/.test(value)) {
    throw httpError(
      'Idempotency-Key inválido para el proveedor de desembolsos.',
      'INVALID_PAYOUT_IDEMPOTENCY_KEY',
      400,
    )
  }
  return value
}

function destinationFingerprint(destination: WompiBankDestination): string {
  if (!config.PAYOUT_DESTINATION_PEPPER) {
    throw httpError('Falta configuración criptográfica de desembolsos.', 'PAYOUT_CRYPTO_UNAVAILABLE', 503)
  }
  return createHmac('sha256', config.PAYOUT_DESTINATION_PEPPER)
    .update(`${destination.bankId}|${destination.accountType}|${destination.accountNumber}`)
    .digest('hex')
}

function centsFromCop(amountCop: number): number {
  const cents = amountCop * 100
  if (!Number.isSafeInteger(cents) || cents <= 0) {
    throw httpError('Monto de desembolso inválido.', 'INVALID_PAYOUT_AMOUNT', 400)
  }
  return cents
}

function providerReference(): string {
  return `vertice-${randomUUID().replace(/-/g, '').slice(0, 24)}`
}

function transactionReference(payoutRequestId: string): string {
  return `vp-${payoutRequestId.replace(/-/g, '').slice(0, 32)}`
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function classifyWompiPayoutState(
  batchStatus: string,
  transactions: WompiPayoutTransaction[],
): LocalPayoutStatus {
  const transaction = transactions[0]
  if (transaction?.status === 'APPROVED') return 'paid'
  if (transaction?.status === 'FAILED' || transaction?.status === 'REJECTED') return 'failed'
  if (transaction?.status === 'CANCELLED') return 'cancelled'

  if (batchStatus === 'PENDING_APPROVAL') return 'pending_approval'
  if (batchStatus === 'NOT_APPROVED') return 'not_approved'
  if (batchStatus === 'REJECTED') return 'failed'
  if (batchStatus === 'CANCELLED') return 'cancelled'
  if (batchStatus === 'PENDING') return 'processing'
  if (batchStatus === 'TOTAL_PAYMENT' || batchStatus === 'PARTIAL_PAYMENT') {
    return 'reconciliation_required'
  }
  return 'processing'
}

function isTerminal(status: LocalPayoutStatus): boolean {
  return ['paid', 'failed', 'not_approved', 'cancelled'].includes(status)
}

async function latestPayoutCertificationVerified(): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ status: string }>>(Prisma.sql`
    SELECT status
    FROM payout_operation_certifications
    WHERE provider = ${CROWDFUNDING_PAYOUT_PROVIDER}
    ORDER BY certified_at DESC
    LIMIT 1
  `)
  return rows[0]?.status === 'verified'
}

async function preparePayoutLedger(input: {
  actorId: string
  campaignId: string
  idempotencyKey: string
  destination: WompiBankDestination
}): Promise<{ payout: PayoutRow; reused: boolean }> {
  return prisma.$transaction(async (db) => {
    const existing = await db.$queryRaw<PayoutRow[]>(Prisma.sql`
      SELECT id, campaign_id, beneficiary_citizen_id, provider_payout_id,
             provider_reference, amount_cop, status, provider_status
      FROM crowdfunding_payout_requests
      WHERE provider = ${CROWDFUNDING_PAYOUT_PROVIDER}
        AND idempotency_key = ${input.idempotencyKey}
      LIMIT 1
      FOR UPDATE
    `)
    if (existing[0]) return { payout: existing[0], reused: true }

    const campaigns = await db.$queryRaw<Array<{
      id: string
      creator_citizen_id: string
      status: string
      compliance_status: string
      goal_amount_cop: bigint
      raised_amount_cop: bigint
      ends_at: Date | null
    }>>(Prisma.sql`
      SELECT id, creator_citizen_id, status, compliance_status,
             goal_amount_cop, raised_amount_cop, ends_at
      FROM crowdfunding_campaigns
      WHERE id = ${input.campaignId}::uuid
      LIMIT 1
      FOR UPDATE
    `)
    const campaign = campaigns[0]
    if (!campaign) throw httpError('Campaña no encontrada.', 'CAMPAIGN_NOT_FOUND', 404)
    if (campaign.compliance_status !== 'verified') {
      throw httpError('La campaña no tiene compliance verificado.', 'CAMPAIGN_COMPLIANCE_REQUIRED', 409)
    }

    if (campaign.status === 'active') {
      const fundingClosed = Number(campaign.raised_amount_cop) >= Number(campaign.goal_amount_cop)
        || Boolean(campaign.ends_at && campaign.ends_at <= new Date())
      if (!fundingClosed) {
        throw httpError('La campaña todavía está recaudando.', 'CAMPAIGN_STILL_FUNDRAISING', 409)
      }
      await db.$executeRaw(Prisma.sql`
        UPDATE crowdfunding_campaigns
        SET status = 'funded', updated_at = NOW()
        WHERE id = ${campaign.id}::uuid AND status = 'active'
      `)
      campaign.status = 'funded'
    }
    if (campaign.status !== 'funded') {
      throw httpError('La campaña no está lista para desembolso.', 'CAMPAIGN_NOT_PAYOUT_READY', 409)
    }

    const pending = await db.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*) AS count
      FROM crowdfunding_contributions c
      JOIN payment_transactions tx ON tx.id = c.payment_transaction_id
      WHERE c.campaign_id = ${campaign.id}::uuid
        AND (c.status = 'pending' OR tx.status IN ('pending', 'authorized'))
    `)
    if (Number(pending[0]?.count ?? 0) > 0) {
      throw httpError(
        'La campaña tiene aportes pendientes de conciliación.',
        'CAMPAIGN_PENDING_CONTRIBUTIONS',
        409,
      )
    }

    const profile = await db.$queryRaw<Array<{
      verification_status: string
      payout_status: string
    }>>(Prisma.sql`
      SELECT verification_status, payout_status
      FROM crowdfunding_payout_profiles
      WHERE citizen_id = ${campaign.creator_citizen_id}::uuid
      LIMIT 1
    `)
    if (profile[0]?.verification_status !== 'verified' || profile[0]?.payout_status !== 'eligible') {
      throw httpError('El beneficiario no está habilitado para desembolsos.', 'PAYOUT_PROFILE_NOT_READY', 409)
    }

    const risk = await db.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*) AS count
      FROM payment_risk_flags
      WHERE status IN ('open', 'escalated')
        AND (
          campaign_id = ${campaign.id}::uuid
          OR citizen_id = ${campaign.creator_citizen_id}::uuid
        )
    `)
    if (Number(risk[0]?.count ?? 0) > 0) {
      throw httpError('Hay alertas financieras pendientes de revisión.', 'PAYOUT_RISK_REVIEW_REQUIRED', 409)
    }

    const balances = await db.$queryRaw<Array<{ paid_cop: bigint; disbursed_cop: bigint }>>(Prisma.sql`
      SELECT
        COALESCE((
          SELECT SUM(amount_cop) FROM crowdfunding_contributions
          WHERE campaign_id = ${campaign.id}::uuid AND status = 'paid'
        ), 0) AS paid_cop,
        COALESCE((
          SELECT SUM(amount_cop) FROM crowdfunding_payout_requests
          WHERE campaign_id = ${campaign.id}::uuid AND status = 'paid'
        ), 0) AS disbursed_cop
    `)
    const availableCop = Number(balances[0]?.paid_cop ?? 0) - Number(balances[0]?.disbursed_cop ?? 0)
    if (!Number.isSafeInteger(availableCop) || availableCop <= 0) {
      throw httpError('No hay saldo conciliado disponible para desembolsar.', 'PAYOUT_BALANCE_UNAVAILABLE', 409)
    }

    const reference = providerReference()
    const rows = await db.$queryRaw<PayoutRow[]>(Prisma.sql`
      INSERT INTO crowdfunding_payout_requests (
        campaign_id, beneficiary_citizen_id, provider, provider_reference,
        idempotency_key, amount_cop, status, destination_kind,
        destination_fingerprint, bank_provider_id, account_type, requested_by_citizen_id
      ) VALUES (
        ${campaign.id}::uuid, ${campaign.creator_citizen_id}::uuid,
        ${CROWDFUNDING_PAYOUT_PROVIDER}, ${reference}, ${input.idempotencyKey},
        ${availableCop}, 'requested', 'bank', ${destinationFingerprint(input.destination)},
        ${input.destination.bankId}::uuid, ${input.destination.accountType}, ${input.actorId}::uuid
      )
      RETURNING id, campaign_id, beneficiary_citizen_id, provider_payout_id,
                provider_reference, amount_cop, status, provider_status
    `)
    return { payout: rows[0], reused: false }
  })
}

async function updatePayoutFromProvider(input: {
  payout: PayoutRow
  providerPayoutId: string
}): Promise<PayoutRow> {
  const [batch, transactions] = await Promise.all([
    getWompiPayout(input.providerPayoutId),
    getWompiPayoutTransactions(input.providerPayoutId),
  ])
  if (batch.reference && batch.reference !== input.payout.provider_reference) {
    throw httpError('La referencia del payout no coincide con el ledger local.', 'PAYOUT_LEDGER_MISMATCH', 409)
  }
  const providerAmount = batch.amountInCents === undefined ? null : Number(batch.amountInCents)
  if (providerAmount !== null && Number.isFinite(providerAmount) && providerAmount !== Number(input.payout.amount_cop) * 100) {
    throw httpError('El monto del payout no coincide con el ledger local.', 'PAYOUT_LEDGER_MISMATCH', 409)
  }
  if (transactions.length > 1) {
    throw httpError('El payout contiene más transacciones de las esperadas.', 'PAYOUT_LEDGER_MISMATCH', 409)
  }
  const tx = transactions[0]
  if (tx?.amountInCents !== undefined && Number(tx.amountInCents) !== Number(input.payout.amount_cop) * 100) {
    throw httpError('La transacción del payout no coincide con el ledger local.', 'PAYOUT_LEDGER_MISMATCH', 409)
  }

  const target = classifyWompiPayoutState(batch.status, transactions)
  const failureCode = tx?.failureReason?.code ?? null
  const failureMessage = tx?.failureReason?.message?.slice(0, 1000) ?? null
  const responseMetadata = JSON.stringify({
    batch_status: batch.status,
    transaction_status: tx?.status ?? null,
  })

  return prisma.$transaction(async (db) => {
    const locked = await db.$queryRaw<PayoutRow[]>(Prisma.sql`
      SELECT id, campaign_id, beneficiary_citizen_id, provider_payout_id,
             provider_reference, amount_cop, status, provider_status
      FROM crowdfunding_payout_requests
      WHERE id = ${input.payout.id}::uuid
      LIMIT 1
      FOR UPDATE
    `)
    const current = locked[0]
    if (!current) throw httpError('Solicitud de desembolso no encontrada.', 'PAYOUT_REQUEST_NOT_FOUND', 404)

    let effectiveTarget = target
    if (current.status === 'paid' && target !== 'paid') effectiveTarget = 'paid'
    if (isTerminal(current.status) && !isTerminal(target)) effectiveTarget = current.status

    const updated = await db.$queryRaw<PayoutRow[]>(Prisma.sql`
      UPDATE crowdfunding_payout_requests
      SET provider_payout_id = ${input.providerPayoutId},
          provider_transaction_id = ${tx?.id ?? null},
          provider_status = ${batch.status},
          status = ${effectiveTarget},
          failure_code = ${failureCode},
          failure_message = ${failureMessage},
          provider_response = ${responseMetadata}::jsonb,
          completed_at = CASE WHEN ${effectiveTarget} IN ('paid', 'failed', 'not_approved', 'cancelled')
            THEN COALESCE(completed_at, NOW()) ELSE completed_at END,
          updated_at = NOW()
      WHERE id = ${current.id}::uuid
      RETURNING id, campaign_id, beneficiary_citizen_id, provider_payout_id,
                provider_reference, amount_cop, status, provider_status
    `)

    if (effectiveTarget === 'paid') {
      await db.$executeRaw(Prisma.sql`
        UPDATE crowdfunding_campaigns
        SET status = CASE WHEN status = 'funded' THEN 'executing' ELSE status END,
            updated_at = NOW()
        WHERE id = ${current.campaign_id}::uuid
      `)
    }
    return updated[0]
  })
}

async function payoutRowById(payoutRequestId: string): Promise<PayoutRow> {
  const rows = await prisma.$queryRaw<PayoutRow[]>(Prisma.sql`
    SELECT id, campaign_id, beneficiary_citizen_id, provider_payout_id,
           provider_reference, amount_cop, status, provider_status
    FROM crowdfunding_payout_requests
    WHERE id = ${payoutRequestId}::uuid
      AND provider = ${CROWDFUNDING_PAYOUT_PROVIDER}
    LIMIT 1
  `)
  if (!rows[0]) throw httpError('Solicitud de desembolso no encontrada.', 'PAYOUT_REQUEST_NOT_FOUND', 404)
  return rows[0]
}

export async function requestCampaignPayout(input: {
  actorId: string
  campaignId: string
  destination: WompiBankDestination
  requestedIdempotencyKey?: string
}) {
  ensurePayoutExecutionReady()
  if (!await latestPayoutCertificationVerified()) {
    throw httpError(
      'La operación de desembolsos todavía no tiene certificación vigente.',
      'PAYOUT_OPERATIONS_NOT_CERTIFIED',
      503,
    )
  }
  const key = idempotencyKey(input.requestedIdempotencyKey)
  const prepared = await preparePayoutLedger({
    actorId: input.actorId,
    campaignId: input.campaignId,
    idempotencyKey: key,
    destination: input.destination,
  })
  if (prepared.reused) {
    return {
      id: prepared.payout.id,
      status: prepared.payout.status,
      amountCop: Number(prepared.payout.amount_cop),
      reused: true,
    }
  }

  try {
    const created = await createWompiBankPayout({
      reference: prepared.payout.provider_reference,
      transactionReference: transactionReference(prepared.payout.id),
      idempotencyKey: key,
      amountInCents: centsFromCop(Number(prepared.payout.amount_cop)),
      destination: input.destination,
    })
    let providerPayoutId = created.payoutId
    if (!providerPayoutId) {
      providerPayoutId = (await findWompiPayoutByReference(prepared.payout.provider_reference))?.id ?? null
    }
    if (!providerPayoutId) {
      await prisma.$executeRaw(Prisma.sql`
        UPDATE crowdfunding_payout_requests
        SET status = 'reconciliation_required',
            provider_status = ${created.status},
            provider_response = ${JSON.stringify({ trace_id: created.traceId })}::jsonb,
            updated_at = NOW()
        WHERE id = ${prepared.payout.id}::uuid
      `)
      return {
        id: prepared.payout.id,
        status: 'reconciliation_required' as LocalPayoutStatus,
        amountCop: Number(prepared.payout.amount_cop),
        reused: false,
      }
    }

    const synced = await updatePayoutFromProvider({ payout: prepared.payout, providerPayoutId })
    await recordAuditEvent({
      actorId: input.actorId,
      action: 'finance.crowdfunding_payout_request',
      targetType: 'crowdfunding_payout_request',
      targetId: synced.id,
      result: synced.status,
      metadata: { campaignId: synced.campaign_id, amountCop: Number(synced.amount_cop) },
    })
    return { id: synced.id, status: synced.status, amountCop: Number(synced.amount_cop), reused: false }
  } catch (error) {
    const retryable = error instanceof WompiPayoutApiError && error.retryable
    await prisma.$executeRaw(Prisma.sql`
      UPDATE crowdfunding_payout_requests
      SET status = ${retryable ? 'reconciliation_required' : 'failed'}, updated_at = NOW()
      WHERE id = ${prepared.payout.id}::uuid
    `)
    await recordAuditEvent({
      actorId: input.actorId,
      action: 'finance.crowdfunding_payout_request',
      targetType: 'crowdfunding_payout_request',
      targetId: prepared.payout.id,
      result: retryable ? 'reconciliation_required' : 'failed',
      metadata: { campaignId: prepared.payout.campaign_id },
    })
    throw error
  }
}

export async function reconcileCampaignPayout(input: {
  payoutRequestId: string
  actorId?: string | null
}) {
  ensurePayoutExecutionReady()
  const payout = await payoutRowById(input.payoutRequestId)
  let providerPayoutId = payout.provider_payout_id
  if (!providerPayoutId) {
    providerPayoutId = (await findWompiPayoutByReference(payout.provider_reference))?.id ?? null
  }
  if (!providerPayoutId) {
    throw httpError('El proveedor aún no expone un payout conciliable.', 'PAYOUT_RECONCILIATION_PENDING', 503)
  }

  const synced = await updatePayoutFromProvider({ payout, providerPayoutId })
  if (input.actorId) {
    await recordAuditEvent({
      actorId: input.actorId,
      action: 'finance.crowdfunding_payout_reconcile',
      targetType: 'crowdfunding_payout_request',
      targetId: synced.id,
      result: synced.status,
    })
  }
  return { id: synced.id, status: synced.status, amountCop: Number(synced.amount_cop) }
}

export async function listCampaignPayouts(limit = 100) {
  const rows = await prisma.$queryRaw<Array<{
    id: string
    campaign_id: string
    beneficiary_citizen_id: string
    amount_cop: bigint
    status: string
    provider_status: string | null
    provider_reference: string
    created_at: Date
    updated_at: Date
    completed_at: Date | null
  }>>(Prisma.sql`
    SELECT id, campaign_id, beneficiary_citizen_id, amount_cop, status,
           provider_status, provider_reference, created_at, updated_at, completed_at
    FROM crowdfunding_payout_requests
    ORDER BY created_at DESC
    LIMIT ${Math.min(Math.max(limit, 1), 250)}
  `)
  return rows.map((row) => ({
    ...row,
    amount_cop: Number(row.amount_cop),
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
    completed_at: row.completed_at?.toISOString() ?? null,
  }))
}

export async function processWompiPayoutWebhook(input: {
  xEventChecksum?: string
  body: unknown
}) {
  const verified = verifyWompiPayoutWebhook(input)
  const payout = asRecord(verified.data.payout)
  const transaction = asRecord(verified.data.transaction)
  const providerPayoutId = verified.event === 'payout.updated'
    ? stringValue(payout?.id)
    : verified.event === 'transaction.updated'
      ? stringValue(transaction?.payoutId)
      : null

  const inserted = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    INSERT INTO payout_webhook_events (
      provider, event_key, event_type, provider_resource_id, checksum,
      signature_timestamp, status
    ) VALUES (
      ${CROWDFUNDING_PAYOUT_PROVIDER}, ${verified.eventKey}, ${verified.event},
      ${providerPayoutId}, ${verified.checksum}, ${verified.timestamp}, 'received'
    )
    ON CONFLICT (provider, event_key) DO NOTHING
    RETURNING id
  `)
  if (!inserted[0]) return { duplicate: true, processed: false }
  const webhookId = inserted[0].id

  if (!providerPayoutId || !['payout.updated', 'transaction.updated'].includes(verified.event)) {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE payout_webhook_events SET status = 'ignored', processed_at = NOW()
      WHERE id = ${webhookId}::uuid
    `)
    return { duplicate: false, processed: false, ignored: true }
  }

  const local = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT id FROM crowdfunding_payout_requests
    WHERE provider = ${CROWDFUNDING_PAYOUT_PROVIDER}
      AND provider_payout_id = ${providerPayoutId}
    LIMIT 1
  `)
  if (!local[0]) {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE payout_webhook_events SET status = 'ignored', processed_at = NOW()
      WHERE id = ${webhookId}::uuid
    `)
    return { duplicate: false, processed: false, ignored: true }
  }

  try {
    await reconcileCampaignPayout({ payoutRequestId: local[0].id })
    await prisma.$executeRaw(Prisma.sql`
      UPDATE payout_webhook_events SET status = 'processed', processed_at = NOW()
      WHERE id = ${webhookId}::uuid
    `)
    return { duplicate: false, processed: true }
  } catch (error) {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE payout_webhook_events SET status = 'failed', processed_at = NOW()
      WHERE id = ${webhookId}::uuid
    `)
    throw error
  }
}
