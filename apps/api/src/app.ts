import Fastify from 'fastify'
import cors from '@fastify/cors'
import pkg from '../package.json'
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
import { assessRuntimeReadiness, type RuntimeDependencyChecks } from './lib/runtime-readiness'
import { assessClosedPilotReadiness } from './lib/closed-pilot-readiness'
import { getClosedPilotAccessState } from './lib/closed-pilot-access'
import { initSentry, captureException } from './lib/sentry'
import { authRoutes } from './modules/auth/auth.routes'
import { mobileAuthRoutes } from './modules/auth/mobile-auth.routes'
import { superadminControlPlaneRoutes } from './modules/auth/control-plane.routes'
import { probeCtgOneFederation } from './modules/auth/federation.service'
import { dashboardRoutes } from './modules/dashboard/dashboard.routes'
import { identityRoutes } from './modules/identity/identity.routes'
import { identityProviderCertificationRoutes } from './modules/identity/identity-provider-certification.routes'
import { identityProviderWebhookRoutes } from './modules/identity/identity-provider-webhook.routes'
import { identityProviderSessionRoutes } from './modules/identity/identity-provider-session.routes'
import { territorialRoutes } from './modules/territorial/territorial.routes'
import { territoriesRoutes } from './modules/territories/territories.routes'
import { governanceRoutes } from './modules/governance/governance.routes'
import { reputationRoutes } from './modules/reputation/reputation.routes'
import { communityRoutes } from './modules/community/community.routes'
import { civicActionsRoutes } from './modules/civic-actions/civic-actions.routes'
import { legalRoutes } from './modules/legal/legal.routes'
import { aiRoutes } from './modules/ai/ai.routes'
import { eventsRoutes } from './modules/events/events.routes'
import { notificationsRoutes } from './modules/notifications/notifications.routes'
import { workflowRoutes } from './modules/workflows/workflow.routes'
import { billingRoutes } from './modules/billing/billing.routes'
import { financeOperationsRoutes } from './modules/billing/finance-operations.routes'
import { crowdfundingRoutes } from './modules/crowdfunding/crowdfunding.routes'
import { crowdfundingLifecycleRoutes } from './modules/crowdfunding/crowdfunding.lifecycle.routes'
import { publishingRoutes } from './modules/publishing/publishing.routes'
import { pilotRoutes } from './modules/pilot/pilot.routes'

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
  app.register(helmet, { contentSecurityPolicy: false })
  app.register(cors, {
    origin: config.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
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

  const livenessPayload = () => ({
    status: 'ok' as const,
    version: pkg.version,
    revision: deployedRevision(),
    timestamp: new Date().toISOString(),
  })

  const probeRuntime = async () => {
    const [redisProbe, databaseProbe, neo4jProbe] = await Promise.allSettled([
      withTimeout('redis', redis.ping()),
      withTimeout('database', prisma.$queryRaw`SELECT 1`),
      withTimeout('neo4j', getNeo4jDriver().verifyConnectivity()),
    ])

    const checks: RuntimeDependencyChecks = {
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
    const revision = deployedRevision()
    const assessment = assessRuntimeReadiness({
      checks,
      capabilities,
      revision,
      production: config.NODE_ENV === 'production',
    })

    return { checks, capabilities, revision, assessment }
  }

  // Backward-compatible liveness endpoint. It intentionally performs no
  // network dependency probes; schedulers can use /health/live explicitly.
  app.get('/health', async () => livenessPayload())
  app.get('/health/live', async () => livenessPayload())

  // Serving readiness: only core dependencies (Postgres + Redis) block traffic.
  // Optional/degraded capabilities stay observable without taking civic basics down.
  app.get('/health/ready', async (_request, reply) => {
    const { checks, capabilities, revision, assessment } = await probeRuntime()

    return reply.status(assessment.servingReady ? 200 : 503).send({
      status: assessment.status,
      checks,
      capabilities,
      version: pkg.version,
      revision,
      timestamp: new Date().toISOString(),
    })
  })

  // Release readiness is intentionally stricter than serving readiness. A
  // partially configured feature or an untraceable production revision blocks
  // promotion even when the base API can safely continue serving free civic use.
  app.get('/health/release', async (_request, reply) => {
    const { checks, capabilities, revision, assessment } = await probeRuntime()

    return reply.status(assessment.releaseReady ? 200 : 503).send({
      status: assessment.releaseReady ? 'ready' : 'blocked',
      serving_status: assessment.status,
      blockers: assessment.blockers,
      checks,
      capabilities,
      version: pkg.version,
      revision,
      timestamp: new Date().toISOString(),
    })
  })

  // Phase 7H closed-pilot gate. Unlike generic serving readiness, the first
  // real-user cohort exercises Community/social graph behavior, so Neo4j is
  // mandatory here. Real-money capabilities must remain disabled, invitation
  // access must be enforced, and production must expose an immutable revision.
  app.get('/health/pilot', async (_request, reply) => {
    const { checks, capabilities, revision, assessment } = await probeRuntime()
    const access = getClosedPilotAccessState()
    const pilot = assessClosedPilotReadiness({
      checks,
      capabilities,
      access,
      revision,
      production: config.NODE_ENV === 'production',
    })

    return reply.status(pilot.ready ? 200 : 503).send({
      status: pilot.status,
      blockers: pilot.blockers,
      safeguards: pilot.safeguards,
      access_control: access,
      serving_status: assessment.status,
      release_ready: assessment.releaseReady,
      checks,
      capabilities,
      version: pkg.version,
      revision,
      timestamp: new Date().toISOString(),
    })
  })

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
  app.register(mobileAuthRoutes, { prefix: '/auth/mobile' })
  app.register(superadminControlPlaneRoutes, { prefix: '/superadmin' })
  app.register(dashboardRoutes, { prefix: '/dashboard' })
  app.register(identityProviderCertificationRoutes, { prefix: '/identity/provider-certifications' })
  app.register(identityProviderSessionRoutes, { prefix: '/identity/providers' })
  app.register(identityProviderWebhookRoutes, { prefix: '/identity/providers' })
  app.register(identityRoutes, { prefix: '/identity' })
  app.register(territorialRoutes, { prefix: '/territorial' })
  app.register(territoriesRoutes, { prefix: '/territories' })
  app.register(governanceRoutes, { prefix: '/governance' })
  app.register(reputationRoutes, { prefix: '/reputation' })
  app.register(communityRoutes, { prefix: '/community' })
  app.register(civicActionsRoutes, { prefix: '/civic-actions' })
  app.register(legalRoutes, { prefix: '/legal' })
  app.register(aiRoutes, { prefix: '/ai' })
  app.register(workflowRoutes, { prefix: '/workflows' })
  app.register(notificationsRoutes, { prefix: '/notifications' })
  app.register(billingRoutes, { prefix: '/billing' })
  app.register(financeOperationsRoutes, { prefix: '/billing/admin/finance' })
  app.register(crowdfundingRoutes, { prefix: '/crowdfunding' })
  app.register(crowdfundingLifecycleRoutes, { prefix: '/crowdfunding' })
  app.register(publishingRoutes, { prefix: '/publishing' })
  app.register(pilotRoutes, { prefix: '/pilot' })
  app.register(eventsRoutes)

  return app
}
