import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { LoginSchema } from './auth.schema'
import { loginCitizen, refreshAccessToken, revokeSession } from './auth.service'
import {
  exchangeMobileCtgOneFederation,
  startMobileCtgOneFederation,
} from './mobile-federation.service'

const NativeRefreshTokenSchema = z.object({
  refresh_token: z.string().regex(/^[a-f0-9]{80}$/i, 'Refresh token inválido'),
})

const NativeFederationExchangeSchema = z.object({
  code: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  state: z.string().regex(/^mobile\.[A-Za-z0-9_-]{24}$/),
  transaction_id: z.string().regex(/^[A-Za-z0-9_-]{32}$/),
})

/**
 * Native authentication contract.
 *
 * Browser auth remains cookie-based under /auth/*. Native clients cannot rely
 * on a browser cookie jar, so the refresh token is returned explicitly and
 * MUST be persisted only in an OS-backed secure store (Keychain/Keystore).
 * These endpoints intentionally reuse the same session and federation services
 * used by the web flow; there is no second source of auth truth or citizen data.
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

  app.post('/ctgone/start', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (_request, reply) => {
    return reply.send(await startMobileCtgOneFederation())
  })

  app.post('/ctgone/exchange', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const parsed = NativeFederationExchangeSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Solicitud de federación móvil inválida',
        code: 'INVALID_MOBILE_FEDERATION_REQUEST',
      })
    }

    // Unlike browser /auth/ctgone/exchange, this response intentionally keeps
    // refresh_token in the JSON body so the native client can persist it in
    // Keychain/Keystore. No browser cookie is emitted from this namespace.
    return reply.send(await exchangeMobileCtgOneFederation(app, parsed.data, {
      userAgent: request.headers['user-agent'],
      ipAddress: request.ip,
    }))
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
