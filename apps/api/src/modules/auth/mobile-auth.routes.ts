import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { LoginSchema } from './auth.schema'
import { loginCitizen, refreshAccessToken, revokeSession } from './auth.service'

const NativeRefreshTokenSchema = z.object({
  refresh_token: z.string().regex(/^[a-f0-9]{80}$/i, 'Refresh token inválido'),
})

/**
 * Native authentication contract.
 *
 * Browser auth remains cookie-based under /auth/*. Native clients cannot rely
 * on a browser cookie jar, so the refresh token is returned explicitly and
 * MUST be persisted only in an OS-backed secure store (Keychain/Keystore).
 * These endpoints intentionally reuse the same session service and token
 * hashing used by the web flow; there is no second source of auth truth.
 */
export async function mobileAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post('/token', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const parsed = LoginSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Datos inválidos',
        details: parsed.error.flatten().fieldErrors,
      })
    }

    const result = await loginCitizen(app, parsed.data, {
      userAgent: request.headers['user-agent'],
      ipAddress: request.ip,
    })

    return reply.send(result)
  })

  app.post('/refresh', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const parsed = NativeRefreshTokenSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Refresh token inválido',
        code: 'INVALID_REFRESH_TOKEN',
      })
    }

    const result = await refreshAccessToken(app, parsed.data.refresh_token)
    return reply.send(result)
  })

  app.post('/logout', {
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const parsed = NativeRefreshTokenSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Refresh token inválido',
        code: 'INVALID_REFRESH_TOKEN',
      })
    }

    await revokeSession(parsed.data.refresh_token)
    return reply.send({ message: 'Sesión móvil cerrada' })
  })
}
