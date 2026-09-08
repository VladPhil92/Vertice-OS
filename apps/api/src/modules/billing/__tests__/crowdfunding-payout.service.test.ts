jest.mock('../../../lib/prisma', () => ({
  prisma: {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
    $transaction: jest.fn(),
  },
}))

jest.mock('../../../lib/audit', () => ({ recordAuditEvent: jest.fn() }))

jest.mock('../../../config', () => ({
  config: {
    CROWDFUNDING_PAYOUTS_ENABLED: true,
    PAYOUT_DESTINATION_PEPPER: 'destination-pepper-with-at-least-thirty-two-characters',
  },
}))

jest.mock('../wompi-payouts.provider', () => {
  const actual = jest.requireActual('../wompi-payouts.provider')
  return {
    WompiPayoutApiError: actual.WompiPayoutApiError,
    createWompiBrebPayout: jest.fn(),
    findWompiPayoutByReference: jest.fn(),
    getWompiPayout: jest.fn(),
    getWompiPayoutConfigurationState: jest.fn(),
    getWompiPayoutTransactions: jest.fn(),
    resolveWompiBrebKey: jest.fn(),
    verifyWompiPayoutWebhook: jest.fn(),
  }
})

import { config } from '../../../config'
import { prisma } from '../../../lib/prisma'
import { recordAuditEvent } from '../../../lib/audit'
import {
  WompiPayoutApiError,
  createWompiBrebPayout,
  findWompiPayoutByReference,
  getWompiPayout,
  getWompiPayoutConfigurationState,
  getWompiPayoutTransactions,
  resolveWompiBrebKey,
} from '../wompi-payouts.provider'
import {
  classifyWompiPayoutState,
  listCampaignPayouts,
  previewCampaignPayoutDestination,
  processWompiPayoutWebhook,
  reconcileCampaignPayout,
  requestCampaignPayout,
} from '../crowdfunding-payout.service'
import { verifyWompiPayoutWebhook } from '../wompi-payouts.provider'

const mockQueryRaw = prisma.$queryRaw as jest.Mock
const mockExecuteRaw = prisma.$executeRaw as jest.Mock
const mockTransaction = prisma.$transaction as jest.Mock
const mockGetWompiPayoutConfigurationState = getWompiPayoutConfigurationState as jest.Mock
const mockResolveWompiBrebKey = resolveWompiBrebKey as jest.Mock
const mockCreateWompiBrebPayout = createWompiBrebPayout as jest.Mock
const mockFindWompiPayoutByReference = findWompiPayoutByReference as jest.Mock
const mockGetWompiPayout = getWompiPayout as jest.Mock
const mockGetWompiPayoutTransactions = getWompiPayoutTransactions as jest.Mock
const mockVerifyWompiPayoutWebhook = verifyWompiPayoutWebhook as jest.Mock
const mockRecordAuditEvent = recordAuditEvent as jest.Mock

const CAMPAIGN_ID = '550e8400-e29b-41d4-a716-446655440010'
const ACTOR_ID = '550e8400-e29b-41d4-a716-446655440011'
const CREATOR_ID = '550e8400-e29b-41d4-a716-446655440012'
const PAYOUT_ID = '550e8400-e29b-41d4-a716-446655440013'

const FUNDED_CAMPAIGN = {
  id: CAMPAIGN_ID,
  creator_citizen_id: CREATOR_ID,
  status: 'funded',
  compliance_status: 'verified',
  goal_amount_cop: 1_000_000n,
  raised_amount_cop: 1_000_000n,
  ends_at: null,
}

const VERIFIED_PROFILE = { verification_status: 'verified', payout_status: 'eligible' }

const DESTINATION = {
  key: 'juana@example.com',
  keyType: 'MAIL' as const,
  name: 'Juana Pérez',
  email: 'juana@example.com',
  confirmedHolderName: 'Juana Pérez',
  confirmedFinancialEntityCode: '1234',
}

const MATCHING_PREVIEW = {
  holderName: 'Juana Pérez',
  financialEntity: { name: 'Banco Ejemplo', code: '1234' },
  keyType: 'MAIL',
  keyValue: 'juana@example.com',
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetWompiPayoutConfigurationState.mockReturnValue('ready')
  ;(config as unknown as { CROWDFUNDING_PAYOUTS_ENABLED: boolean }).CROWDFUNDING_PAYOUTS_ENABLED = true
  mockExecuteRaw.mockResolvedValue(undefined)
  mockTransaction.mockImplementation(async (callback: (tx: typeof prisma) => unknown) =>
    callback({ $queryRaw: mockQueryRaw, $executeRaw: mockExecuteRaw } as unknown as typeof prisma),
  )
  mockResolveWompiBrebKey.mockResolvedValue(MATCHING_PREVIEW)
})

describe('classifyWompiPayoutState', () => {
  it('does not treat a prepared batch as money delivered', () => {
    expect(classifyWompiPayoutState('PENDING_APPROVAL', [
      { id: 'tx1', status: 'PENDING' },
    ])).toBe('pending_approval')
  })

  it('marks a payout paid only from an approved transaction', () => {
    expect(classifyWompiPayoutState('TOTAL_PAYMENT', [
      { id: 'tx1', status: 'APPROVED' },
    ])).toBe('paid')
  })

  it('requires reconciliation when the batch claims payment without a conclusive transaction', () => {
    expect(classifyWompiPayoutState('TOTAL_PAYMENT', [
      { id: 'tx1', status: 'PENDING' },
    ])).toBe('reconciliation_required')
  })

  it('maps failed, rejected and cancelled provider outcomes conservatively', () => {
    expect(classifyWompiPayoutState('PENDING', [{ id: 'tx1', status: 'FAILED' }])).toBe('failed')
    expect(classifyWompiPayoutState('REJECTED', [])).toBe('failed')
    expect(classifyWompiPayoutState('NOT_APPROVED', [])).toBe('not_approved')
    expect(classifyWompiPayoutState('CANCELLED', [])).toBe('cancelled')
  })
})

describe('previewCampaignPayoutDestination', () => {
  it('fails closed when the provider is not ready', async () => {
    mockGetWompiPayoutConfigurationState.mockReturnValue('disabled')

    await expect(previewCampaignPayoutDestination({ key: 'juana@example.com', keyType: 'MAIL' }))
      .rejects.toMatchObject({ statusCode: 503, code: 'PAYOUT_PROVIDER_UNAVAILABLE' })
  })

  it('returns the masked beneficiary preview', async () => {
    const result = await previewCampaignPayoutDestination({ key: 'juana@example.com', keyType: 'MAIL' })

    expect(result).toEqual(MATCHING_PREVIEW)
  })
})

describe('requestCampaignPayout', () => {
  const baseInput = { actorId: ACTOR_ID, campaignId: CAMPAIGN_ID, destination: DESTINATION }

  it('fails closed when the provider is not ready', async () => {
    mockGetWompiPayoutConfigurationState.mockReturnValue('disabled')

    await expect(requestCampaignPayout(baseInput)).rejects.toMatchObject({
      statusCode: 503, code: 'PAYOUT_PROVIDER_UNAVAILABLE',
    })
    expect(mockQueryRaw).not.toHaveBeenCalled()
  })

  it('fails closed when payout execution is disabled', async () => {
    ;(config as unknown as { CROWDFUNDING_PAYOUTS_ENABLED: boolean }).CROWDFUNDING_PAYOUTS_ENABLED = false

    await expect(requestCampaignPayout(baseInput)).rejects.toMatchObject({
      statusCode: 503, code: 'CROWDFUNDING_PAYOUTS_DISABLED',
    })
  })

  it('rejects when payout operations are not certified', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ status: 'pending' }])

    await expect(requestCampaignPayout(baseInput)).rejects.toMatchObject({
      statusCode: 503, code: 'PAYOUT_OPERATIONS_NOT_CERTIFIED',
    })
  })

  it('rejects when the provider re-resolution no longer matches the confirmed beneficiary', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ status: 'verified' }])
    mockResolveWompiBrebKey.mockResolvedValue({ ...MATCHING_PREVIEW, holderName: 'Otra Persona' })

    await expect(requestCampaignPayout(baseInput)).rejects.toMatchObject({
      statusCode: 409, code: 'PAYOUT_BENEFICIARY_CONFIRMATION_MISMATCH',
    })
  })

  it('rejects a malformed idempotency key', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ status: 'verified' }])

    await expect(requestCampaignPayout({
      ...baseInput, requestedIdempotencyKey: 'bad key!',
    })).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_PAYOUT_IDEMPOTENCY_KEY' })
  })

  it('reuses an existing payout request for the same idempotency key', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ status: 'verified' }])
      .mockResolvedValueOnce([{
        id: PAYOUT_ID, campaign_id: CAMPAIGN_ID, beneficiary_citizen_id: CREATOR_ID,
        provider_payout_id: 'wpayout-1', provider_reference: 'vertice-ref-1',
        amount_cop: 500_000n, status: 'paid', provider_status: 'TOTAL_PAYMENT',
      }])

    const result = await requestCampaignPayout({ ...baseInput, requestedIdempotencyKey: 'reused-key-123' })

    expect(result).toEqual({ id: PAYOUT_ID, status: 'paid', amountCop: 500_000, reused: true })
    expect(mockCreateWompiBrebPayout).not.toHaveBeenCalled()
  })

  it('rejects when the campaign does not exist', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ status: 'verified' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    await expect(requestCampaignPayout(baseInput)).rejects.toMatchObject({
      statusCode: 404, code: 'CAMPAIGN_NOT_FOUND',
    })
  })

  it('rejects when campaign compliance is not verified', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ status: 'verified' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...FUNDED_CAMPAIGN, status: 'draft', compliance_status: 'pending' }])

    await expect(requestCampaignPayout(baseInput)).rejects.toMatchObject({
      statusCode: 409, code: 'CAMPAIGN_COMPLIANCE_REQUIRED',
    })
  })

  it('rejects an active campaign that is still fundraising', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ status: 'verified' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        ...FUNDED_CAMPAIGN, status: 'active', raised_amount_cop: 100_000n, goal_amount_cop: 1_000_000n, ends_at: null,
      }])

    await expect(requestCampaignPayout(baseInput)).rejects.toMatchObject({
      statusCode: 409, code: 'CAMPAIGN_STILL_FUNDRAISING',
    })
  })

  it('rejects a campaign that is neither active nor funded', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ status: 'verified' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...FUNDED_CAMPAIGN, status: 'draft' }])

    await expect(requestCampaignPayout(baseInput)).rejects.toMatchObject({
      statusCode: 409, code: 'CAMPAIGN_NOT_PAYOUT_READY',
    })
  })

  it('rejects when contributions remain pending reconciliation', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ status: 'verified' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([FUNDED_CAMPAIGN])
      .mockResolvedValueOnce([{ count: 1n }])

    await expect(requestCampaignPayout(baseInput)).rejects.toMatchObject({
      statusCode: 409, code: 'CAMPAIGN_PENDING_CONTRIBUTIONS',
    })
  })

  it('rejects when the beneficiary payout profile is not ready', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ status: 'verified' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([FUNDED_CAMPAIGN])
      .mockResolvedValueOnce([{ count: 0n }])
      .mockResolvedValueOnce([{ verification_status: 'pending', payout_status: 'disabled' }])

    await expect(requestCampaignPayout(baseInput)).rejects.toMatchObject({
      statusCode: 409, code: 'PAYOUT_PROFILE_NOT_READY',
    })
  })

  it('rejects when an open financial risk flag exists', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ status: 'verified' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([FUNDED_CAMPAIGN])
      .mockResolvedValueOnce([{ count: 0n }])
      .mockResolvedValueOnce([VERIFIED_PROFILE])
      .mockResolvedValueOnce([{ count: 1n }])

    await expect(requestCampaignPayout(baseInput)).rejects.toMatchObject({
      statusCode: 409, code: 'PAYOUT_RISK_REVIEW_REQUIRED',
    })
  })

  it('rejects when there is no reconciled balance available to disburse', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ status: 'verified' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([FUNDED_CAMPAIGN])
      .mockResolvedValueOnce([{ count: 0n }])
      .mockResolvedValueOnce([VERIFIED_PROFILE])
      .mockResolvedValueOnce([{ count: 0n }])
      .mockResolvedValueOnce([{ paid_cop: 500_000n, disbursed_cop: 500_000n }])

    await expect(requestCampaignPayout(baseInput)).rejects.toMatchObject({
      statusCode: 409, code: 'PAYOUT_BALANCE_UNAVAILABLE',
    })
  })

  it('auto-transitions an active fully-funded campaign before disbursing', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ status: 'verified' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...FUNDED_CAMPAIGN, status: 'active' }])
      .mockResolvedValueOnce([{ count: 0n }])
      .mockResolvedValueOnce([VERIFIED_PROFILE])
      .mockResolvedValueOnce([{ count: 0n }])
      .mockResolvedValueOnce([{ paid_cop: 500_000n, disbursed_cop: 0n }])
      .mockResolvedValueOnce([{
        id: PAYOUT_ID, campaign_id: CAMPAIGN_ID, beneficiary_citizen_id: CREATOR_ID,
        provider_payout_id: null, provider_reference: 'vertice-ref-1',
        amount_cop: 500_000n, status: 'requested', provider_status: null,
      }])
    mockCreateWompiBrebPayout.mockResolvedValue({ payoutId: null, status: 'PENDING', traceId: 'trace-1' })
    mockFindWompiPayoutByReference.mockResolvedValue(null)

    const result = await requestCampaignPayout(baseInput)

    expect(result).toEqual({ id: PAYOUT_ID, status: 'reconciliation_required', amountCop: 500_000, reused: false })
    expect(mockExecuteRaw).toHaveBeenCalledWith(expect.objectContaining({
      strings: expect.arrayContaining([expect.stringContaining("SET status = 'funded'")]),
    }))
  })

  it('marks the payout for reconciliation when the provider never exposes a payout id', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ status: 'verified' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([FUNDED_CAMPAIGN])
      .mockResolvedValueOnce([{ count: 0n }])
      .mockResolvedValueOnce([VERIFIED_PROFILE])
      .mockResolvedValueOnce([{ count: 0n }])
      .mockResolvedValueOnce([{ paid_cop: 500_000n, disbursed_cop: 0n }])
      .mockResolvedValueOnce([{
        id: PAYOUT_ID, campaign_id: CAMPAIGN_ID, beneficiary_citizen_id: CREATOR_ID,
        provider_payout_id: null, provider_reference: 'vertice-ref-1',
        amount_cop: 500_000n, status: 'requested', provider_status: null,
      }])
    mockCreateWompiBrebPayout.mockResolvedValue({ payoutId: null, status: 'PENDING', traceId: 'trace-1' })
    mockFindWompiPayoutByReference.mockResolvedValue(null)

    const result = await requestCampaignPayout(baseInput)

    expect(result).toEqual({ id: PAYOUT_ID, status: 'reconciliation_required', amountCop: 500_000, reused: false })
    expect(mockRecordAuditEvent).not.toHaveBeenCalled()
  })

  it('creates the payout, reconciles it and audits the outcome on success', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ status: 'verified' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([FUNDED_CAMPAIGN])
      .mockResolvedValueOnce([{ count: 0n }])
      .mockResolvedValueOnce([VERIFIED_PROFILE])
      .mockResolvedValueOnce([{ count: 0n }])
      .mockResolvedValueOnce([{ paid_cop: 500_000n, disbursed_cop: 0n }])
      .mockResolvedValueOnce([{
        id: PAYOUT_ID, campaign_id: CAMPAIGN_ID, beneficiary_citizen_id: CREATOR_ID,
        provider_payout_id: null, provider_reference: 'vertice-ref-1',
        amount_cop: 500_000n, status: 'requested', provider_status: null,
      }])
      .mockResolvedValueOnce([{
        id: PAYOUT_ID, campaign_id: CAMPAIGN_ID, beneficiary_citizen_id: CREATOR_ID,
        provider_payout_id: 'wpayout-1', provider_reference: 'vertice-ref-1',
        amount_cop: 500_000n, status: 'requested', provider_status: null,
      }])
      .mockResolvedValueOnce([{
        id: PAYOUT_ID, campaign_id: CAMPAIGN_ID, beneficiary_citizen_id: CREATOR_ID,
        provider_payout_id: 'wpayout-1', provider_reference: 'vertice-ref-1',
        amount_cop: 500_000n, status: 'paid', provider_status: 'TOTAL_PAYMENT',
      }])
    mockCreateWompiBrebPayout.mockResolvedValue({ payoutId: 'wpayout-1', status: 'TOTAL_PAYMENT', traceId: null })
    mockGetWompiPayout.mockResolvedValue({ id: 'wpayout-1', reference: 'vertice-ref-1', status: 'TOTAL_PAYMENT', amountInCents: 50_000_000 })
    mockGetWompiPayoutTransactions.mockResolvedValue([{ id: 'tx-1', status: 'APPROVED', amountInCents: 50_000_000 }])

    const result = await requestCampaignPayout(baseInput)

    expect(result).toEqual({ id: PAYOUT_ID, status: 'paid', amountCop: 500_000, reused: false })
    expect(mockRecordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: 'finance.crowdfunding_payout_request', result: 'paid',
    }))
  })

  it('marks the payout for reconciliation and audits it on a retryable provider error', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ status: 'verified' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([FUNDED_CAMPAIGN])
      .mockResolvedValueOnce([{ count: 0n }])
      .mockResolvedValueOnce([VERIFIED_PROFILE])
      .mockResolvedValueOnce([{ count: 0n }])
      .mockResolvedValueOnce([{ paid_cop: 500_000n, disbursed_cop: 0n }])
      .mockResolvedValueOnce([{
        id: PAYOUT_ID, campaign_id: CAMPAIGN_ID, beneficiary_citizen_id: CREATOR_ID,
        provider_payout_id: null, provider_reference: 'vertice-ref-1',
        amount_cop: 500_000n, status: 'requested', provider_status: null,
      }])
    mockCreateWompiBrebPayout.mockRejectedValue(new WompiPayoutApiError(true))

    await expect(requestCampaignPayout(baseInput)).rejects.toBeInstanceOf(WompiPayoutApiError)
    expect(mockRecordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ result: 'reconciliation_required' }))
  })

  it('fails the payout and audits it on a definitive provider error', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ status: 'verified' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([FUNDED_CAMPAIGN])
      .mockResolvedValueOnce([{ count: 0n }])
      .mockResolvedValueOnce([VERIFIED_PROFILE])
      .mockResolvedValueOnce([{ count: 0n }])
      .mockResolvedValueOnce([{ paid_cop: 500_000n, disbursed_cop: 0n }])
      .mockResolvedValueOnce([{
        id: PAYOUT_ID, campaign_id: CAMPAIGN_ID, beneficiary_citizen_id: CREATOR_ID,
        provider_payout_id: null, provider_reference: 'vertice-ref-1',
        amount_cop: 500_000n, status: 'requested', provider_status: null,
      }])
    const providerError = new Error('unexpected provider failure')
    mockCreateWompiBrebPayout.mockRejectedValue(providerError)

    await expect(requestCampaignPayout(baseInput)).rejects.toBe(providerError)
    expect(mockRecordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ result: 'failed' }))
  })
})

describe('reconcileCampaignPayout', () => {
  it('fails when the payout request does not exist', async () => {
    mockQueryRaw.mockResolvedValueOnce([])

    await expect(reconcileCampaignPayout({ payoutRequestId: PAYOUT_ID })).rejects.toMatchObject({
      statusCode: 404, code: 'PAYOUT_REQUEST_NOT_FOUND',
    })
  })

  it('fails when the provider still exposes no conciliable payout', async () => {
    mockQueryRaw.mockResolvedValueOnce([{
      id: PAYOUT_ID, campaign_id: CAMPAIGN_ID, beneficiary_citizen_id: CREATOR_ID,
      provider_payout_id: null, provider_reference: 'vertice-ref-1',
      amount_cop: 500_000n, status: 'requested', provider_status: null,
    }])
    mockFindWompiPayoutByReference.mockResolvedValue(null)

    await expect(reconcileCampaignPayout({ payoutRequestId: PAYOUT_ID })).rejects.toMatchObject({
      statusCode: 503, code: 'PAYOUT_RECONCILIATION_PENDING',
    })
  })

  it('reconciles a payout with a known provider id and audits when an actor triggered it', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{
        id: PAYOUT_ID, campaign_id: CAMPAIGN_ID, beneficiary_citizen_id: CREATOR_ID,
        provider_payout_id: 'wpayout-1', provider_reference: 'vertice-ref-1',
        amount_cop: 500_000n, status: 'processing', provider_status: 'PENDING',
      }])
      .mockResolvedValueOnce([{
        id: PAYOUT_ID, campaign_id: CAMPAIGN_ID, beneficiary_citizen_id: CREATOR_ID,
        provider_payout_id: 'wpayout-1', provider_reference: 'vertice-ref-1',
        amount_cop: 500_000n, status: 'processing', provider_status: 'PENDING',
      }])
      .mockResolvedValueOnce([{
        id: PAYOUT_ID, campaign_id: CAMPAIGN_ID, beneficiary_citizen_id: CREATOR_ID,
        provider_payout_id: 'wpayout-1', provider_reference: 'vertice-ref-1',
        amount_cop: 500_000n, status: 'paid', provider_status: 'TOTAL_PAYMENT',
      }])
    mockGetWompiPayout.mockResolvedValue({ id: 'wpayout-1', reference: 'vertice-ref-1', status: 'TOTAL_PAYMENT', amountInCents: 50_000_000 })
    mockGetWompiPayoutTransactions.mockResolvedValue([{ id: 'tx-1', status: 'APPROVED', amountInCents: 50_000_000 }])

    const result = await reconcileCampaignPayout({ payoutRequestId: PAYOUT_ID, actorId: ACTOR_ID })

    expect(result).toEqual({ id: PAYOUT_ID, status: 'paid', amountCop: 500_000 })
    expect(mockRecordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: 'finance.crowdfunding_payout_reconcile', result: 'paid',
    }))
  })

  it('does not audit a system-triggered reconciliation without an actor', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{
        id: PAYOUT_ID, campaign_id: CAMPAIGN_ID, beneficiary_citizen_id: CREATOR_ID,
        provider_payout_id: 'wpayout-1', provider_reference: 'vertice-ref-1',
        amount_cop: 500_000n, status: 'processing', provider_status: 'PENDING',
      }])
      .mockResolvedValueOnce([{
        id: PAYOUT_ID, campaign_id: CAMPAIGN_ID, beneficiary_citizen_id: CREATOR_ID,
        provider_payout_id: 'wpayout-1', provider_reference: 'vertice-ref-1',
        amount_cop: 500_000n, status: 'processing', provider_status: 'PENDING',
      }])
      .mockResolvedValueOnce([{
        id: PAYOUT_ID, campaign_id: CAMPAIGN_ID, beneficiary_citizen_id: CREATOR_ID,
        provider_payout_id: 'wpayout-1', provider_reference: 'vertice-ref-1',
        amount_cop: 500_000n, status: 'pending_approval', provider_status: 'PENDING_APPROVAL',
      }])
    mockGetWompiPayout.mockResolvedValue({ id: 'wpayout-1', reference: 'vertice-ref-1', status: 'PENDING_APPROVAL' })
    mockGetWompiPayoutTransactions.mockResolvedValue([])

    const result = await reconcileCampaignPayout({ payoutRequestId: PAYOUT_ID })

    expect(result.status).toBe('pending_approval')
    expect(mockRecordAuditEvent).not.toHaveBeenCalled()
  })

  it('rejects when the provider reference no longer matches the local ledger', async () => {
    mockQueryRaw.mockResolvedValueOnce([{
      id: PAYOUT_ID, campaign_id: CAMPAIGN_ID, beneficiary_citizen_id: CREATOR_ID,
      provider_payout_id: 'wpayout-1', provider_reference: 'vertice-ref-1',
      amount_cop: 500_000n, status: 'processing', provider_status: 'PENDING',
    }])
    mockGetWompiPayout.mockResolvedValue({ id: 'wpayout-1', reference: 'a-different-reference', status: 'PENDING' })
    mockGetWompiPayoutTransactions.mockResolvedValue([])

    await expect(reconcileCampaignPayout({ payoutRequestId: PAYOUT_ID })).rejects.toMatchObject({
      statusCode: 409, code: 'PAYOUT_LEDGER_MISMATCH',
    })
  })
})

describe('listCampaignPayouts', () => {
  it('serializes payout rows with bigint and date fields', async () => {
    const createdAt = new Date('2026-09-01T00:00:00.000Z')
    mockQueryRaw.mockResolvedValueOnce([{
      id: PAYOUT_ID, campaign_id: CAMPAIGN_ID, beneficiary_citizen_id: CREATOR_ID,
      amount_cop: 500_000n, status: 'paid', provider_status: 'TOTAL_PAYMENT',
      provider_reference: 'vertice-ref-1', destination_key_type: 'MAIL',
      created_at: createdAt, updated_at: createdAt, completed_at: null,
    }])

    const result = await listCampaignPayouts()

    expect(result).toEqual([{
      id: PAYOUT_ID, campaign_id: CAMPAIGN_ID, beneficiary_citizen_id: CREATOR_ID,
      amount_cop: 500_000, status: 'paid', provider_status: 'TOTAL_PAYMENT',
      provider_reference: 'vertice-ref-1', destination_key_type: 'MAIL',
      created_at: createdAt.toISOString(), updated_at: createdAt.toISOString(), completed_at: null,
    }])
  })
})

describe('processWompiPayoutWebhook', () => {
  it('short-circuits duplicate webhook deliveries', async () => {
    mockVerifyWompiPayoutWebhook.mockReturnValue({
      event: 'payout.updated', data: { payout: { id: 'wpayout-1' } }, timestamp: '1', checksum: 'a'.repeat(64), eventKey: 'evt-key-1',
    })
    mockQueryRaw.mockResolvedValueOnce([])

    const result = await processWompiPayoutWebhook({ body: {} })

    expect(result).toEqual({ duplicate: true, processed: false })
    expect(mockExecuteRaw).not.toHaveBeenCalled()
  })

  it('ignores events without a resolvable provider payout id', async () => {
    mockVerifyWompiPayoutWebhook.mockReturnValue({
      event: 'payout.created', data: { payout: { id: 'wpayout-1' } }, timestamp: '1', checksum: 'a'.repeat(64), eventKey: 'evt-key-2',
    })
    mockQueryRaw.mockResolvedValueOnce([{ id: 'webhook-evt-1' }])

    const result = await processWompiPayoutWebhook({ body: {} })

    expect(result).toEqual({ duplicate: false, processed: false, ignored: true })
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1)
  })

  it('ignores events with no matching local payout request', async () => {
    mockVerifyWompiPayoutWebhook.mockReturnValue({
      event: 'payout.updated', data: { payout: { id: 'wpayout-orphan' } }, timestamp: '1', checksum: 'a'.repeat(64), eventKey: 'evt-key-3',
    })
    mockQueryRaw
      .mockResolvedValueOnce([{ id: 'webhook-evt-2' }])
      .mockResolvedValueOnce([])

    const result = await processWompiPayoutWebhook({ body: {} })

    expect(result).toEqual({ duplicate: false, processed: false, ignored: true })
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1)
  })

  it('reconciles the matching local payout and marks the webhook processed', async () => {
    mockVerifyWompiPayoutWebhook.mockReturnValue({
      event: 'payout.updated', data: { payout: { id: 'wpayout-1' } }, timestamp: '1', checksum: 'a'.repeat(64), eventKey: 'evt-key-4',
    })
    mockQueryRaw
      .mockResolvedValueOnce([{ id: 'webhook-evt-3' }])
      .mockResolvedValueOnce([{ id: PAYOUT_ID }])
      .mockResolvedValueOnce([{
        id: PAYOUT_ID, campaign_id: CAMPAIGN_ID, beneficiary_citizen_id: CREATOR_ID,
        provider_payout_id: 'wpayout-1', provider_reference: 'vertice-ref-1',
        amount_cop: 500_000n, status: 'processing', provider_status: 'PENDING',
      }])
      .mockResolvedValueOnce([{
        id: PAYOUT_ID, campaign_id: CAMPAIGN_ID, beneficiary_citizen_id: CREATOR_ID,
        provider_payout_id: 'wpayout-1', provider_reference: 'vertice-ref-1',
        amount_cop: 500_000n, status: 'processing', provider_status: 'PENDING',
      }])
      .mockResolvedValueOnce([{
        id: PAYOUT_ID, campaign_id: CAMPAIGN_ID, beneficiary_citizen_id: CREATOR_ID,
        provider_payout_id: 'wpayout-1', provider_reference: 'vertice-ref-1',
        amount_cop: 500_000n, status: 'paid', provider_status: 'TOTAL_PAYMENT',
      }])
    mockGetWompiPayout.mockResolvedValue({ id: 'wpayout-1', reference: 'vertice-ref-1', status: 'TOTAL_PAYMENT', amountInCents: 50_000_000 })
    mockGetWompiPayoutTransactions.mockResolvedValue([{ id: 'tx-1', status: 'APPROVED', amountInCents: 50_000_000 }])

    const result = await processWompiPayoutWebhook({ xEventChecksum: 'a'.repeat(64), body: {} })

    expect(result).toEqual({ duplicate: false, processed: true })
  })

  it('marks the webhook failed when reconciliation throws', async () => {
    mockVerifyWompiPayoutWebhook.mockReturnValue({
      event: 'payout.updated', data: { payout: { id: 'wpayout-1' } }, timestamp: '1', checksum: 'a'.repeat(64), eventKey: 'evt-key-5',
    })
    mockQueryRaw
      .mockResolvedValueOnce([{ id: 'webhook-evt-4' }])
      .mockResolvedValueOnce([{ id: PAYOUT_ID }])
      .mockResolvedValueOnce([{
        id: PAYOUT_ID, campaign_id: CAMPAIGN_ID, beneficiary_citizen_id: CREATOR_ID,
        provider_payout_id: null, provider_reference: 'vertice-ref-1',
        amount_cop: 500_000n, status: 'requested', provider_status: null,
      }])
    mockFindWompiPayoutByReference.mockResolvedValue(null)

    await expect(processWompiPayoutWebhook({ body: {} })).rejects.toMatchObject({
      statusCode: 503, code: 'PAYOUT_RECONCILIATION_PENDING',
    })
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1)
  })
})
