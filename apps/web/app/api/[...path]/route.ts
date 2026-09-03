import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 300

const DEFAULT_PRODUCTION_UPSTREAM = 'https://vertice-os-production.up.railway.app'
const PROXY_PREFIX = '/api'
const AUTH_PROXY_COOKIE_PATH = `${PROXY_PREFIX}/auth`

const REQUEST_HEADERS_TO_DROP = new Set([
  'accept-encoding',
  'connection',
  'content-length',
  'host',
  'origin',
  'referer',
])

const RESPONSE_HEADERS_TO_DROP = new Set([
  'access-control-allow-credentials',
  'access-control-allow-headers',
  'access-control-allow-methods',
  'access-control-allow-origin',
  'connection',
  'content-encoding',
  'content-length',
  'set-cookie',
  'transfer-encoding',
])

type RouteContext = {
  params: Promise<{ path: string[] }>
}

function validUpstream(value: string): string | null {
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    if (url.username || url.password) return null
    url.pathname = url.pathname.replace(/\/+$/, '') || '/'
    url.search = ''
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

function resolveUpstream(): string | null {
  const explicit = process.env.VERTICE_API_UPSTREAM?.trim()
  const configured = explicit ? validUpstream(explicit) : null

  if (configured) {
    if (process.env.VERCEL_ENV === 'production' && !configured.startsWith('https://')) {
      return DEFAULT_PRODUCTION_UPSTREAM
    }
    return configured
  }

  // Production has one canonical Railway runtime. Preview deployments remain
  // fail-closed unless VERTICE_API_UPSTREAM is supplied explicitly, so a PR
  // can never mutate production data simply by rendering its preview.
  if (process.env.VERCEL_ENV === 'production') {
    return DEFAULT_PRODUCTION_UPSTREAM
  }

  return null
}

function rewriteSetCookie(rawCookie: string): string {
  return rawCookie
    .replace(/;\s*Domain=[^;]*/gi, '')
    .replace(/;\s*Path=\/auth(?=;|$)/i, `; Path=${AUTH_PROXY_COOKIE_PATH}`)
}

function getSetCookies(headers: Headers): string[] {
  const maybeHeaders = headers as Headers & { getSetCookie?: () => string[] }
  if (typeof maybeHeaders.getSetCookie === 'function') {
    return maybeHeaders.getSetCookie()
  }

  const value = headers.get('set-cookie')
  return value ? [value] : []
}

function jsonError(status: number, error: string, code: string): Response {
  return Response.json(
    { error, code },
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  )
}

async function proxy(request: NextRequest, context: RouteContext): Promise<Response> {
  const upstreamBase = resolveUpstream()
  if (!upstreamBase) {
    return jsonError(
      503,
      'La API de VÉRTICE no está disponible en este entorno.',
      'API_UPSTREAM_NOT_CONFIGURED',
    )
  }

  const { path } = await context.params
  if (!Array.isArray(path) || path.length === 0) {
    return jsonError(404, 'Ruta de API inválida.', 'INVALID_API_ROUTE')
  }

  const upstreamUrl = `${upstreamBase}/${path.map(encodeURIComponent).join('/')}${request.nextUrl.search}`
  const headers = new Headers(request.headers)

  for (const header of REQUEST_HEADERS_TO_DROP) headers.delete(header)
  for (const header of Array.from(headers.keys())) {
    if (header.startsWith('sec-fetch-')) headers.delete(header)
  }

  const forwardedHost = request.headers.get('host')
  if (forwardedHost) headers.set('x-forwarded-host', forwardedHost)
  headers.set('x-forwarded-proto', request.nextUrl.protocol.replace(':', ''))

  let body: ArrayBuffer | undefined
  if (!['GET', 'HEAD'].includes(request.method)) {
    body = await request.arrayBuffer()
  }

  let upstreamResponse: Response
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body,
      redirect: 'manual',
      cache: 'no-store',
    })
  } catch {
    return jsonError(
      502,
      'La API productiva de VÉRTICE no respondió. Intenta nuevamente.',
      'API_UPSTREAM_UNAVAILABLE',
    )
  }

  const responseHeaders = new Headers()
  upstreamResponse.headers.forEach((value, key) => {
    if (!RESPONSE_HEADERS_TO_DROP.has(key.toLowerCase())) {
      responseHeaders.append(key, value)
    }
  })

  for (const cookie of getSetCookies(upstreamResponse.headers)) {
    responseHeaders.append('set-cookie', rewriteSetCookie(cookie))
  }

  const location = responseHeaders.get('location')
  if (location?.startsWith(upstreamBase)) {
    responseHeaders.set('location', `${PROXY_PREFIX}${location.slice(upstreamBase.length)}`)
  }

  responseHeaders.set('Cache-Control', 'no-store')

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  })
}

export const GET = proxy
export const POST = proxy
export const PUT = proxy
export const PATCH = proxy
export const DELETE = proxy
export const OPTIONS = proxy
export const HEAD = proxy
