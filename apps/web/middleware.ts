import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const AUTH_COOKIE = 'vertice_auth'

export function middleware(request: NextRequest) {
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    // Antes: `script-src 'nonce-${n}' 'strict-dynamic'`. Se veía más estricto,
    // pero dejaba el sitio SIN EJECUTAR NADA de JavaScript: un nonce se genera
    // por request, y 22 de las 25 páginas son prerenderizadas en build
    // (`○ Static`), así que su HTML no puede llevarlo. Next renderizaba sus
    // <script> sin nonce (`"nonce":"$undefined"` en el payload RSC) y
    // 'strict-dynamic' — que anula los allowlists por host — hacía que el
    // navegador los rechazara todos.
    //
    // Verificado en Chromium real, con los assets estáticos servidos
    // correctamente en ambos casos: con nonce+strict-dynamic React NO hidrata
    // y hay 18 violaciones de CSP; con esta política hidrata y hay 0. El fallo
    // era idéntico en Next 14, así que no lo introdujo la migración a 15.
    //
    // Volver a nonce exige renderizado dinámico en todas las páginas (perder
    // la generación estática, y con ella el hosting gratuito). Compensación
    // aceptada a conciencia: el riesgo real de 'unsafe-inline' aquí es bajo
    // — no existe ni un `dangerouslySetInnerHTML` en el código y React escapa
    // todo por defecto. `'self'` mantiene fuera cualquier script de terceros.
    "script-src 'self' 'unsafe-inline' https://*.sentry.io",
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

  // Ya no se reenvía ningún `x-nonce`: sin nonce en la política, no hay nada
  // que Next tenga que estampar en sus <script>.
  const response = NextResponse.next()

  response.headers.set('Content-Security-Policy', csp)
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)')
  response.headers.set('X-DNS-Prefetch-Control', 'off')
  response.headers.set('X-Permitted-Cross-Domain-Policies', 'none')
  if (isDashboard) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  }

  return response
}

export const config = {
  // All HTML routes; skip Next.js internals and static assets
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
