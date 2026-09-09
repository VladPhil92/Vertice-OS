import { createHmac, randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import {
  createCrowdfundingContributionCheckout,
  processMercadoPagoWebhook,
} from '../modules/billing/payment.service'
import {
  computeDisbursableAmount,
  evaluateFundingEligibility,
} from '../modules/billing/crowdfunding-payout-policy'
import { getCrowdfundingPayoutOperationsStatus } from '../modules/billing/payout-operations.service'

const describeGolden = process.env.GOLDEN_FINANCE_JOURNEYS === '1' ? describe : describe.skip

const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET ?? ''

type CitizenFixture = {
  id: string
  email: string
  reputationScore: number
}

type CampaignFixture = {
  id: string
  category: 'social' | 'education' | 'culture'
  fundingModel: 'donation' | 'reward'
  fundingPolicy: 'flexible' | 'all_or_nothing'
}

type SyntheticOrder = {
  id: string
  externalReference: string
  amountCop: number
  status: 'processed' | 'refunded'
}

const syntheticOrders = new Map<string, SyntheticOrder>()
let orderSequence = 0
let providerPostCount = 0
let originalFetch: typeof global.fetch

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function installSyntheticMercadoPago(): void {
  originalFetch = global.fetch
  global.fetch = jest.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const method = init?.method ?? 'GET'

    if (url === 'https://api.mercadopago.com/v1/orders' && method === 'POST') {
      providerPostCount += 1
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        external_reference?: string
        total_amount?: string
      }
      const id = `golden-order-${++orderSequence}`
      const amountCop = Number(body.total_amount)
      if (!body.external_reference || !Number.isFinite(amountCop)) {
        return jsonResponse({ error: 'invalid synthetic order' }, 400)
      }
      syntheticOrders.set(id, {
        id,
        externalReference: body.external_reference,
        amountCop,
        status: 'processed',
      })
      return jsonResponse({
        id,
        status: 'created',
        external_reference: body.external_reference,
        total_amount: body.total_amount,
        currency: 'COP',
        checkout_url: `https://checkout.example.invalid/${id}`,
      })
    }

    const orderMatch = url.match(/^https:\/\/api\.mercadopago\.com\/v1\/orders\/(golden-order-\d+)$/)
    if (orderMatch && method === 'GET') {
      const order = syntheticOrders.get(orderMatch[1])
      if (!order) return jsonResponse({ error: 'not found' }, 404)
      return jsonResponse({
        id: order.id,
        status: order.status,
        external_reference: order.externalReference,
        total_amount: order.amountCop,
        total_paid_amount: order.amountCop,
        currency: 'COP',
      })
    }

    return jsonResponse({ error: `unexpected synthetic provider request: ${method} ${url}` }, 500)
  }) as typeof global.fetch
}

function signedWebhook(input: {
  dataId: string
  eventId: string
  action: string
}) {
  const timestamp = String(Math.floor(Date.now() / 1000))
  const requestId = `golden-request-${randomUUID()}`
  const manifest = `id:${input.dataId.toLowerCase()};request-id:${requestId};ts:${timestamp};`
  const signature = createHmac('sha256', webhookSecret).update(manifest).digest('hex')
  return {
    xSignature: `ts=${timestamp},v1=${signature}`,
    xRequestId: requestId,
    dataId: input.dataId,
    body: {
      id: input.eventId,
      type: 'order',
      action: input.action,
      live_mode: false,
      data: { id: input.dataId },
    },
  }
}

async function createCitizen(label: string, reputationScore: number): Promise<CitizenFixture> {
  const id = randomUUID()
  const email = `golden-finance-${label}-${randomUUID()}@vertice.test`
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO citizens (
      id, did, cedula_hash, email, verification_level, reputation_score, is_active
    ) VALUES (
      ${id}::uuid,
      ${`did:vertice:golden-finance:${id}`},
      ${`golden-finance-cedula-${randomUUID()}`},
      ${email},
      2,
      ${reputationScore},
      TRUE
    )
  `)
  return { id, email, reputationScore }
}

async function createCampaign(
  creatorId: string,
  input: Omit<CampaignFixture, 'id'>,
): Promise<CampaignFixture> {
  const id = randomUUID()
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO crowdfunding_campaigns (
      id, creator_citizen_id, title, slug, summary, description, category,
      funding_model, funding_policy, status, compliance_status,
      goal_amount_cop, raised_amount_cop, currency, budget
    ) VALUES (
      ${id}::uuid,
      ${creatorId}::uuid,
      ${`Golden finance ${input.category} ${id.slice(0, 8)}`},
      ${`golden-finance-${id}`},
      'Golden financial integrity campaign',
      'Synthetic campaign used exclusively to certify internal financial invariants.',
      ${input.category},
      ${input.fundingModel},
      ${input.fundingPolicy},
      'active',
      'verified',
      500000,
      0,
      'COP',
      '[]'::jsonb
    )
  `)
  return { id, ...input }
}

async function paymentSnapshot(transactionId: string) {
  const rows = await prisma.$queryRaw<Array<{
    id: string
    amount_cop: bigint
    platform_fee_cop: bigint
    status: string
    metadata: Record<string, unknown>
    provider_transaction_id: string | null
  }>>(Prisma.sql`
    SELECT id, amount_cop, platform_fee_cop, status, metadata, provider_transaction_id
    FROM payment_transactions
    WHERE id = ${transactionId}::uuid
    LIMIT 1
  `)
  if (!rows[0]) throw new Error(`Missing payment transaction ${transactionId}`)
  return rows[0]
}

async function campaignRaised(campaignId: string): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ raised_amount_cop: bigint }>>(Prisma.sql`
    SELECT raised_amount_cop FROM crowdfunding_campaigns WHERE id = ${campaignId}::uuid
  `)
  return Number(rows[0]?.raised_amount_cop ?? 0)
}

async function reputationSnapshot(citizenIds: string[]) {
  const rows = await prisma.$queryRaw<Array<{
    id: string
    reputation_score: Prisma.Decimal
    event_count: bigint
  }>>(Prisma.sql`
    SELECT c.id,
           c.reputation_score,
           COUNT(re.id) AS event_count
    FROM citizens c
    LEFT JOIN reputation_events re ON re.citizen_id = c.id
    WHERE c.id IN (${Prisma.join(citizenIds.map((id) => Prisma.sql`${id}::uuid`))})
    GROUP BY c.id, c.reputation_score
    ORDER BY c.id
  `)
  return rows.map((row) => ({
    id: row.id,
    reputationScore: Number(row.reputation_score),
    eventCount: Number(row.event_count),
  }))
}

describeGolden('Golden Financial Integrity', () => {
  let creator: CitizenFixture
  let contributor: CitizenFixture
  let standard: CampaignFixture
  let social: CampaignFixture
  let reward: CampaignFixture
  let standardTransactionId = ''
  let socialTransactionId = ''
  let standardOrderId = ''
  let socialOrderId = ''

  beforeAll(async () => {
    if (!webhookSecret) throw new Error('MERCADOPAGO_WEBHOOK_SECRET is required for Golden Finance')
    installSyntheticMercadoPago()

    creator = await createCitizen('creator', 42)
    contributor = await createCitizen('contributor', 17)

    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO crowdfunding_payout_profiles (
        citizen_id, verification_status, payout_status, provider, provider_reference,
        requested_at, verified_at
      ) VALUES (
        ${creator.id}::uuid, 'verified', 'eligible', 'golden-fixture', 'golden-beneficiary', NOW(), NOW()
      )
    `)

    standard = await createCampaign(creator.id, {
      category: 'education',
      fundingModel: 'donation',
      fundingPolicy: 'flexible',
    })
    social = await createCampaign(creator.id, {
      category: 'social',
      fundingModel: 'donation',
      fundingPolicy: 'flexible',
    })
    reward = await createCampaign(creator.id, {
      category: 'culture',
      fundingModel: 'reward',
      fundingPolicy: 'all_or_nothing',
    })
  })

  afterAll(async () => {
    global.fetch = originalFetch
    await prisma.$disconnect()
  })

  test('GF-01 checkout snapshots canonical fees, excludes optional tip, and reuses idempotent checkout', async () => {
    const standardCheckout = await createCrowdfundingContributionCheckout({
      citizenId: contributor.id,
      campaignId: standard.id,
      amountCop: 100000,
      platformTipCop: 10000,
      isAnonymous: false,
      requestedIdempotencyKey: `gf-standard-${randomUUID()}`,
    })
    standardTransactionId = standardCheckout.transactionId
    standardOrderId = [...syntheticOrders.values()].find((order) => order.externalReference === `cf_${standardTransactionId}`)?.id ?? ''

    const socialKey = `gf-social-${randomUUID()}`
    const socialCheckout = await createCrowdfundingContributionCheckout({
      citizenId: contributor.id,
      campaignId: social.id,
      amountCop: 100000,
      platformTipCop: 10000,
      isAnonymous: true,
      requestedIdempotencyKey: socialKey,
    })
    socialTransactionId = socialCheckout.transactionId
    socialOrderId = [...syntheticOrders.values()].find((order) => order.externalReference === `cf_${socialTransactionId}`)?.id ?? ''

    const rewardCheckout = await createCrowdfundingContributionCheckout({
      citizenId: contributor.id,
      campaignId: reward.id,
      amountCop: 100000,
      platformTipCop: 0,
      isAnonymous: false,
      requestedIdempotencyKey: `gf-reward-${randomUUID()}`,
    })

    const [standardTx, socialTx, rewardTx] = await Promise.all([
      paymentSnapshot(standardTransactionId),
      paymentSnapshot(socialTransactionId),
      paymentSnapshot(rewardCheckout.transactionId),
    ])

    expect(Number(standardTx.amount_cop)).toBe(110000)
    expect(Number(standardTx.platform_fee_cop)).toBe(2500)
    expect(standardTx.metadata).toMatchObject({
      campaign_id: standard.id,
      platform_tip_cop: 10000,
      platform_fee_bps: 250,
      platform_fee_policy_version: '2026-09-v1',
      platform_fee_base_cop: 100000,
    })

    expect(Number(socialTx.amount_cop)).toBe(110000)
    expect(Number(socialTx.platform_fee_cop)).toBe(1000)
    expect(socialTx.metadata).toMatchObject({
      platform_fee_bps: 100,
      platform_fee_base_cop: 100000,
    })

    expect(Number(rewardTx.platform_fee_cop)).toBe(3500)
    expect(rewardTx.metadata).toMatchObject({
      platform_fee_bps: 350,
      platform_fee_base_cop: 100000,
    })

    const postsBeforeReplay = providerPostCount
    const replay = await createCrowdfundingContributionCheckout({
      citizenId: contributor.id,
      campaignId: social.id,
      amountCop: 100000,
      platformTipCop: 10000,
      isAnonymous: true,
      requestedIdempotencyKey: socialKey,
    })
    expect(replay.transactionId).toBe(socialTransactionId)
    expect(replay.reused).toBe(true)
    expect(providerPostCount).toBe(postsBeforeReplay)

    expect(standardOrderId).toMatch(/^golden-order-/)
    expect(socialOrderId).toMatch(/^golden-order-/)
  })

  test('GF-02 provider-verified settlement and reversal are idempotent and only principal changes campaign raised amount', async () => {
    const paidEvent = signedWebhook({
      dataId: standardOrderId,
      eventId: `golden-paid-${randomUUID()}`,
      action: 'order.processed',
    })
    const firstPaid = await processMercadoPagoWebhook(paidEvent)
    expect(firstPaid).toMatchObject({ duplicate: false, processed: true })
    expect((await paymentSnapshot(standardTransactionId)).status).toBe('paid')
    expect(await campaignRaised(standard.id)).toBe(100000)

    const duplicatePaid = await processMercadoPagoWebhook(paidEvent)
    expect(duplicatePaid).toMatchObject({ duplicate: true, processed: false })
    expect(await campaignRaised(standard.id)).toBe(100000)

    const order = syntheticOrders.get(standardOrderId)
    if (!order) throw new Error('Synthetic standard order missing')
    order.status = 'refunded'

    const refundEvent = signedWebhook({
      dataId: standardOrderId,
      eventId: `golden-refund-${randomUUID()}`,
      action: 'order.refunded',
    })
    const refunded = await processMercadoPagoWebhook(refundEvent)
    expect(refunded).toMatchObject({ duplicate: false, processed: true })
    expect((await paymentSnapshot(standardTransactionId)).status).toBe('refunded')
    expect(await campaignRaised(standard.id)).toBe(0)

    const duplicateRefund = await processMercadoPagoWebhook(refundEvent)
    expect(duplicateRefund).toMatchObject({ duplicate: true, processed: false })
    expect(await campaignRaised(standard.id)).toBe(0)
  })

  test('GF-03 payout availability uses settled principal net of fee, excludes tip, and subtracts prior paid disbursements', async () => {
    const paidEvent = signedWebhook({
      dataId: socialOrderId,
      eventId: `golden-social-paid-${randomUUID()}`,
      action: 'order.processed',
    })
    await processMercadoPagoWebhook(paidEvent)
    expect(await campaignRaised(social.id)).toBe(100000)

    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO crowdfunding_payout_requests (
        campaign_id, beneficiary_citizen_id, provider, provider_reference,
        idempotency_key, amount_cop, status, destination_kind,
        destination_fingerprint, destination_key_type, preview_confirmed_at,
        requested_by_citizen_id
      ) VALUES (
        ${social.id}::uuid,
        ${creator.id}::uuid,
        'wompi_payouts',
        ${`golden-ref-${randomUUID().replace(/-/g, '').slice(0, 20)}`},
        ${`golden-payout-${randomUUID().replace(/-/g, '').slice(0, 20)}`},
        20000,
        'paid',
        'breb',
        ${'a'.repeat(64)},
        'ALPHANUMERIC',
        NOW(),
        ${creator.id}::uuid
      )
    `)

    const balances = await prisma.$queryRaw<Array<{ net_paid_cop: bigint; disbursed_cop: bigint }>>(Prisma.sql`
      SELECT
        COALESCE((
          SELECT SUM(GREATEST(c.amount_cop - COALESCE(tx.platform_fee_cop, 0), 0))
          FROM crowdfunding_contributions c
          JOIN payment_transactions tx ON tx.id = c.payment_transaction_id
          WHERE c.campaign_id = ${social.id}::uuid
            AND c.status = 'paid'
            AND tx.status = 'paid'
        ), 0) AS net_paid_cop,
        COALESCE((
          SELECT SUM(amount_cop)
          FROM crowdfunding_payout_requests
          WHERE campaign_id = ${social.id}::uuid AND status = 'paid'
        ), 0) AS disbursed_cop
    `)

    const netPaidCop = Number(balances[0]?.net_paid_cop ?? 0)
    const disbursedCop = Number(balances[0]?.disbursed_cop ?? 0)
    expect(netPaidCop).toBe(99000)
    expect(disbursedCop).toBe(20000)
    expect(computeDisbursableAmount({
      netPaidCop,
      disbursedCop,
      fundingPolicy: 'flexible',
    })).toBe(79000)

    const rewardSnapshot = await prisma.$queryRaw<Array<{ raised_amount_cop: bigint; goal_amount_cop: bigint; status: string }>>(Prisma.sql`
      SELECT raised_amount_cop, goal_amount_cop, status
      FROM crowdfunding_campaigns WHERE id = ${reward.id}::uuid
    `)
    expect(evaluateFundingEligibility({
      status: rewardSnapshot[0].status,
      fundingPolicy: 'all_or_nothing',
      goalAmountCop: Number(rewardSnapshot[0].goal_amount_cop),
      raisedAmountCop: Number(rewardSnapshot[0].raised_amount_cop),
    })).toMatchObject({ eligible: false, code: 'CAMPAIGN_GOAL_NOT_REACHED' })
  })

  test('GF-04 money movements remain reputation-neutral and payout execution stays fail-closed without certified provider rails', async () => {
    const reputation = await reputationSnapshot([creator.id, contributor.id])
    const creatorRow = reputation.find((row) => row.id === creator.id)
    const contributorRow = reputation.find((row) => row.id === contributor.id)

    expect(creatorRow).toMatchObject({ reputationScore: creator.reputationScore, eventCount: 0 })
    expect(contributorRow).toMatchObject({ reputationScore: contributor.reputationScore, eventCount: 0 })

    const payoutStatus = await getCrowdfundingPayoutOperationsStatus()
    expect(payoutStatus.operationallyCertified).toBe(false)
    expect(payoutStatus.executionEnabled).toBe(false)
    expect(payoutStatus.readiness).toBe('blocked')
  })
})
