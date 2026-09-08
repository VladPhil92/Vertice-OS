import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import type { CampaignReviewInput, PayoutProfileReviewInput } from './crowdfunding.schema'

function httpError(message: string, code: string, statusCode: number): Error {
  return Object.assign(new Error(message), { code, statusCode })
}

export async function getPayoutReadiness(citizenId: string) {
  const citizenRows = await prisma.$queryRaw<Array<{ verification_level: number }>>(Prisma.sql`
    SELECT verification_level
    FROM citizens
    WHERE id = ${citizenId}::uuid AND is_active = TRUE
    LIMIT 1
  `)
  if (!citizenRows[0]) throw httpError('Ciudadano no encontrado.', 'CITIZEN_NOT_FOUND', 404)

  const profileRows = await prisma.$queryRaw<Array<{
    verification_status: string
    payout_status: string
    requested_at: Date | null
    verified_at: Date | null
    review_notes: string | null
  }>>(Prisma.sql`
    SELECT verification_status, payout_status, requested_at, verified_at, review_notes
    FROM crowdfunding_payout_profiles
    WHERE citizen_id = ${citizenId}::uuid
    LIMIT 1
  `)
  const profile = profileRows[0]
  const identityVerified = citizenRows[0].verification_level >= 1

  return {
    identity_verified: identityVerified,
    verification_status: profile?.verification_status ?? 'pending',
    payout_status: profile?.payout_status ?? 'disabled',
    requested_at: profile?.requested_at?.toISOString() ?? null,
    verified_at: profile?.verified_at?.toISOString() ?? null,
    review_notes: profile?.review_notes ?? null,
    can_request_review: identityVerified && (!profile || ['pending', 'rejected'].includes(profile.verification_status)),
    can_activate_campaign: identityVerified && profile?.verification_status === 'verified' && profile.payout_status === 'eligible',
  }
}

export async function requestPayoutReview(citizenId: string) {
  const readiness = await getPayoutReadiness(citizenId)
  if (!readiness.identity_verified) {
    throw httpError('Debes verificar tu identidad antes de solicitar habilitación de recaudo.', 'IDENTITY_NOT_VERIFIED', 403)
  }
  if (readiness.verification_status === 'verified') return readiness
  if (readiness.verification_status === 'in_review') return readiness
  if (readiness.verification_status === 'suspended') {
    throw httpError('El perfil de recaudo está suspendido y requiere revisión administrativa.', 'PAYOUT_PROFILE_SUSPENDED', 409)
  }

  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO crowdfunding_payout_profiles (
      citizen_id, verification_status, payout_status, requested_at
    ) VALUES (
      ${citizenId}::uuid, 'in_review', 'disabled', NOW()
    )
    ON CONFLICT (citizen_id) DO UPDATE SET
      verification_status = 'in_review',
      payout_status = 'disabled',
      requested_at = NOW(),
      verified_at = NULL,
      reviewed_by_citizen_id = NULL,
      updated_at = NOW()
  `)
  return getPayoutReadiness(citizenId)
}

export async function reviewPayoutProfile(
  reviewerCitizenId: string,
  targetCitizenId: string,
  input: PayoutProfileReviewInput,
) {
  const citizenRows = await prisma.$queryRaw<Array<{ verification_level: number }>>(Prisma.sql`
    SELECT verification_level
    FROM citizens
    WHERE id = ${targetCitizenId}::uuid AND is_active = TRUE
    LIMIT 1
  `)
  if (!citizenRows[0]) throw httpError('Ciudadano no encontrado.', 'CITIZEN_NOT_FOUND', 404)
  if (input.decision === 'approve' && citizenRows[0].verification_level < 1) {
    throw httpError('No puede habilitarse recaudo sin identidad verificada.', 'IDENTITY_NOT_VERIFIED', 409)
  }
  if (input.decision === 'approve' && !input.provider_reference) {
    throw httpError(
      'La aprobación requiere referencia verificable del proveedor KYC/KYB.',
      'PROVIDER_REFERENCE_REQUIRED',
      400,
    )
  }

  const verificationStatus = input.decision === 'approve'
    ? 'verified'
    : input.decision === 'suspend'
      ? 'suspended'
      : 'rejected'
  const payoutStatus = input.decision === 'approve' ? 'eligible' : 'blocked'

  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO crowdfunding_payout_profiles (
      citizen_id, verification_status, payout_status, provider, provider_reference,
      review_notes, requested_at, verified_at, reviewed_by_citizen_id
    ) VALUES (
      ${targetCitizenId}::uuid, ${verificationStatus}, ${payoutStatus},
      ${input.provider_reference ? 'mercadopago' : null}, ${input.provider_reference ?? null},
      ${input.notes ?? null}, NOW(), ${input.decision === 'approve' ? new Date() : null},
      ${reviewerCitizenId}::uuid
    )
    ON CONFLICT (citizen_id) DO UPDATE SET
      verification_status = EXCLUDED.verification_status,
      payout_status = EXCLUDED.payout_status,
      provider = EXCLUDED.provider,
      provider_reference = EXCLUDED.provider_reference,
      review_notes = EXCLUDED.review_notes,
      verified_at = EXCLUDED.verified_at,
      reviewed_by_citizen_id = EXCLUDED.reviewed_by_citizen_id,
      updated_at = NOW()
  `)

  return getPayoutReadiness(targetCitizenId)
}

export async function listComplianceQueue() {
  const [campaigns, payoutProfiles] = await Promise.all([
    prisma.$queryRaw<Array<{
      id: string
      creator_citizen_id: string
      title: string
      category: string
      funding_model: string
      goal_amount_cop: bigint
      compliance_status: string
      status: string
      created_at: Date
    }>>(Prisma.sql`
      SELECT id, creator_citizen_id, title, category, funding_model, goal_amount_cop,
             compliance_status, status, created_at
      FROM crowdfunding_campaigns
      WHERE status = 'review'
        AND compliance_status = 'in_review'
      ORDER BY submitted_for_review_at ASC NULLS LAST, created_at ASC
      LIMIT 100
    `),
    prisma.$queryRaw<Array<{
      citizen_id: string
      verification_status: string
      payout_status: string
      requested_at: Date | null
    }>>(Prisma.sql`
      SELECT citizen_id, verification_status, payout_status, requested_at
      FROM crowdfunding_payout_profiles
      WHERE verification_status = 'in_review'
      ORDER BY requested_at ASC NULLS LAST
      LIMIT 100
    `),
  ])

  return {
    campaigns: campaigns.map((campaign) => ({
      ...campaign,
      goal_amount_cop: Number(campaign.goal_amount_cop),
      created_at: campaign.created_at.toISOString(),
    })),
    payout_profiles: payoutProfiles.map((profile) => ({
      ...profile,
      requested_at: profile.requested_at?.toISOString() ?? null,
    })),
  }
}

export async function reviewCampaign(campaignId: string, input: CampaignReviewInput) {
  const rows = await prisma.$queryRaw<Array<{
    id: string
    status: string
    compliance_status: string
  }>>(Prisma.sql`
    SELECT id, status, compliance_status
    FROM crowdfunding_campaigns
    WHERE id = ${campaignId}::uuid
    LIMIT 1
  `)
  const campaign = rows[0]
  if (!campaign) throw httpError('Campaña no encontrada.', 'CAMPAIGN_NOT_FOUND', 404)

  if (input.decision !== 'suspend' && (campaign.status !== 'review' || campaign.compliance_status !== 'in_review')) {
    throw httpError('La campaña debe enviarse formalmente a revisión antes de decidir.', 'CAMPAIGN_NOT_IN_REVIEW', 409)
  }
  if (input.decision !== 'approve' && !input.notes?.trim()) {
    throw httpError('Rechazar o suspender requiere observaciones.', 'CAMPAIGN_REVIEW_NOTES_REQUIRED', 400)
  }

  if (input.decision === 'approve') {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE crowdfunding_campaigns
      SET compliance_status = 'verified', status = 'verified', review_notes = ${input.notes ?? null}, updated_at = NOW()
      WHERE id = ${campaignId}::uuid
        AND status = 'review'
        AND compliance_status = 'in_review'
    `)
  } else if (input.decision === 'reject') {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE crowdfunding_campaigns
      SET compliance_status = 'rejected', status = 'review', review_notes = ${input.notes ?? null}, updated_at = NOW()
      WHERE id = ${campaignId}::uuid
        AND status = 'review'
        AND compliance_status = 'in_review'
    `)
  } else {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE crowdfunding_campaigns
      SET compliance_status = 'suspended', status = 'suspended', review_notes = ${input.notes ?? null}, updated_at = NOW()
      WHERE id = ${campaignId}::uuid
    `)
  }

  const campaignRows = await prisma.$queryRaw<Array<{
    id: string
    status: string
    compliance_status: string
    review_notes: string | null
  }>>(Prisma.sql`
    SELECT id, status, compliance_status, review_notes
    FROM crowdfunding_campaigns
    WHERE id = ${campaignId}::uuid
    LIMIT 1
  `)
  return campaignRows[0]
}

export async function activateCampaign(citizenId: string, campaignId: string) {
  const readiness = await getPayoutReadiness(citizenId)
  if (!readiness.can_activate_campaign) {
    throw httpError(
      'Antes de recaudar debes tener identidad y perfil de desembolso verificados.',
      'PAYOUT_PROFILE_NOT_READY',
      409,
    )
  }

  const updated = await prisma.$queryRaw<Array<{
    id: string
    status: string
    starts_at: Date | null
    ends_at: Date | null
  }>>(Prisma.sql`
    UPDATE crowdfunding_campaigns
    SET status = 'active', starts_at = COALESCE(starts_at, NOW()), updated_at = NOW()
    WHERE id = ${campaignId}::uuid
      AND creator_citizen_id = ${citizenId}::uuid
      AND compliance_status = 'verified'
      AND status = 'verified'
      AND (ends_at IS NULL OR ends_at > NOW())
    RETURNING id, status, starts_at, ends_at
  `)
  if (!updated[0]) {
    throw httpError('La campaña no cumple condiciones para activarse.', 'CAMPAIGN_NOT_ACTIVATABLE', 409)
  }

  return {
    id: updated[0].id,
    status: updated[0].status,
    starts_at: updated[0].starts_at?.toISOString() ?? null,
    ends_at: updated[0].ends_at?.toISOString() ?? null,
  }
}
