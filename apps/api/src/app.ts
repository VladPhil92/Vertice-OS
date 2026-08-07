import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import sensible from '@fastify/sensible'
import { config } from './config'
import { redis } from './lib/redis'
import { prisma } from './lib/prisma'
import { getNeo4jDriver } from './lib/neo4j'
import { initSentry, captureException } from './lib/sentry'
import { authRoutes } from './modules/auth/auth.routes'
import { identityRoutes } from './modules/identity/identity.routes'
import { territorialRoutes } from './modules/territorial/territorial.routes'
import { governanceRoutes } from './modules/governance/governance.routes'
import { reputationRoutes } from './modules/reputation/reputation.routes'
import { legalRoutes } from './modules/legal/legal.routes'
import { aiRoutes } from './modules/ai/ai.routes'
import { eventsRoutes } from './modules/events/events.routes'
import { notificationsRoutes } from './modules/notifications/notifications.routes'

initSentry()

export function buildApp() {
  const app = Fastify({
    logger: {
      level: config.NODE_ENV === 'production' ? 'info' : 'debug',
      transport: config.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
    trustProxy: true,
  })

  // ── Plugins ──────────────────────────────────────────────────────

  app.register(sensible)

  app.register(helmet, {
    contentSecurityPolicy: false, // gestionado en Next.js
  })

  app.register(cors, {
    origin: config.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  })

  app.register(cookie)

  app.register(jwt, {
    secret: config.JWT_SECRET,
    sign: { algorithm: 'HS256' },
  })

  // Rate limiting deshabilitado en test para simplificar fixtures
  if (config.NODE_ENV !== 'test') {
    app.register(rateLimit, {
      global: true,
      max: 100,
      timeWindow: '1 minute',
      redis,
      errorResponseBuilder: () => ({
        error: 'Demasiadas solicitudes',
        code: 'RATE_LIMIT_EXCEEDED',
      }),
    })
  }

  // ── Error handler global ─────────────────────────────────────────

  // Fastify 5 tipa el `error` del handler como `unknown` (en 4 era
  // FastifyError), así que se normaliza una vez en lugar de castear campo a
  // campo. El comportamiento es idéntico: mismos códigos, mismo mensaje.
  app.setErrorHandler((error, request, reply) => {
    const err = error as { statusCode?: number; code?: string; message?: string }
    const statusCode = err.statusCode ?? 500
    const code = err.code ?? 'INTERNAL_ERROR'

    if (statusCode >= 500) {
      app.log.error(error)
      captureException(error, {
        url: request.url,
        method: request.method,
        statusCode,
        code,
      })
    }

    reply.status(statusCode).send({
      error: statusCode < 500 ? (err.message ?? 'Solicitud inválida') : 'Error interno del servidor',
      code,
    })
  })

  // ── Health checks ────────────────────────────────────────────────

  app.get('/health', async () => ({
    status: 'ok',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  }))

  // Readiness. Distingue dependencias REQUERIDAS de OPCIONALES a propósito:
  // este endpoint es el healthcheck del despliegue, así que marcar el
  // servicio como no-listo equivale a impedir que arranque.
  //
  // Postgres y Redis son requeridos: sin ellos no hay autenticación, sesiones,
  // ni datos — el servicio no puede atender nada útil.
  //
  // Neo4j es opcional: solo alimenta el grafo de reputación, y todos sus
  // usos degradan (ver recordReputationEvent). Antes contaba como requerido,
  // lo que hacía imposible desplegar sin Neo4j aunque el piloto lo excluya
  // explícitamente: el healthcheck devolvía 503 para siempre y la plataforma
  // mataba el contenedor por "never became healthy". Su estado se sigue
  // reportando para poder vigilarlo, pero ya no bloquea el arranque.
  app.get('/health/ready', async (_request, reply) => {
    const checks: Record<string, 'ok' | 'fail'> = {}
    let healthy = true

    try {
      await redis.ping()
      checks.redis = 'ok'
    } catch {
      checks.redis = 'fail'
      healthy = false
    }

    try {
      await prisma.$queryRaw`SELECT 1`
      checks.database = 'ok'
    } catch {
      checks.database = 'fail'
      healthy = false
    }

    try {
      await getNeo4jDriver().verifyConnectivity()
      checks.neo4j = 'ok'
    } catch {
      checks.neo4j = 'fail'
    }

    return reply.status(healthy ? 200 : 503).send({
      status: healthy ? (checks.neo4j === 'ok' ? 'ok' : 'degraded') : 'unavailable',
      checks,
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    })
  })

  // ── Routes ───────────────────────────────────────────────────────

  app.register(authRoutes, { prefix: '/auth' })
  app.register(identityRoutes, { prefix: '/identity' })
  app.register(territorialRoutes, { prefix: '/territorial' })
  app.register(governanceRoutes, { prefix: '/governance' })
  app.register(reputationRoutes, { prefix: '/reputation' })
  app.register(legalRoutes, { prefix: '/legal' })
  app.register(aiRoutes, { prefix: '/ai' })
  app.register(notificationsRoutes, { prefix: '/notifications' })
  app.register(eventsRoutes)

  return app
}
