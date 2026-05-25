import { FastifyInstance } from 'fastify'
import { ZodError } from 'zod'
import { RegisterSchema, LoginSchema } from './auth.schema'
import { requireAuth } from '../../middleware/auth'
import {
  registerCitizen,
  loginCitizen,
  refreshAccessToken,
  revokeSession,
  getCitizenProfile,
  requestPasswordReset,
  resetPassword,
} from './auth.service'
import { config } from '../../config'

const REFRESH_COOKIE = 'vertice_refresh'

const cookieOpts = {
  httpOnly: true,
  secure: config.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/auth',
  maxAge: config.JWT_REFRESH_EXPIRY_SECONDS,
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // POST /auth/register — 5 intentos/hora para frenar registro masivo
  app.post('/register', { config: { rateLimit: { max: 5, timeWindow: '1 hour' } } }, async (request, reply) => {
    const parsed = RegisterSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors })
    }

    const result = await registerCitizen(parsed.data)
    return reply.status(201).send(result)
  })

  // POST /auth/token — 10/min, protección brute-force
  app.post('/token', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const parsed = LoginSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors })
    }

    const { refresh_token, ...tokenResponse } = await loginCitizen(app, parsed.data, {
      userAgent: request.headers['user-agent'],
      ipAddress: request.ip,
    })

    reply.setCookie(REFRESH_COOKIE, refresh_token, cookieOpts)
    return reply.send(tokenResponse)
  })

  // POST /auth/refresh — 30/min
  app.post('/refresh', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    const rawToken = request.cookies[REFRESH_COOKIE]
    if (!rawToken) {
      return reply.status(401).send({ error: 'Sin token de refresco', code: 'NO_REFRESH_TOKEN' })
    }

    const result = await refreshAccessToken(app, rawToken)
    return reply.send(result)
  })

  // POST /auth/logout — 20/min
  app.post('/logout', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
    const rawToken = request.cookies[REFRESH_COOKIE]
    if (rawToken) {
      await revokeSession(rawToken)
    }
    reply.clearCookie(REFRESH_COOKIE, { path: '/auth' })
    return reply.send({ message: 'Sesión cerrada' })
  })

  // GET /auth/me
  app.get('/me', { preHandler: requireAuth }, async (request, reply) => {
    const profile = await getCitizenProfile(request.citizen.sub)
    return reply.send(profile)
  })

  // POST /auth/forgot-password — 3/hora para frenar enumeración de emails
  app.post('/forgot-password', { config: { rateLimit: { max: 3, timeWindow: '1 hour' } } }, async (request, reply) => {
    const body = request.body as { email?: unknown }
    if (typeof body.email !== 'string' || !body.email.includes('@')) {
      return reply.status(400).send({ error: 'Email inválido' })
    }
    // Always returns 200 — prevents email enumeration
    await requestPasswordReset(body.email.toLowerCase().trim())
    return reply.send({ message: 'Si el email existe, recibirás instrucciones en breve' })
  })

  // POST /auth/reset-password — 5/hora
  app.post('/reset-password', { config: { rateLimit: { max: 5, timeWindow: '1 hour' } } }, async (request, reply) => {
    const body = request.body as { token?: unknown; new_password?: unknown }
    if (typeof body.token !== 'string' || !body.token) {
      return reply.status(400).send({ error: 'Token requerido' })
    }
    if (typeof body.new_password !== 'string' || body.new_password.length < 8) {
      return reply.status(400).send({ error: 'La contraseña debe tener al menos 8 caracteres' })
    }
    await resetPassword(body.token, body.new_password)
    return reply.send({ message: 'Contraseña actualizada. Inicia sesión con tus nuevas credenciales.' })
  })
}
