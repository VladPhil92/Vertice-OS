import { clearSessionTokens, getAccessToken, getRefreshToken, setSessionTokens } from './session'
import type { MobileTokenResponse, RefreshTokenResponse } from '../types/api'

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '')
export const API_URL = configuredApiUrl || 'http://localhost:4000'

interface ApiOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>
  public?: boolean
}

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

export async function loginMobile(email: string, password: string): Promise<MobileTokenResponse> {
  const token = await execute<MobileTokenResponse>('/auth/mobile/token', {
    method: 'POST',
    public: true,
    body: JSON.stringify({ email, password }),
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
