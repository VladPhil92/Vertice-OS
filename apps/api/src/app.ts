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
import { dashboardRoutes } from './modules/dashboard/dashboard.routes'
import { identityRoutes } from './modules/identity/identity.routes'
import { territorialRoutes } from './modules/territorial/territorial.routes'
import { governanceRoutes } from './modules/governance/governance.routes'
import { reputationRoutes } from './modules/reputation/reputation.routes'
import { legalRoutes } from './modules/legal/legal.routes'
import { aiRoutes } from './modules/ai/ai.routes'
import { eventsRoutes } from './modules/events/events.routes'
import { notificationsRoutes } from './modules/notifications/notifications.routes'
import { workflowRoutes } from './modules/workflows/workflow.routes'

initSentry()

const DEPENDENCY_PROBE_TIMEOUT_MS = 2500

function deployedRevision(): string {
  return process.env.RAILWAY_GIT_COMMIT_SHA
    ?? process.env.GITHUB_SHA
    ?? process.env.VERCEL_GIT_COMMIT_SHA
    ?? 'unknown'
}

async function withTimeout<T>(label: string, work: Promise<T>, timeoutMs = DEPENDENCY_PROBE_TIMEOUT_MS): Promise<T> {
  let timer: NodeJS.Timeout | undefined
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} probe timed out after ${timeoutMs}ms`)), timeoutMs)
  })

  try {
    return await Promise.race([work, timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

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
    revision: deployedRevision(),
    timestamp: new Date().toISOString(),
  }))

  // Readiness. Distingue dependencias REQUERIDAS de OPCIONALES a propósito:
  // este endpoint es el healthcheck del despliegue, así que marcar el
  // servicio como no-listo equivale a impedir que arranque.
  //
  // Postgres y Redis son requeridos: sin ellos no hay autenticación, sesiones,
  // ni datos — el servicio no puede atender nada útil.
  //
  // Neo4j es opcional: solo alimenta el grafo de reputación. Su conectividad
  // nunca debe bloquear la respuesta de readiness. Las tres sondas se ejecutan
  // en paralelo y con timeout explícito para que una dependencia inaccesible
  // no pueda consumir por sí sola toda la ventana de healthcheck de Railway.
  app.get('/health/ready', async (_request, reply) => {
    const [redisProbe, databaseProbe, neo4jProbe] = await Promise.allSettled([
      withTimeout('redis', redis.ping()),
      withTimeout('database', prisma.$queryRaw`SELECT 1`),
      withTimeout('neo4j', getNeo4jDriver().verifyConnectivity()),
    ])

    const checks: Record<string, 'ok' | 'fail'> = {
      redis: redisProbe.status === 'fulfilled' ? 'ok' : 'fail',
      database: databaseProbe.status === 'fulfilled' ? 'ok' : 'fail',
      neo4j: neo4jProbe.status === 'fulfilled' ? 'ok' : 'fail',
    }

    for (const [dependency, probe] of [
      ['redis', redisProbe],
      ['database', databaseProbe],
      ['neo4j', neo4jProbe],
    ] as const) {
      if (probe.status === 'rejected') {
        const message = probe.reason instanceof Error ? probe.reason.message : String(probe.reason)
        app.log.warn({ dependency, message }, '[health] dependency probe failed')
      }
    }

    const healthy = checks.redis === 'ok' && checks.database === 'ok'

    return reply.status(healthy ? 200 : 503).send({
      status: healthy ? (checks.neo4j === 'ok' ? 'ok' : 'degraded') : 'unavailable',
      checks,
      version: '0.1.0',
      revision: deployedRevision(),
      timestamp: new Date().toISOString(),
    })
  })

  // ── Routes ───────────────────────────────────────────────────────

  app.register(authRoutes, { prefix: '/auth' })
  app.register(dashboardRoutes, { prefix: '/dashboard' })
  app.register(identityRoutes, { prefix: '/identity' })
  app.register(territorialRoutes, { prefix: '/territorial' })
  app.register(governanceRoutes, { prefix: '/governance' })
  app.register(reputationRoutes, { prefix: '/reputation' })
  app.register(legalRoutes, { prefix: '/legal' })
  app.register(aiRoutes, { prefix: '/ai' })
  app.register(workflowRoutes, { prefix: '/workflows' })
  app.register(notificationsRoutes, { prefix: '/notifications' })
  app.register(eventsRoutes)

  return app
}
