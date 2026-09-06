import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const middleware = await readFile(new URL('../middleware.ts', import.meta.url), 'utf8')

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

console.log('VÉRTICE web HTTP security boundary: PASS')
