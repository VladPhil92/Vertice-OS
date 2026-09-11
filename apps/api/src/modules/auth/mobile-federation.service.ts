import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'

import { config } from '../../config'
import { redis } from '../../lib/redis'
import { exchangeCtgOneFederation } from './federation.service'

const MOBILE_TRANSACTION_TTL_SECONDS = 10 * 60
const MOBILE_TRANSACTION_PREFIX = 'auth:mobile:ctgone:'
const MOBILE_CALLBACK_SCHEME = 'vertice://auth/ctgone/callback'

export type MobileFederationStart = {
  authorize_url: string
  transaction_id: string
  state: string
  callback_uri: string
  expires_in: number
}

export type MobileFederationExchangeInput = {
  code: string
  state: string
  transaction_id: string
}

type StoredMobileFederationTransaction = {
  codeVerifier: string
  state: string
}

function federationError(message: string, statusCode: number, code: string) {
  return Object.assign(new Error(message), { statusCode, code })
}

function transactionKey(transactionId: string): string {
  return `${MOBILE_TRANSACTION_PREFIX}${transactionId}`
}

function createPkcePair(): { verifier: string; challenge: string } {
  // 32 random bytes encoded as base64url produce 43 characters, satisfying
  // RFC 7636 while keeping the verifier out of the native client entirely.
  const verifier = crypto.randomBytes(32).toString('base64url')
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

async function consumeTransaction(transactionId: string): Promise<StoredMobileFederationTransaction | null> {
  const key = transactionKey(transactionId)
  // GET + DEL atomically: a mobile authorization handoff can be consumed once.
  const raw = await redis.eval(
    "local value = redis.call('GET', KEYS[1]); if value then redis.call('DEL', KEYS[1]); end; return value",
    1,
    key,
  )

  if (typeof raw !== 'string') return null

  try {
    const parsed = JSON.parse(raw) as Partial<StoredMobileFederationTransaction>
    if (typeof parsed.codeVerifier !== 'string' || typeof parsed.state !== 'string') return null
    return { codeVerifier: parsed.codeVerifier, state: parsed.state }
  } catch {
    return null
  }
}

/**
 * Starts CTG One federation for a native VÉRTICE client.
 *
 * The API acts as the confidential OAuth/BFF boundary: it generates and stores
 * the PKCE verifier in Redis, while the app only receives an opaque transaction
 * id, state, and public authorization URL. This avoids duplicating CTG One
 * credentials or cryptographic secrets in the Android/iOS bundle.
 */
export async function startMobileCtgOneFederation(): Promise<MobileFederationStart> {
  const { verifier, challenge } = createPkcePair()
  const transactionId = crypto.randomBytes(24).toString('base64url')
  // Prefix lets the existing web callback identify a native handoff and relay
  // the one-time code to the registered VÉRTICE custom scheme.
  const state = `mobile.${crypto.randomBytes(18).toString('base64url')}`

  const stored: StoredMobileFederationTransaction = {
    codeVerifier: verifier,
    state,
  }

  const storedOk = await redis.set(
    transactionKey(transactionId),
    JSON.stringify(stored),
    'EX',
    MOBILE_TRANSACTION_TTL_SECONDS,
    'NX',
  )
  if (storedOk !== 'OK') {
    throw federationError(
      'No fue posible iniciar la autenticación móvil',
      503,
      'MOBILE_FEDERATION_TRANSACTION_UNAVAILABLE',
    )
  }

  const authorizeUrl = new URL(config.CTG_ONE_FEDERATION_AUTHORIZE_URL)
  authorizeUrl.searchParams.set('code_challenge', challenge)
  authorizeUrl.searchParams.set('state', state)

  return {
    authorize_url: authorizeUrl.toString(),
    transaction_id: transactionId,
    state,
    callback_uri: MOBILE_CALLBACK_SCHEME,
    expires_in: MOBILE_TRANSACTION_TTL_SECONDS,
  }
}

/**
 * Completes native CTG One SSO and returns the same canonical VÉRTICE session
 * used everywhere else. No second citizen record is created when the CTG One
 * subject is already linked: federation.service resolves the existing citizen.
 */
export async function exchangeMobileCtgOneFederation(
  app: FastifyInstance,
  input: MobileFederationExchangeInput,
  meta: { userAgent?: string; ipAddress?: string },
) {
  const transaction = await consumeTransaction(input.transaction_id)
  if (!transaction) {
    throw federationError(
      'La autorización móvil expiró o ya fue utilizada',
      401,
      'MOBILE_FEDERATION_TRANSACTION_EXPIRED',
    )
  }

  if (transaction.state !== input.state) {
    throw federationError(
      'El estado de autenticación móvil no coincide',
      401,
      'MOBILE_FEDERATION_STATE_MISMATCH',
    )
  }

  return exchangeCtgOneFederation(
    app,
    { code: input.code, code_verifier: transaction.codeVerifier },
    meta,
  )
}
