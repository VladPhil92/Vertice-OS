import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const middleware = await readFile(new URL('../middleware.ts', import.meta.url), 'utf8')
const apiClient = await readFile(new URL('../lib/api.ts', import.meta.url), 'utf8')
const registerPage = await readFile(new URL('../app/auth/register/page.tsx', import.meta.url), 'utf8')

for (const directive of [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
]) {
  assert.ok(middleware.includes(directive), `VÉRTICE CSP must include ${directive}`)
}

for (const header of [
  "Content-Security-Policy",
  "Strict-Transport-Security",
  "X-Frame-Options",
  "X-Content-Type-Options",
  "Referrer-Policy",
  "Permissions-Policy",
  "X-DNS-Prefetch-Control",
  "X-Permitted-Cross-Domain-Policies",
]) {
  assert.ok(middleware.includes(header), `VÉRTICE web perimeter must include ${header}`)
}

assert.ok(
  middleware.includes("X-Robots-Tag', 'noindex, nofollow"),
  'Authenticated dashboard routes must remain excluded from indexing.',
)

assert.ok(
  apiClient.includes(": '/api'"),
  'Production browser API traffic must remain on the same-origin /api proxy.',
)
assert.ok(
  registerPage.includes('requireApiBaseUrl()'),
  'Citizen registration must resolve its API target through the shared browser API boundary.',
)
assert.ok(
  !registerPage.includes('process.env.NEXT_PUBLIC_API_URL'),
  'Citizen registration must never bypass the same-origin proxy with NEXT_PUBLIC_API_URL.',
)
assert.ok(
  registerPage.includes("credentials: 'include'"),
  'Citizen registration must preserve first-party credential semantics.',
)

console.log('VÉRTICE web HTTP security boundary: PASS')
