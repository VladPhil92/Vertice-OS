import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { defaultFundingPolicy } from './crowdfunding.policy'
import type { FundingPolicy } from './crowdfunding.policy'
import type { CreateCampaignDraftInput } from './crowdfunding.schema'

type CampaignLifecycleRow = {
  id: string
  creator_citizen_id: string
  title: string
  slug: string
  summary: string
  description: string
  category: string
  funding_model: string
  funding_policy: FundingPolicy
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
  last_reviewed_by_citizen_id: string | null
  starts_at: Date | null
  ends_at: Date | null
  created_at: Date
  updated_at: Date
}

type LifecycleEventRow = {
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
}

export type CampaignLifecycleReviewDecision = 'approve' | 'request_changes' | 'reject' | 'suspend'

function httpError(message: string, code: string, statusCode: number): Error {
  return Object.assign(new Error(message), { code, statusCode })
}

function serializeCampaign(row: CampaignLifecycleRow) {
  return {
    ...row,
    goal_amount_cop: Number(row.goal_amount_cop),
    raised_amount_cop: Number(row.raised_amount_cop),
    submitted_for_review_at: row.submitted_for_review_at?.toISOString() ?? null,
    last_reviewed_at: row.last_reviewed_at?.toISOString() ?? null,
    starts_at: row.starts_at?.toISOString() ?? null,
    ends_at: row.ends_at?.toISOString() ?? null,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  }
}

function serializeEvent(row: LifecycleEventRow) {
  return {
    ...row,
    created_at: row.created_at.toISOString(),
  }
}

async function loadOwnedCampaignForUpdate(
  tx: Prisma.TransactionClient,
  citizenId: string,
  campaignId: string,
): Promise<CampaignLifecycleRow> {
  const rows = await tx.$queryRaw<CampaignLifecycleRow[]>(Prisma.sql`
    SELECT *
    FROM crowdfunding_campaigns
    WHERE id = ${campaignId}::uuid
      AND creator_citizen_id = ${citizenId}::uuid
    FOR UPDATE
  `)
  if (!rows[0]) throw httpError('Campaña no encontrada.', 'CAMPAIGN_NOT_FOUND', 404)
  return rows[0]
}

async function recordLifecycleEvent(
  tx: Prisma.TransactionClient,
  input: {
    campaignId: string
    actorCitizenId: string | null
    eventType: string
    revisionNo: number
    fromStatus: string | null
    toStatus: string
    fromComplianceStatus: string | null
    toComplianceStatus: string
    notes?: string | null
  },
) {
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO crowdfunding_campaign_lifecycle_events (
      campaign_id, actor_citizen_id, event_type, revision_no,
      from_status, to_status, from_compliance_status, to_compliance_status,
      notes
    ) VALUES (
      ${input.campaignId}::uuid,
      ${input.actorCitizenId}::uuid,
      ${input.eventType},
      ${input.revisionNo},
      ${input.fromStatus},
      ${input.toStatus},
      ${input.fromComplianceStatus},
      ${input.toComplianceStatus},
      ${input.notes ?? null}
    )
  `)
}

export async function getOwnCampaignLifecycle(citizenId: string, campaignId: string) {
  const rows = await prisma.$queryRaw<CampaignLifecycleRow[]>(Prisma.sql`
    SELECT *
    FROM crowdfunding_campaigns
    WHERE id = ${campaignId}::uuid
      AND creator_citizen_id = ${citizenId}::uuid
    LIMIT 1
  `)
  if (!rows[0]) throw httpError('Campaña no encontrada.', 'CAMPAIGN_NOT_FOUND', 404)

  const events = await prisma.$queryRaw<LifecycleEventRow[]>(Prisma.sql`
    SELECT id, campaign_id, actor_citizen_id, event_type, revision_no,
           from_status, to_status, from_compliance_status, to_compliance_status,
           notes, created_at
    FROM crowdfunding_campaign_lifecycle_events
    WHERE campaign_id = ${campaignId}::uuid
    ORDER BY created_at ASC, id ASC
    LIMIT 250
  `)

  const campaign = serializeCampaign(rows[0])
  return {
    campaign,
    events: events.map(serializeEvent),
    permissions: {
      can_edit: campaign.status === 'draft' && campaign.compliance_status !== 'suspended',
      can_submit_for_review: campaign.status === 'draft' && ['pending', 'rejected'].includes(campaign.compliance_status),
      can_activate: campaign.status === 'verified' && campaign.compliance_status === 'verified',
    },
  }
}

export async function updateOwnCampaignDraft(
  citizenId: string,
  campaignId: string,
  input: CreateCampaignDraftInput,
) {
  const fundingPolicy = input.funding_policy ?? defaultFundingPolicy(input.funding_model)
  const budgetJson = JSON.stringify(input.budget)

  return prisma.$transaction(async (tx) => {
    const current = await loadOwnedCampaignForUpdate(tx, citizenId, campaignId)
    if (current.status !== 'draft') {
      throw httpError('Solo los borradores pueden editarse.', 'CAMPAIGN_NOT_EDITABLE', 409)
    }
    if (current.compliance_status === 'suspended') {
      throw httpError('La campaña está suspendida y no puede editarse.', 'CAMPAIGN_SUSPENDED', 409)
    }

    const rows = await tx.$queryRaw<CampaignLifecycleRow[]>(Prisma.sql`
      UPDATE crowdfunding_campaigns
      SET title = ${input.title},
          summary = ${input.summary},
          description = ${input.description},
          category = ${input.category},
          funding_model = ${input.funding_model},
          funding_policy = ${fundingPolicy},
          goal_amount_cop = ${input.goal_amount_cop},
          locality_id = ${input.locality_id ?? null},
          neighborhood = ${input.neighborhood ?? null},
          budget = ${budgetJson}::jsonb,
          updated_at = NOW()
      WHERE id = ${campaignId}::uuid
        AND creator_citizen_id = ${citizenId}::uuid
        AND status = 'draft'
      RETURNING *
    `)
    if (!rows[0]) throw httpError('La campaña cambió de estado. Actualiza e inténtalo de nuevo.', 'CAMPAIGN_STATE_CHANGED', 409)

    await recordLifecycleEvent(tx, {
      campaignId,
      actorCitizenId: citizenId,
      eventType: 'draft_updated',
      revisionNo: rows[0].revision_no,
      fromStatus: current.status,
      toStatus: rows[0].status,
      fromComplianceStatus: current.compliance_status,
      toComplianceStatus: rows[0].compliance_status,
      notes: current.review_notes ? 'Borrador actualizado después de observaciones de revisión.' : null,
    })

    return serializeCampaign(rows[0])
  })
}

export async function submitOwnCampaignForReview(citizenId: string, campaignId: string) {
  return prisma.$transaction(async (tx) => {
    const current = await loadOwnedCampaignForUpdate(tx, citizenId, campaignId)
    if (current.status !== 'draft') {
      throw httpError('Solo un borrador puede enviarse a revisión.', 'CAMPAIGN_NOT_SUBMITTABLE', 409)
    }
    if (!['pending', 'rejected'].includes(current.compliance_status)) {
      throw httpError('La campaña no está disponible para una nueva revisión.', 'CAMPAIGN_COMPLIANCE_STATE_INVALID', 409)
    }

    const rows = await tx.$queryRaw<CampaignLifecycleRow[]>(Prisma.sql`
      UPDATE crowdfunding_campaigns
      SET status = 'review',
          compliance_status = 'in_review',
          revision_no = CASE
            WHEN submitted_for_review_at IS NULL THEN revision_no
            ELSE revision_no + 1
          END,
          submitted_for_review_at = NOW(),
          review_notes = NULL,
          updated_at = NOW()
      WHERE id = ${campaignId}::uuid
        AND creator_citizen_id = ${citizenId}::uuid
        AND status = 'draft'
      RETURNING *
    `)
    if (!rows[0]) throw httpError('La campaña cambió de estado. Actualiza e inténtalo de nuevo.', 'CAMPAIGN_STATE_CHANGED', 409)

    await recordLifecycleEvent(tx, {
      campaignId,
      actorCitizenId: citizenId,
      eventType: 'submitted_for_review',
      revisionNo: rows[0].revision_no,
      fromStatus: current.status,
      toStatus: rows[0].status,
      fromComplianceStatus: current.compliance_status,
      toComplianceStatus: rows[0].compliance_status,
    })

    return serializeCampaign(rows[0])
  })
}

export async function reviewCampaignLifecycle(
  reviewerCitizenId: string,
  campaignId: string,
  input: { decision: CampaignLifecycleReviewDecision; notes?: string },
) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<CampaignLifecycleRow[]>(Prisma.sql`
      SELECT *
      FROM crowdfunding_campaigns
      WHERE id = ${campaignId}::uuid
      FOR UPDATE
    `)
    const current = rows[0]
    if (!current) throw httpError('Campaña no encontrada.', 'CAMPAIGN_NOT_FOUND', 404)

    if (input.decision !== 'suspend') {
      if (current.status !== 'review' || current.compliance_status !== 'in_review') {
        throw httpError('La campaña debe estar formalmente en revisión.', 'CAMPAIGN_NOT_IN_REVIEW', 409)
      }
    }

    if (['request_changes', 'reject', 'suspend'].includes(input.decision) && !input.notes?.trim()) {
      throw httpError('Esta decisión requiere observaciones.', 'CAMPAIGN_REVIEW_NOTES_REQUIRED', 400)
    }

    const next = input.decision === 'approve'
      ? { status: 'verified', compliance: 'verified', event: 'approved' }
      : input.decision === 'request_changes'
        ? { status: 'draft', compliance: 'pending', event: 'changes_requested' }
        : input.decision === 'reject'
          ? { status: 'review', compliance: 'rejected', event: 'rejected' }
          : { status: 'suspended', compliance: 'suspended', event: 'suspended' }

    const updated = await tx.$queryRaw<CampaignLifecycleRow[]>(Prisma.sql`
      UPDATE crowdfunding_campaigns
      SET status = ${next.status},
          compliance_status = ${next.compliance},
          review_notes = ${input.notes?.trim() ?? null},
          last_reviewed_at = NOW(),
          last_reviewed_by_citizen_id = ${reviewerCitizenId}::uuid,
          updated_at = NOW()
      WHERE id = ${campaignId}::uuid
      RETURNING *
    `)

    await recordLifecycleEvent(tx, {
      campaignId,
      actorCitizenId: reviewerCitizenId,
      eventType: next.event,
      revisionNo: updated[0].revision_no,
      fromStatus: current.status,
      toStatus: updated[0].status,
      fromComplianceStatus: current.compliance_status,
      toComplianceStatus: updated[0].compliance_status,
      notes: input.notes?.trim() ?? null,
    })

    return serializeCampaign(updated[0])
  })
}
