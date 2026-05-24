import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Cookie set by the client after a successful login.
// Value is a simple presence marker — actual token validity is enforced by the API.
const AUTH_COOKIE = 'vertice_auth'

export function middleware(request: NextRequest) {
  const isAuthenticated = request.cookies.has(AUTH_COOKIE)

  if (!isAuthenticated) {
    const loginUrl = new URL('/auth/login', request.url)
    // Preserve the intended destination so we can redirect back after login
    loginUrl.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

// Only run on dashboard routes — public pages and auth routes are unaffected
export const config = {
  matcher: ['/dashboard/:path*'],
}
