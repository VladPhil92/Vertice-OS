import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import sensible from '@fastify/sensible'
import { config } from './config'
import { redis } from './lib/redis'
import { authRoutes } from './modules/auth/auth.routes'

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

  // ── Error handler global ─────────────────────────────────────────

  app.setErrorHandler((error, _request, reply) => {
    const statusCode = (error as { statusCode?: number }).statusCode ?? 500
    const code = (error as { code?: string }).code ?? 'INTERNAL_ERROR'

    if (statusCode >= 500) {
      app.log.error(error)
    }

    reply.status(statusCode).send({
      error: statusCode < 500 ? error.message : 'Error interno del servidor',
      code,
    })
  })

  // ── Health check ─────────────────────────────────────────────────

  app.get('/health', async () => ({
    status: 'ok',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  }))

  // ── Routes ───────────────────────────────────────────────────────

  app.register(authRoutes, { prefix: '/auth' })

  return app
}
