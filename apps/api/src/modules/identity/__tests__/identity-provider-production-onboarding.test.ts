import {
  defineNativeCivicIdentityProviderAdapter,
  type NativeProviderWebhookRequest,
  type VerifiedNativeProviderWebhook,
} from '../identity-provider-adapter'
import { certifyNativeProviderLifecycleCanary } from '../identity-provider-lifecycle-certification'
import {
  buildNativeProviderReplayKey,
  claimNativeProviderReplayWithStore,
} from '../identity-provider-replay'

const PROVIDER = 'fixture_native'
const CITIZEN_ID = '00000000-0000-4000-8000-000000000001'
const EVIDENCE_HASH = 'b'.repeat(64)

function requestFor(
  eventId: string,
  status: 'verified' | 'revoked' | 'expired',
  occurredAt: string,
  providerReference = 'fixture-subject-42',
): NativeProviderWebhookRequest {
  return {
    raw_body: Buffer.from(JSON.stringify({
      citizen_id: CITIZEN_ID,
      provider_reference: providerReference,
      status,
      assurance_level: 2,
      evidence_hash: EVIDENCE_HASH,
      occurred_at: occurredAt,
      expires_at: status === 'verified' ? '2026-09-10T12:00:00.000Z' : null,
    })),
    headers: {
      'x-fixture-event-id': eventId,
      'x-fixture-signed-at': occurredAt,
    },
    received_at: new Date(occurredAt),
  }
}

function createLifecycleAdapter() {
  const claims = new Set<string>()
  return defineNativeCivicIdentityProviderAdapter({
    provider: PROVIDER,
    async verify_native_webhook(request): Promise<VerifiedNativeProviderWebhook> {
      const eventId = request.headers['x-fixture-event-id']
      const signedAt = request.headers['x-fixture-signed-at']
      if (typeof eventId !== 'string' || typeof signedAt !== 'string') {
        throw Object.assign(new Error('INVALID_FIXTURE_SIGNATURE'), {
          statusCode: 401,
          code: 'INVALID_FIXTURE_SIGNATURE',
        })
      }
      return { event_id: eventId, signed_at: new Date(signedAt) }
    },
    async claim_replay({ provider, event_id }) {
      const key = `${provider}:${event_id}`
      if (claims.has(key)) return false
      claims.add(key)
      return true
    },
    async normalize(request, verified) {
      const payload = JSON.parse(request.raw_body.toString('utf8')) as {
        citizen_id: string
        provider_reference: string
        status: 'verified' | 'revoked' | 'expired'
        assurance_level: number
        evidence_hash: string
        occurred_at: string
        expires_at: string | null
      }
      return {
        provider: PROVIDER,
        event_id: verified.event_id,
        ...payload,
      }
    },
  })
}

function expectedEvent(
  eventId: string,
  status: 'verified' | 'revoked' | 'expired',
  occurredAt: string,
  providerReference = 'fixture-subject-42',
) {
  return {
    provider: PROVIDER,
    event_id: eventId,
    citizen_id: CITIZEN_ID,
    provider_reference: providerReference,
    status,
    assurance_level: 2,
    evidence_hash: EVIDENCE_HASH,
    occurred_at: occurredAt,
    expires_at: status === 'verified' ? '2026-09-10T12:00:00.000Z' : null,
  } as const
}

describe('P0.6 production identity provider onboarding boundary', () => {
  it('uses a deterministic hashed Redis key without exposing the native event id', () => {
    const claim = { provider: PROVIDER, event_id: 'vendor-event-sensitive-42', ttl_seconds: 360 }
    const key = buildNativeProviderReplayKey(claim)

    expect(key).toMatch(/^identity:native-replay:v1:fixture_native:[0-9a-f]{64}$/)
    expect(key).not.toContain(claim.event_id)
    expect(buildNativeProviderReplayKey(claim)).toBe(key)
  })

  it('models Redis SET NX EX as an atomic first-writer replay claim', async () => {
    const keys = new Set<string>()
    const setNxEx = jest.fn(async (key: string, _value: string, _ttlSeconds: number) => {
      if (keys.has(key)) return null
      keys.add(key)
      return 'OK' as const
    })
    const claim = { provider: PROVIDER, event_id: 'evt-redis-replay', ttl_seconds: 360 }

    await expect(claimNativeProviderReplayWithStore(claim, setNxEx)).resolves.toBe(true)
    await expect(claimNativeProviderReplayWithStore(claim, setNxEx)).resolves.toBe(false)
    expect(setNxEx).toHaveBeenCalledTimes(2)
  })

  it('fails closed when the distributed replay store is unavailable', async () => {
    const failure = new Error('redis unavailable')
    await expect(claimNativeProviderReplayWithStore(
      { provider: PROVIDER, event_id: 'evt-redis-down', ttl_seconds: 360 },
      async () => { throw failure },
    )).rejects.toBe(failure)
  })

  it('certifies verified, revoked and expired events with stable subject binding', async () => {
    const adapter = createLifecycleAdapter()
    const verifiedAt = '2026-09-03T12:00:00.000Z'
    const revokedAt = '2026-09-03T12:01:00.000Z'
    const expiredAt = '2026-09-03T12:02:00.000Z'

    const report = await certifyNativeProviderLifecycleCanary(adapter, {
      verified: {
        request: requestFor('evt-canary-verified', 'verified', verifiedAt),
        expected_event: expectedEvent('evt-canary-verified', 'verified', verifiedAt),
      },
      revoked: {
        request: requestFor('evt-canary-revoked', 'revoked', revokedAt),
        expected_event: expectedEvent('evt-canary-revoked', 'revoked', revokedAt),
      },
      expired: {
        request: requestFor('evt-canary-expired', 'expired', expiredAt),
        expected_event: expectedEvent('evt-canary-expired', 'expired', expiredAt),
      },
    })

    expect(report).toEqual({
      provider: PROVIDER,
      contract_version: 1,
      subject_binding: true,
      lifecycle: {
        verified: true,
        revoked: true,
        expired: true,
        monotonic_event_time: true,
      },
    })
  })

  it('rejects lifecycle canaries that switch provider subject mid-stream', async () => {
    const adapter = createLifecycleAdapter()
    const verifiedAt = '2026-09-03T12:00:00.000Z'
    const revokedAt = '2026-09-03T12:01:00.000Z'
    const expiredAt = '2026-09-03T12:02:00.000Z'

    await expect(certifyNativeProviderLifecycleCanary(adapter, {
      verified: {
        request: requestFor('evt-subject-v', 'verified', verifiedAt),
        expected_event: expectedEvent('evt-subject-v', 'verified', verifiedAt),
      },
      revoked: {
        request: requestFor('evt-subject-r', 'revoked', revokedAt, 'other-subject'),
        expected_event: expectedEvent('evt-subject-r', 'revoked', revokedAt, 'other-subject'),
      },
      expired: {
        request: requestFor('evt-subject-e', 'expired', expiredAt),
        expected_event: expectedEvent('evt-subject-e', 'expired', expiredAt),
      },
    })).rejects.toThrow('NATIVE_PROVIDER_CANARY_SUBJECT_BINDING_FAILED')
  })

  it('rejects non-monotonic lifecycle evidence', async () => {
    const adapter = createLifecycleAdapter()
    const verifiedAt = '2026-09-03T12:02:00.000Z'
    const revokedAt = '2026-09-03T12:01:00.000Z'
    const expiredAt = '2026-09-03T12:03:00.000Z'

    await expect(certifyNativeProviderLifecycleCanary(adapter, {
      verified: {
        request: requestFor('evt-time-v', 'verified', verifiedAt),
        expected_event: expectedEvent('evt-time-v', 'verified', verifiedAt),
      },
      revoked: {
        request: requestFor('evt-time-r', 'revoked', revokedAt),
        expected_event: expectedEvent('evt-time-r', 'revoked', revokedAt),
      },
      expired: {
        request: requestFor('evt-time-e', 'expired', expiredAt),
        expected_event: expectedEvent('evt-time-e', 'expired', expiredAt),
      },
    })).rejects.toThrow('NATIVE_PROVIDER_CANARY_NON_MONOTONIC_LIFECYCLE')
  })
})
