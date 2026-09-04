import { createHash, createHmac, timingSafeEqual } from 'crypto'
import { z } from 'zod'
import { config } from '../../config'
import {
  defineNativeCivicIdentityProviderAdapter,
  type NativeProviderWebhookHeaders,
  type VerifiedNativeProviderWebhook,
} from './identity-provider-adapter'
import { claimNativeProviderReplay } from './identity-provider-replay'

const VERIFF_PROVIDER = 'veriff'
const SESSION_TIMEOUT_MS = 8_000

const VeriffDecisionSchema = z.object({
  status: z.string(),
  verification: z.object({
    id: z.string().uuid(),
    attemptId: z.string().uuid(),
    vendorData: z.string().nullable().optional(),
    endUserId: z.string().uuid().nullable(),
    status: z.enum([
      'approved',
      'declined',
      'resubmission_requested',
      'review',
      'expired',
      'abandoned',
    ]),
    decisionTime: z.string().datetime({ offset: true }).nullable(),
  }),
}).passthrough()

const VeriffUserStatusSchema = z.object({
  data: z.object({
    verification: z.object({
      id: z.string().uuid(),
      userDefinedData: z.object({
        status: z.string(),
        statusCode: z.string(),
        createdAt: z.string().datetime({ offset: true }),
      }).passthrough(),
    }).passthrough(),
  }).passthrough(),
  time: z.string().datetime({ offset: true }),
  attemptId: z.string().uuid(),
  eventType: z.literal('user-status.created'),
  sessionId: z.string().uuid(),
  vendorData: z.string().nullable().optional(),
  endUserId: z.string().uuid().nullable(),
}).passthrough()

const VeriffSessionResponseSchema = z.object({
  status: z.literal('success'),
  verification: z.object({
    id: z.string().uuid(),
    url: z.string().url(),
    endUserId: z.string().uuid().nullable().optional(),
    status: z.string(),
  }).passthrough(),
}).passthrough()

type VeriffDecision = z.infer<typeof VeriffDecisionSchema>
type VeriffUserStatus = z.infer<typeof VeriffUserStatusSchema>

function isVeriffUserStatus(
  payload: VeriffDecision | VeriffUserStatus,
): payload is VeriffUserStatus {
  return (payload as { eventType?: unknown }).eventType === 'user-status.created'
}

type VeriffCredentials = {
  baseUrl: string
  apiKey: string
  sharedSecret: string
}

export type VeriffSessionResult = {
  provider: typeof VERIFF_PROVIDER
  session_id: string
  url: string
}

function makeError(message: string, statusCode: number, code: string): Error {
  return Object.assign(new Error(message), { statusCode, code })
}

function firstHeader(headers: NativeProviderWebhookHeaders, name: string): string | undefined {
  const value = headers[name] ?? headers[name.toLowerCase()]
  return Array.isArray(value) ? value[0] : value
}

function configuredCredentials(): VeriffCredentials | null {
  const baseUrl = config.VERIFF_BASE_URL?.trim().replace(/\/+$/, '')
  const apiKey = config.VERIFF_API_KEY?.trim()
  const sharedSecret = config.VERIFF_SHARED_SECRET?.trim()
  if (!baseUrl || !apiKey || !sharedSecret) return null
  return { baseUrl, apiKey, sharedSecret }
}

export function isVeriffRuntimeReady(): boolean {
  return configuredCredentials() !== null
}

function requireCredentials(): VeriffCredentials {
  const credentials = configuredCredentials()
  if (!credentials) {
    throw makeError(
      'La integración de Veriff no está configurada',
      503,
      'VERIFF_NOT_CONFIGURED',
    )
  }
  return credentials
}

function hmacHex(secret: string, rawBody: Buffer | string): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex')
}

function safeHexEqual(supplied: string | undefined, expectedHex: string): boolean {
  const normalized = supplied?.trim().toLowerCase() ?? ''
  if (!/^[0-9a-f]{64}$/.test(normalized)) return false
  const received = Buffer.from(normalized, 'hex')
  const expected = Buffer.from(expectedHex, 'hex')
  return received.length === expected.length && timingSafeEqual(received, expected)
}

function parseAuthenticatedWebhook(rawBody: Buffer): VeriffDecision | VeriffUserStatus {
  let payload: unknown
  try {
    payload = JSON.parse(rawBody.toString('utf8'))
  } catch {
    throw makeError('Webhook de Veriff no contiene JSON válido', 400, 'INVALID_VERIFF_WEBHOOK_JSON')
  }

  const userStatus = VeriffUserStatusSchema.safeParse(payload)
  if (userStatus.success) return userStatus.data

  const decision = VeriffDecisionSchema.safeParse(payload)
  if (decision.success) return decision.data

  throw makeError(
    'Tipo o contrato de webhook de Veriff no soportado',
    422,
    'UNSUPPORTED_VERIFF_WEBHOOK',
  )
}

function requireEndUserId(endUserId: string | null | undefined): string {
  if (!endUserId) {
    throw makeError(
      'El webhook de Veriff no está ligado a un endUserId VÉRTICE',
      422,
      'VERIFF_END_USER_ID_REQUIRED',
    )
  }
  return endUserId
}

function timestampMillis(value: string, code: string): number {
  const millis = new Date(value).getTime()
  if (!Number.isFinite(millis)) throw makeError('Timestamp de Veriff inválido', 422, code)
  return millis
}

function eventIdForDecision(decision: VeriffDecision): string {
  const occurredAt = decision.verification.decisionTime
  if (!occurredAt) {
    throw makeError(
      'La decisión de Veriff no contiene decisionTime',
      422,
      'VERIFF_DECISION_TIME_REQUIRED',
    )
  }
  return `veriff:${decision.verification.attemptId}:${decision.verification.status}:${timestampMillis(occurredAt, 'INVALID_VERIFF_DECISION_TIME')}`
}

function eventIdForUserStatus(event: VeriffUserStatus): string {
  const createdAt = event.data.verification.userDefinedData.createdAt
  return `veriff:${event.attemptId}:user-status:${timestampMillis(createdAt, 'INVALID_VERIFF_STATUS_TIME')}`
}

function proofingStatusForDecision(status: VeriffDecision['verification']['status']): {
  status: 'verified' | 'rejected' | 'review' | 'expired'
  assurance_level: number
} {
  switch (status) {
    case 'approved':
      return { status: 'verified', assurance_level: 2 }
    case 'declined':
      return { status: 'rejected', assurance_level: 0 }
    case 'resubmission_requested':
    case 'review':
      return { status: 'review', assurance_level: 0 }
    case 'expired':
    case 'abandoned':
      return { status: 'expired', assurance_level: 0 }
  }
}

function evidenceHash(parts: string[]): string {
  return createHash('sha256').update(parts.join('\0')).digest('hex')
}

function normalizeDecision(decision: VeriffDecision, verified: VerifiedNativeProviderWebhook) {
  const endUserId = requireEndUserId(decision.verification.endUserId)
  const decisionTime = decision.verification.decisionTime
  if (!decisionTime) {
    throw makeError(
      'La decisión de Veriff no contiene decisionTime',
      422,
      'VERIFF_DECISION_TIME_REQUIRED',
    )
  }
  const mapped = proofingStatusForDecision(decision.verification.status)
  const expiresAt = mapped.status === 'expired' ? decisionTime : null

  return {
    provider: VERIFF_PROVIDER,
    event_id: verified.event_id,
    citizen_id: endUserId,
    // Stable, PII-free reference across multiple Veriff sessions for one
    // VÉRTICE account. Duplicate-person policy remains a separate pilot control.
    provider_reference: `end-user:${endUserId}`,
    status: mapped.status,
    assurance_level: mapped.assurance_level,
    evidence_hash: evidenceHash([
      VERIFF_PROVIDER,
      decision.verification.id,
      decision.verification.attemptId,
      decision.verification.status,
      decisionTime,
    ]),
    occurred_at: decisionTime,
    expires_at: expiresAt,
  }
}

function normalizeUserStatus(event: VeriffUserStatus, verified: VerifiedNativeProviderWebhook) {
  const endUserId = requireEndUserId(event.endUserId)
  const userStatus = event.data.verification.userDefinedData
  const isRevocation = userStatus.statusCode === config.VERIFF_REVOCATION_STATUS_CODE

  return {
    provider: VERIFF_PROVIDER,
    event_id: verified.event_id,
    citizen_id: endUserId,
    provider_reference: `end-user:${endUserId}`,
    // Unknown portal statuses fail closed into review rather than granting or
    // retaining assurance. The configured revocation code is authoritative.
    status: isRevocation ? 'revoked' as const : 'review' as const,
    assurance_level: 0,
    evidence_hash: evidenceHash([
      VERIFF_PROVIDER,
      event.sessionId,
      event.attemptId,
      userStatus.statusCode,
      userStatus.createdAt,
    ]),
    occurred_at: userStatus.createdAt,
    expires_at: null,
  }
}

export function createVeriffIdentityProviderAdapter(options?: {
  apiKey?: string
  sharedSecret?: string
  runtimeReady?: () => boolean
  claimReplay?: typeof claimNativeProviderReplay
}) {
  return defineNativeCivicIdentityProviderAdapter({
    provider: VERIFF_PROVIDER,
    runtime_ready: options?.runtimeReady ?? isVeriffRuntimeReady,
    claim_replay: options?.claimReplay ?? claimNativeProviderReplay,
    async verify_native_webhook(request): Promise<VerifiedNativeProviderWebhook> {
      const credentials = options?.apiKey && options?.sharedSecret
        ? { apiKey: options.apiKey, sharedSecret: options.sharedSecret }
        : requireCredentials()

      const authClient = firstHeader(request.headers, 'x-auth-client')?.trim()
      const signature = firstHeader(request.headers, 'x-hmac-signature')
      if (authClient !== credentials.apiKey) {
        throw makeError('X-AUTH-CLIENT de Veriff inválido', 401, 'INVALID_VERIFF_AUTH_CLIENT')
      }
      if (!safeHexEqual(signature, hmacHex(credentials.sharedSecret, request.raw_body))) {
        throw makeError('Firma HMAC de Veriff inválida', 401, 'INVALID_VERIFF_HMAC_SIGNATURE')
      }

      // Parse only after authenticating the exact raw bytes.
      const payload = parseAuthenticatedWebhook(request.raw_body)
      if (isVeriffUserStatus(payload)) {
        return {
          event_id: eventIdForUserStatus(payload),
          signed_at: new Date(payload.time),
        }
      }

      const decisionTime = payload.verification.decisionTime
      if (!decisionTime) {
        throw makeError(
          'La decisión de Veriff no contiene decisionTime',
          422,
          'VERIFF_DECISION_TIME_REQUIRED',
        )
      }
      return {
        event_id: eventIdForDecision(payload),
        signed_at: new Date(decisionTime),
      }
    },
    async normalize(request, verified) {
      const payload = parseAuthenticatedWebhook(request.raw_body)
      return isVeriffUserStatus(payload)
        ? normalizeUserStatus(payload, verified)
        : normalizeDecision(payload, verified)
    },
  })
}

export const veriffIdentityProviderAdapter = createVeriffIdentityProviderAdapter()

function callbackUrl(): string {
  if (config.VERIFF_CALLBACK_URL) return config.VERIFF_CALLBACK_URL
  const origin = config.CORS_ORIGIN.split(',')[0]?.trim().replace(/\/+$/, '')
  if (!origin) {
    throw makeError('Callback de Veriff no configurado', 503, 'VERIFF_CALLBACK_NOT_CONFIGURED')
  }
  try {
    return new URL('/dashboard/identity', origin).toString()
  } catch {
    throw makeError('Callback de Veriff no configurado', 503, 'VERIFF_CALLBACK_NOT_CONFIGURED')
  }
}

export async function createVeriffVerificationSession(
  citizenId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<VeriffSessionResult> {
  const { baseUrl, apiKey, sharedSecret } = requireCredentials()
  const payload = JSON.stringify({
    verification: {
      callback: callbackUrl(),
      vendorData: citizenId,
      endUserId: citizenId,
    },
  })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SESSION_TIMEOUT_MS)
  let response: Response
  try {
    response = await fetchImpl(`${baseUrl}/v1/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AUTH-CLIENT': apiKey,
        'X-HMAC-SIGNATURE': hmacHex(sharedSecret, payload),
      },
      body: payload,
      signal: controller.signal,
    })
  } catch (error) {
    throw makeError(
      error instanceof Error && error.name === 'AbortError'
        ? 'Veriff no respondió dentro del tiempo permitido'
        : 'No fue posible conectar con Veriff',
      502,
      'VERIFF_SESSION_REQUEST_FAILED',
    )
  } finally {
    clearTimeout(timer)
  }

  const rawResponse = await response.text()
  if (!response.ok) {
    throw makeError('Veriff rechazó la creación de sesión', 502, 'VERIFF_SESSION_REJECTED')
  }

  const responseClient = response.headers.get('vrf-auth-client')
  const responseSignature = response.headers.get('vrf-hmac-signature')
  if (responseClient !== apiKey
    || !safeHexEqual(responseSignature ?? undefined, hmacHex(sharedSecret, rawResponse))) {
    throw makeError('Respuesta de Veriff no autenticada', 502, 'INVALID_VERIFF_RESPONSE_SIGNATURE')
  }

  let responsePayload: unknown
  try {
    responsePayload = JSON.parse(rawResponse)
  } catch {
    throw makeError('Respuesta de Veriff inválida', 502, 'INVALID_VERIFF_SESSION_RESPONSE')
  }
  const parsed = VeriffSessionResponseSchema.safeParse(responsePayload)
  if (!parsed.success || parsed.data.verification.endUserId !== citizenId) {
    throw makeError('Respuesta de Veriff inválida', 502, 'INVALID_VERIFF_SESSION_RESPONSE')
  }

  return {
    provider: VERIFF_PROVIDER,
    session_id: parsed.data.verification.id,
    url: parsed.data.verification.url,
  }
}
