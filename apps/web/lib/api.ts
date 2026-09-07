const configuredDevelopmentBaseUrl = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/+$/, '')

/**
 * Browser API target.
 *
 * Production is deliberately same-origin. The browser never talks to Railway
 * directly; Vercel proxies /api/* to the canonical Railway API. This keeps
 * refresh cookies first-party, satisfies the CSP with `connect-src 'self'`,
 * and makes stale NEXT_PUBLIC_API_URL values unable to redirect credentials.
 *
 * Development may still point directly at a local API for the normal local
 * monorepo workflow.
 */
export const BASE_URL = process.env.NODE_ENV === 'development'
  ? (configuredDevelopmentBaseUrl || 'http://localhost:4000')
  : '/api'

export function requireApiBaseUrl(): string {
  return BASE_URL
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('access_token')
}

function redirectToLogin(): void {
  const next = encodeURIComponent(window.location.pathname + window.location.search)
  window.location.href = `/auth/login?next=${next}`
}

interface ApiOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>
  /** Skip adding Authorization header (e.g. for public endpoints) */
  public?: boolean
}

/**
 * Canjea la cookie httpOnly de refresco por un nuevo access token.
 *
 * Las peticiones concurrentes que reciban 401 comparten la misma promesa para
 * no disparar N refrescos en paralelo (y no invalidarse entre sí si el backend
 * rota el refresh token).
 */
let refreshInFlight: Promise<string | null> | null = null

/**
 * Deduplicación exclusivamente *in-flight* para lecturas idempotentes.
 *
 * El dashboard monta varias superficies independientes que consumen el mismo
 * contrato (`/dashboard/me`). Mantener aislamiento entre componentes es útil
 * para resiliencia, pero no debe traducirse en dos o tres requests idénticos
 * al mismo tiempo. Este mapa comparte únicamente la promesa activa y se limpia
 * al terminar: no es una caché de datos y, por tanto, no puede servir estado
 * cívico obsoleto después de una mutación.
 */
const readInFlight = new Map<string, Promise<unknown>>()

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight

  refreshInFlight = (async () => {
    try {
      const baseUrl = requireApiBaseUrl()
      const res = await fetch(`${baseUrl}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) return null

      const data = (await res.json()) as { access_token?: string }
      if (!data.access_token) return null

      localStorage.setItem('access_token', data.access_token)
      return data.access_token
    } catch {
      return null
    } finally {
      setTimeout(() => { refreshInFlight = null }, 0)
    }
  })()

  return refreshInFlight
}

function isDedupeEligible(options: RequestInit): boolean {
  const method = (options.method ?? 'GET').toUpperCase()
  return (method === 'GET' || method === 'HEAD') && options.body == null && options.signal == null
}

function dedupeKey(path: string, isPublic: boolean, options: RequestInit): string {
  const method = (options.method ?? 'GET').toUpperCase()
  const authScope = isPublic ? 'public' : (getToken() ?? 'cookie-session')
  return `${method}:${authScope}:${path}`
}

async function executeApiRequest<T>(
  path: string,
  isPublic: boolean,
  extraHeaders: Record<string, string> | undefined,
  rest: RequestInit,
): Promise<T> {
  const baseUrl = requireApiBaseUrl()

  function buildHeaders(token: string | null): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...extraHeaders,
    }
    if (!isPublic && token) headers.Authorization = `Bearer ${token}`
    return headers
  }

  let res = await fetch(`${baseUrl}${path}`, {
    credentials: 'include',
    ...rest,
    headers: buildHeaders(isPublic ? null : getToken()),
  })

  if (res.status === 401 && !isPublic) {
    const newToken = await refreshAccessToken()
    if (newToken) {
      res = await fetch(`${baseUrl}${path}`, {
        credentials: 'include',
        ...rest,
        headers: buildHeaders(newToken),
      })
    }
  }

  if (res.status === 401) {
    localStorage.removeItem('access_token')
    redirectToLogin()
    return new Promise(() => undefined)
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string; message?: string }
    throw new Error(body.error ?? body.message ?? `HTTP ${res.status}`)
  }

  const text = await res.text()
  if (!text) return undefined as T
  return JSON.parse(text) as T
}

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const { public: isPublic = false, headers: extraHeaders, ...rest } = options

  if (!isDedupeEligible(rest)) {
    return executeApiRequest<T>(path, isPublic, extraHeaders, rest)
  }

  const key = dedupeKey(path, isPublic, rest)
  const active = readInFlight.get(key)
  if (active) return active as Promise<T>

  const request = executeApiRequest<T>(path, isPublic, extraHeaders, rest)
  readInFlight.set(key, request)

  try {
    return await request
  } finally {
    if (readInFlight.get(key) === request) readInFlight.delete(key)
  }
}
