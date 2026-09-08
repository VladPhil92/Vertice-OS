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

export const DASHBOARD_IDENTITY_CHANGED_EVENT = 'vertice:dashboard-identity-changed'
export const DASHBOARD_RUNTIME_INVALIDATED_EVENT = 'vertice:dashboard-runtime-invalidated'

export type DashboardRuntimeScope = 'identity' | 'dashboard' | 'resolution' | 'notifications' | 'all'

export interface DashboardRuntimeInvalidationDetail {
  scope: DashboardRuntimeScope
  sourcePath?: string
}

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
 */
const readInFlight = new Map<string, Promise<unknown>>()

/**
 * Phase 4 — Dashboard Runtime & Data Convergence.
 *
 * Las superficies principales del dashboard montan en paralelo y comparten
 * contratos de lectura. Esta caché deliberadamente corta evita que cada capa
 * cree su propia copia de red sin convertir el cliente en una caché persistente
 * de estado cívico. Toda mutación relevante invalida de inmediato el dominio.
 */
const DASHBOARD_READ_CACHE_TTL_MS = 1_500
const readCache = new Map<string, { value: unknown; expiresAt: number; scope: DashboardRuntimeScope }>()

const DASHBOARD_CACHE_PATH_SCOPE: Record<string, DashboardRuntimeScope> = {
  '/community/profile/me': 'identity',
  '/community/profile/me/avatar': 'identity',
  '/dashboard/me': 'dashboard',
  '/dashboard/me/resolution': 'resolution',
}

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
  const hasNoBody = options.body === undefined || options.body === null
  const hasNoSignal = options.signal === undefined || options.signal === null
  return (method === 'GET' || method === 'HEAD') && hasNoBody && hasNoSignal
}

function dedupeKey(path: string, isPublic: boolean, options: RequestInit): string {
  const method = (options.method ?? 'GET').toUpperCase()
  const authScope = isPublic ? 'public' : (getToken() ?? 'cookie-session')
  return `${method}:${authScope}:${path}`
}

function changesDashboardIdentity(path: string, options: RequestInit): boolean {
  const method = (options.method ?? 'GET').toUpperCase()
  return (
    (path === '/community/profile/me' && method === 'PATCH')
    || (path === '/community/profile/me/avatar' && method === 'DELETE')
    || (path === '/community/profile/me/avatar/confirm' && method === 'POST')
  )
}

function dashboardMutationScope(path: string, options: RequestInit): DashboardRuntimeScope | null {
  const method = (options.method ?? 'GET').toUpperCase()
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return null

  if (changesDashboardIdentity(path, options)) return 'identity'
  if (path === '/auth/roles/switch') return 'all'
  if (path.startsWith('/notifications')) return 'notifications'

  if (
    path.startsWith('/civic-actions')
    || path.startsWith('/territorial')
    || path.startsWith('/proposals')
    || path.startsWith('/governance')
    || path.startsWith('/legal')
    || path.startsWith('/workflows')
  ) {
    return 'all'
  }

  return null
}

function notifyDashboardIdentityChanged(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(DASHBOARD_IDENTITY_CHANGED_EVENT))
}

function scopeInvalidates(cacheScope: DashboardRuntimeScope, requested: DashboardRuntimeScope): boolean {
  if (requested === 'all') return true
  if (requested === 'identity') return cacheScope === 'identity' || cacheScope === 'dashboard'
  return cacheScope === requested
}

export function invalidateDashboardRuntime(
  scope: DashboardRuntimeScope = 'all',
  sourcePath?: string,
): void {
  for (const [key, entry] of readCache.entries()) {
    if (scopeInvalidates(entry.scope, scope)) readCache.delete(key)
  }

  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<DashboardRuntimeInvalidationDetail>(
    DASHBOARD_RUNTIME_INVALIDATED_EVENT,
    { detail: { scope, sourcePath } },
  ))
}

function getCachedRead<T>(key: string): T | null {
  const entry = readCache.get(key)
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) {
    readCache.delete(key)
    return null
  }
  return entry.value as T
}

function cacheRead<T>(key: string, path: string, value: T): void {
  const scope = DASHBOARD_CACHE_PATH_SCOPE[path]
  if (!scope) return
  readCache.set(key, {
    value,
    scope,
    expiresAt: Date.now() + DASHBOARD_READ_CACHE_TTL_MS,
  })
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
    const result = await executeApiRequest<T>(path, isPublic, extraHeaders, rest)
    const invalidationScope = dashboardMutationScope(path, rest)
    if (changesDashboardIdentity(path, rest)) notifyDashboardIdentityChanged()
    if (invalidationScope) invalidateDashboardRuntime(invalidationScope, path)
    return result
  }

  const key = dedupeKey(path, isPublic, rest)
  const cached = getCachedRead<T>(key)
  if (cached !== null) return cached

  const active = readInFlight.get(key)
  if (active) return active as Promise<T>

  const request = executeApiRequest<T>(path, isPublic, extraHeaders, rest)
  readInFlight.set(key, request)

  try {
    const result = await request
    cacheRead(key, path, result)
    return result
  } finally {
    if (readInFlight.get(key) === request) readInFlight.delete(key)
  }
}
