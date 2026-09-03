import { prisma } from '../../lib/prisma'
import { getActiveCivicIdentityProof } from './identity-proofing.service'
import { getOperationalCivicIdentityProviders } from './identity-proofing-provider-config'

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
    provider_ingress_operational: boolean
    active_identity_proof: boolean
  }
}

/**
 * Identity assurance is deliberately separate from authentication/federation.
 *
 * P0.4 requires three independent conditions for governance eligibility:
 * verified contact, an active proof, and a trusted provider whose authenticated
 * ingress is operational. This last condition is a revocation-safety interlock:
 * a previously verified proof cannot keep authorizing governance if VÉRTICE can
 * no longer authenticate that provider's future revocation/expiry events.
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
  const operationalProviders = getOperationalCivicIdentityProviders()
  const providerIngressOperational = operationalProviders.length > 0

  if (!providerIngressOperational) {
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
        provider_ingress_operational: false,
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
      provider_ingress_operational: true,
      active_identity_proof: proofActive,
    },
  }
}
