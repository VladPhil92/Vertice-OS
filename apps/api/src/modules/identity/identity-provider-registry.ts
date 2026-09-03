import { config } from '../../config'

export type CivicIdentityProviderActivationState = 'ready' | 'disabled' | 'misconfigured'

interface CivicIdentityProviderAdapterRegistration {
  provider: string
  productionEligible: boolean
}

/**
 * Compile-time registry for civic identity proofing adapters.
 *
 * Environment variables may request a provider, but they cannot make an
 * arbitrary provider authoritative. A production provider only becomes
 * eligible after its native webhook/signature adapter is implemented, audited
 * and explicitly registered here with productionEligible=true.
 *
 * `trusted_kyc` exists exclusively so the test suite can exercise the complete
 * proof-ledger/governance path without pretending a real vendor is deployed.
 */
const REGISTERED_ADAPTERS: readonly CivicIdentityProviderAdapterRegistration[] = [
  ...(config.NODE_ENV === 'test'
    ? [{ provider: 'trusted_kyc', productionEligible: false } as const]
    : []),
]

function normalizeProvider(provider: string): string {
  return provider.trim().toLowerCase()
}

export function getRegisteredCivicIdentityProviders(): string[] {
  return REGISTERED_ADAPTERS
    .filter((adapter) => config.NODE_ENV !== 'production' || adapter.productionEligible)
    .map((adapter) => adapter.provider)
}

export function getActivatedCivicIdentityProviders(): string[] {
  const registered = new Set(getRegisteredCivicIdentityProviders())
  return config.CIVIC_IDENTITY_ASSURANCE_PROVIDERS
    .map(normalizeProvider)
    .filter((provider) => registered.has(provider))
}

export function isActivatedCivicIdentityProvider(provider: string): boolean {
  const normalized = normalizeProvider(provider)
  return getActivatedCivicIdentityProviders().includes(normalized)
}

/**
 * Coarse operational state only; never exposes provider identifiers.
 */
export function getCivicIdentityProviderActivationState(): CivicIdentityProviderActivationState {
  const configured = config.CIVIC_IDENTITY_ASSURANCE_PROVIDERS
  if (configured.length === 0) return 'disabled'

  const active = getActivatedCivicIdentityProviders()
  if (active.length !== configured.length) return 'misconfigured'

  return active.length > 0 ? 'ready' : 'misconfigured'
}

/**
 * The normalized HMAC ingress is useful only when at least one compiled
 * provider adapter is active and its independent adapter→API secret exists.
 */
export function getCivicIdentityProofingIngressState(): CivicIdentityProviderActivationState {
  const providerState = getCivicIdentityProviderActivationState()
  const hasIngressSecret = Boolean(config.CIVIC_IDENTITY_PROOFING_EVENT_SECRET)

  if (providerState === 'disabled' && !hasIngressSecret) return 'disabled'
  if (providerState !== 'ready' || !hasIngressSecret) return 'misconfigured'
  return 'ready'
}
