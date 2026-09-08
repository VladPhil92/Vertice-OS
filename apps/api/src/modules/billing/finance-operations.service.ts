import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { recordAuditEvent } from '../../lib/audit'
import {
  MercadoPagoApiError,
  getMercadoPagoConfigurationState,
  getMercadoPagoOrder,
  getMercadoPagoSubscription,
  refundMercadoPagoOrder,
  type MercadoPagoOrder,
} from './mercadopago.provider'

const PROVIDER = 'mercadopago'
const HIGH_VALUE_CROWDFUNDING_COP = 2_000_000
const VELOCITY_WINDOW_MINUTES = 10
const VELOCITY_THRESHOLD = 5
const FAILED_PAYMENT_THRESHOLD = 3

function httpError(message: string, code: string, statusCode: number): Error {
  return Object.assign(new Error(message), { code, statusCode })
}

function ensureProviderReady(): void {
  if (getMercadoPagoConfigurationState() !== 'ready') {
    throw httpError('La operación financiera requiere un proveedor de pagos listo.', 'PAYMENT_PROVIDER_UNAVAILABLE', 503)
  }
}

function metadataValue(metadata: unknown, key: string): unknown {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return undefined
  return (metadata as Record<string, unknown>)[key]
}

function metadataString(metadata: unknown, key: string): string | null {
  const value = metadataValue(metadata, key)
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function asNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function classifyCrowdfundingOrderStatus(
  status: string,
  paidAmount: number | null,
  expectedAmount: number,
): 'pending' | 'paid' | 'failed' | 'refunded' | 'chargeback' | 'cancelled' {
  if ((status === 'processed' || status === 'approved') && paidAmount !== null && paidAmount >= expectedAmount) return 'paid'
  if (status === 'refunded') return 'refunded'
  if (status === 'charged_back' || status === 'charged_backed') return 'chargeback'
  if (status === 'cancelled' || status === 'canceled') return 'cancelled'
  if (status === 'failed' || status === 'rejected') return 'failed'
  return 'pending'
}

export function financeCsvEscape(value: unknown): string {
  if (value === null || value === undefined) return ''
  const text = String(value)
  if (!/[",\r\n]/.test(text)) return text
  return `"${text.replace(/"/g, '""')}"`
}

type LedgerCandidate = {
  id: string
  citizen_id: string | null
  kind: string
  status: string
  provider_transaction_id: string | null
  amount_cop: bigint
  currency: string
  metadata: unknown
}

async function currentTransactionStatus(transactionId: string): Promise<string> {
  const rows = await prisma.$queryRaw<Array<{ status: string }>>(Prisma.sql`
    SELECT status FROM payment_transactions WHERE id = ${transactionId}::uuid LIMIT 1
  `)
  return rows[0]?.status ?? 'missing'
}

async function applyCrowdfundingOrderState(tx: LedgerCandidate, order: MercadoPagoOrder): Promise<void> {
  const total = asNumber(order.total_amount)
  const paid = asNumber(order.total_paid_amount)
  if ((order.currency && order.currency !== tx.currency) || (total !== null && total !== Number(tx.amount_cop))) {
    throw httpError('La orden del proveedor no coincide con el ledger local.', 'PAYMENT_LEDGER_MISMATCH', 409)
  }

  const target = classifyCrowdfundingOrderStatus(order.status, paid, Number(tx.amount_cop))
  await prisma.$transaction(async (db) => {
    const rows = await db.$queryRaw<Array<{
      contribution_id: string
      campaign_id: string
      contribution_amount: bigint
      contribution_status: string
    }>>(Prisma.sql`
      SELECT c.id AS contribution_id, c.campaign_id, c.amount_cop AS contribution_amount,
             c.status AS contribution_status
      FROM crowdfunding_contributions c
      WHERE c.payment_transaction_id = ${tx.id}::uuid
      FOR UPDATE
    `)
    const contribution = rows[0]
    if (!contribution) throw httpError('Aporte asociado no encontrado.', 'CONTRIBUTION_NOT_FOUND', 409)

    // Terminal reversals are monotonic. A stale provider read must never resurrect
    // a refunded/charged-back contribution as paid.
    if (
      (contribution.contribution_status === 'refunded' || contribution.contribution_status === 'chargeback')
      && target === 'paid'
    ) return

    await db.$executeRaw(Prisma.sql`
      UPDATE payment_transactions
      SET status = ${target},
          occurred_at = CASE WHEN ${target} = 'paid' THEN COALESCE(occurred_at, NOW()) ELSE occurred_at END,
          updated_at = NOW()
      WHERE id = ${tx.id}::uuid
    `)
    await db.$executeRaw(Prisma.sql`
      UPDATE crowdfunding_contributions
      SET status = ${target}, updated_at = NOW()
      WHERE id = ${contribution.contribution_id}::uuid
    `)

    if (target === 'paid' && contribution.contribution_status !== 'paid') {
      await db.$executeRaw(Prisma.sql`
        UPDATE crowdfunding_campaigns
        SET raised_amount_cop = raised_amount_cop + ${Number(contribution.contribution_amount)}, updated_at = NOW()
        WHERE id = ${contribution.campaign_id}::uuid
      `)
    } else if (
      (target === 'refunded' || target === 'chargeback')
      && contribution.contribution_status === 'paid'
    ) {
      await db.$executeRaw(Prisma.sql`
        UPDATE crowdfunding_campaigns
        SET raised_amount_cop = GREATEST(0, raised_amount_cop - ${Number(contribution.contribution_amount)}), updated_at = NOW()
        WHERE id = ${contribution.campaign_id}::uuid
      `)
    }
  })
}

async function reconcileCrowdfundingTransaction(tx: LedgerCandidate): Promise<void> {
  const orderId = metadataString(tx.metadata, 'provider_order_id') ?? tx.provider_transaction_id
  if (!orderId) throw httpError('El aporte no tiene una orden conciliable.', 'PROVIDER_RESOURCE_MISSING', 409)
  await applyCrowdfundingOrderState(tx, await getMercadoPagoOrder(orderId))
}

async function reconcileSubscriptionTransaction(tx: LedgerCandidate): Promise<void> {
  const subscriptionId = metadataString(tx.metadata, 'preapproval_id')
    ?? metadataString(tx.metadata, 'external_session_id')
    ?? (tx.status === 'pending' || tx.status === 'authorized' ? tx.provider_transaction_id : null)
  if (!subscriptionId) return

  const resource = await getMercadoPagoSubscription(subscriptionId)
  const amount = asNumber(resource.auto_recurring?.transaction_amount)
  if (
    (resource.auto_recurring?.currency_id && resource.auto_recurring.currency_id !== tx.currency)
    || (amount !== null && amount !== Number(tx.amount_cop))
  ) {
    throw httpError('La suscripción del proveedor no coincide con el ledger local.', 'PAYMENT_LEDGER_MISMATCH', 409)
  }

  if (resource.status === 'authorized') {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE payment_transactions
      SET status = CASE WHEN status = 'pending' THEN 'authorized' ELSE status END,
          updated_at = NOW()
      WHERE id = ${tx.id}::uuid
    `)
  } else if (resource.status === 'cancelled') {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE payment_transactions
      SET status = CASE WHEN status IN ('pending', 'authorized') THEN 'cancelled' ELSE status END,
          updated_at = NOW()
      WHERE id = ${tx.id}::uuid
    `)
  }

  await prisma.$executeRaw(Prisma.sql`
    UPDATE subscriptions
    SET last_provider_sync_at = NOW(),
        cancel_at_period_end = CASE
          WHEN ${resource.status} IN ('cancelled', 'paused') THEN TRUE
          ELSE cancel_at_period_end
        END,
        status = CASE
          WHEN ${resource.status} IN ('cancelled', 'paused')
               AND (current_period_end IS NULL OR current_period_end <= NOW()) THEN 'cancelled'
          ELSE status
        END,
        updated_at = NOW()
    WHERE provider = ${PROVIDER} AND provider_subscription_id = ${resource.id}
  `)
}

export async function reconcileFinanceLedger(input: {
  actorId?: string | null
  triggerKind: 'manual' | 'job'
  limit?: number
}) {
  ensureProviderReady()
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 250)
  const runs = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    INSERT INTO payment_reconciliation_runs (triggered_by_citizen_id, trigger_kind)
    VALUES (${input.actorId ?? null}::uuid, ${input.triggerKind})
    RETURNING id
  `)
  const runId = runs[0].id

  const candidates = await prisma.$queryRaw<LedgerCandidate[]>(Prisma.sql`
    SELECT id, citizen_id, kind, status, provider_transaction_id,
           amount_cop, currency, metadata
    FROM payment_transactions
    WHERE provider = ${PROVIDER}
      AND kind IN ('subscription', 'crowdfunding_contribution')
      AND provider_transaction_id IS NOT NULL
      AND status IN ('pending', 'authorized', 'paid')
    ORDER BY updated_at ASC
    LIMIT ${limit}
  `)

  let changed = 0
  let failed = 0
  for (const tx of candidates) {
    const before = tx.status
    try {
      if (tx.kind === 'crowdfunding_contribution') await reconcileCrowdfundingTransaction(tx)
      else await reconcileSubscriptionTransaction(tx)
      const after = await currentTransactionStatus(tx.id)
      const result = before === after ? 'unchanged' : 'synced'
      if (result === 'synced') changed += 1
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO payment_reconciliation_items (
          run_id, payment_transaction_id, provider_resource_id,
          before_status, after_status, result
        ) VALUES (
          ${runId}::uuid, ${tx.id}::uuid, ${tx.provider_transaction_id},
          ${before}, ${after}, ${result}
        )
      `)
    } catch (error) {
      failed += 1
      const code = error && typeof error === 'object' && 'code' in error ? String((error as { code?: unknown }).code ?? '') : null
      const message = error instanceof Error ? error.message.slice(0, 1000) : 'Error de conciliación'
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO payment_reconciliation_items (
          run_id, payment_transaction_id, provider_resource_id,
          before_status, after_status, result, error_code, error_message
        ) VALUES (
          ${runId}::uuid, ${tx.id}::uuid, ${tx.provider_transaction_id},
          ${before}, ${before}, 'failed', ${code}, ${message}
        )
      `)
    }
  }

  const runStatus = failed === 0 ? 'succeeded' : failed === candidates.length && candidates.length > 0 ? 'failed' : 'partial'
  await prisma.$executeRaw(Prisma.sql`
    UPDATE payment_reconciliation_runs
    SET status = ${runStatus},
        scanned_count = ${candidates.length},
        changed_count = ${changed},
        failed_count = ${failed},
        completed_at = NOW()
    WHERE id = ${runId}::uuid
  `)

  if (input.actorId) {
    await recordAuditEvent({
      actorId: input.actorId,
      action: 'finance.reconcile',
      targetType: 'payment_reconciliation_run',
      targetId: runId,
      result: runStatus,
      metadata: { scanned: candidates.length, changed, failed },
    })
  }

  return { id: runId, status: runStatus, scanned: candidates.length, changed, failed }
}

export async function requestCrowdfundingRefund(input: {
  actorId: string
  transactionId: string
  reason: string
  requestedIdempotencyKey?: string
}) {
  ensureProviderReady()
  const idempotencyKey = input.requestedIdempotencyKey?.trim() || randomUUID()
  if (!/^[A-Za-z0-9._:-]{8,80}$/.test(idempotencyKey)) {
    throw httpError('Idempotency-Key inválido.', 'INVALID_IDEMPOTENCY_KEY', 400)
  }

  const rows = await prisma.$queryRaw<Array<{
    id: string
    status: string
    provider_transaction_id: string | null
    amount_cop: bigint
    metadata: unknown
  }>>(Prisma.sql`
    SELECT id, status, provider_transaction_id, amount_cop, metadata
    FROM payment_transactions
    WHERE id = ${input.transactionId}::uuid
      AND provider = ${PROVIDER}
      AND kind = 'crowdfunding_contribution'
    LIMIT 1
  `)
  const tx = rows[0]
  if (!tx) throw httpError('Transacción no encontrada.', 'PAYMENT_TRANSACTION_NOT_FOUND', 404)
  if (tx.status !== 'paid') throw httpError('Solo un aporte pagado puede reembolsarse.', 'REFUND_NOT_ALLOWED', 409)

  const existing = await prisma.$queryRaw<Array<{ id: string; status: string }>>(Prisma.sql`
    SELECT id, status FROM payment_refund_requests
    WHERE payment_transaction_id = ${tx.id}::uuid AND idempotency_key = ${idempotencyKey}
    LIMIT 1
  `)
  if (existing[0]) return { refundRequestId: existing[0].id, status: existing[0].status, reused: true }

  const orderId = metadataString(tx.metadata, 'provider_order_id') ?? tx.provider_transaction_id
  if (!orderId) throw httpError('La transacción no tiene orden de proveedor.', 'PROVIDER_RESOURCE_MISSING', 409)

  const created = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    INSERT INTO payment_refund_requests (
      payment_transaction_id, provider, idempotency_key, amount_cop,
      status, requested_by_citizen_id, reason
    ) VALUES (
      ${tx.id}::uuid, ${PROVIDER}, ${idempotencyKey}, ${Number(tx.amount_cop)},
      'processing', ${input.actorId}::uuid, ${input.reason}
    ) RETURNING id
  `)
  const refundRequestId = created[0].id

  try {
    const refund = await refundMercadoPagoOrder(orderId, idempotencyKey)
    await prisma.$executeRaw(Prisma.sql`
      UPDATE payment_refund_requests
      SET provider_refund_id = ${refund.id != null ? String(refund.id) : null},
          status = 'succeeded',
          provider_response = ${JSON.stringify({ status: refund.status ?? null, amount: refund.amount ?? null })}::jsonb,
          completed_at = NOW(), updated_at = NOW()
      WHERE id = ${refundRequestId}::uuid
    `)

    // Do not infer that money was returned merely from our local request. The
    // provider order is fetched again and the contribution ledger changes only
    // if its verified state reports the refund.
    const ledgerTx: LedgerCandidate = {
      id: tx.id,
      citizen_id: null,
      kind: 'crowdfunding_contribution',
      status: tx.status,
      provider_transaction_id: tx.provider_transaction_id,
      amount_cop: tx.amount_cop,
      currency: 'COP',
      metadata: tx.metadata,
    }
    await applyCrowdfundingOrderState(ledgerTx, await getMercadoPagoOrder(orderId))

    await recordAuditEvent({
      actorId: input.actorId,
      action: 'finance.refund_crowdfunding',
      targetType: 'payment_transaction',
      targetId: tx.id,
      result: 'provider_accepted',
      reason: input.reason,
      metadata: { refundRequestId },
    })
    return { refundRequestId, status: 'succeeded', reused: false }
  } catch (error) {
    const reconciliationRequired = error instanceof MercadoPagoApiError && error.retryable
    await prisma.$executeRaw(Prisma.sql`
      UPDATE payment_refund_requests
      SET status = ${reconciliationRequired ? 'reconciliation_required' : 'failed'}, updated_at = NOW()
      WHERE id = ${refundRequestId}::uuid
    `)
    await recordAuditEvent({
      actorId: input.actorId,
      action: 'finance.refund_crowdfunding',
      targetType: 'payment_transaction',
      targetId: tx.id,
      result: reconciliationRequired ? 'reconciliation_required' : 'failed',
      reason: input.reason,
    })
    throw error
  }
}

export async function scanFinanceRisk(actorId?: string | null) {
  let inserted = 0
  inserted += await prisma.$executeRaw(Prisma.sql`
    INSERT INTO payment_risk_flags (
      payment_transaction_id, citizen_id, campaign_id, rule_code, severity, details
    )
    SELECT tx.id, tx.citizen_id, c.campaign_id, 'chargeback', 'critical',
           jsonb_build_object('status', tx.status, 'amount_cop', tx.amount_cop)
    FROM payment_transactions tx
    LEFT JOIN crowdfunding_contributions c ON c.payment_transaction_id = tx.id
    WHERE tx.status = 'chargeback'
    ON CONFLICT (rule_code, payment_transaction_id)
      WHERE payment_transaction_id IS NOT NULL AND status = 'open'
    DO NOTHING
  `)

  inserted += await prisma.$executeRaw(Prisma.sql`
    INSERT INTO payment_risk_flags (
      payment_transaction_id, citizen_id, campaign_id, rule_code, severity, details
    )
    SELECT tx.id, tx.citizen_id, c.campaign_id, 'high_value_crowdfunding', 'medium',
           jsonb_build_object('amount_cop', c.amount_cop, 'threshold_cop', ${HIGH_VALUE_CROWDFUNDING_COP})
    FROM payment_transactions tx
    JOIN crowdfunding_contributions c ON c.payment_transaction_id = tx.id
    WHERE tx.status = 'paid' AND c.amount_cop >= ${HIGH_VALUE_CROWDFUNDING_COP}
    ON CONFLICT (rule_code, payment_transaction_id)
      WHERE payment_transaction_id IS NOT NULL AND status = 'open'
    DO NOTHING
  `)

  inserted += await prisma.$executeRaw(Prisma.sql`
    INSERT INTO payment_risk_flags (
      payment_transaction_id, citizen_id, campaign_id, rule_code, severity, details
    )
    SELECT tx.id, tx.citizen_id, c.campaign_id, 'self_funding', 'medium',
           jsonb_build_object('amount_cop', c.amount_cop)
    FROM payment_transactions tx
    JOIN crowdfunding_contributions c ON c.payment_transaction_id = tx.id
    JOIN crowdfunding_campaigns campaign ON campaign.id = c.campaign_id
    WHERE tx.status = 'paid'
      AND c.contributor_citizen_id = campaign.creator_citizen_id
    ON CONFLICT (rule_code, payment_transaction_id)
      WHERE payment_transaction_id IS NOT NULL AND status = 'open'
    DO NOTHING
  `)

  const velocity = await prisma.$queryRaw<Array<{
    citizen_id: string
    latest_tx_id: string
    event_count: bigint
  }>>(Prisma.sql`
    SELECT citizen_id, (ARRAY_AGG(id ORDER BY created_at DESC))[1] AS latest_tx_id, COUNT(*) AS event_count
    FROM payment_transactions
    WHERE citizen_id IS NOT NULL
      AND created_at >= NOW() - (${VELOCITY_WINDOW_MINUTES} || ' minutes')::interval
    GROUP BY citizen_id
    HAVING COUNT(*) >= ${VELOCITY_THRESHOLD}
  `)
  for (const row of velocity) {
    inserted += await prisma.$executeRaw(Prisma.sql`
      INSERT INTO payment_risk_flags (
        payment_transaction_id, citizen_id, rule_code, severity, details
      ) VALUES (
        ${row.latest_tx_id}::uuid, ${row.citizen_id}::uuid, 'payment_velocity', 'high',
        ${JSON.stringify({ count: Number(row.event_count), window_minutes: VELOCITY_WINDOW_MINUTES })}::jsonb
      )
      ON CONFLICT (rule_code, payment_transaction_id)
        WHERE payment_transaction_id IS NOT NULL AND status = 'open'
      DO NOTHING
    `)
  }

  const failures = await prisma.$queryRaw<Array<{
    citizen_id: string
    latest_tx_id: string
    event_count: bigint
  }>>(Prisma.sql`
    SELECT citizen_id, (ARRAY_AGG(id ORDER BY updated_at DESC))[1] AS latest_tx_id, COUNT(*) AS event_count
    FROM payment_transactions
    WHERE citizen_id IS NOT NULL
      AND status = 'failed'
      AND updated_at >= NOW() - INTERVAL '24 hours'
    GROUP BY citizen_id
    HAVING COUNT(*) >= ${FAILED_PAYMENT_THRESHOLD}
  `)
  for (const row of failures) {
    inserted += await prisma.$executeRaw(Prisma.sql`
      INSERT INTO payment_risk_flags (
        payment_transaction_id, citizen_id, rule_code, severity, details
      ) VALUES (
        ${row.latest_tx_id}::uuid, ${row.citizen_id}::uuid, 'repeated_failures', 'medium',
        ${JSON.stringify({ count: Number(row.event_count), window_hours: 24 })}::jsonb
      )
      ON CONFLICT (rule_code, payment_transaction_id)
        WHERE payment_transaction_id IS NOT NULL AND status = 'open'
      DO NOTHING
    `)
  }

  if (actorId) {
    await recordAuditEvent({
      actorId,
      action: 'finance.risk_scan',
      targetType: 'payment_risk_flags',
      targetId: 'system',
      result: 'completed',
      metadata: { inserted },
    })
  }
  return { inserted }
}

export async function listFinanceRiskFlags(limit = 100) {
  return prisma.$queryRaw<Array<{
    id: string
    payment_transaction_id: string | null
    citizen_id: string | null
    campaign_id: string | null
    rule_code: string
    severity: string
    status: string
    details: unknown
    detected_at: Date
    reviewed_at: Date | null
    review_notes: string | null
  }>>(Prisma.sql`
    SELECT id, payment_transaction_id, citizen_id, campaign_id, rule_code,
           severity, status, details, detected_at, reviewed_at, review_notes
    FROM payment_risk_flags
    ORDER BY
      CASE severity WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END DESC,
      detected_at DESC
    LIMIT ${Math.min(Math.max(limit, 1), 250)}
  `)
}

export async function reviewFinanceRiskFlag(input: {
  actorId: string
  flagId: string
  status: 'reviewed' | 'dismissed' | 'escalated'
  notes?: string
}) {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    UPDATE payment_risk_flags
    SET status = ${input.status}, reviewed_by_citizen_id = ${input.actorId}::uuid,
        reviewed_at = NOW(), review_notes = ${input.notes ?? null}
    WHERE id = ${input.flagId}::uuid
    RETURNING id
  `)
  if (!rows[0]) throw httpError('Alerta de riesgo no encontrada.', 'RISK_FLAG_NOT_FOUND', 404)
  await recordAuditEvent({
    actorId: input.actorId,
    action: 'finance.risk_review',
    targetType: 'payment_risk_flag',
    targetId: input.flagId,
    result: input.status,
    reason: input.notes,
  })
  return { id: input.flagId, status: input.status }
}

export async function buildAccountingExport(from: Date, to: Date): Promise<string> {
  const rows = await prisma.$queryRaw<Array<{
    id: string
    occurred_at: Date | null
    created_at: Date
    kind: string
    status: string
    provider: string
    provider_transaction_id: string | null
    amount_cop: bigint
    platform_fee_cop: bigint
    currency: string
    citizen_id: string | null
    campaign_id: string | null
    contribution_amount_cop: bigint | null
    platform_tip_cop: bigint | null
  }>>(Prisma.sql`
    SELECT tx.id, tx.occurred_at, tx.created_at, tx.kind, tx.status, tx.provider,
           tx.provider_transaction_id, tx.amount_cop, tx.platform_fee_cop, tx.currency,
           tx.citizen_id, c.campaign_id, c.amount_cop AS contribution_amount_cop,
           c.platform_tip_cop
    FROM payment_transactions tx
    LEFT JOIN crowdfunding_contributions c ON c.payment_transaction_id = tx.id
    WHERE tx.created_at >= ${from} AND tx.created_at < ${to}
    ORDER BY tx.created_at ASC
  `)

  const header = [
    'transaction_id', 'accounting_date', 'kind', 'status', 'provider',
    'provider_transaction_id', 'amount_cop', 'platform_fee_cop', 'currency',
    'citizen_id', 'campaign_id', 'contribution_amount_cop', 'platform_tip_cop',
  ]
  const lines = [header.join(',')]
  for (const row of rows) {
    lines.push([
      row.id,
      (row.occurred_at ?? row.created_at).toISOString(),
      row.kind,
      row.status,
      row.provider,
      row.provider_transaction_id,
      Number(row.amount_cop),
      Number(row.platform_fee_cop),
      row.currency,
      row.citizen_id,
      row.campaign_id,
      row.contribution_amount_cop == null ? null : Number(row.contribution_amount_cop),
      row.platform_tip_cop == null ? null : Number(row.platform_tip_cop),
    ].map(financeCsvEscape).join(','))
  }
  return `${lines.join('\n')}\n`
}

export async function certifyPayoutOperations(input: {
  actorId: string
  status: 'pending' | 'verified' | 'rejected' | 'suspended'
  evidenceReference?: string
  notes?: string
}) {
  if (input.status === 'verified' && !input.evidenceReference?.trim()) {
    throw httpError('La certificación verificada exige evidencia externa.', 'PAYOUT_CERTIFICATION_EVIDENCE_REQUIRED', 422)
  }
  const rows = await prisma.$queryRaw<Array<{ id: string; certified_at: Date }>>(Prisma.sql`
    INSERT INTO payout_operation_certifications (
      provider, status, evidence_reference, notes, certified_by_citizen_id
    ) VALUES (
      ${PROVIDER}, ${input.status}, ${input.evidenceReference?.trim() || null},
      ${input.notes ?? null}, ${input.actorId}::uuid
    ) RETURNING id, certified_at
  `)
  await recordAuditEvent({
    actorId: input.actorId,
    action: 'finance.payout_certification',
    targetType: 'payout_operation_certification',
    targetId: rows[0].id,
    result: input.status,
    reason: input.notes,
  })
  return rows[0]
}

export async function getFinanceOperationsStatus() {
  const [runs, counts, certification] = await Promise.all([
    prisma.$queryRaw<Array<{
      id: string
      status: string
      scanned_count: number
      changed_count: number
      failed_count: number
      started_at: Date
      completed_at: Date | null
    }>>(Prisma.sql`
      SELECT id, status, scanned_count, changed_count, failed_count, started_at, completed_at
      FROM payment_reconciliation_runs ORDER BY started_at DESC LIMIT 1
    `),
    prisma.$queryRaw<Array<{ open_risk_flags: bigint; pending_refunds: bigint }>>(Prisma.sql`
      SELECT
        (SELECT COUNT(*) FROM payment_risk_flags WHERE status IN ('open', 'escalated')) AS open_risk_flags,
        (SELECT COUNT(*) FROM payment_refund_requests WHERE status IN ('requested', 'processing', 'reconciliation_required')) AS pending_refunds
    `),
    prisma.$queryRaw<Array<{
      id: string
      status: string
      evidence_reference: string | null
      certified_at: Date
    }>>(Prisma.sql`
      SELECT id, status, evidence_reference, certified_at
      FROM payout_operation_certifications
      WHERE provider = ${PROVIDER}
      ORDER BY certified_at DESC LIMIT 1
    `),
  ])

  return {
    provider: getMercadoPagoConfigurationState(),
    reconciliation: runs[0] ?? null,
    openRiskFlags: Number(counts[0]?.open_risk_flags ?? 0),
    pendingRefunds: Number(counts[0]?.pending_refunds ?? 0),
    payoutCertification: certification[0] ?? null,
    automaticPayoutsEnabled: false,
  }
}
