import { Prisma } from '@prisma/client'
import { config } from '../../config'
import { recordAuditEvent } from '../../lib/audit'
import { prisma } from '../../lib/prisma'
import { getFinanceOperationsStatus } from './finance-operations.service'
import { getMercadoPagoConfigurationState } from './mercadopago.provider'
import { getCrowdfundingPayoutOperationsStatus } from './payout-operations.service'
import { getWompiPayoutConfigurationState } from './wompi-payouts.provider'

export const FINANCIAL_CAPABILITIES = [
  'pro_checkout',
  'crowdfunding_collection',
  'crowdfunding_payouts',
] as const

export type FinancialCapability = typeof FINANCIAL_CAPABILITIES[number]

type RuntimeControlRow = {
  capability: FinancialCapability
  emergency_stop: boolean
  reason: string | null
  updated_by_citizen_id: string | null
  updated_at: Date
}

function httpError(message: string, code: string, statusCode: number): Error {
  return Object.assign(new Error(message), { code, statusCode })
}

function capabilityCode(capability: FinancialCapability): string {
  return capability.toUpperCase()
}

export async function getFinancialRuntimeControls(): Promise<RuntimeControlRow[]> {
  return prisma.$queryRaw<RuntimeControlRow[]>(Prisma.sql`
    SELECT capability, emergency_stop, reason, updated_by_citizen_id, updated_at
    FROM finance_runtime_controls
    ORDER BY capability ASC
  `)
}

export async function assertFinancialCapabilityEnabled(capability: FinancialCapability): Promise<void> {
  let rows: Array<{ emergency_stop: boolean; reason: string | null }>
  try {
    rows = await prisma.$queryRaw(Prisma.sql`
      SELECT emergency_stop, reason
      FROM finance_runtime_controls
      WHERE capability = ${capability}
      LIMIT 1
    `)
  } catch {
    throw httpError(
      'El plano de control financiero no está disponible. La operación queda bloqueada por seguridad.',
      'FINANCE_CONTROL_PLANE_UNAVAILABLE',
      503,
    )
  }

  if (!rows[0]) {
    throw httpError(
      'El plano de control financiero no tiene estado para esta capacidad.',
      'FINANCE_CONTROL_STATE_MISSING',
      503,
    )
  }

  if (rows[0].emergency_stop) {
    throw httpError(
      rows[0].reason?.trim() || 'La capacidad financiera está detenida temporalmente por operación.',
      `${capabilityCode(capability)}_EMERGENCY_STOP`,
      503,
    )
  }
}

export async function setFinancialEmergencyStop(input: {
  actorId: string
  capability: FinancialCapability
  emergencyStop: boolean
  reason?: string
}) {
  const reason = input.reason?.trim() || null
  if (input.emergencyStop && (!reason || reason.length < 8)) {
    throw httpError(
      'Activar un emergency stop exige una razón operativa de al menos 8 caracteres.',
      'FINANCE_CONTROL_REASON_REQUIRED',
      422,
    )
  }

  const rows = await prisma.$queryRaw<RuntimeControlRow[]>(Prisma.sql`
    UPDATE finance_runtime_controls
    SET emergency_stop = ${input.emergencyStop},
        reason = ${input.emergencyStop ? reason : null},
        updated_by_citizen_id = ${input.actorId}::uuid,
        updated_at = NOW()
    WHERE capability = ${input.capability}
    RETURNING capability, emergency_stop, reason, updated_by_citizen_id, updated_at
  `)
  if (!rows[0]) {
    throw httpError('Control financiero no encontrado.', 'FINANCE_CONTROL_NOT_FOUND', 404)
  }

  await recordAuditEvent({
    actorId: input.actorId,
    action: input.emergencyStop ? 'finance.emergency_stop.enable' : 'finance.emergency_stop.disable',
    targetType: 'finance_runtime_control',
    targetId: input.capability,
    result: input.emergencyStop ? 'blocked' : 'restored',
    reason: reason ?? undefined,
    metadata: { capability: input.capability },
  })

  return rows[0]
}

export async function getFinanceCommandCenter() {
  const [
    controls,
    finance,
    payoutOperations,
    transactionMetrics,
    webhookMetrics,
    refundMetrics,
    payoutMetrics,
    riskMetrics,
  ] = await Promise.all([
    getFinancialRuntimeControls(),
    getFinanceOperationsStatus(),
    getCrowdfundingPayoutOperationsStatus(),
    prisma.$queryRaw<Array<{
      pending_total: bigint
      stale_pending: bigint
      reconciliation_unknown: bigint
      paid_24h_cop: bigint
      platform_fee_24h_cop: bigint
    }>>(Prisma.sql`
      SELECT
        COUNT(*) FILTER (WHERE status IN ('pending', 'authorized')) AS pending_total,
        COUNT(*) FILTER (
          WHERE status IN ('pending', 'authorized')
            AND updated_at < NOW() - INTERVAL '30 minutes'
        ) AS stale_pending,
        COUNT(*) FILTER (
          WHERE status IN ('pending', 'authorized')
            AND metadata->>'provider_state' = 'unknown'
        ) AS reconciliation_unknown,
        COALESCE(SUM(amount_cop) FILTER (
          WHERE status = 'paid' AND occurred_at >= NOW() - INTERVAL '24 hours'
        ), 0) AS paid_24h_cop,
        COALESCE(SUM(platform_fee_cop) FILTER (
          WHERE status = 'paid' AND occurred_at >= NOW() - INTERVAL '24 hours'
        ), 0) AS platform_fee_24h_cop
      FROM payment_transactions
      WHERE provider = 'mercadopago'
    `),
    prisma.$queryRaw<Array<{
      failed_24h: bigint
      received_stale: bigint
    }>>(Prisma.sql`
      SELECT
        COUNT(*) FILTER (
          WHERE status = 'failed' AND received_at >= NOW() - INTERVAL '24 hours'
        ) AS failed_24h,
        COUNT(*) FILTER (
          WHERE status = 'received' AND received_at < NOW() - INTERVAL '5 minutes'
        ) AS received_stale
      FROM payment_webhook_events
      WHERE provider = 'mercadopago'
    `),
    prisma.$queryRaw<Array<{
      pending: bigint
      reconciliation_required: bigint
    }>>(Prisma.sql`
      SELECT
        COUNT(*) FILTER (WHERE status IN ('requested', 'processing')) AS pending,
        COUNT(*) FILTER (WHERE status = 'reconciliation_required') AS reconciliation_required
      FROM payment_refund_requests
    `),
    prisma.$queryRaw<Array<{
      in_flight: bigint
      reconciliation_required: bigint
    }>>(Prisma.sql`
      SELECT
        COUNT(*) FILTER (WHERE status IN ('requested', 'pending_approval', 'processing')) AS in_flight,
        COUNT(*) FILTER (WHERE status = 'reconciliation_required') AS reconciliation_required
      FROM crowdfunding_payout_requests
    `),
    prisma.$queryRaw<Array<{
      open_total: bigint
      escalated: bigint
      critical: bigint
    }>>(Prisma.sql`
      SELECT
        COUNT(*) FILTER (WHERE status IN ('open', 'escalated')) AS open_total,
        COUNT(*) FILTER (WHERE status = 'escalated') AS escalated,
        COUNT(*) FILTER (WHERE status IN ('open', 'escalated') AND severity = 'critical') AS critical
      FROM payment_risk_flags
    `),
  ])

  const tx = transactionMetrics[0]
  const hooks = webhookMetrics[0]
  const refunds = refundMetrics[0]
  const payouts = payoutMetrics[0]
  const risk = riskMetrics[0]
  const controlMap = Object.fromEntries(controls.map((row) => [row.capability, row])) as Record<FinancialCapability, RuntimeControlRow>

  const slos = {
    stalePaymentsClear: Number(tx?.stale_pending ?? 0) === 0,
    webhookBacklogClear: Number(hooks?.received_stale ?? 0) === 0,
    webhookFailures24hClear: Number(hooks?.failed_24h ?? 0) === 0,
    refundReconciliationClear: Number(refunds?.reconciliation_required ?? 0) === 0,
    payoutReconciliationClear: Number(payouts?.reconciliation_required ?? 0) === 0,
    criticalRiskClear: Number(risk?.critical ?? 0) === 0,
  }
  const degraded = Object.values(slos).some((ok) => !ok)
  const stopped = controls.some((row) => row.emergency_stop)

  return {
    state: stopped ? 'blocked' : degraded ? 'degraded' : 'nominal',
    generatedAt: new Date().toISOString(),
    providers: {
      mercadopago: getMercadoPagoConfigurationState(),
      wompiPayouts: getWompiPayoutConfigurationState(),
    },
    releaseSwitches: {
      crowdfundingCollectionEnabled: config.CROWDFUNDING_PAYMENTS_ENABLED,
      crowdfundingPayoutsEnabled: config.CROWDFUNDING_PAYOUTS_ENABLED,
    },
    controls: FINANCIAL_CAPABILITIES.map((capability) => controlMap[capability]).filter(Boolean),
    metrics: {
      pendingPayments: Number(tx?.pending_total ?? 0),
      stalePendingPayments: Number(tx?.stale_pending ?? 0),
      providerStateUnknown: Number(tx?.reconciliation_unknown ?? 0),
      paid24hCop: Number(tx?.paid_24h_cop ?? 0),
      platformFees24hCop: Number(tx?.platform_fee_24h_cop ?? 0),
      failedWebhooks24h: Number(hooks?.failed_24h ?? 0),
      staleReceivedWebhooks: Number(hooks?.received_stale ?? 0),
      pendingRefunds: Number(refunds?.pending ?? 0),
      refundsReconciliationRequired: Number(refunds?.reconciliation_required ?? 0),
      payoutsInFlight: Number(payouts?.in_flight ?? 0),
      payoutsReconciliationRequired: Number(payouts?.reconciliation_required ?? 0),
      openRiskFlags: Number(risk?.open_total ?? 0),
      escalatedRiskFlags: Number(risk?.escalated ?? 0),
      criticalRiskFlags: Number(risk?.critical ?? 0),
    },
    slos,
    finance,
    payoutOperations,
    certificationBoundary: {
      internalFinancialIntegrity: 'integrated',
      providerMoneyMovement: 'requires_external_canary',
    },
  }
}
