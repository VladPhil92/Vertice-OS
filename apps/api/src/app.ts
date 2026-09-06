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
import { getFeatureCapabilities } from './lib/feature-secrets'
import { initSentry, captureException } from './lib/sentry'
import { authRoutes } from './modules/auth/auth.routes'
import { probeCtgOneFederation } from './modules/auth/federation.service'
import { dashboardRoutes } from './modules/dashboard/dashboard.routes'
import { identityRoutes } from './modules/identity/identity.routes'
import { identityProviderCertificationRoutes } from './modules/identity/identity-provider-certification.routes'
import { identityProviderWebhookRoutes } from './modules/identity/identity-provider-webhook.routes'
import { identityProviderSessionRoutes } from './modules/identity/identity-provider-session.routes'
import { territorialRoutes } from './modules/territorial/territorial.routes'
import { governanceRoutes } from './modules/governance/governance.routes'
import { reputationRoutes } from './modules/reputation/reputation.routes'
import { communityRoutes } from './modules/community/community.routes'
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

  app.register(sensible)

  app.register(helmet, {
    contentSecurityPolicy: false,
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

  app.get('/health', async () => ({
    status: 'ok',
    version: '0.1.0',
    revision: deployedRevision(),
    timestamp: new Date().toISOString(),
  }))

  // PostgreSQL and Redis are the only deployment-blocking runtime dependencies.
  // Neo4j and feature-scoped integrations can degrade independently and are
  // surfaced below without leaking secrets, provider names, addresses or URLs.
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

    const capabilities = getFeatureCapabilities()
    const healthy = checks.redis === 'ok' && checks.database === 'ok'
    // "disabled" is a deliberate feature state and does not make the core API
    // unhealthy. "misconfigured" means an operator enabled part of a feature
    // but omitted another required value and should be visible as degradation.
    const featureDegraded = Object.values(capabilities).some((state) => state === 'misconfigured')
    const dependencyDegraded = checks.neo4j !== 'ok'

    return reply.status(healthy ? 200 : 503).send({
      status: healthy
        ? (dependencyDegraded || featureDegraded ? 'degraded' : 'ok')
        : 'unavailable',
      checks,
      capabilities,
      version: '0.1.0',
      revision: deployedRevision(),
      timestamp: new Date().toISOString(),
    })
  })

  // On-demand operational canary for CTG One federation. This endpoint never
  // uses a real authorization code and never returns credentials or provider
  // configuration. It exists to distinguish secret/configuration drift from
  // network/provider failures without weakening the fail-closed auth path.
  app.get('/health/federation', async (_request, reply) => {
    const probe = await probeCtgOneFederation()
    return reply.status(probe.status === 'ready' ? 200 : 503).send({
      status: probe.status,
      ...(probe.remote_status ? { remote_status: probe.remote_status } : {}),
      revision: deployedRevision(),
      timestamp: new Date().toISOString(),
    })
  })

  app.register(authRoutes, { prefix: '/auth' })
  app.register(dashboardRoutes, { prefix: '/dashboard' })
  // P1.0 keeps JSON certification administration outside the raw-body webhook
  // parser while preserving the common identity provider namespace.
  app.register(identityProviderCertificationRoutes, { prefix: '/identity/provider-certifications' })
  app.register(identityProviderSessionRoutes, { prefix: '/identity/providers' })
  app.register(identityProviderWebhookRoutes, { prefix: '/identity/providers' })
  app.register(identityRoutes, { prefix: '/identity' })
  app.register(territorialRoutes, { prefix: '/territorial' })
  app.register(governanceRoutes, { prefix: '/governance' })
  app.register(reputationRoutes, { prefix: '/reputation' })
  app.register(communityRoutes, { prefix: '/community' })
  app.register(legalRoutes, { prefix: '/legal' })
  app.register(aiRoutes, { prefix: '/ai' })
  app.register(workflowRoutes, { prefix: '/workflows' })
  app.register(notificationsRoutes, { prefix: '/notifications' })
  app.register(eventsRoutes)

  return app
}
