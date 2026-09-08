jest.mock('../../../lib/prisma', () => ({
  prisma: { $queryRaw: jest.fn() },
}))

jest.mock('../../../lib/audit', () => ({ recordAuditEvent: jest.fn() }))

jest.mock('../../../config', () => ({
  config: {
    CROWDFUNDING_PAYOUTS_ENABLED: true,
    WOMPI_PAYOUTS_ENV: 'sandbox',
  },
}))

jest.mock('../wompi-payouts.provider', () => ({
  getWompiPayoutConfigurationState: jest.fn(),
}))

import { config } from '../../../config'
import { recordAuditEvent } from '../../../lib/audit'
import { prisma } from '../../../lib/prisma'
import { getWompiPayoutConfigurationState } from '../wompi-payouts.provider'
import {
  certifyCrowdfundingPayoutOperations,
  getCrowdfundingPayoutOperationsStatus,
} from '../payout-operations.service'

const mockQueryRaw = prisma.$queryRaw as jest.Mock
const mockRecordAuditEvent = recordAuditEvent as jest.Mock
const mockGetWompiPayoutConfigurationState = getWompiPayoutConfigurationState as jest.Mock

const ACTOR_ID = '550e8400-e29b-41d4-a716-446655440020'

beforeEach(() => {
  jest.clearAllMocks()
  mockGetWompiPayoutConfigurationState.mockReturnValue('ready')
  ;(config as unknown as { CROWDFUNDING_PAYOUTS_ENABLED: boolean }).CROWDFUNDING_PAYOUTS_ENABLED = true
})

describe('certifyCrowdfundingPayoutOperations', () => {
  it('requires evidence for a verified certification', async () => {
    await expect(certifyCrowdfundingPayoutOperations({
      actorId: ACTOR_ID, status: 'verified',
    })).rejects.toMatchObject({ statusCode: 422, code: 'PAYOUT_CERTIFICATION_EVIDENCE_REQUIRED' })
    expect(mockQueryRaw).not.toHaveBeenCalled()
  })

  it('records a verified certification with evidence and audits it', async () => {
    const certifiedAt = new Date('2026-09-01T00:00:00.000Z')
    mockQueryRaw.mockResolvedValueOnce([{ id: 'cert-1', certified_at: certifiedAt }])

    const result = await certifyCrowdfundingPayoutOperations({
      actorId: ACTOR_ID, status: 'verified', evidenceReference: 'wompi-ticket-123', notes: 'Certificación anual',
    })

    expect(result).toEqual({
      id: 'cert-1', certified_at: certifiedAt, provider: 'wompi_payouts', status: 'verified',
    })
    expect(mockRecordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: 'finance.crowdfunding_payout_certification', result: 'verified',
    }))
  })

  it('allows a pending certification without evidence', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ id: 'cert-2', certified_at: new Date() }])

    const result = await certifyCrowdfundingPayoutOperations({ actorId: ACTOR_ID, status: 'pending' })

    expect(result.status).toBe('pending')
  })
})

describe('getCrowdfundingPayoutOperationsStatus', () => {
  it('reports blocked readiness when there is no verified certification', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ pending: 2n, reconciliation_required: 1n, paid: 5n, failed: 0n }])

    const status = await getCrowdfundingPayoutOperationsStatus()

    expect(status).toMatchObject({
      provider: 'wompi_payouts',
      providerState: 'ready',
      operationallyCertified: false,
      readiness: 'blocked',
      queue: { pending: 2, reconciliationRequired: 1, paid: 5, failed: 0 },
    })
  })

  it('reports ready readiness when certified, enabled and provider-ready', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ id: 'cert-1', status: 'verified', evidence_reference: 'wompi-ticket-123', certified_at: new Date() }])
      .mockResolvedValueOnce([{ pending: 0n, reconciliation_required: 0n, paid: 3n, failed: 0n }])

    const status = await getCrowdfundingPayoutOperationsStatus()

    expect(status.operationallyCertified).toBe(true)
    expect(status.readiness).toBe('ready')
  })

  it('reports blocked readiness when execution is disabled even if certified', async () => {
    ;(config as unknown as { CROWDFUNDING_PAYOUTS_ENABLED: boolean }).CROWDFUNDING_PAYOUTS_ENABLED = false
    mockQueryRaw
      .mockResolvedValueOnce([{ id: 'cert-1', status: 'verified', evidence_reference: 'wompi-ticket-123', certified_at: new Date() }])
      .mockResolvedValueOnce([{ pending: 0n, reconciliation_required: 0n, paid: 0n, failed: 0n }])

    const status = await getCrowdfundingPayoutOperationsStatus()

    expect(status.readiness).toBe('blocked')
  })

  it('reports blocked readiness when the provider is not ready', async () => {
    mockGetWompiPayoutConfigurationState.mockReturnValue('misconfigured')
    mockQueryRaw
      .mockResolvedValueOnce([{ id: 'cert-1', status: 'verified', evidence_reference: 'wompi-ticket-123', certified_at: new Date() }])
      .mockResolvedValueOnce([{ pending: 0n, reconciliation_required: 0n, paid: 0n, failed: 0n }])

    const status = await getCrowdfundingPayoutOperationsStatus()

    expect(status.providerState).toBe('misconfigured')
    expect(status.readiness).toBe('blocked')
  })
})
