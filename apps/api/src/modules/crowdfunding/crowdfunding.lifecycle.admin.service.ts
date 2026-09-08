import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'

function httpError(message: string, code: string, statusCode: number): Error {
  return Object.assign(new Error(message), { code, statusCode })
}

export async function getCampaignLifecycleForAdmin(campaignId: string) {
  const rows = await prisma.$queryRaw<Array<{
    id: string
    creator_citizen_id: string
    title: string
    slug: string
    summary: string
    description: string
    category: string
    funding_model: string
    funding_policy: string
    status: string
    compliance_status: string
    goal_amount_cop: bigint
    raised_amount_cop: bigint
    currency: string
    locality_id: number | null
    neighborhood: string | null
    budget: unknown
    review_notes: string | null
    revision_no: number
    submitted_for_review_at: Date | null
    last_reviewed_at: Date | null
    starts_at: Date | null
    ends_at: Date | null
    created_at: Date
    updated_at: Date
  }>>(Prisma.sql`
    SELECT *
    FROM crowdfunding_campaigns
    WHERE id = ${campaignId}::uuid
    LIMIT 1
  `)
  const campaign = rows[0]
  if (!campaign) throw httpError('Campaña no encontrada.', 'CAMPAIGN_NOT_FOUND', 404)

  const events = await prisma.$queryRaw<Array<{
    id: string
    campaign_id: string
    actor_citizen_id: string | null
    event_type: string
    revision_no: number
    from_status: string | null
    to_status: string
    from_compliance_status: string | null
    to_compliance_status: string
    notes: string | null
    created_at: Date
  }>>(Prisma.sql`
    SELECT id, campaign_id, actor_citizen_id, event_type, revision_no,
           from_status, to_status, from_compliance_status, to_compliance_status,
           notes, created_at
    FROM crowdfunding_campaign_lifecycle_events
    WHERE campaign_id = ${campaignId}::uuid
    ORDER BY created_at ASC, id ASC
    LIMIT 250
  `)

  return {
    campaign: {
      ...campaign,
      goal_amount_cop: Number(campaign.goal_amount_cop),
      raised_amount_cop: Number(campaign.raised_amount_cop),
      submitted_for_review_at: campaign.submitted_for_review_at?.toISOString() ?? null,
      last_reviewed_at: campaign.last_reviewed_at?.toISOString() ?? null,
      starts_at: campaign.starts_at?.toISOString() ?? null,
      ends_at: campaign.ends_at?.toISOString() ?? null,
      created_at: campaign.created_at.toISOString(),
      updated_at: campaign.updated_at.toISOString(),
    },
    events: events.map((event) => ({ ...event, created_at: event.created_at.toISOString() })),
    reviewable: campaign.status === 'review' && campaign.compliance_status === 'in_review',
  }
}
