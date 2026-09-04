import { createHmac } from 'crypto'
import { config } from '../../../config'
import {
  createVeriffIdentityProviderAdapter,
  createVeriffVerificationSession,
} from '../identity-provider-veriff'
import type { NativeProviderWebhookRequest } from '../identity-provider-adapter'

const API_KEY = 'veriff-test-api-key'
const SHARED_SECRET = 'veriff-test-shared-secret-32-characters!!'
const NOW = new Date('2026-09-04T18:00:00.000Z')
const CITIZEN_ID = '00000000-0000-4000-8000-000000000001'
const SESSION_ID = '10000000-0000-4000-8000-000000000001'
const ATTEMPT_ID = '20000000-0000-4000-8000-000000000001'

function sign(raw: Buffer | string): string {
  return createHmac('sha256', SHARED_SECRET).update(raw).digest('hex')
}

function decisionBody(status: 'approved' | 'declined' | 'review' | 'expired' | 'abandoned' = 'approved') {
  return {
    status: 'success',
    verification: {
      id: SESSION_ID,
      attemptId: ATTEMPT_ID,
      vendorData: CITIZEN_ID,
      endUserId: CITIZEN_ID,
      status,
      decisionTime: NOW.toISOString(),
    },
  }
}

function signedRequest(payload: unknown, receivedAt = NOW): NativeProviderWebhookRequest {
  const rawBody = Buffer.from(JSON.stringify(payload))
  return {
    raw_body: rawBody,
    received_at: receivedAt,
    headers: {
      'x-auth-client': API_KEY,
      'x-hmac-signature': sign(rawBody),
    },
  }
}

function adapter() {
  const replay = new Set<string>()
  return createVeriffIdentityProviderAdapter({
    apiKey: API_KEY,
    sharedSecret: SHARED_SECRET,
    runtimeReady: () => true,
    claimReplay: async ({ provider, event_id }) => {
      const key = `${provider}:${event_id}`
      if (replay.has(key)) return false
      replay.add(key)
      return true
    },
  })
}

describe('Veriff P0.8 native identity provider adapter', () => {
  it('normalizes an authenticated approved decision into assurance level 2', async () => {
    const result = await adapter().verifyAndNormalize(signedRequest(decisionBody('approved')))

    expect(result).toMatchObject({
      provider: 'veriff',
      citizen_id: CITIZEN_ID,
      provider_reference: `end-user:${CITIZEN_ID}`,
      status: 'verified',
      assurance_level: 2,
      occurred_at: NOW.toISOString(),
      expires_at: null,
    })
    expect(result.event_id).toContain(`${ATTEMPT_ID}:approved:`)
    expect(result.evidence_hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('maps Veriff terminal abandonment/expiration fail-closed', async () => {
    const expired = await adapter().verifyAndNormalize(signedRequest(decisionBody('expired')))
    const abandonedPayload = decisionBody('abandoned')
    abandonedPayload.verification.attemptId = '20000000-0000-4000-8000-000000000002'
    const abandoned = await adapter().verifyAndNormalize(signedRequest(abandonedPayload))

    expect(expired).toMatchObject({ status: 'expired', assurance_level: 0, expires_at: NOW.toISOString() })
    expect(abandoned).toMatchObject({ status: 'expired', assurance_level: 0, expires_at: NOW.toISOString() })
  })

  it('normalizes the configured user-defined status into a revocation event', async () => {
    const payload = {
      data: {
        verification: {
          id: ATTEMPT_ID,
          userDefinedData: {
            status: 'VÉRTICE revoked',
            statusCode: config.VERIFF_REVOCATION_STATUS_CODE,
            createdAt: NOW.toISOString(),
          },
        },
      },
      time: new Date(NOW.getTime() + 1_000).toISOString(),
      attemptId: ATTEMPT_ID,
      eventType: 'user-status.created',
      sessionId: SESSION_ID,
      vendorData: CITIZEN_ID,
      endUserId: CITIZEN_ID,
    }

    const result = await adapter().verifyAndNormalize(
      signedRequest(payload, new Date(NOW.getTime() + 1_000)),
    )

    expect(result).toMatchObject({
      provider: 'veriff',
      citizen_id: CITIZEN_ID,
      provider_reference: `end-user:${CITIZEN_ID}`,
      status: 'revoked',
      assurance_level: 0,
      occurred_at: NOW.toISOString(),
    })
  })

  it('rejects tampering, wrong API key and replay before persistence', async () => {
    const native = adapter()
    const valid = signedRequest(decisionBody())

    const wrongClient: NativeProviderWebhookRequest = {
      ...valid,
      headers: { ...valid.headers, 'x-auth-client': 'wrong-client' },
    }
    await expect(native.verifyAndNormalize(wrongClient)).rejects.toMatchObject({
      code: 'INVALID_VERIFF_AUTH_CLIENT',
    })

    const tampered = signedRequest(decisionBody())
    tampered.raw_body = Buffer.from(JSON.stringify(decisionBody('declined')))
    await expect(native.verifyAndNormalize(tampered)).rejects.toMatchObject({
      code: 'INVALID_VERIFF_HMAC_SIGNATURE',
    })

    await native.verifyAndNormalize(valid)
    await expect(native.verifyAndNormalize(valid)).rejects.toMatchObject({
      code: 'REPLAYED_NATIVE_WEBHOOK',
    })
  })

  it('requires the signed endUserId instead of matching accounts by email or document data', async () => {
    const payload = decisionBody()
    payload.verification.endUserId = null as unknown as string

    await expect(adapter().verifyAndNormalize(signedRequest(payload))).rejects.toMatchObject({
      code: 'VERIFF_END_USER_ID_REQUIRED',
    })
  })
})

describe('Veriff session bootstrap', () => {
  const saved = {
    baseUrl: config.VERIFF_BASE_URL,
    apiKey: config.VERIFF_API_KEY,
    sharedSecret: config.VERIFF_SHARED_SECRET,
    callbackUrl: config.VERIFF_CALLBACK_URL,
  }

  beforeEach(() => {
    config.VERIFF_BASE_URL = 'https://veriff-api.example.test'
    config.VERIFF_API_KEY = API_KEY
    config.VERIFF_SHARED_SECRET = SHARED_SECRET
    config.VERIFF_CALLBACK_URL = 'https://vertice.example.test/dashboard/identity'
  })

  afterAll(() => {
    config.VERIFF_BASE_URL = saved.baseUrl
    config.VERIFF_API_KEY = saved.apiKey
    config.VERIFF_SHARED_SECRET = saved.sharedSecret
    config.VERIFF_CALLBACK_URL = saved.callbackUrl
  })

  it('sends only opaque citizen binding and authenticates the signed Veriff response', async () => {
    const responseBody = JSON.stringify({
      status: 'success',
      verification: {
        id: SESSION_ID,
        url: 'https://magic.veriff.example/session-token',
        endUserId: CITIZEN_ID,
        status: 'created',
      },
    })

    const fetchMock: typeof fetch = jest.fn(async (_input, init) => {
      const requestBody = String(init?.body ?? '')
      expect(JSON.parse(requestBody)).toEqual({
        verification: {
          callback: 'https://vertice.example.test/dashboard/identity',
          vendorData: CITIZEN_ID,
          endUserId: CITIZEN_ID,
        },
      })
      expect(init?.headers).toMatchObject({
        'Content-Type': 'application/json',
        'X-AUTH-CLIENT': API_KEY,
        'X-HMAC-SIGNATURE': sign(requestBody),
      })

      return new Response(responseBody, {
        status: 200,
        headers: {
          'vrf-auth-client': API_KEY,
          'vrf-hmac-signature': sign(responseBody),
        },
      })
    }) as unknown as typeof fetch

    const result = await createVeriffVerificationSession(CITIZEN_ID, fetchMock)

    expect(result).toEqual({
      provider: 'veriff',
      session_id: SESSION_ID,
      url: 'https://magic.veriff.example/session-token',
    })
  })

  it('fails closed when the Veriff response signature is invalid', async () => {
    const responseBody = JSON.stringify({
      status: 'success',
      verification: {
        id: SESSION_ID,
        url: 'https://magic.veriff.example/session-token',
        endUserId: CITIZEN_ID,
        status: 'created',
      },
    })
    const fetchMock: typeof fetch = jest.fn(async () => new Response(responseBody, {
      status: 200,
      headers: {
        'vrf-auth-client': API_KEY,
        'vrf-hmac-signature': '0'.repeat(64),
      },
    })) as unknown as typeof fetch

    await expect(createVeriffVerificationSession(CITIZEN_ID, fetchMock)).rejects.toMatchObject({
      code: 'INVALID_VERIFF_RESPONSE_SIGNATURE',
    })
  })
})
