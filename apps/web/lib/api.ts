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

export class ApiRequestError extends Error {
  status: number
  code?: string
  retriable: boolean

  constructor(message: string, status = 0, code?: string, retriable = false) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.code = code
    this.retriable = retriable
  }
}

export function requireApiBaseUrl(): string {
  return BASE_URL
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('access_token')
}

function redirectToLogin(): void {
  if (typeof window === 'undefined') return
  const next = encodeURIComponent(window.location.pathname + window.location.search)
  window.location.href = `/auth/login?next=${next}`
}

interface ApiOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>
  /** Skip adding Authorization header (e.g. for public endpoints) */
  public?: boolean
  /** Override the default timeout for this request. */
  timeoutMs?: number
  /** Override automatic retries for safe reads. Mutations are never retried automatically. */
  retries?: number
}

const READ_TIMEOUT_MS = 20_000
const MUTATION_TIMEOUT_MS = 60_000
const REFRESH_TIMEOUT_MS = 15_000
const DEFAULT_READ_RETRIES = 1
const RETRYABLE_STATUSES = new Set([502, 503, 504])

/**
 * Canjea la cookie httpOnly de refresco por un nuevo access token.
 *
 * Las peticiones concurrentes que reciban 401 comparten la misma promesa para
 * no disparar N refrescos en paralelo (y no invalidarse entre sí si el backend
 * rota el refresh token).
 */
let refreshInFlight: Promise<string | null> | null = null

/**
 * Deduplicación in-flight para lecturas idempotentes y para mutaciones JSON
 * equivalentes que accidentalmente se disparen en paralelo (doble click,
 * teclado + click, re-render concurrente). Nunca se conserva el resultado de
 * una mutación después de finalizar.
 */
const readInFlight = new Map<string, Promise<unknown>>()
const mutationInFlight = new Map<string, Promise<unknown>>()

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

function isSafeRead(options: RequestInit): boolean {
  const method = (options.method ?? 'GET').toUpperCase()
  return method === 'GET' || method === 'HEAD'
}

function defaultTimeout(options: RequestInit): number {
  return isSafeRead(options) ? READ_TIMEOUT_MS : MUTATION_TIMEOUT_MS
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isAbortLike(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function buildTimedSignal(parentSignal: AbortSignal | null | undefined, timeoutMs: number) {
  const controller = new AbortController()
  let timedOut = false

  const onParentAbort = () => controller.abort(parentSignal?.reason)
  if (parentSignal) {
    if (parentSignal.aborted) controller.abort(parentSignal.reason)
    else parentSignal.addEventListener('abort', onParentAbort, { once: true })
  }

  const timeoutId = setTimeout(() => {
    timedOut = true
    controller.abort(new DOMException('Request timeout', 'AbortError'))
  }, timeoutMs)

  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    cleanup: () => {
      clearTimeout(timeoutId)
      parentSignal?.removeEventListener('abort', onParentAbort)
    },
  }
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = defaultTimeout(init),
): Promise<Response> {
  const timed = buildTimedSignal(init.signal, timeoutMs)
  try {
    return await fetch(input, { ...init, signal: timed.signal })
  } catch (error) {
    if (timed.timedOut()) {
      throw new ApiRequestError(
        'La operación tardó demasiado en responder. Intenta nuevamente.',
        0,
        'REQUEST_TIMEOUT',
        true,
      )
    }
    if (init.signal?.aborted || isAbortLike(error)) {
      throw new ApiRequestError('La operación fue cancelada.', 0, 'REQUEST_ABORTED', false)
    }
    throw new ApiRequestError(
      'No fue posible conectar con el servicio. Verifica tu conexión e intenta nuevamente.',
      0,
      'NETWORK_ERROR',
      true,
    )
  } finally {
    timed.cleanup()
  }
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight

  refreshInFlight = (async () => {
    try {
      const baseUrl = requireApiBaseUrl()
      const res = await fetchWithTimeout(`${baseUrl}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      }, REFRESH_TIMEOUT_MS)
      if (!res.ok) return null

      const data = (await res.json().catch(() => ({}))) as { access_token?: string }
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
  const hasNoBody = options.body === undefined || options.body === null
  const hasNoSignal = options.signal === undefined || options.signal === null
  return isSafeRead(options) && hasNoBody && hasNoSignal
}

function isMutationDedupeEligible(options: RequestInit): boolean {
  if (isSafeRead(options)) return false
  if (options.signal) return false
  return typeof options.body === 'string' && options.body.length > 0
}

function dedupeKey(path: string, isPublic: boolean, options: RequestInit): string {
  const method = (options.method ?? 'GET').toUpperCase()
  const authScope = isPublic ? 'public' : (getToken() ?? 'cookie-session')
  return `${method}:${authScope}:${path}`
}

function mutationDedupeKey(path: string, isPublic: boolean, options: RequestInit): string {
  return `${dedupeKey(path, isPublic, options)}:${String(options.body)}`
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

function hasHeader(headers: Record<string, string>, headerName: string): boolean {
  const normalized = headerName.toLowerCase()
  return Object.keys(headers).some((name) => name.toLowerCase() === normalized)
}

function shouldDefaultToJson(body: BodyInit | null | undefined): boolean {
  return typeof body === 'string' && body.length > 0
}

async function parseApiError(res: Response): Promise<ApiRequestError> {
  const text = await res.text().catch(() => '')
  let body: { error?: string; message?: string; code?: string } = {}

  if (text) {
    try {
      body = JSON.parse(text) as { error?: string; message?: string; code?: string }
    } catch {
      body = {}
    }
  }

  const retriable = RETRYABLE_STATUSES.has(res.status)
  const fallback = retriable
    ? 'El servicio no está disponible temporalmente. Intenta nuevamente.'
    : `La operación no pudo completarse (HTTP ${res.status}).`

  return new ApiRequestError(
    body.error ?? body.message ?? fallback,
    res.status,
    body.code,
    retriable,
  )
}

async function requestWithResilience(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  retries: number,
): Promise<Response> {
  const safeRead = isSafeRead(init)
  let attempt = 0

  while (true) {
    try {
      const response = await fetchWithTimeout(url, init, timeoutMs)
      if (!safeRead || !RETRYABLE_STATUSES.has(response.status) || attempt >= retries) {
        return response
      }
    } catch (error) {
      const apiError = error instanceof ApiRequestError ? error : null
      if (!safeRead || !apiError?.retriable || attempt >= retries) throw error
    }

    attempt += 1
    await sleep(180 * (2 ** (attempt - 1)))
  }
}

async function executeApiRequest<T>(
  path: string,
  isPublic: boolean,
  extraHeaders: Record<string, string> | undefined,
  rest: RequestInit,
  timeoutMs: number,
  retries: number,
): Promise<T> {
  const baseUrl = requireApiBaseUrl()

  function buildHeaders(token: string | null): Record<string, string> {
    const headers: Record<string, string> = { ...extraHeaders }
    if (shouldDefaultToJson(rest.body) && !hasHeader(headers, 'content-type')) {
      headers['Content-Type'] = 'application/json'
    }
    if (!isPublic && token) headers.Authorization = `Bearer ${token}`
    return headers
  }

  const request = (token: string | null) => requestWithResilience(
    `${baseUrl}${path}`,
    {
      credentials: 'include',
      ...rest,
      headers: buildHeaders(token),
    },
    timeoutMs,
    retries,
  )

  let res = await request(isPublic ? null : getToken())

  if (res.status === 401 && !isPublic) {
    const newToken = await refreshAccessToken()
    if (newToken) res = await request(newToken)
  }

  if (res.status === 401) {
    localStorage.removeItem('access_token')
    redirectToLogin()
    throw new ApiRequestError('Tu sesión expiró. Ingresa nuevamente.', 401, 'SESSION_EXPIRED', false)
  }

  if (!res.ok) throw await parseApiError(res)

  const text = await res.text()
  if (!text) return undefined as T

  try {
    return JSON.parse(text) as T
  } catch {
    throw new ApiRequestError(
      'El servicio devolvió una respuesta inválida. Intenta nuevamente.',
      res.status,
      'INVALID_RESPONSE',
      false,
    )
  }
}

function afterMutation(path: string, rest: RequestInit): void {
  const invalidationScope = dashboardMutationScope(path, rest)
  if (changesDashboardIdentity(path, rest)) notifyDashboardIdentityChanged()
  if (invalidationScope) invalidateDashboardRuntime(invalidationScope, path)
}

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const {
    public: isPublic = false,
    headers: extraHeaders,
    timeoutMs: requestedTimeout,
    retries: requestedRetries,
    ...rest
  } = options

  const timeoutMs = requestedTimeout ?? defaultTimeout(rest)
  const retries = isSafeRead(rest) ? (requestedRetries ?? DEFAULT_READ_RETRIES) : 0

  if (isDedupeEligible(rest)) {
    const key = dedupeKey(path, isPublic, rest)
    const cached = getCachedRead<T>(key)
    if (cached !== null) return cached

    const active = readInFlight.get(key)
    if (active) return active as Promise<T>

    const request = executeApiRequest<T>(path, isPublic, extraHeaders, rest, timeoutMs, retries)
    readInFlight.set(key, request)

    try {
      const result = await request
      cacheRead(key, path, result)
      return result
    } finally {
      if (readInFlight.get(key) === request) readInFlight.delete(key)
    }
  }

  if (isMutationDedupeEligible(rest)) {
    const key = mutationDedupeKey(path, isPublic, rest)
    const active = mutationInFlight.get(key)
    if (active) return active as Promise<T>

    const request = executeApiRequest<T>(path, isPublic, extraHeaders, rest, timeoutMs, 0)
      .then((result) => {
        afterMutation(path, rest)
        return result
      })
    mutationInFlight.set(key, request)

    try {
      return await request
    } finally {
      if (mutationInFlight.get(key) === request) mutationInFlight.delete(key)
    }
  }

  const result = await executeApiRequest<T>(path, isPublic, extraHeaders, rest, timeoutMs, retries)
  afterMutation(path, rest)
  return result
}
