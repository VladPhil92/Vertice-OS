import { prisma } from '../../lib/prisma'
import { getActiveCivicIdentityProof } from './identity-proofing.service'
import { getOperationalCivicIdentityProviders } from './identity-proofing-provider-config'
import { getRegisteredNativeCivicIdentityProviders } from './identity-provider-registry'
import { getActiveEvidenceCertifiedProviders } from './identity-provider-external-certification.service'

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
    provider_external_certified: boolean
  }
}

/**
 * Identity assurance is deliberately separate from authentication/federation.
 *
 * P1.0 requires four independent conditions for governance eligibility:
 * verified contact, an active proof, operational authenticated ingress, and —
 * for native providers — a durable external-canary certification backed by
 * authenticated persisted lifecycle events. Synthetic test adapters retain the
 * legacy contract and can never become production authority.
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
        provider_external_certified: false,
      },
    }
  }

  const activeProof = await getActiveCivicIdentityProof(citizenId)
  const proofActive = Boolean(activeProof)
  const nativeProviders = new Set(getRegisteredNativeCivicIdentityProviders())
  let providerExternalCertified = proofActive && activeProof
    ? !nativeProviders.has(activeProof.provider)
    : false

  if (proofActive && activeProof && nativeProviders.has(activeProof.provider)) {
    const evidenceCertifiedProviders = await getActiveEvidenceCertifiedProviders()
    providerExternalCertified = evidenceCertifiedProviders.includes(activeProof.provider)
  }

  const assured = contactVerified && proofActive && providerExternalCertified

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
      provider_external_certified: providerExternalCertified,
    },
  }
}
