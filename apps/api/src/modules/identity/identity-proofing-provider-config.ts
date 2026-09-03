import { config } from '../../config'

const PROVIDER_RE = /^[a-z0-9][a-z0-9_.-]{0,49}$/
const KEY_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/
const MIN_SECRET_LENGTH = 32

type ProviderAdapterRegistry = Record<string, Record<string, string>>

function makeError(message: string, statusCode: number, code: string): Error {
  return Object.assign(new Error(message), { statusCode, code })
}

function normalizeProvider(provider: string): string {
  return provider.trim().toLowerCase()
}

function parseRegistry(): ProviderAdapterRegistry {
  const raw = config.CIVIC_IDENTITY_PROOFING_ADAPTER_KEYS_JSON?.trim() ?? ''
  if (!raw) return {}

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw makeError(
      'La configuración de llaves de identity proofing es inválida',
      503,
      'PROOFING_PROVIDER_CONFIG_INVALID',
    )
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw makeError(
      'La configuración de llaves de identity proofing es inválida',
      503,
      'PROOFING_PROVIDER_CONFIG_INVALID',
    )
  }

  const registry: ProviderAdapterRegistry = {}
  for (const [rawProvider, rawKeys] of Object.entries(parsed as Record<string, unknown>)) {
    const provider = normalizeProvider(rawProvider)
    if (!PROVIDER_RE.test(provider) || !rawKeys || typeof rawKeys !== 'object' || Array.isArray(rawKeys)) {
      throw makeError(
        'La configuración de llaves de identity proofing es inválida',
        503,
        'PROOFING_PROVIDER_CONFIG_INVALID',
      )
    }

    const providerKeys: Record<string, string> = {}
    for (const [keyId, secret] of Object.entries(rawKeys as Record<string, unknown>)) {
      if (!KEY_ID_RE.test(keyId) || typeof secret !== 'string' || secret.length < MIN_SECRET_LENGTH) {
        throw makeError(
          'La configuración de llaves de identity proofing es inválida',
          503,
          'PROOFING_PROVIDER_CONFIG_INVALID',
        )
      }
      providerKeys[keyId] = secret
    }

    if (Object.keys(providerKeys).length > 0) {
      registry[provider] = providerKeys
    }
  }

  return registry
}

/**
 * Providers are operational only when BOTH policy and ingress are configured.
 * This prevents a stale verified proof from authorizing governance while the
 * API is unable to receive that provider's future revocation/expiry events.
 * Invalid feature configuration fails closed to an empty provider set without
 * preventing the rest of the API from booting.
 */
export function getOperationalCivicIdentityProviders(): string[] {
  let registry: ProviderAdapterRegistry
  try {
    registry = parseRegistry()
  } catch {
    return []
  }

  return config.CIVIC_IDENTITY_ASSURANCE_PROVIDERS.filter((provider) =>
    Object.keys(registry[normalizeProvider(provider)] ?? {}).length > 0,
  )
}

export function resolveProofingAdapterSecret(
  providerInput: string,
  keyIdInput: string,
): { provider: string; keyId: string; secret: string } {
  const provider = normalizeProvider(providerInput)
  const keyId = keyIdInput.trim()

  if (!config.CIVIC_IDENTITY_ASSURANCE_PROVIDERS.includes(provider)) {
    throw makeError(
      'Proveedor de identity proofing no autorizado',
      403,
      'UNTRUSTED_PROOFING_PROVIDER',
    )
  }

  if (!KEY_ID_RE.test(keyId)) {
    throw makeError('Identificador de llave de proofing inválido', 401, 'INVALID_PROOFING_KEY_ID')
  }

  const registry = parseRegistry()
  const providerKeys = registry[provider]
  if (!providerKeys) {
    throw makeError(
      'El ingress del proveedor de identity proofing no está configurado',
      503,
      'PROOFING_PROVIDER_INGRESS_DISABLED',
    )
  }

  const secret = providerKeys[keyId]
  if (!secret) {
    throw makeError('Identificador de llave de proofing inválido', 401, 'INVALID_PROOFING_KEY_ID')
  }

  return { provider, keyId, secret }
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
