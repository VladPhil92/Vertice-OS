import { config } from '../config'

function unavailable(message: string, code: string): Error {
  return Object.assign(new Error(message), { statusCode: 503, code })
}

/**
 * High-impact feature secrets must never silently reuse JWT_SECRET in
 * production. Missing feature secrets degrade only the affected capability;
 * core API boot remains reserved for truly core dependencies (DB/Redis/JWT).
 */
export function getVoteNullifierSecret(): string {
  if (config.NODE_ENV === 'production' && !config.VOTE_NULLIFIER_SECRET) {
    throw unavailable(
      'La votación está temporalmente deshabilitada mientras se completa la configuración criptográfica',
      'VOTING_CRYPTO_UNAVAILABLE',
    )
  }
  return config.VOTE_NULLIFIER_SECRET ?? config.JWT_SECRET
}

export function getIdentityPepper(): string {
  if (config.NODE_ENV === 'production' && !config.IDENTITY_PEPPER) {
    throw unavailable(
      'La verificación de identidad está temporalmente deshabilitada mientras se completa la configuración criptográfica',
      'IDENTITY_CRYPTO_UNAVAILABLE',
    )
  }
  return config.IDENTITY_PEPPER ?? config.JWT_SECRET
}

export function getAIServiceSecret(): string | undefined {
  if (config.NODE_ENV === 'production' && !config.AI_SERVICE_SECRET) {
    throw unavailable(
      'El servicio de IA cívica está temporalmente no disponible por configuración incompleta',
      'AI_SERVICE_UNAVAILABLE',
    )
  }
  return config.AI_SERVICE_SECRET || undefined
}

/**
 * The DID commitment pepper has no safe fallback. A partially configured
 * CivicSBT deployment must therefore fail closed when the blockchain feature
 * is invoked, but it must not prevent unrelated civic services from booting.
 */
export function getDidCommitmentPepper(): string {
  if (!config.DID_COMMITMENT_PEPPER) {
    throw unavailable(
      'La emisión blockchain está temporalmente deshabilitada mientras se completa la configuración criptográfica',
      'BLOCKCHAIN_CRYPTO_UNAVAILABLE',
    )
  }
  return config.DID_COMMITMENT_PEPPER
}

export type CapabilityState = 'ready' | 'disabled' | 'misconfigured'

export interface FeatureCapabilities {
  civic_ai: CapabilityState
  voting_crypto: CapabilityState
  identity_crypto: CapabilityState
  civic_identity_assurance: CapabilityState
  civic_sbt: CapabilityState
  voting_registry: CapabilityState
}

function contractCapability(
  address: string | undefined,
  requiresDidPepper: boolean,
): CapabilityState {
  if (!address) return 'disabled'
  if (!config.POLYGON_RPC_URL || !config.POLYGON_PRIVATE_KEY) return 'misconfigured'
  if (requiresDidPepper && !config.DID_COMMITMENT_PEPPER) return 'misconfigured'
  return 'ready'
}

/**
 * Non-secret capability diagnostics for readiness/operations. This intentionally
 * exposes only coarse state and never secret values, provider identifiers,
 * addresses, RPC URLs, or credentials.
 */
export function getFeatureCapabilities(): FeatureCapabilities {
  return {
    civic_ai: config.AI_SERVICE_SECRET ? 'ready' : 'disabled',
    voting_crypto: config.VOTE_NULLIFIER_SECRET ? 'ready' : 'disabled',
    identity_crypto: config.IDENTITY_PEPPER ? 'ready' : 'disabled',
    civic_identity_assurance: config.CIVIC_IDENTITY_ASSURANCE_PROVIDERS.length > 0 ? 'ready' : 'disabled',
    civic_sbt: contractCapability(config.CIVIC_SBT_ADDRESS, true),
    voting_registry: contractCapability(config.VOTING_REGISTRY_ADDRESS, false),
  }
}
