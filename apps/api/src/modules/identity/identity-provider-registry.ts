import { config } from '../../config'
import {
  defineSyntheticCivicIdentityProviderAdapter,
  isProductionCivicIdentityProviderAdapter,
  type CivicIdentityProviderAdapterRegistration,
  type NativeCivicIdentityProviderAdapter,
} from './identity-provider-adapter'
import { veriffIdentityProviderAdapter } from './identity-provider-veriff'

export type CivicIdentityProviderActivationState = 'ready' | 'disabled' | 'misconfigured'

type ProviderKeyRegistry = Record<string, Record<string, string>>

const PROVIDER_RE = /^[a-z0-9][a-z0-9_.-]{0,49}$/
const KEY_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/
const MIN_SECRET_LENGTH = 32

/**
 * Compile-time trust boundary.
 *
 * Production providers are executable native adapters, never names invented by
 * environment variables. P0.8 registers Veriff here, but civic authority still
 * requires explicit policy allowlisting plus runtime credential readiness.
 * `trusted_kyc` remains synthetic and test-only.
 */
const REGISTERED_ADAPTERS: readonly CivicIdentityProviderAdapterRegistration[] = [
  defineSyntheticCivicIdentityProviderAdapter('trusted_kyc'),
  veriffIdentityProviderAdapter,
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

function runtimeRegisteredAdapters(): readonly CivicIdentityProviderAdapterRegistration[] {
  if (config.NODE_ENV !== 'production') return REGISTERED_ADAPTERS
  return REGISTERED_ADAPTERS.filter(isProductionCivicIdentityProviderAdapter)
}

function registeredProviderSet(): Set<string> {
  return new Set(runtimeRegisteredAdapters().map((adapter) => adapter.provider))
}

export function getRegisteredCivicIdentityProviders(): string[] {
  return [...registeredProviderSet()]
}

/** Native adapters only; synthetic fixtures never make native ingress ready. */
export function getRegisteredNativeCivicIdentityProviders(): string[] {
  return REGISTERED_ADAPTERS
    .filter(isProductionCivicIdentityProviderAdapter)
    .map((adapter) => adapter.provider)
}

export function getRuntimeReadyNativeCivicIdentityProviders(): string[] {
  return REGISTERED_ADAPTERS
    .filter(isProductionCivicIdentityProviderAdapter)
    .filter((adapter) => adapter.isRuntimeReady())
    .map((adapter) => adapter.provider)
}

/**
 * Returns only a compiled native adapter. This is intentionally distinct from
 * policy activation: webhook authentication may be deployed before governance
 * is permitted to trust the provider.
 */
export function getNativeCivicIdentityProviderAdapter(
  providerInput: string,
): NativeCivicIdentityProviderAdapter | null {
  const provider = normalizeProvider(providerInput)
  const registration = REGISTERED_ADAPTERS.find((adapter) => adapter.provider === provider)
  if (!registration || !isProductionCivicIdentityProviderAdapter(registration)) return null
  return registration
}

/**
 * Operational provider contract.
 *
 * Native P0.7+ adapters require:
 *   policy allowlist + compiled adapter + feature-scoped runtime credentials.
 * Synthetic/legacy normalized adapters continue to require their isolated
 * internal HMAC keyset. This removes an obsolete HMAC dependency from direct
 * vendor-native ingress without weakening fail-closed activation.
 */
export function getActivatedCivicIdentityProviders(): string[] {
  let keyRegistry: ProviderKeyRegistry | null = null
  try {
    keyRegistry = parseKeyRegistry()
  } catch {
    // Invalid legacy/internal ingress configuration must not manufacture trust.
    keyRegistry = null
  }

  const registered = runtimeRegisteredAdapters()
  return config.CIVIC_IDENTITY_ASSURANCE_PROVIDERS
    .map(normalizeProvider)
    .filter((provider) => {
      const registration = registered.find((adapter) => adapter.provider === provider)
      if (!registration) return false
      if (isProductionCivicIdentityProviderAdapter(registration)) {
        return registration.isRuntimeReady()
      }
      return keyRegistry !== null && Object.keys(keyRegistry[provider] ?? {}).length > 0
    })
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

  const providerKeys = keyRegistry[provider]
  if (!providerKeys) {
    throw Object.assign(new Error('El ingress del proveedor de identity proofing no está configurado'), {
      statusCode: 503,
      code: 'PROOFING_PROVIDER_INGRESS_DISABLED',
    })
  }

  const secret = providerKeys[keyId]
  if (!secret) {
    throw Object.assign(new Error('Identificador de llave de proofing inválido'), {
      statusCode: 401,
      code: 'INVALID_PROOFING_KEY_ID',
    })
  }

  return { provider, keyId, secret }
}

/** Coarse operational state only; never exposes secrets. */
export function getCivicIdentityProviderActivationState(): CivicIdentityProviderActivationState {
  const configured = config.CIVIC_IDENTITY_ASSURANCE_PROVIDERS
  const hasInternalKeyConfig = Boolean(config.CIVIC_IDENTITY_PROOFING_ADAPTER_KEYS_JSON?.trim())

  if (configured.length === 0 && !hasInternalKeyConfig) return 'disabled'
  if (configured.length === 0) return 'misconfigured'

  const active = getActivatedCivicIdentityProviders()
  if (active.length !== configured.length) return 'misconfigured'
  return 'ready'
}

export function getCivicIdentityProofingIngressState(): CivicIdentityProviderActivationState {
  return getCivicIdentityProviderActivationState()
}
