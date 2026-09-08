import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { getFeatureCapabilities, type CapabilityState } from '../../lib/feature-secrets'

export type ReadinessState = 'ready' | 'action_required' | 'pending_review' | 'platform_blocked' | 'blocked'
export type BlockerScope = 'user' | 'campaign' | 'platform'

export interface ReadinessBlocker {
  code: string
  scope: BlockerScope
  message: string
  action_href: string | null
}

interface PayoutProfileSnapshot {
  verification_status: string
  payout_status: string
  destination_fingerprint: string | null
  destination_key_type: string | null
  requested_at: Date | null
  verified_at: Date | null
  review_notes: string | null
}

interface CampaignSnapshot {
  id: string
  title: string
  status: string
  compliance_status: string
  review_notes: string | null
}

export interface FundingReadinessSnapshot {
  identityVerified: boolean
  payoutProfile: PayoutProfileSnapshot | null
  capabilities: {
    ctg_one_federation: CapabilityState
    payments: CapabilityState
    crowdfunding_payments: CapabilityState
    payouts: CapabilityState
    crowdfunding_payouts: CapabilityState
  }
  payoutCertificationStatus: string | null
}

function stageState(ready: boolean, fallback: ReadinessState): ReadinessState {
  return ready ? 'ready' : fallback
}

export function evaluateFundingReadiness(snapshot: FundingReadinessSnapshot) {
  const profile = snapshot.payoutProfile
  const profileVerified = profile?.verification_status === 'verified' && profile.payout_status === 'eligible'
  const destinationRegistered = Boolean(profile?.destination_fingerprint && profile.destination_key_type)
  const payoutProviderReady = snapshot.capabilities.payouts === 'ready'
  const collectionRailReady = snapshot.capabilities.crowdfunding_payments === 'ready'
  const payoutCertificationReady = snapshot.payoutCertificationStatus === 'verified'

  const blockers: ReadinessBlocker[] = []

  if (!snapshot.identityVerified) {
    blockers.push({
      code: 'IDENTITY_VERIFICATION_REQUIRED',
      scope: 'user',
      message: 'Verifica tu identidad antes de habilitar recaudo.',
      action_href: '/dashboard/identity',
    })
  }

  if (snapshot.identityVerified && !profileVerified) {
    const inReview = profile?.verification_status === 'in_review'
    blockers.push({
      code: inReview ? 'PAYOUT_PROFILE_REVIEW_PENDING' : 'PAYOUT_PROFILE_REVIEW_REQUIRED',
      scope: 'user',
      message: inReview
        ? 'Tu perfil de recaudo está en revisión.'
        : 'Solicita la revisión de tu perfil de recaudo y desembolso.',
      action_href: inReview ? null : '/dashboard/crowdfunding/readiness',
    })
  }

  if (profileVerified && !destinationRegistered) {
    blockers.push({
      code: payoutProviderReady ? 'PAYOUT_DESTINATION_REQUIRED' : 'PAYOUT_DESTINATION_PROVIDER_BLOCKED',
      scope: payoutProviderReady ? 'user' : 'platform',
      message: payoutProviderReady
        ? 'Confirma un destino BRE-B propio antes de activar campañas.'
        : 'El registro de destino BRE-B está bloqueado hasta que el proveedor de desembolsos esté configurado.',
      action_href: payoutProviderReady ? '/dashboard/crowdfunding/readiness' : null,
    })
  }

  if (!collectionRailReady) {
    blockers.push({
      code: snapshot.capabilities.crowdfunding_payments === 'misconfigured'
        ? 'COLLECTION_RAIL_MISCONFIGURED'
        : 'COLLECTION_RAIL_DISABLED',
      scope: 'platform',
      message: 'El rail de cobro de crowdfunding todavía no está habilitado operativamente.',
      action_href: null,
    })
  }

  if (!payoutProviderReady) {
    blockers.push({
      code: snapshot.capabilities.payouts === 'misconfigured'
        ? 'PAYOUT_PROVIDER_MISCONFIGURED'
        : 'PAYOUT_PROVIDER_DISABLED',
      scope: 'platform',
      message: 'El proveedor de desembolsos todavía no está configurado operativamente.',
      action_href: null,
    })
  } else if (!payoutCertificationReady) {
    blockers.push({
      code: 'PAYOUT_CERTIFICATION_REQUIRED',
      scope: 'platform',
      message: 'El proveedor de desembolsos requiere certificación operativa vigente antes de aceptar recaudo real.',
      action_href: null,
    })
  }

  const userReady = snapshot.identityVerified && profileVerified && destinationRegistered
  const platformReady = collectionRailReady && payoutProviderReady && payoutCertificationReady

  return {
    identity: {
      state: stageState(snapshot.identityVerified, 'action_required'),
      verified: snapshot.identityVerified,
    },
    payout_profile: {
      state: profileVerified
        ? 'ready' as const
        : profile?.verification_status === 'in_review'
          ? 'pending_review' as const
          : 'action_required' as const,
      verification_status: profile?.verification_status ?? 'pending',
      payout_status: profile?.payout_status ?? 'disabled',
      requested_at: profile?.requested_at?.toISOString() ?? null,
      verified_at: profile?.verified_at?.toISOString() ?? null,
      review_notes: profile?.review_notes ?? null,
      can_request_review: snapshot.identityVerified
        && (!profile || ['pending', 'rejected'].includes(profile.verification_status)),
    },
    payout_destination: {
      state: destinationRegistered
        ? 'ready' as const
        : profileVerified && payoutProviderReady
          ? 'action_required' as const
          : payoutProviderReady
            ? 'blocked' as const
            : 'platform_blocked' as const,
      registered: destinationRegistered,
      key_type: profile?.destination_key_type ?? null,
    },
    platform: {
      ctg_one_federation: snapshot.capabilities.ctg_one_federation,
      collection_provider: snapshot.capabilities.payments,
      crowdfunding_collection: snapshot.capabilities.crowdfunding_payments,
      payout_provider: snapshot.capabilities.payouts,
      payout_execution: snapshot.capabilities.crowdfunding_payouts,
      payout_certification: snapshot.payoutCertificationStatus ?? 'pending',
    },
    blockers,
    user_ready: userReady,
    platform_ready: platformReady,
    ready_for_campaign_activation: userReady && platformReady,
  }
}

function campaignBlockers(campaign: CampaignSnapshot): ReadinessBlocker[] {
  if (campaign.status === 'draft') {
    return [{
      code: 'CAMPAIGN_REVIEW_REQUIRED',
      scope: 'campaign',
      message: 'Envía la campaña a revisión de cumplimiento.',
      action_href: `/dashboard/crowdfunding/${campaign.id}`,
    }]
  }
  if (campaign.status === 'review' && campaign.compliance_status === 'in_review') {
    return [{
      code: 'CAMPAIGN_REVIEW_PENDING',
      scope: 'campaign',
      message: 'La campaña está en revisión de cumplimiento.',
      action_href: `/dashboard/crowdfunding/${campaign.id}`,
    }]
  }
  if (campaign.compliance_status === 'rejected') {
    return [{
      code: 'CAMPAIGN_REJECTED',
      scope: 'campaign',
      message: campaign.review_notes || 'La campaña fue rechazada en revisión.',
      action_href: `/dashboard/crowdfunding/${campaign.id}`,
    }]
  }
  if (campaign.status === 'suspended' || campaign.compliance_status === 'suspended') {
    return [{
      code: 'CAMPAIGN_SUSPENDED',
      scope: 'campaign',
      message: campaign.review_notes || 'La campaña está suspendida.',
      action_href: `/dashboard/crowdfunding/${campaign.id}`,
    }]
  }
  return []
}

export function evaluateCampaignReadiness(
  campaign: CampaignSnapshot,
  funding: ReturnType<typeof evaluateFundingReadiness>,
) {
  const ownBlockers = campaignBlockers(campaign)
  const lifecycleReady = campaign.status === 'verified' && campaign.compliance_status === 'verified'
  const canActivate = lifecycleReady && funding.ready_for_campaign_activation
  const canAcceptContributions = campaign.status === 'active'
    && campaign.compliance_status === 'verified'
    && funding.ready_for_campaign_activation

  const blockers = campaign.status === 'active'
    ? funding.blockers
    : [...ownBlockers, ...(lifecycleReady ? funding.blockers : [])]

  return {
    id: campaign.id,
    title: campaign.title,
    status: campaign.status,
    compliance_status: campaign.compliance_status,
    review_notes: campaign.review_notes,
    lifecycle_ready: lifecycleReady,
    can_activate: canActivate,
    can_accept_contributions: canAcceptContributions,
    blockers,
  }
}

async function loadReadinessSnapshot(citizenId: string): Promise<FundingReadinessSnapshot> {
  const [citizenRows, profileRows, certificationRows] = await Promise.all([
    prisma.$queryRaw<Array<{ verification_level: number }>>(Prisma.sql`
      SELECT verification_level
      FROM citizens
      WHERE id = ${citizenId}::uuid AND is_active = TRUE
      LIMIT 1
    `),
    prisma.$queryRaw<PayoutProfileSnapshot[]>(Prisma.sql`
      SELECT verification_status, payout_status, destination_fingerprint, destination_key_type,
             requested_at, verified_at, review_notes
      FROM crowdfunding_payout_profiles
      WHERE citizen_id = ${citizenId}::uuid
      LIMIT 1
    `),
    prisma.$queryRaw<Array<{ status: string }>>(Prisma.sql`
      SELECT status
      FROM payout_operation_certifications
      WHERE provider = 'wompi_payouts'
      ORDER BY certified_at DESC
      LIMIT 1
    `),
  ])

  if (!citizenRows[0]) {
    throw Object.assign(new Error('Ciudadano no encontrado.'), {
      code: 'CITIZEN_NOT_FOUND',
      statusCode: 404,
    })
  }

  const capabilities = getFeatureCapabilities()
  return {
    identityVerified: citizenRows[0].verification_level >= 1,
    payoutProfile: profileRows[0] ?? null,
    capabilities: {
      ctg_one_federation: capabilities.ctg_one_federation,
      payments: capabilities.payments,
      crowdfunding_payments: capabilities.crowdfunding_payments,
      payouts: capabilities.payouts,
      crowdfunding_payouts: capabilities.crowdfunding_payouts,
    },
    payoutCertificationStatus: certificationRows[0]?.status ?? null,
  }
}

export async function getCrowdfundingReadiness(citizenId: string) {
  const [snapshot, campaigns] = await Promise.all([
    loadReadinessSnapshot(citizenId),
    prisma.$queryRaw<CampaignSnapshot[]>(Prisma.sql`
      SELECT id, title, status, compliance_status, review_notes
      FROM crowdfunding_campaigns
      WHERE creator_citizen_id = ${citizenId}::uuid
      ORDER BY updated_at DESC
      LIMIT 100
    `),
  ])
  const funding = evaluateFundingReadiness(snapshot)
  const campaignReadiness = campaigns.map((campaign) => evaluateCampaignReadiness(campaign, funding))
  return {
    generated_at: new Date().toISOString(),
    ...funding,
    campaigns: campaignReadiness,
  }
}

export async function getCampaignActivationReadiness(citizenId: string, campaignId: string) {
  const [snapshot, campaigns] = await Promise.all([
    loadReadinessSnapshot(citizenId),
    prisma.$queryRaw<CampaignSnapshot[]>(Prisma.sql`
      SELECT id, title, status, compliance_status, review_notes
      FROM crowdfunding_campaigns
      WHERE id = ${campaignId}::uuid
        AND creator_citizen_id = ${citizenId}::uuid
      LIMIT 1
    `),
  ])
  const campaign = campaigns[0]
  if (!campaign) {
    throw Object.assign(new Error('Campaña no encontrada.'), {
      code: 'CAMPAIGN_NOT_FOUND',
      statusCode: 404,
    })
  }
  const funding = evaluateFundingReadiness(snapshot)
  return {
    funding,
    campaign: evaluateCampaignReadiness(campaign, funding),
  }
}
