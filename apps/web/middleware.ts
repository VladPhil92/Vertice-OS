import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const AUTH_COOKIE = 'vertice_auth'

export function middleware(request: NextRequest) {
  // Fresh nonce per request — eliminates unsafe-inline from script-src
  const nonce = btoa(crypto.randomUUID())

  const csp = [
    "default-src 'self'",
    // nonce trusts Next.js bootstrap scripts; strict-dynamic propagates trust
    // to scripts they load, covering hydration and dynamically injected chunks
    `script-src 'nonce-${nonce}' 'strict-dynamic' https://*.sentry.io`,
    // Styles: unsafe-inline kept — inline styles carry no code-execution risk
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://*.mapbox.com https://ipfs.io",
    "connect-src 'self' https://*.mapbox.com wss: ws: https://*.sentry.io",
    "worker-src blob:",
  ].join('; ')

  const isDashboard = request.nextUrl.pathname.startsWith('/dashboard')
  const isAuthenticated = request.cookies.has(AUTH_COOKIE)

  if (isDashboard && !isAuthenticated) {
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Forward nonce to Server Components so layout.tsx can attach it to <html>
  // Next.js reads html[nonce] and stamps it on all its generated <script> tags
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)

  const response = NextResponse.next({ request: { headers: requestHeaders } })

  response.headers.set('Content-Security-Policy', csp)
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)')
  if (isDashboard) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  }

  return response
}

export const config = {
  // All HTML routes; skip Next.js internals and static assets
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
