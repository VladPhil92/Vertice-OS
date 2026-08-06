const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

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

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
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
      // Se libera en el microtask siguiente para que los 401 simultáneos
      // alcancen a engancharse a esta misma promesa.
      setTimeout(() => { refreshInFlight = null }, 0)
    }
  })()

  return refreshInFlight
}

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const { public: isPublic, headers: extraHeaders, ...rest } = options

  function buildHeaders(token: string | null): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...extraHeaders,
    }
    if (!isPublic && token) headers['Authorization'] = `Bearer ${token}`
    return headers
  }

  let res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    ...rest,
    headers: buildHeaders(isPublic ? null : getToken()),
  })

  // El access token caducó: se intenta refrescar una vez y se reintenta.
  if (res.status === 401 && !isPublic) {
    const newToken = await refreshAccessToken()
    if (newToken) {
      res = await fetch(`${BASE_URL}${path}`, {
        credentials: 'include',
        ...rest,
        headers: buildHeaders(newToken),
      })
    }
  }

  if (res.status === 401) {
    localStorage.removeItem('access_token')
    redirectToLogin()
    // Return a never-resolving promise so caller code doesn't continue
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
