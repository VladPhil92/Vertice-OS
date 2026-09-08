import { createHmac, randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { config } from '../../config'
import { recordAuditEvent } from '../../lib/audit'
import { prisma } from '../../lib/prisma'
import type { FundingPolicy } from '../crowdfunding/crowdfunding.policy'
import {
  CROWDFUNDING_PAYOUT_PROVIDER,
  reconcileCampaignPayout,
} from './crowdfunding-payout.service'
import {
  computeDisbursableAmount,
  evaluateFundingEligibility,
} from './crowdfunding-payout-policy'
import {
  WompiPayoutApiError,
  createWompiBrebPayout,
  findWompiPayoutByReference,
  getWompiPayoutConfigurationState,
  resolveWompiBrebKey,
  type WompiBrebDestination,
  type WompiBrebKeyType,
} from './wompi-payouts.provider'

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

type ConfirmedBrebDestination = WompiBrebDestination & {
  confirmedHolderName: string
  confirmedFinancialEntityCode: string
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

function normalizeBrebKey(key: string, keyType: WompiBrebKeyType): string {
  const value = key.trim()
  if (keyType === 'MAIL') return value.toLowerCase()
  if (keyType === 'ALPHANUMERIC' || keyType === 'IDENTIFICATION') return value.toUpperCase()
  return value
}

function destinationFingerprint(key: string, keyType: WompiBrebKeyType): string {
  if (!config.PAYOUT_DESTINATION_PEPPER) {
    throw httpError('Falta configuración criptográfica de desembolsos.', 'PAYOUT_CRYPTO_UNAVAILABLE', 503)
  }
  return createHmac('sha256', config.PAYOUT_DESTINATION_PEPPER)
    .update(`${keyType}|${normalizeBrebKey(key, keyType)}`)
    .digest('hex')
}

function payoutIdempotencyKey(requested?: string): string {
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

function providerReference(): string {
  return `vertice-${randomUUID().replace(/-/g, '').slice(0, 24)}`
}

function transactionReference(payoutRequestId: string): string {
  return `vp-${payoutRequestId.replace(/-/g, '').slice(0, 32)}`
}

function centsFromCop(amountCop: number): number {
  const cents = amountCop * 100
  if (!Number.isSafeInteger(cents) || cents <= 0) {
    throw httpError('Monto de desembolso inválido.', 'INVALID_PAYOUT_AMOUNT', 400)
  }
  return cents
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

async function prepareFlexiblePayoutLedger(input: {
  actorId: string
  campaignId: string
  idempotencyKey: string
  destinationFingerprint: string
  destinationKeyType: WompiBrebKeyType
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
      funding_policy: FundingPolicy
      goal_amount_cop: bigint
      raised_amount_cop: bigint
    }>>(Prisma.sql`
      SELECT id, creator_citizen_id, status, compliance_status, funding_policy,
             goal_amount_cop, raised_amount_cop
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

    const funding = evaluateFundingEligibility({
      status: campaign.status,
      fundingPolicy: campaign.funding_policy,
      goalAmountCop: Number(campaign.goal_amount_cop),
      raisedAmountCop: Number(campaign.raised_amount_cop),
    })
    if (!funding.eligible) {
      if (funding.code === 'CAMPAIGN_GOAL_NOT_REACHED') {
        throw httpError(
          'La campaña todo-o-nada todavía no alcanzó su meta.',
          'CAMPAIGN_GOAL_NOT_REACHED',
          409,
        )
      }
      throw httpError('La campaña no está lista para desembolso.', 'CAMPAIGN_NOT_PAYOUT_READY', 409)
    }
    if (funding.shouldMarkFunded) {
      await db.$executeRaw(Prisma.sql`
        UPDATE crowdfunding_campaigns
        SET status = 'funded', updated_at = NOW()
        WHERE id = ${campaign.id}::uuid AND status = 'active'
      `)
      campaign.status = 'funded'
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

    const balances = await db.$queryRaw<Array<{ net_paid_cop: bigint; disbursed_cop: bigint }>>(Prisma.sql`
      SELECT
        COALESCE((
          SELECT SUM(GREATEST(c.amount_cop - COALESCE(tx.platform_fee_cop, 0), 0))
          FROM crowdfunding_contributions c
          JOIN payment_transactions tx ON tx.id = c.payment_transaction_id
          WHERE c.campaign_id = ${campaign.id}::uuid
            AND c.status = 'paid'
            AND tx.status = 'paid'
        ), 0) AS net_paid_cop,
        COALESCE((
          SELECT SUM(amount_cop)
          FROM crowdfunding_payout_requests
          WHERE campaign_id = ${campaign.id}::uuid AND status = 'paid'
        ), 0) AS disbursed_cop
    `)

    let verifiedMilestoneCapCop: number | null = null
    if (campaign.funding_policy === 'milestone') {
      const milestone = await db.$queryRaw<Array<{ verified_cap_cop: bigint }>>(Prisma.sql`
        SELECT COALESCE(SUM(target_amount_cop), 0) AS verified_cap_cop
        FROM crowdfunding_milestones
        WHERE campaign_id = ${campaign.id}::uuid
          AND status = 'verified'
          AND target_amount_cop IS NOT NULL
      `)
      verifiedMilestoneCapCop = Number(milestone[0]?.verified_cap_cop ?? 0)
    }

    const availableCop = computeDisbursableAmount({
      netPaidCop: Number(balances[0]?.net_paid_cop ?? 0),
      disbursedCop: Number(balances[0]?.disbursed_cop ?? 0),
      fundingPolicy: campaign.funding_policy,
      verifiedMilestoneCapCop,
    })
    if (!Number.isSafeInteger(availableCop) || availableCop <= 0) {
      const code = campaign.funding_policy === 'milestone'
        ? 'PAYOUT_MILESTONE_BALANCE_UNAVAILABLE'
        : 'PAYOUT_BALANCE_UNAVAILABLE'
      throw httpError('No hay saldo conciliado disponible para desembolsar.', code, 409)
    }

    const reference = providerReference()
    const rows = await db.$queryRaw<PayoutRow[]>(Prisma.sql`
      INSERT INTO crowdfunding_payout_requests (
        campaign_id, beneficiary_citizen_id, provider, provider_reference,
        idempotency_key, amount_cop, status, destination_kind,
        destination_fingerprint, destination_key_type, preview_confirmed_at,
        requested_by_citizen_id
      ) VALUES (
        ${campaign.id}::uuid, ${campaign.creator_citizen_id}::uuid,
        ${CROWDFUNDING_PAYOUT_PROVIDER}, ${reference}, ${input.idempotencyKey},
        ${availableCop}, 'requested', 'breb', ${input.destinationFingerprint},
        ${input.destinationKeyType}, NOW(), ${input.actorId}::uuid
      )
      RETURNING id, campaign_id, beneficiary_citizen_id, provider_payout_id,
                provider_reference, amount_cop, status, provider_status
    `)
    return { payout: rows[0], reused: false }
  })
}

export async function requestFlexibleCampaignPayout(input: {
  actorId: string
  campaignId: string
  destination: ConfirmedBrebDestination
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

  const normalizedKey = normalizeBrebKey(input.destination.key, input.destination.keyType)
  const preview = await resolveWompiBrebKey({ key: normalizedKey, keyType: input.destination.keyType })
  if (
    preview.holderName !== input.destination.confirmedHolderName.trim()
    || preview.financialEntity.code !== input.destination.confirmedFinancialEntityCode.trim()
    || preview.keyType !== input.destination.keyType
  ) {
    throw httpError(
      'La confirmación del beneficiario BRE-B ya no coincide con la resolución del proveedor.',
      'PAYOUT_BENEFICIARY_CONFIRMATION_MISMATCH',
      409,
    )
  }

  const key = payoutIdempotencyKey(input.requestedIdempotencyKey)
  const prepared = await prepareFlexiblePayoutLedger({
    actorId: input.actorId,
    campaignId: input.campaignId,
    idempotencyKey: key,
    destinationFingerprint: destinationFingerprint(normalizedKey, input.destination.keyType),
    destinationKeyType: input.destination.keyType,
  })
  if (prepared.reused) {
    return {
      id: prepared.payout.id,
      status: prepared.payout.status,
      amountCop: Number(prepared.payout.amount_cop),
      reused: true,
    }
  }

  let providerInstructionIssued = false
  try {
    const created = await createWompiBrebPayout({
      reference: prepared.payout.provider_reference,
      transactionReference: transactionReference(prepared.payout.id),
      idempotencyKey: key,
      amountInCents: centsFromCop(Number(prepared.payout.amount_cop)),
      destination: {
        key: normalizedKey,
        keyType: input.destination.keyType,
        name: input.destination.name,
        email: input.destination.email,
      },
    })
    providerInstructionIssued = true

    let providerPayoutId = created.payoutId
    if (!providerPayoutId) {
      providerPayoutId = (await findWompiPayoutByReference(prepared.payout.provider_reference))?.id ?? null
    }
    if (!providerPayoutId) {
      await prisma.$executeRaw(Prisma.sql`
        UPDATE crowdfunding_payout_requests
        SET status = 'reconciliation_required', provider_status = ${created.status},
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

    await prisma.$executeRaw(Prisma.sql`
      UPDATE crowdfunding_payout_requests
      SET provider_payout_id = ${providerPayoutId}, provider_status = ${created.status}, updated_at = NOW()
      WHERE id = ${prepared.payout.id}::uuid
    `)
    const synced = await reconcileCampaignPayout({ payoutRequestId: prepared.payout.id })
    await recordAuditEvent({
      actorId: input.actorId,
      action: 'finance.crowdfunding_payout_request',
      targetType: 'crowdfunding_payout_request',
      targetId: synced.id,
      result: synced.status,
      metadata: {
        campaignId: prepared.payout.campaign_id,
        amountCop: synced.amountCop,
        destinationKind: 'breb',
        fundingPolicy: 'policy_v2',
      },
    })
    return { ...synced, reused: false }
  } catch (error) {
    const retryable = error instanceof WompiPayoutApiError && error.retryable
    const reconciliationRequired = providerInstructionIssued || retryable
    const target = reconciliationRequired ? 'reconciliation_required' : 'failed'
    await prisma.$executeRaw(Prisma.sql`
      UPDATE crowdfunding_payout_requests
      SET status = ${target}, updated_at = NOW()
      WHERE id = ${prepared.payout.id}::uuid
    `)
    await recordAuditEvent({
      actorId: input.actorId,
      action: 'finance.crowdfunding_payout_request',
      targetType: 'crowdfunding_payout_request',
      targetId: prepared.payout.id,
      result: target,
      metadata: { campaignId: prepared.payout.campaign_id, destinationKind: 'breb' },
    })
    throw error
  }
}
