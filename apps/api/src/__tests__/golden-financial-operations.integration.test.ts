import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import {
  assertFinancialCapabilityEnabled,
  getFinanceCommandCenter,
  getFinancialRuntimeControls,
  setFinancialEmergencyStop,
} from '../modules/billing/finance-control-plane.service'

const describeGolden = process.env.GOLDEN_FINANCE_OPERATIONS === '1' ? describe : describe.skip

function errorCode(error: unknown): string | undefined {
  return error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code)
    : undefined
}

describeGolden('Golden Financial Operations Command Center', () => {
  const actorId = randomUUID()
  let initialReputation = 0

  beforeAll(async () => {
    initialReputation = 31.25
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO citizens (
        id, did, cedula_hash, email, verification_level, reputation_score, is_active
      ) VALUES (
        ${actorId}::uuid,
        ${`did:vertice:golden-finops:${actorId}`},
        ${`golden-finops-cedula-${randomUUID()}`},
        ${`golden-finops-${randomUUID()}@vertice.test`},
        2,
        ${initialReputation},
        TRUE
      )
    `)
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  test('FO-01 seeded controls allow all rails and missing control state fails closed', async () => {
    const controls = await getFinancialRuntimeControls()
    expect(controls).toHaveLength(3)
    expect(controls.every((control) => control.emergency_stop === false)).toBe(true)

    await expect(assertFinancialCapabilityEnabled('pro_checkout')).resolves.toBeUndefined()
    await expect(assertFinancialCapabilityEnabled('crowdfunding_collection')).resolves.toBeUndefined()
    await expect(assertFinancialCapabilityEnabled('crowdfunding_payouts')).resolves.toBeUndefined()

    await prisma.$executeRaw(Prisma.sql`
      DELETE FROM finance_runtime_controls WHERE capability = 'pro_checkout'
    `)
    await expect(assertFinancialCapabilityEnabled('pro_checkout')).rejects.toSatisfy((error: unknown) => (
      errorCode(error) === 'FINANCE_CONTROL_STATE_MISSING'
    ))
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO finance_runtime_controls (capability, emergency_stop)
      VALUES ('pro_checkout', FALSE)
    `)
  })

  test('FO-02 emergency stop is durable, audited and blocks only the selected rail', async () => {
    await setFinancialEmergencyStop({
      actorId,
      capability: 'crowdfunding_collection',
      emergencyStop: true,
      reason: 'Golden incident containment test',
    })

    await expect(assertFinancialCapabilityEnabled('crowdfunding_collection')).rejects.toSatisfy((error: unknown) => (
      errorCode(error) === 'CROWDFUNDING_COLLECTION_EMERGENCY_STOP'
    ))
    await expect(assertFinancialCapabilityEnabled('pro_checkout')).resolves.toBeUndefined()
    await expect(assertFinancialCapabilityEnabled('crowdfunding_payouts')).resolves.toBeUndefined()

    const blocked = await getFinanceCommandCenter()
    expect(blocked.state).toBe('blocked')
    expect(blocked.controls.find((control) => control.capability === 'crowdfunding_collection')).toMatchObject({
      emergency_stop: true,
      reason: 'Golden incident containment test',
    })

    await setFinancialEmergencyStop({
      actorId,
      capability: 'crowdfunding_collection',
      emergencyStop: false,
    })
    await expect(assertFinancialCapabilityEnabled('crowdfunding_collection')).resolves.toBeUndefined()

    const audits = await prisma.$queryRaw<Array<{ action: string; result: string }>>(Prisma.sql`
      SELECT action, result
      FROM admin_audit_log
      WHERE actor_id = ${actorId}::uuid
        AND target_type = 'finance_runtime_control'
        AND target_id = 'crowdfunding_collection'
      ORDER BY created_at ASC
    `)
    expect(audits).toEqual([
      { action: 'finance.emergency_stop.enable', result: 'blocked' },
      { action: 'finance.emergency_stop.disable', result: 'restored' },
    ])
  })

  test('FO-03 command center degrades on stale money, webhook failure and critical risk', async () => {
    const transactionId = randomUUID()
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO payment_transactions (
        id, citizen_id, kind, status, provider, provider_transaction_id,
        amount_cop, platform_fee_cop, currency, metadata, created_at, updated_at
      ) VALUES (
        ${transactionId}::uuid, ${actorId}::uuid, 'subscription', 'pending', 'mercadopago',
        ${`golden-finops-payment-${randomUUID()}`}, 15000, 0, 'COP',
        '{"provider_state":"unknown"}'::jsonb,
        NOW() - INTERVAL '45 minutes', NOW() - INTERVAL '45 minutes'
      )
    `)

    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO payment_webhook_events (
        provider, provider_event_id, resource_type, resource_id,
        signature_timestamp, status, payload, received_at, processed_at
      ) VALUES (
        'mercadopago', ${`golden-finops-event-${randomUUID()}`}, 'payment', 'synthetic',
        '0', 'failed', '{}'::jsonb, NOW() - INTERVAL '10 minutes', NOW() - INTERVAL '9 minutes'
      )
    `)

    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO payment_risk_flags (
        payment_transaction_id, citizen_id, rule_code, severity, status, details
      ) VALUES (
        ${transactionId}::uuid, ${actorId}::uuid,
        'GOLDEN_CRITICAL_RISK', 'critical', 'open', '{"synthetic":true}'::jsonb
      )
    `)

    const center = await getFinanceCommandCenter()
    expect(center.state).toBe('degraded')
    expect(center.metrics.stalePendingPayments).toBeGreaterThanOrEqual(1)
    expect(center.metrics.providerStateUnknown).toBeGreaterThanOrEqual(1)
    expect(center.metrics.failedWebhooks24h).toBeGreaterThanOrEqual(1)
    expect(center.metrics.criticalRiskFlags).toBeGreaterThanOrEqual(1)
    expect(center.slos.stalePaymentsClear).toBe(false)
    expect(center.slos.webhookFailures24hClear).toBe(false)
    expect(center.slos.criticalRiskClear).toBe(false)
  })

  test('FO-04 financial operations never mutate civic reputation', async () => {
    const rows = await prisma.$queryRaw<Array<{
      reputation_score: Prisma.Decimal
      event_count: bigint
    }>>(Prisma.sql`
      SELECT c.reputation_score, COUNT(re.id) AS event_count
      FROM citizens c
      LEFT JOIN reputation_events re ON re.citizen_id = c.id
      WHERE c.id = ${actorId}::uuid
      GROUP BY c.id, c.reputation_score
    `)
    expect(Number(rows[0]?.reputation_score)).toBe(initialReputation)
    expect(Number(rows[0]?.event_count ?? 0)).toBe(0)
  })
})
