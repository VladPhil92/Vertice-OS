import { CivicProofingEventSchema, type CivicProofingEventInput } from './identity.schema'

export type NativeProviderWebhookHeaders = Readonly<Record<string, string | string[] | undefined>>

export interface NativeProviderWebhookRequest {
  /** Exact bytes received from the provider. Never parse or re-serialize before verification. */
  raw_body: Buffer
  headers: NativeProviderWebhookHeaders
  received_at: Date
}

export interface VerifiedNativeProviderWebhook {
  /** Stable provider event id and replay-protection key. */
  event_id: string
  /** Timestamp authenticated by the provider-native verifier. */
  signed_at: Date
}

export interface VerifiedNativeProviderDelivery {
  event: CivicProofingEventInput
  receipt: VerifiedNativeProviderWebhook
}

export interface NativeProviderReplayClaim {
  provider: string
  event_id: string
  ttl_seconds: number
}

export interface NativeCivicIdentityProviderAdapterDefinition {
  provider: string
  verify_native_webhook: (
    request: NativeProviderWebhookRequest,
  ) => Promise<VerifiedNativeProviderWebhook>
  /** Return true only for the first atomic claim of provider + event_id. */
  claim_replay: (claim: NativeProviderReplayClaim) => Promise<boolean>
  normalize: (
    request: NativeProviderWebhookRequest,
    verified: VerifiedNativeProviderWebhook,
  ) => Promise<unknown>
  max_webhook_skew_ms?: number
  replay_ttl_seconds?: number
}

export interface SyntheticCivicIdentityProviderAdapterRegistration {
  provider: string
  kind: 'synthetic'
}

const NATIVE_ADAPTER_MARK: unique symbol = Symbol('vertice.native-provider-adapter.v1')

export interface NativeCivicIdentityProviderAdapter {
  provider: string
  kind: 'native'
  certification_contract_version: 1
  verifyAndNormalize: (
    request: NativeProviderWebhookRequest,
  ) => Promise<CivicProofingEventInput>
  /**
   * Production ingress variant. It preserves the provider-authenticated event id
   * and signed timestamp so persistence can retain native cryptographic
   * provenance without storing the signature or raw vendor payload.
   */
  verifyAndNormalizeWithReceipt: (
    request: NativeProviderWebhookRequest,
  ) => Promise<VerifiedNativeProviderDelivery>
  readonly [NATIVE_ADAPTER_MARK]: true
}

export type CivicIdentityProviderAdapterRegistration =
  | SyntheticCivicIdentityProviderAdapterRegistration
  | NativeCivicIdentityProviderAdapter

const PROVIDER_RE = /^[a-z0-9][a-z0-9_.-]{0,49}$/
const EVENT_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,190}$/
const DEFAULT_MAX_WEBHOOK_SKEW_MS = 5 * 60 * 1000
const MAX_RAW_WEBHOOK_BYTES = 1024 * 1024

function makeError(message: string, statusCode: number, code: string): Error {
  return Object.assign(new Error(message), { statusCode, code })
}

function normalizeProvider(provider: string): string {
  return provider.trim().toLowerCase()
}

function assertProvider(providerInput: string): string {
  const provider = normalizeProvider(providerInput)
  if (!PROVIDER_RE.test(provider)) throw new Error('INVALID_NATIVE_PROVIDER_ID')
  return provider
}

export function defineSyntheticCivicIdentityProviderAdapter(
  providerInput: string,
): SyntheticCivicIdentityProviderAdapterRegistration {
  return Object.freeze({ provider: assertProvider(providerInput), kind: 'synthetic' as const })
}

/**
 * Production authority cannot be granted by metadata alone. A native adapter
 * must provide executable vendor verification, atomic replay protection and
 * normalization hooks. This wrapper then enforces raw-body preservation,
 * freshness, event-id binding and the normalized VÉRTICE schema.
 */
export function defineNativeCivicIdentityProviderAdapter(
  definition: NativeCivicIdentityProviderAdapterDefinition,
): NativeCivicIdentityProviderAdapter {
  const provider = assertProvider(definition.provider)
  const maxSkewMs = definition.max_webhook_skew_ms ?? DEFAULT_MAX_WEBHOOK_SKEW_MS
  const replayTtlSeconds = definition.replay_ttl_seconds ?? Math.ceil(maxSkewMs / 1000) + 60

  if (!Number.isFinite(maxSkewMs) || maxSkewMs <= 0) {
    throw new Error('INVALID_NATIVE_WEBHOOK_SKEW')
  }
  if (!Number.isInteger(replayTtlSeconds) || replayTtlSeconds < Math.ceil(maxSkewMs / 1000)) {
    throw new Error('INVALID_NATIVE_REPLAY_TTL')
  }

  async function verifyAndNormalizeWithReceipt(
    request: NativeProviderWebhookRequest,
  ): Promise<VerifiedNativeProviderDelivery> {
    if (!Buffer.isBuffer(request.raw_body)
      || request.raw_body.length === 0
      || request.raw_body.length > MAX_RAW_WEBHOOK_BYTES) {
      throw makeError('Payload nativo de identity proofing inválido', 400, 'INVALID_NATIVE_WEBHOOK_BODY')
    }
    if (!(request.received_at instanceof Date) || Number.isNaN(request.received_at.valueOf())) {
      throw makeError('Timestamp de recepción nativo inválido', 400, 'INVALID_NATIVE_WEBHOOK_RECEIVED_AT')
    }

    const verified = await definition.verify_native_webhook(request)
    if (!EVENT_ID_RE.test(verified.event_id)) {
      throw makeError('Event id nativo inválido', 401, 'INVALID_NATIVE_WEBHOOK_EVENT_ID')
    }
    if (!(verified.signed_at instanceof Date) || Number.isNaN(verified.signed_at.valueOf())) {
      throw makeError('Timestamp nativo firmado inválido', 401, 'INVALID_NATIVE_WEBHOOK_SIGNED_AT')
    }
    if (Math.abs(request.received_at.getTime() - verified.signed_at.getTime()) > maxSkewMs) {
      throw makeError('Webhook nativo fuera de la ventana permitida', 401, 'STALE_NATIVE_WEBHOOK')
    }

    const claimed = await definition.claim_replay({
      provider,
      event_id: verified.event_id,
      ttl_seconds: replayTtlSeconds,
    })
    if (!claimed) {
      throw makeError('Webhook nativo repetido', 409, 'REPLAYED_NATIVE_WEBHOOK')
    }

    const parsed = CivicProofingEventSchema.safeParse(
      await definition.normalize(request, verified),
    )
    if (!parsed.success) {
      throw makeError(
        'El proveedor produjo un evento normalizado inválido',
        502,
        'INVALID_NATIVE_WEBHOOK_NORMALIZATION',
      )
    }

    const normalizedProvider = normalizeProvider(parsed.data.provider)
    if (normalizedProvider !== provider) {
      throw makeError(
        'El proveedor normalizado no coincide con el adaptador certificado',
        502,
        'NATIVE_WEBHOOK_PROVIDER_MISMATCH',
      )
    }
    if (parsed.data.event_id !== verified.event_id) {
      throw makeError(
        'El event id normalizado no coincide con el evento nativo autenticado',
        502,
        'NATIVE_WEBHOOK_EVENT_ID_MISMATCH',
      )
    }

    return {
      event: { ...parsed.data, provider },
      receipt: verified,
    }
  }

  const adapter: NativeCivicIdentityProviderAdapter = {
    provider,
    kind: 'native',
    certification_contract_version: 1,
    [NATIVE_ADAPTER_MARK]: true,
    async verifyAndNormalize(request): Promise<CivicProofingEventInput> {
      const delivery = await verifyAndNormalizeWithReceipt(request)
      return delivery.event
    },
    verifyAndNormalizeWithReceipt,
  }

  return Object.freeze(adapter)
}

export function isProductionCivicIdentityProviderAdapter(
  registration: CivicIdentityProviderAdapterRegistration,
): registration is NativeCivicIdentityProviderAdapter {
  return registration.kind === 'native'
}
