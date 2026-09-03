import { prisma } from '../../lib/prisma'
import { config } from '../../config'
import { getActiveCivicIdentityProof } from './identity-proofing.service'

export interface CivicIdentityAssuranceStatus {
  citizen_id: string
  assured: boolean
  status: 'assured' | 'required'
  governance_eligible: boolean
  verification_level: number
  provider: string | null
  provider_verified_at: string | null
  provider_expires_at: string | null
  requirements: {
    contact_verified: boolean
    active_identity_proof: boolean
  }
}

/**
 * Identity assurance is deliberately separate from authentication/federation.
 *
 * P0.2: an ExternalIdentity link is no longer sufficient evidence. The
 * citizen must have contact verification plus an ACTIVE, VERIFIED proofing
 * record from a provider in CIVIC_IDENTITY_ASSURANCE_PROVIDERS. Proofs that
 * are rejected, expired, revoked or below assurance level 2 never authorize
 * civic governance.
 */
export async function getCivicIdentityAssurance(
  citizenId: string,
): Promise<CivicIdentityAssuranceStatus> {
  const citizen = await prisma.citizen.findUnique({
    where: { id: citizenId },
    select: { id: true, verificationLevel: true },
  })

  if (!citizen) {
    throw Object.assign(new Error('Ciudadano no encontrado'), {
      statusCode: 404,
      code: 'CITIZEN_NOT_FOUND',
    })
  }

  const contactVerified = citizen.verificationLevel >= 2

  if (config.CIVIC_IDENTITY_ASSURANCE_PROVIDERS.length === 0) {
    return {
      citizen_id: citizen.id,
      assured: false,
      status: 'required',
      governance_eligible: false,
      verification_level: citizen.verificationLevel,
      provider: null,
      provider_verified_at: null,
      provider_expires_at: null,
      requirements: {
        contact_verified: contactVerified,
        active_identity_proof: false,
      },
    }
  }

  const activeProof = await getActiveCivicIdentityProof(citizenId)
  const proofActive = Boolean(activeProof)
  const assured = contactVerified && proofActive

  return {
    citizen_id: citizen.id,
    assured,
    status: assured ? 'assured' : 'required',
    governance_eligible: assured,
    verification_level: citizen.verificationLevel,
    provider: activeProof?.provider ?? null,
    provider_verified_at: activeProof?.verified_at?.toISOString() ?? null,
    provider_expires_at: activeProof?.expires_at?.toISOString() ?? null,
    requirements: {
      contact_verified: contactVerified,
      active_identity_proof: proofActive,
    },
  }
}
