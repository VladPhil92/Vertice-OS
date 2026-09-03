import { createHmac } from 'crypto'
import {
  defineNativeCivicIdentityProviderAdapter,
  defineSyntheticCivicIdentityProviderAdapter,
  isProductionCivicIdentityProviderAdapter,
  type NativeProviderWebhookRequest,
  type VerifiedNativeProviderWebhook,
} from '../identity-provider-adapter'
import { certifyNativeCivicIdentityProviderAdapter } from '../identity-provider-adapter-certification'

const SECRET = 'fixture-native-provider-secret-with-32-characters!!'
const NOW = new Date('2026-09-03T12:00:00.000Z')
const CITIZEN_ID = '00000000-0000-4000-8000-000000000001'
const EVIDENCE_HASH = 'a'.repeat(64)

type FixturePayload = {
  citizen_id: string
  provider_reference: string
  status: 'verified' | 'revoked'
  assurance_level: number
  evidence_hash: string
  occurred_at: string
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function vendorError(code: string): Error {
  return Object.assign(new Error(code), { statusCode: 401, code })
}

function signatureFor(rawBody: Buffer, eventId: string, timestamp: string): string {
  return createHmac('sha256', SECRET)
    .update(`${timestamp}.${eventId}.`)
    .update(rawBody)
    .digest('hex')
}

function signedRequest(
  payload: FixturePayload,
  eventId: string,
  signedAt = NOW,
  receivedAt = NOW,
): NativeProviderWebhookRequest {
  const rawBody = Buffer.from(JSON.stringify(payload))
  const timestamp = String(Math.floor(signedAt.getTime() / 1000))
  return {
    raw_body: rawBody,
    received_at: receivedAt,
    headers: {
      'x-fixture-event-id': eventId,
      'x-fixture-timestamp': timestamp,
      'x-fixture-signature': signatureFor(rawBody, eventId, timestamp),
    },
  }
}

function createFixtureAdapter(options?: {
  normalized_provider?: string
  event_id_override?: string
  invalid_normalization?: boolean
}) {
  const claimed = new Set<string>()

  return defineNativeCivicIdentityProviderAdapter({
    provider: 'fixture_native',
    async verify_native_webhook(request): Promise<VerifiedNativeProviderWebhook> {
      const eventId = firstHeader(request.headers['x-fixture-event-id'])
      const timestamp = firstHeader(request.headers['x-fixture-timestamp'])
      const supplied = firstHeader(request.headers['x-fixture-signature'])
      if (!eventId || !timestamp || !supplied) {
        throw vendorError('INVALID_NATIVE_WEBHOOK_SIGNATURE')
      }

      const expected = signatureFor(request.raw_body, eventId, timestamp)
      if (supplied !== expected) throw vendorError('INVALID_NATIVE_WEBHOOK_SIGNATURE')

      return {
        event_id: eventId,
        signed_at: new Date(Number(timestamp) * 1000),
      }
    },
    async claim_replay({ provider, event_id }) {
      const key = `${provider}:${event_id}`
      if (claimed.has(key)) return false
      claimed.add(key)
      return true
    },
    async normalize(request, verified) {
      if (options?.invalid_normalization) return { provider: 'fixture_native' }
      const payload = JSON.parse(request.raw_body.toString('utf8')) as FixturePayload
      return {
        provider: options?.normalized_provider ?? 'fixture_native',
        event_id: options?.event_id_override ?? verified.event_id,
        citizen_id: payload.citizen_id,
        provider_reference: payload.provider_reference,
        status: payload.status,
        assurance_level: payload.assurance_level,
        evidence_hash: payload.evidence_hash,
        occurred_at: payload.occurred_at,
        expires_at: null,
      }
    },
  })
}

function fixturePayload(status: 'verified' | 'revoked' = 'verified'): FixturePayload {
  return {
    citizen_id: CITIZEN_ID,
    provider_reference: 'fixture-subject-42',
    status,
    assurance_level: 2,
    evidence_hash: EVIDENCE_HASH,
    occurred_at: NOW.toISOString(),
  }
}

describe('native civic identity provider adapter certification boundary', () => {
  it('makes production eligibility derive from an executable native adapter, not a boolean', () => {
    const synthetic = defineSyntheticCivicIdentityProviderAdapter('trusted_kyc')
    const native = createFixtureAdapter()

    expect(isProductionCivicIdentityProviderAdapter(synthetic)).toBe(false)
    expect(isProductionCivicIdentityProviderAdapter(native)).toBe(true)
    expect(native.certification_contract_version).toBe(1)
  })

  it('accepts an authenticated fresh webhook and emits the canonical normalized contract', async () => {
    const adapter = createFixtureAdapter()
    const result = await adapter.verifyAndNormalize(signedRequest(fixturePayload(), 'evt-valid'))

    expect(result).toMatchObject({
      provider: 'fixture_native',
      event_id: 'evt-valid',
      citizen_id: CITIZEN_ID,
      provider_reference: 'fixture-subject-42',
      status: 'verified',
      assurance_level: 2,
      evidence_hash: EVIDENCE_HASH,
    })
  })

  it('rejects stale and replayed native webhooks before they reach normalized ingress', async () => {
    const adapter = createFixtureAdapter()
    const valid = signedRequest(fixturePayload(), 'evt-replay')
    await adapter.verifyAndNormalize(valid)

    await expect(adapter.verifyAndNormalize(valid)).rejects.toMatchObject({
      code: 'REPLAYED_NATIVE_WEBHOOK',
    })

    const staleAt = new Date(NOW.getTime() - 10 * 60 * 1000)
    const stale = signedRequest(fixturePayload(), 'evt-stale', staleAt, NOW)
    await expect(adapter.verifyAndNormalize(stale)).rejects.toMatchObject({
      code: 'STALE_NATIVE_WEBHOOK',
    })
  })

  it('binds normalized provider and event id to authenticated native metadata', async () => {
    await expect(
      createFixtureAdapter({ normalized_provider: 'other_provider' })
        .verifyAndNormalize(signedRequest(fixturePayload(), 'evt-provider-mismatch')),
    ).rejects.toMatchObject({ code: 'NATIVE_WEBHOOK_PROVIDER_MISMATCH' })

    await expect(
      createFixtureAdapter({ event_id_override: 'different-event' })
        .verifyAndNormalize(signedRequest(fixturePayload(), 'evt-id-mismatch')),
    ).rejects.toMatchObject({ code: 'NATIVE_WEBHOOK_EVENT_ID_MISMATCH' })
  })

  it('rejects invalid normalized output from a vendor adapter', async () => {
    await expect(
      createFixtureAdapter({ invalid_normalization: true })
        .verifyAndNormalize(signedRequest(fixturePayload(), 'evt-invalid-normalization')),
    ).rejects.toMatchObject({ code: 'INVALID_NATIVE_WEBHOOK_NORMALIZATION' })
  })

  it('runs the reusable adversarial certification suite required by future native adapters', async () => {
    const adapter = createFixtureAdapter()
    const valid = signedRequest(fixturePayload(), 'evt-cert-valid')

    const tampered = signedRequest(fixturePayload(), 'evt-cert-tampered')
    tampered.raw_body = Buffer.from(JSON.stringify(fixturePayload('revoked')))

    const unsignedBase = signedRequest(fixturePayload(), 'evt-cert-unsigned')
    const unsigned: NativeProviderWebhookRequest = {
      ...unsignedBase,
      headers: {
        ...unsignedBase.headers,
        'x-fixture-signature': undefined,
      },
    }

    const staleAt = new Date(NOW.getTime() - 10 * 60 * 1000)
    const stale = signedRequest(fixturePayload(), 'evt-cert-stale', staleAt, NOW)

    const report = await certifyNativeCivicIdentityProviderAdapter(adapter, {
      valid_request: valid,
      tampered_request: tampered,
      unsigned_request: unsigned,
      stale_request: stale,
      expected_event: {
        provider: 'fixture_native',
        event_id: 'evt-cert-valid',
        citizen_id: CITIZEN_ID,
        provider_reference: 'fixture-subject-42',
        status: 'verified',
        assurance_level: 2,
        evidence_hash: EVIDENCE_HASH,
        occurred_at: NOW.toISOString(),
        expires_at: null,
      },
    })

    expect(report).toEqual({
      provider: 'fixture_native',
      contract_version: 1,
      checks: {
        valid_signature_and_normalization: true,
        tamper_rejected: true,
        unsigned_rejected: true,
        stale_rejected: true,
        replay_rejected: true,
      },
    })
  })
})
