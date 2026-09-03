import { config } from '../../config'

export type CivicIdentityProviderActivationState = 'ready' | 'disabled' | 'misconfigured'

interface CivicIdentityProviderAdapterRegistration {
  provider: string
  productionEligible: boolean
}

type ProviderKeyRegistry = Record<string, Record<string, string>>

const PROVIDER_RE = /^[a-z0-9][a-z0-9_.-]{0,49}$/
const KEY_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/
const MIN_SECRET_LENGTH = 32

/**
 * Compile-time trust boundary. Environment configuration may request a
 * provider but cannot create civic authority on its own. A real production
 * provider must have its native vendor verification adapter implemented and
 * audited before a productionEligible registration is added here.
 *
 * `trusted_kyc` is synthetic and can never activate in production.
 */
const REGISTERED_ADAPTERS: readonly CivicIdentityProviderAdapterRegistration[] = [
  { provider: 'trusted_kyc', productionEligible: false },
]

function normalizeProvider(provider: string): string {
  return provider.trim().toLowerCase()
}

function parseKeyRegistry(): ProviderKeyRegistry {
  const raw = config.CIVIC_IDENTITY_PROOFING_ADAPTER_KEYS_JSON?.trim() ?? ''
  if (!raw) return {}

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('PROOFING_PROVIDER_CONFIG_INVALID')
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('PROOFING_PROVIDER_CONFIG_INVALID')
  }

  const registry: ProviderKeyRegistry = {}
  for (const [rawProvider, rawKeys] of Object.entries(parsed as Record<string, unknown>)) {
    const provider = normalizeProvider(rawProvider)
    if (!PROVIDER_RE.test(provider) || !rawKeys || typeof rawKeys !== 'object' || Array.isArray(rawKeys)) {
      throw new Error('PROOFING_PROVIDER_CONFIG_INVALID')
    }

    const keys: Record<string, string> = {}
    for (const [keyId, secret] of Object.entries(rawKeys as Record<string, unknown>)) {
      if (!KEY_ID_RE.test(keyId) || typeof secret !== 'string' || secret.length < MIN_SECRET_LENGTH) {
        throw new Error('PROOFING_PROVIDER_CONFIG_INVALID')
      }
      keys[keyId] = secret
    }

    if (Object.keys(keys).length > 0) registry[provider] = keys
  }

  return registry
}

function registeredProviderSet(): Set<string> {
  return new Set(
    REGISTERED_ADAPTERS
      .filter((adapter) => config.NODE_ENV !== 'production' || adapter.productionEligible)
      .map((adapter) => adapter.provider),
  )
}

export function getRegisteredCivicIdentityProviders(): string[] {
  return [...registeredProviderSet()]
}

/**
 * A provider is operational only when policy, compiled adapter and at least one
 * provider-scoped ingress key all exist. This also prevents stale verified
 * proofs from authorizing governance while revocation ingress is unavailable.
 */
export function getActivatedCivicIdentityProviders(): string[] {
  let keyRegistry: ProviderKeyRegistry
  try {
    keyRegistry = parseKeyRegistry()
  } catch {
    return []
  }

  const registered = registeredProviderSet()
  return config.CIVIC_IDENTITY_ASSURANCE_PROVIDERS
    .map(normalizeProvider)
    .filter((provider) =>
      registered.has(provider) && Object.keys(keyRegistry[provider] ?? {}).length > 0,
    )
}

export function isActivatedCivicIdentityProvider(provider: string): boolean {
  return getActivatedCivicIdentityProviders().includes(normalizeProvider(provider))
}

export function resolveProofingAdapterSecret(
  providerInput: string,
  keyIdInput: string | undefined,
): { provider: string; keyId: string; secret: string } {
  const provider = normalizeProvider(providerInput)
  const keyId = keyIdInput?.trim() ?? ''

  if (!config.CIVIC_IDENTITY_ASSURANCE_PROVIDERS.includes(provider)) {
    throw Object.assign(new Error('Proveedor de identity proofing no autorizado'), {
      statusCode: 403,
      code: 'UNTRUSTED_PROOFING_PROVIDER',
    })
  }

  if (!registeredProviderSet().has(provider)) {
    throw Object.assign(new Error('El adaptador de identity proofing no está habilitado'), {
      statusCode: 503,
      code: 'PROOFING_PROVIDER_ADAPTER_UNAVAILABLE',
    })
  }

  if (!KEY_ID_RE.test(keyId)) {
    throw Object.assign(new Error('Identificador de llave de proofing inválido'), {
      statusCode: 401,
      code: 'INVALID_PROOFING_KEY_ID',
    })
  }

  let keyRegistry: ProviderKeyRegistry
  try {
    keyRegistry = parseKeyRegistry()
  } catch {
    throw Object.assign(new Error('La configuración de identity proofing es inválida'), {
      statusCode: 503,
      code: 'PROOFING_PROVIDER_CONFIG_INVALID',
    })
  }

  const secret = keyRegistry[provider]?.[keyId]
  if (!secret) {
    throw Object.assign(new Error('Identificador de llave de proofing inválido'), {
      statusCode: 401,
      code: 'INVALID_PROOFING_KEY_ID',
    })
  }

  return { provider, keyId, secret }
}

/** Coarse operational state only; never exposes provider identifiers or keys. */
export function getCivicIdentityProviderActivationState(): CivicIdentityProviderActivationState {
  const configured = config.CIVIC_IDENTITY_ASSURANCE_PROVIDERS
  const hasKeyConfig = Boolean(config.CIVIC_IDENTITY_PROOFING_ADAPTER_KEYS_JSON?.trim())

  if (configured.length === 0 && !hasKeyConfig) return 'disabled'
  if (configured.length === 0) return 'misconfigured'

  const active = getActivatedCivicIdentityProviders()
  if (active.length !== configured.length) return 'misconfigured'
  return 'ready'
}

export function getCivicIdentityProofingIngressState(): CivicIdentityProviderActivationState {
  return getCivicIdentityProviderActivationState()
}
