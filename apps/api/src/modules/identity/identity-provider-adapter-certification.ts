import type { CivicProofingEventInput } from './identity.schema'
import type {
  NativeCivicIdentityProviderAdapter,
  NativeProviderWebhookRequest,
} from './identity-provider-adapter'

export interface NativeProviderAdapterCertificationVectors {
  valid_request: NativeProviderWebhookRequest
  tampered_request: NativeProviderWebhookRequest
  unsigned_request: NativeProviderWebhookRequest
  stale_request: NativeProviderWebhookRequest
  expected_event: CivicProofingEventInput
}

export interface NativeProviderAdapterCertificationReport {
  provider: string
  contract_version: 1
  checks: {
    valid_signature_and_normalization: true
    tamper_rejected: true
    unsigned_rejected: true
    stale_rejected: true
    replay_rejected: true
  }
}

function errorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object' || !('code' in error)) return undefined
  const code = (error as { code?: unknown }).code
  return typeof code === 'string' ? code : undefined
}

async function rejects(
  adapter: NativeCivicIdentityProviderAdapter,
  request: NativeProviderWebhookRequest,
): Promise<boolean> {
  try {
    await adapter.verifyAndNormalize(request)
    return false
  } catch {
    return true
  }
}

async function rejectsWithCode(
  adapter: NativeCivicIdentityProviderAdapter,
  request: NativeProviderWebhookRequest,
  code: string,
): Promise<boolean> {
  try {
    await adapter.verifyAndNormalize(request)
    return false
  } catch (error) {
    return errorCode(error) === code
  }
}

function sameNormalizedEvent(
  actual: CivicProofingEventInput,
  expected: CivicProofingEventInput,
): boolean {
  return actual.provider === expected.provider
    && actual.event_id === expected.event_id
    && actual.citizen_id === expected.citizen_id
    && actual.provider_reference === expected.provider_reference
    && actual.status === expected.status
    && actual.assurance_level === expected.assurance_level
    && (actual.evidence_hash ?? null) === (expected.evidence_hash ?? null)
    && actual.occurred_at === expected.occurred_at
    && (actual.expires_at ?? null) === (expected.expires_at ?? null)
}

/**
 * Reusable certification harness for every future production KYC adapter.
 *
 * A provider-specific adapter is not considered certifiable unless a valid
 * native webhook is accepted and normalized exactly, while tampered, unsigned,
 * stale and replayed deliveries are rejected. Provider-specific test suites
 * should execute this helper with vendor fixture vectors before registration.
 */
export async function certifyNativeCivicIdentityProviderAdapter(
  adapter: NativeCivicIdentityProviderAdapter,
  vectors: NativeProviderAdapterCertificationVectors,
): Promise<NativeProviderAdapterCertificationReport> {
  const valid = await adapter.verifyAndNormalize(vectors.valid_request)
  if (!sameNormalizedEvent(valid, vectors.expected_event)) {
    throw new Error('NATIVE_ADAPTER_CERTIFICATION_VALID_VECTOR_FAILED')
  }

  if (!await rejects(adapter, vectors.tampered_request)) {
    throw new Error('NATIVE_ADAPTER_CERTIFICATION_TAMPER_FAILED')
  }
  if (!await rejects(adapter, vectors.unsigned_request)) {
    throw new Error('NATIVE_ADAPTER_CERTIFICATION_UNSIGNED_FAILED')
  }
  if (!await rejectsWithCode(adapter, vectors.stale_request, 'STALE_NATIVE_WEBHOOK')) {
    throw new Error('NATIVE_ADAPTER_CERTIFICATION_STALE_FAILED')
  }
  if (!await rejectsWithCode(adapter, vectors.valid_request, 'REPLAYED_NATIVE_WEBHOOK')) {
    throw new Error('NATIVE_ADAPTER_CERTIFICATION_REPLAY_FAILED')
  }

  return {
    provider: adapter.provider,
    contract_version: 1,
    checks: {
      valid_signature_and_normalization: true,
      tamper_rejected: true,
      unsigned_rejected: true,
      stale_rejected: true,
      replay_rejected: true,
    },
  }
}
