import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { RegisterSchema, LoginSchema, ForgotPasswordSchema, ResetPasswordSchema, ChangePasswordSchema } from './auth.schema'
import { requireAuth, requireSuperadmin } from '../../middleware/auth'
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
import { exchangeCtgOneFederation } from './federation.service'
import { provisionCtgOneForCitizen } from './ctgone-provisioning.service'
import {
  CITIZEN_ROLES,
  getRoleContext,
  listCitizensForRoleAdmin,
  switchSessionRole,
} from './roles.service'
import {
  DELEGABLE_ROLES,
  grantCitizenRole,
  revokeCitizenRole,
} from './role-delegation.service'
import { config } from '../../config'

const REFRESH_COOKIE = 'vertice_refresh'

const FederationExchangeSchema = z.object({
  code: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  code_verifier: z.string().min(43).max(128).regex(/^[A-Za-z0-9._~-]+$/),
})
const RoleSchema = z.enum(CITIZEN_ROLES)
const DelegableRoleSchema = z.enum(DELEGABLE_ROLES)
const RoleSwitchSchema = z.object({ role: RoleSchema })
const RoleReasonSchema = z.string().trim().min(8).max(500)
const GrantRoleSchema = z.object({ role: DelegableRoleSchema, reason: RoleReasonSchema })
const RevokeRoleSchema = z.object({ reason: RoleReasonSchema })
const RoleAdminQuerySchema = z.object({ q: z.string().trim().max(100).optional().default('') })
const CitizenIdParamsSchema = z.object({ citizenId: z.string().uuid() })
const CitizenRoleParamsSchema = z.object({
  citizenId: z.string().uuid(),
  role: DelegableRoleSchema,
})

const cookieOpts = {
  httpOnly: true,
  secure: config.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/auth',
  maxAge: config.JWT_REFRESH_EXPIRY_SECONDS,
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/register', { config: { rateLimit: { max: 5, timeWindow: '1 hour' } } }, async (request, reply) => {
    const parsed = RegisterSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors })
    }

    const result = await registerCitizen(parsed.data)
    return reply.status(201).send(result)
  })

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

  app.post('/ctgone/exchange', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const parsed = FederationExchangeSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Solicitud de federación inválida', code: 'INVALID_FEDERATION_REQUEST' })
    }

    const { refresh_token, ...tokenResponse } = await exchangeCtgOneFederation(app, parsed.data, {
      userAgent: request.headers['user-agent'],
      ipAddress: request.ip,
    })

    reply.setCookie(REFRESH_COOKIE, refresh_token, cookieOpts)
    return reply.send(tokenResponse)
  })

  // Reverse ecosystem bridge. The browser proves its VÉRTICE session to this
  // API; only the API speaks to CTG One over the existing service trust secret.
  app.post('/ctgone/provision', {
    preHandler: requireAuth,
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    return reply.send(await provisionCtgOneForCitizen(request.citizen.sub))
  })

  app.post('/refresh', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    const rawToken = request.cookies[REFRESH_COOKIE]
    if (!rawToken) {
      return reply.status(401).send({ error: 'Sin token de refresco', code: 'NO_REFRESH_TOKEN' })
    }

    const result = await refreshAccessToken(app, rawToken)
    return reply.send(result)
  })

  app.post('/logout', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
    const rawToken = request.cookies[REFRESH_COOKIE]
    if (rawToken) {
      await revokeSession(rawToken)
    }
    reply.clearCookie(REFRESH_COOKIE, { path: '/auth' })
    return reply.send({ message: 'Sesión cerrada' })
  })

  app.get('/me', { preHandler: requireAuth }, async (request, reply) => {
    const profile = await getCitizenProfile(request.citizen.sub)
    return reply.send(profile)
  })

  // Roles assigned to the current identity and the active role of this session.
  app.get('/roles', { preHandler: requireAuth }, async (request, reply) => {
    const context = await getRoleContext(request.citizen.sub, request.citizen.sid)
    return reply.send(context)
  })

  // Switching role always rotates the short-lived access token and persists the
  // active role on the server-side session. A client cannot activate an ungranted role.
  app.post('/roles/switch', {
    preHandler: requireAuth,
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const parsed = RoleSwitchSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Rol inválido', code: 'INVALID_ROLE' })
    return reply.send(await switchSessionRole(app, request.citizen, parsed.data.role))
  })

  // P2 role authority plane. Search is deliberately bounded and email is only
  // a discovery/display field; citizen UUID is the mutation target. All role
  // mutations require an explicitly activated live Superadmin session.
  app.get('/role-admin/users', {
    preHandler: requireSuperadmin,
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const parsed = RoleAdminQuerySchema.safeParse(request.query)
    if (!parsed.success) return reply.status(400).send({ error: 'Consulta inválida' })
    return reply.send({ users: await listCitizensForRoleAdmin(parsed.data.q) })
  })

  // Grant and revoke are intentionally separate operations. The former batch
  // replace endpoint made provenance ambiguous and could not express *why* a
  // specific role changed. Every mutation now requires a human-readable reason.
  app.post('/role-admin/users/:citizenId/grants', {
    preHandler: requireSuperadmin,
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const params = CitizenIdParamsSchema.safeParse(request.params)
    const body = GrantRoleSchema.safeParse(request.body)
    if (!params.success || !body.success) {
      return reply.status(400).send({
        error: 'Solicitud de delegación inválida',
        code: 'INVALID_ROLE_GRANT_REQUEST',
      })
    }
    const result = await grantCitizenRole(
      request.citizen.sub,
      params.data.citizenId,
      body.data.role,
      body.data.reason,
    )
    return reply.status(201).send(result)
  })

  app.delete('/role-admin/users/:citizenId/grants/:role', {
    preHandler: requireSuperadmin,
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const params = CitizenRoleParamsSchema.safeParse(request.params)
    const body = RevokeRoleSchema.safeParse(request.body)
    if (!params.success || !body.success) {
      return reply.status(400).send({
        error: 'Solicitud de revocación inválida',
        code: 'INVALID_ROLE_REVOKE_REQUEST',
      })
    }
    return reply.send(await revokeCitizenRole(
      request.citizen.sub,
      params.data.citizenId,
      params.data.role,
      body.data.reason,
    ))
  })

  app.post('/forgot-password', { config: { rateLimit: { max: 3, timeWindow: '1 hour' } } }, async (request, reply) => {
    const parsed = ForgotPasswordSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Email inválido' })
    }
    await requestPasswordReset(parsed.data.email)
    return reply.send({ message: 'Si el email existe, recibirás instrucciones en breve' })
  })

  app.post('/reset-password', { config: { rateLimit: { max: 5, timeWindow: '1 hour' } } }, async (request, reply) => {
    const parsed = ResetPasswordSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors })
    }
    await resetPassword(parsed.data.token, parsed.data.new_password)
    return reply.send({ message: 'Contraseña actualizada. Inicia sesión con tus nuevas credenciales.' })
  })

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
