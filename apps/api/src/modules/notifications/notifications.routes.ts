import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../middleware/auth'
import { publish } from '../../lib/pubsub'
import {
  getNotifications,
  markRead,
  markAllRead,
  unreadCount,
} from './notifications.service'

export async function notificationsRoutes(app: FastifyInstance): Promise<void> {

  // ── GET /notifications — lista de notificaciones del ciudadano ────────────

  app.get('/', {
    preHandler: requireAuth,
    config: { rateLimit: { max: 60, timeWindow: '1 min' } },
  }, async (request, reply) => {
    const notifs = await getNotifications(request.citizen.sub)
    const count = notifs.filter(n => !n.read).length
    return reply.send({ notifications: notifs, unread: count })
  })

  // ── PUT /notifications/read-all — marcar todas como leídas ───────────────

  app.put('/read-all', {
    preHandler: requireAuth,
    config: { rateLimit: { max: 20, timeWindow: '1 min' } },
  }, async (request, reply) => {
    await markAllRead(request.citizen.sub)
    return reply.send({ ok: true })
  })

  // ── PUT /notifications/:id/read — marcar una como leída ──────────────────

  app.put('/:id/read', {
    preHandler: requireAuth,
    config: { rateLimit: { max: 60, timeWindow: '1 min' } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const ok = await markRead(request.citizen.sub, id)
    if (!ok) {
      return reply.status(404).send({ error: 'Notificación no encontrada' })
    }
    return reply.send({ ok: true })
  })

  // ── GET /notifications/unread-count — conteo sin leer (para polling ligero)

  app.get('/unread-count', {
    preHandler: requireAuth,
    config: { rateLimit: { max: 120, timeWindow: '1 min' } },
  }, async (request, reply) => {
    const count = await unreadCount(request.citizen.sub)
    // Push via SSE so other open tabs update immediately
    await publish('system', 'notification:unread', { citizenId: request.citizen.sub, count })
    return reply.send({ count })
  })
}
