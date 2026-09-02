import { prisma } from '../../lib/prisma'
import { config } from '../../config'

export interface CivicIdentityAssuranceStatus {
  citizen_id: string
  assured: boolean
  status: 'assured' | 'required'
  governance_eligible: boolean
  verification_level: number
  provider: string | null
  provider_linked_at: string | null
  requirements: {
    contact_verified: boolean
    trusted_identity_provider_linked: boolean
  }
}

/**
 * Identity assurance is deliberately separate from authentication/federation.
 *
 * An ExternalIdentity only becomes evidence for civic governance when its
 * provider is present in CIVIC_IDENTITY_ASSURANCE_PROVIDERS. That prevents a
 * generic SSO link (for example `ctgone`) from silently being promoted to KYC.
 * Empty allowlist = fail-closed.
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

  const providers = config.CIVIC_IDENTITY_ASSURANCE_PROVIDERS
  const contactVerified = citizen.verificationLevel >= 2

  if (providers.length === 0) {
    return {
      citizen_id: citizen.id,
      assured: false,
      status: 'required',
      governance_eligible: false,
      verification_level: citizen.verificationLevel,
      provider: null,
      provider_linked_at: null,
      requirements: {
        contact_verified: contactVerified,
        trusted_identity_provider_linked: false,
      },
    }
  }

  const trustedIdentity = await prisma.externalIdentity.findFirst({
    where: {
      citizenId,
      provider: { in: providers },
    },
    select: {
      provider: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  const trustedProviderLinked = Boolean(trustedIdentity)
  const assured = contactVerified && trustedProviderLinked

  return {
    citizen_id: citizen.id,
    assured,
    status: assured ? 'assured' : 'required',
    governance_eligible: assured,
    verification_level: citizen.verificationLevel,
    provider: trustedIdentity?.provider ?? null,
    // This is the time VÉRTICE linked the provider identity, not a claim about
    // when the provider performed its own verification.
    provider_linked_at: trustedIdentity?.createdAt.toISOString() ?? null,
    requirements: {
      contact_verified: contactVerified,
      trusted_identity_provider_linked: trustedProviderLinked,
    },
  }
}
