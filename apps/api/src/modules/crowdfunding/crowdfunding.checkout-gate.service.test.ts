jest.mock('../../lib/prisma', () => ({
  prisma: { $queryRaw: jest.fn() },
}))
jest.mock('./crowdfunding.readiness.service', () => ({
  getCampaignActivationReadiness: jest.fn(),
}))

import { prisma } from '../../lib/prisma'
import { getCampaignActivationReadiness } from './crowdfunding.readiness.service'
import { assertCampaignContributionReady } from './crowdfunding.checkout-gate.service'

const mockQueryRaw = prisma.$queryRaw as jest.Mock
const mockReadiness = getCampaignActivationReadiness as jest.Mock

beforeEach(() => {
  jest.resetAllMocks()
})

describe('assertCampaignContributionReady', () => {
  it('rejects a missing campaign', async () => {
    mockQueryRaw.mockResolvedValueOnce([])

    await expect(assertCampaignContributionReady('campaign-1')).rejects.toMatchObject({
      code: 'CAMPAIGN_NOT_FOUND', statusCode: 404,
    })
  })

  it('rejects a campaign that is not active', async () => {
    mockQueryRaw.mockResolvedValueOnce([{
      creator_citizen_id: 'creator-1', status: 'verified', compliance_status: 'verified', ends_at: null,
    }])

    await expect(assertCampaignContributionReady('campaign-1')).rejects.toMatchObject({
      code: 'CAMPAIGN_NOT_PAYABLE', statusCode: 409,
    })
    expect(mockReadiness).not.toHaveBeenCalled()
  })

  it('fails closed when live financial readiness is lost', async () => {
    mockQueryRaw.mockResolvedValueOnce([{
      creator_citizen_id: 'creator-1', status: 'active', compliance_status: 'verified', ends_at: null,
    }])
    mockReadiness.mockResolvedValueOnce({
      funding: {
        ready_for_campaign_activation: false,
        blockers: [{
          code: 'PAYOUT_PROVIDER_DISABLED',
          scope: 'platform',
          message: 'Proveedor no disponible.',
        }],
      },
    })

    await expect(assertCampaignContributionReady('campaign-1')).rejects.toMatchObject({
      code: 'PAYOUT_PROVIDER_DISABLED', statusCode: 503,
    })
  })

  it('allows checkout only when active campaign and funding readiness remain complete', async () => {
    mockQueryRaw.mockResolvedValueOnce([{
      creator_citizen_id: 'creator-1', status: 'active', compliance_status: 'verified', ends_at: null,
    }])
    mockReadiness.mockResolvedValueOnce({
      funding: { ready_for_campaign_activation: true, blockers: [] },
    })

    await expect(assertCampaignContributionReady('campaign-1')).resolves.toBeUndefined()
  })
})
