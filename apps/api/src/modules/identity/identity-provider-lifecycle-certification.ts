import type { CivicProofingEventInput } from './identity.schema'
import type {
  NativeCivicIdentityProviderAdapter,
  NativeProviderWebhookRequest,
} from './identity-provider-adapter'

export interface NativeProviderLifecycleCanaryVector {
  request: NativeProviderWebhookRequest
  expected_event: CivicProofingEventInput
}

export interface NativeProviderLifecycleCanaryVectors {
  verified: NativeProviderLifecycleCanaryVector
  revoked: NativeProviderLifecycleCanaryVector
  expired: NativeProviderLifecycleCanaryVector
}

export interface NativeProviderLifecycleCanaryReport {
  provider: string
  contract_version: 1
  subject_binding: true
  lifecycle: {
    verified: true
    revoked: true
    expired: true
    monotonic_event_time: true
  }
}

function sameEvent(actual: CivicProofingEventInput, expected: CivicProofingEventInput): boolean {
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

function eventTime(event: CivicProofingEventInput): number {
  const value = new Date(event.occurred_at).getTime()
  if (Number.isNaN(value)) throw new Error('NATIVE_PROVIDER_CANARY_INVALID_EVENT_TIME')
  return value
}

function assertExpectedStatus(
  vector: NativeProviderLifecycleCanaryVector,
  expectedStatus: 'verified' | 'revoked' | 'expired',
): void {
  if (vector.expected_event.status !== expectedStatus) {
    throw new Error(`NATIVE_PROVIDER_CANARY_EXPECTED_${expectedStatus.toUpperCase()}_VECTOR`)
  }
}

/**
 * Production lifecycle canary required after cryptographic adapter certification.
 *
 * It proves that vendor-native events preserve one subject binding through the
 * critical lifecycle transitions consumed by VÉRTICE. The canary deliberately
 * operates on provider fixture/sandbox deliveries and never on synthetic policy
 * flags. A production onboarding PR should run this contract with official
 * provider vectors before registering the adapter.
 */
export async function certifyNativeProviderLifecycleCanary(
  adapter: NativeCivicIdentityProviderAdapter,
  vectors: NativeProviderLifecycleCanaryVectors,
): Promise<NativeProviderLifecycleCanaryReport> {
  assertExpectedStatus(vectors.verified, 'verified')
  assertExpectedStatus(vectors.revoked, 'revoked')
  assertExpectedStatus(vectors.expired, 'expired')

  const verified = await adapter.verifyAndNormalize(vectors.verified.request)
  const revoked = await adapter.verifyAndNormalize(vectors.revoked.request)
  const expired = await adapter.verifyAndNormalize(vectors.expired.request)

  if (!sameEvent(verified, vectors.verified.expected_event)) {
    throw new Error('NATIVE_PROVIDER_CANARY_VERIFIED_VECTOR_FAILED')
  }
  if (!sameEvent(revoked, vectors.revoked.expected_event)) {
    throw new Error('NATIVE_PROVIDER_CANARY_REVOKED_VECTOR_FAILED')
  }
  if (!sameEvent(expired, vectors.expired.expected_event)) {
    throw new Error('NATIVE_PROVIDER_CANARY_EXPIRED_VECTOR_FAILED')
  }

  const sameSubject = [revoked, expired].every((event) =>
    event.provider === verified.provider
      && event.citizen_id === verified.citizen_id
      && event.provider_reference === verified.provider_reference,
  )
  if (!sameSubject) throw new Error('NATIVE_PROVIDER_CANARY_SUBJECT_BINDING_FAILED')

  if (verified.assurance_level < 2) {
    throw new Error('NATIVE_PROVIDER_CANARY_INSUFFICIENT_ASSURANCE')
  }

  const verifiedAt = eventTime(verified)
  const revokedAt = eventTime(revoked)
  const expiredAt = eventTime(expired)
  if (!(verifiedAt <= revokedAt && revokedAt <= expiredAt)) {
    throw new Error('NATIVE_PROVIDER_CANARY_NON_MONOTONIC_LIFECYCLE')
  }

  return {
    provider: adapter.provider,
    contract_version: 1,
    subject_binding: true,
    lifecycle: {
      verified: true,
      revoked: true,
      expired: true,
      monotonic_event_time: true,
    },
  }
}
