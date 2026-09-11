import fs from 'node:fs'
import path from 'node:path'

const ROUTES_PATH = path.resolve(__dirname, '../mobile-auth.routes.ts')
const MOBILE_FEDERATION_PATH = path.resolve(__dirname, '../mobile-federation.service.ts')
const APP_PATH = path.resolve(__dirname, '../../../app.ts')

function read(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8')
}

describe('native mobile authentication contract', () => {
  it('reuses the canonical session and federation services and never creates a second auth implementation', () => {
    const routes = read(ROUTES_PATH)
    const federation = read(MOBILE_FEDERATION_PATH)

    expect(routes).toContain('loginCitizen')
    expect(routes).toContain('refreshAccessToken')
    expect(routes).toContain('revokeSession')
    expect(routes).toContain('startMobileCtgOneFederation')
    expect(routes).toContain('exchangeMobileCtgOneFederation')
    expect(federation).toContain('exchangeCtgOneFederation')
    expect(routes).not.toContain('generateRefreshToken')
    expect(routes).not.toContain('prisma.session.create')
    expect(federation).not.toContain('prisma.session.create')
  })

  it('returns refresh tokens only from the native auth namespace and does not set browser cookies', () => {
    const routes = read(ROUTES_PATH)
    const app = read(APP_PATH)

    expect(routes).toContain("app.post('/token'")
    expect(routes).toContain("app.post('/ctgone/start'")
    expect(routes).toContain("app.post('/ctgone/exchange'")
    expect(routes).toContain("app.post('/refresh'")
    expect(routes).toContain("app.post('/logout'")
    expect(routes).not.toContain('setCookie')
    expect(routes).not.toContain('clearCookie')
    expect(app).toContain("app.register(mobileAuthRoutes, { prefix: '/auth/mobile' })")
  })

  it('uses one-time server-side PKCE transactions for native CTG One handoff', () => {
    const federation = read(MOBILE_FEDERATION_PATH)

    expect(federation).toContain("crypto.randomBytes(32).toString('base64url')")
    expect(federation).toContain("crypto.createHash('sha256')")
    expect(federation).toContain("MOBILE_TRANSACTION_TTL_SECONDS = 10 * 60")
    expect(federation).toContain("redis.call('DEL', KEYS[1])")
    expect(federation).toContain("MOBILE_CALLBACK_SCHEME = 'vertice://auth/ctgone/callback'")
  })

  it('validates the opaque 40-byte hex refresh token before service use', () => {
    const routes = read(ROUTES_PATH)

    expect(routes).toContain("regex(/^[a-f0-9]{80}$/i")
    expect(routes).toContain('NativeRefreshTokenSchema.safeParse(request.body)')
  })
})
