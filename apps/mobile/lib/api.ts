import { clearSessionTokens, getAccessToken, getRefreshToken, setSessionTokens } from './session'
import type { MobileTokenResponse, RefreshTokenResponse } from '../types/api'

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '')
export const API_URL = configuredApiUrl || 'http://localhost:4000'

interface ApiOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>
  public?: boolean
}

export interface MobileCtgOneStartResponse {
  authorize_url: string
  transaction_id: string
  state: string
  callback_uri: string
  expires_in: number
}

export interface MobileCtgOneExchangeInput {
  code: string
  state: string
  transaction_id: string
}

interface PendingMutationKey {
  key: string
  expiresAt: number
}

const MUTATION_KEY_TTL_MS = 24 * 60 * 60 * 1000
const pendingMutationKeys = new Map<string, PendingMutationKey>()
let refreshInFlight: Promise<string | null> | null = null

async function parseError(response: Response): Promise<Error> {
  const body = await response.json().catch(() => ({})) as { error?: string; message?: string }
  return new Error(body.error ?? body.message ?? `HTTP ${response.status}`)
}

async function refreshMobileAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight

  refreshInFlight = (async () => {
    const refreshToken = await getRefreshToken()
    if (!refreshToken) return null

    try {
      const response = await fetch(`${API_URL}/auth/mobile/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      })

      if (!response.ok) {
        await clearSessionTokens()
        return null
      }

      const data = await response.json() as RefreshTokenResponse
      await setSessionTokens(data.access_token)
      return data.access_token
    } catch {
      return null
    } finally {
      refreshInFlight = null
    }
  })()

  return refreshInFlight
}

async function execute<T>(path: string, options: ApiOptions, retryAuth: boolean): Promise<T> {
  const { public: isPublic = false, headers: extraHeaders, ...rest } = options
  const token = isPublic ? null : await getAccessToken()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  }
  if (token) headers.Authorization = `Bearer ${token}`

  let response = await fetch(`${API_URL}${path}`, { ...rest, headers })

  if (response.status === 401 && !isPublic && retryAuth) {
    const refreshedToken = await refreshMobileAccessToken()
    if (refreshedToken) {
      response = await fetch(`${API_URL}${path}`, {
        ...rest,
        headers: { ...headers, Authorization: `Bearer ${refreshedToken}` },
      })
    }
  }

  if (response.status === 401 && !isPublic) {
    await clearSessionTokens()
  }

  if (!response.ok) throw await parseError(response)

  const text = await response.text()
  return text ? JSON.parse(text) as T : undefined as T
}

export function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  return execute<T>(path, options, true)
}

export function createIdempotencyKey(scope: string): string {
  const entropy = Math.random().toString(36).slice(2, 10)
  return `${scope}-${Date.now().toString(36)}-${entropy}`.slice(0, 120)
}

function hashMutationInput(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function mutationFingerprint(path: string, scope: string, options: ApiOptions): string {
  const method = (options.method ?? 'POST').toUpperCase()
  const body = typeof options.body === 'string' ? options.body : options.body == null ? '' : String(options.body)
  return `${scope}|${method}|${path}|${hashMutationInput(body)}`
}

function keyForMutation(fingerprint: string, scope: string): string {
  const now = Date.now()
  for (const [candidate, pending] of pendingMutationKeys) {
    if (pending.expiresAt <= now) pendingMutationKeys.delete(candidate)
  }

  const existing = pendingMutationKeys.get(fingerprint)
  if (existing) return existing.key

  const key = createIdempotencyKey(scope)
  pendingMutationKeys.set(fingerprint, { key, expiresAt: now + MUTATION_KEY_TTL_MS })
  return key
}

export async function apiMutation<T>(path: string, scope: string, options: ApiOptions = {}): Promise<T> {
  const fingerprint = mutationFingerprint(path, scope, options)
  const idempotencyKey = keyForMutation(fingerprint, scope)

  try {
    const result = await apiFetch<T>(path, {
      ...options,
      headers: {
        ...options.headers,
        'Idempotency-Key': idempotencyKey,
      },
    })
    pendingMutationKeys.delete(fingerprint)
    return result
  } catch (error) {
    throw error
  }
}

export async function loginMobile(email: string, password: string): Promise<MobileTokenResponse> {
  const token = await execute<MobileTokenResponse>('/auth/mobile/token', {
    method: 'POST',
    public: true,
    body: JSON.stringify({ email, password }),
  }, false)

  await setSessionTokens(token.access_token, token.refresh_token)
  return token
}

export async function startMobileCtgOne(): Promise<MobileCtgOneStartResponse> {
  return execute<MobileCtgOneStartResponse>('/auth/mobile/ctgone/start', {
    method: 'POST',
    public: true,
  }, false)
}

export async function exchangeMobileCtgOne(input: MobileCtgOneExchangeInput): Promise<MobileTokenResponse> {
  const token = await execute<MobileTokenResponse>('/auth/mobile/ctgone/exchange', {
    method: 'POST',
    public: true,
    body: JSON.stringify(input),
  }, false)

  await setSessionTokens(token.access_token, token.refresh_token)
  return token
}

export async function logoutMobile(): Promise<void> {
  const refreshToken = await getRefreshToken()
  try {
    if (refreshToken) {
      await execute('/auth/mobile/logout', {
        method: 'POST',
        public: true,
        body: JSON.stringify({ refresh_token: refreshToken }),
      }, false)
    }
  } finally {
    await clearSessionTokens()
  }
}
