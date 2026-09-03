import { config } from '../../config'
import {
  getActivatedCivicIdentityProviders,
  resolveProofingAdapterSecret as resolveActivatedProofingAdapterSecret,
} from './identity-provider-registry'

/**
 * Compatibility facade for the P0.3 proofing configuration contract.
 *
 * P0.4 moves authority decisions into the compile-time provider registry. Any
 * caller still using the older "operational provider" API therefore inherits
 * the same policy + audited-adapter + provider-key activation boundary instead
 * of maintaining a second, weaker source of truth.
 */
export function getOperationalCivicIdentityProviders(): string[] {
  return getActivatedCivicIdentityProviders()
}

export function resolveProofingAdapterSecret(
  providerInput: string,
  keyIdInput: string,
): { provider: string; keyId: string; secret: string } {
  return resolveActivatedProofingAdapterSecret(providerInput, keyIdInput)
}

export function getProofingProviderReadiness(): {
  trusted_providers: number
  operational_providers: number
  fully_operational: boolean
} {
  const trusted = config.CIVIC_IDENTITY_ASSURANCE_PROVIDERS.length
  const operational = getOperationalCivicIdentityProviders().length
  return {
    trusted_providers: trusted,
    operational_providers: operational,
    fully_operational: trusted > 0 && trusted === operational,
  }
}
