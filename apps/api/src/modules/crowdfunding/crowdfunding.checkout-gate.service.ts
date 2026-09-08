import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { getCampaignActivationReadiness } from './crowdfunding.readiness.service'

function httpError(message: string, code: string, statusCode: number): Error {
  return Object.assign(new Error(message), { code, statusCode })
}

/**
 * Public contribution checkout must fail closed not only when the collection
 * provider is disabled, but also when the beneficiary/payout path has lost
 * readiness after campaign activation.
 */
export async function assertCampaignContributionReady(campaignId: string): Promise<void> {
  const rows = await prisma.$queryRaw<Array<{
    creator_citizen_id: string
    status: string
    compliance_status: string
    ends_at: Date | null
  }>>(Prisma.sql`
    SELECT creator_citizen_id, status, compliance_status, ends_at
    FROM crowdfunding_campaigns
    WHERE id = ${campaignId}::uuid
    LIMIT 1
  `)
  const campaign = rows[0]
  if (!campaign) throw httpError('Campaña no encontrada.', 'CAMPAIGN_NOT_FOUND', 404)
  if (
    campaign.status !== 'active'
    || campaign.compliance_status !== 'verified'
    || (campaign.ends_at && campaign.ends_at <= new Date())
  ) {
    throw httpError('La campaña no está habilitada para recibir aportes.', 'CAMPAIGN_NOT_PAYABLE', 409)
  }

  const readiness = await getCampaignActivationReadiness(campaign.creator_citizen_id, campaignId)
  if (!readiness.funding.ready_for_campaign_activation) {
    const blocker = readiness.funding.blockers[0]
    throw httpError(
      blocker?.message ?? 'El circuito financiero de la campaña no está listo.',
      blocker?.code ?? 'CAMPAIGN_FINANCIAL_READINESS_LOST',
      blocker?.scope === 'platform' ? 503 : 409,
    )
  }
}
