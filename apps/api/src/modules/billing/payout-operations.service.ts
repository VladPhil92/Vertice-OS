import { Prisma } from '@prisma/client'
import { config } from '../../config'
import { recordAuditEvent } from '../../lib/audit'
import { prisma } from '../../lib/prisma'
import { CROWDFUNDING_PAYOUT_PROVIDER } from './crowdfunding-payout.service'
import { getWompiPayoutConfigurationState } from './wompi-payouts.provider'

function httpError(message: string, code: string, statusCode: number): Error {
  return Object.assign(new Error(message), { code, statusCode })
}

export async function certifyCrowdfundingPayoutOperations(input: {
  actorId: string
  status: 'pending' | 'verified' | 'rejected' | 'suspended'
  evidenceReference?: string
  notes?: string
}) {
  if (input.status === 'verified' && !input.evidenceReference?.trim()) {
    throw httpError(
      'La certificación verificada exige evidencia externa de Wompi Pagos a Terceros.',
      'PAYOUT_CERTIFICATION_EVIDENCE_REQUIRED',
      422,
    )
  }

  const rows = await prisma.$queryRaw<Array<{ id: string; certified_at: Date }>>(Prisma.sql`
    INSERT INTO payout_operation_certifications (
      provider, status, evidence_reference, notes, certified_by_citizen_id
    ) VALUES (
      ${CROWDFUNDING_PAYOUT_PROVIDER}, ${input.status},
      ${input.evidenceReference?.trim() || null}, ${input.notes ?? null}, ${input.actorId}::uuid
    )
    RETURNING id, certified_at
  `)

  await recordAuditEvent({
    actorId: input.actorId,
    action: 'finance.crowdfunding_payout_certification',
    targetType: 'payout_operation_certification',
    targetId: rows[0].id,
    result: input.status,
    reason: input.notes,
    metadata: { provider: CROWDFUNDING_PAYOUT_PROVIDER },
  })

  return {
    ...rows[0],
    provider: CROWDFUNDING_PAYOUT_PROVIDER,
    status: input.status,
  }
}

export async function getCrowdfundingPayoutOperationsStatus() {
  const [certifications, counts] = await Promise.all([
    prisma.$queryRaw<Array<{
      id: string
      status: string
      evidence_reference: string | null
      certified_at: Date
    }>>(Prisma.sql`
      SELECT id, status, evidence_reference, certified_at
      FROM payout_operation_certifications
      WHERE provider = ${CROWDFUNDING_PAYOUT_PROVIDER}
      ORDER BY certified_at DESC
      LIMIT 1
    `),
    prisma.$queryRaw<Array<{
      pending: bigint
      reconciliation_required: bigint
      paid: bigint
      failed: bigint
    }>>(Prisma.sql`
      SELECT
        COUNT(*) FILTER (WHERE status IN ('requested', 'pending_approval', 'processing')) AS pending,
        COUNT(*) FILTER (WHERE status = 'reconciliation_required') AS reconciliation_required,
        COUNT(*) FILTER (WHERE status = 'paid') AS paid,
        COUNT(*) FILTER (WHERE status IN ('failed', 'not_approved', 'cancelled')) AS failed
      FROM crowdfunding_payout_requests
    `),
  ])

  const certification = certifications[0] ?? null
  const providerState = getWompiPayoutConfigurationState()
  return {
    provider: CROWDFUNDING_PAYOUT_PROVIDER,
    providerState,
    environment: config.WOMPI_PAYOUTS_ENV,
    executionEnabled: config.CROWDFUNDING_PAYOUTS_ENABLED,
    operationallyCertified: certification?.status === 'verified',
    automaticPayoutsEnabled: false,
    certification,
    queue: {
      pending: Number(counts[0]?.pending ?? 0),
      reconciliationRequired: Number(counts[0]?.reconciliation_required ?? 0),
      paid: Number(counts[0]?.paid ?? 0),
      failed: Number(counts[0]?.failed ?? 0),
    },
    readiness: config.CROWDFUNDING_PAYOUTS_ENABLED
      && providerState === 'ready'
      && certification?.status === 'verified'
      ? 'ready'
      : 'blocked',
  }
}
