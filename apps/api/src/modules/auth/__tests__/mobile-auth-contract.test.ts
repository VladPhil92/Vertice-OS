import fs from 'node:fs'
import path from 'node:path'

const ROUTES_PATH = path.resolve(__dirname, '../mobile-auth.routes.ts')
const APP_PATH = path.resolve(__dirname, '../../../app.ts')

function read(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8')
}

describe('native mobile authentication contract', () => {
  it('reuses the canonical session service and never creates a second auth implementation', () => {
    const routes = read(ROUTES_PATH)

    expect(routes).toContain('loginCitizen')
    expect(routes).toContain('refreshAccessToken')
    expect(routes).toContain('revokeSession')
    expect(routes).not.toContain('generateRefreshToken')
    expect(routes).not.toContain('prisma.session.create')
  })

  it('returns refresh tokens only from the native auth namespace and does not set browser cookies', () => {
    const routes = read(ROUTES_PATH)
    const app = read(APP_PATH)

    expect(routes).toContain("app.post('/token'")
    expect(routes).toContain("app.post('/refresh'")
    expect(routes).toContain("app.post('/logout'")
    expect(routes).not.toContain('setCookie')
    expect(routes).not.toContain('clearCookie')
    expect(app).toContain("app.register(mobileAuthRoutes, { prefix: '/auth/mobile' })")
  })

  it('validates the opaque 40-byte hex refresh token before service use', () => {
    const routes = read(ROUTES_PATH)

    expect(routes).toContain("regex(/^[a-f0-9]{80}$/i")
    expect(routes).toContain('NativeRefreshTokenSchema.safeParse(request.body)')
  })
})
