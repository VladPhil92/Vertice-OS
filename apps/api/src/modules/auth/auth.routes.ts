import type { FastifyInstance } from 'fastify'
import { ZodError } from 'zod'
import { RegisterSchema, LoginSchema, ForgotPasswordSchema, ResetPasswordSchema, ChangePasswordSchema } from './auth.schema'
import { requireAuth } from '../../middleware/auth'
import {
  registerCitizen,
  loginCitizen,
  refreshAccessToken,
  revokeSession,
  getCitizenProfile,
  requestPasswordReset,
  resetPassword,
  changePassword,
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
    const parsed = ForgotPasswordSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Email inválido' })
    }
    // Always returns 200 — prevents email enumeration
    await requestPasswordReset(parsed.data.email)
    return reply.send({ message: 'Si el email existe, recibirás instrucciones en breve' })
  })

  // POST /auth/reset-password — 5/hora
  app.post('/reset-password', { config: { rateLimit: { max: 5, timeWindow: '1 hour' } } }, async (request, reply) => {
    const parsed = ResetPasswordSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors })
    }
    await resetPassword(parsed.data.token, parsed.data.new_password)
    return reply.send({ message: 'Contraseña actualizada. Inicia sesión con tus nuevas credenciales.' })
  })

  // POST /auth/change-password — requiere sesión activa + contraseña actual
  app.post('/change-password', {
    preHandler: requireAuth,
    config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const parsed = ChangePasswordSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors })
    }
    await changePassword(
      request.citizen.sub,
      parsed.data.current_password,
      parsed.data.new_password,
      request.cookies[REFRESH_COOKIE],
    )
    return reply.send({ message: 'Contraseña actualizada. Tus otras sesiones fueron cerradas.' })
  })
}
