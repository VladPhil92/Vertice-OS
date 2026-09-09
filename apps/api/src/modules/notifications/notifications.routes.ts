import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../../middleware/auth'
import { publish } from '../../lib/pubsub'
import {
  getNotifications,
  markRead,
  markAllRead,
  unreadCount,
  registerPushDevice,
  unregisterPushDevice,
  getPushDeviceStatus,
} from './notifications.service'
import { registerPushDevice, revokePushDevice } from './push-devices.service'

const PushDeviceSchema = z.object({
  installation_id: z.string().regex(/^[A-Za-z0-9_-]{12,128}$/),
  expo_push_token: z.string().regex(/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/),
  platform: z.enum(['android', 'ios']),
})

const ExpoPushTokenSchema = z.string()
  .max(255)
  .refine(
    (value) => /^(ExpoPushToken|ExponentPushToken)\[[^\]]+\]$/.test(value),
    'Invalid Expo push token',
  )

const RegisterPushDeviceSchema = z.object({
  expo_push_token: ExpoPushTokenSchema,
  platform: z.enum(['ios', 'android']),
  app_version: z.string().trim().min(1).max(64).nullable().optional(),
})

const UnregisterPushDeviceSchema = z.object({
  expo_push_token: ExpoPushTokenSchema,
})

export async function notificationsRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /notifications/push-devices — registrar instalación móvil ────────

  app.post('/push-devices', {
    preHandler: requireAuth,
    config: { rateLimit: { max: 20, timeWindow: '1 min' } },
  }, async (request, reply) => {
    const parsed = PushDeviceSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Registro de dispositivo push inválido',
        code: 'INVALID_PUSH_DEVICE',
      })
    }

    const device = await registerPushDevice(request.citizen.sub, parsed.data)
    return reply.send(device)
  })

  // ── DELETE /notifications/push-devices/:installationId — revocar ─────────

  app.delete('/push-devices/:installationId', {
    preHandler: requireAuth,
    config: { rateLimit: { max: 20, timeWindow: '1 min' } },
  }, async (request, reply) => {
    const { installationId } = request.params as { installationId: string }
    if (!/^[A-Za-z0-9_-]{12,128}$/.test(installationId)) {
      return reply.status(400).send({ error: 'Instalación inválida', code: 'INVALID_INSTALLATION_ID' })
    }

    await revokePushDevice(request.citizen.sub, installationId)
    // Idempotent revocation: a repeated logout must not reveal whether a token existed.
    return reply.send({ ok: true })
  })

  // ── Device push destinations — durable opt-in, scoped to authenticated user ─

  app.post('/devices', {
    preHandler: requireAuth,
    config: { rateLimit: { max: 20, timeWindow: '1 min' } },
  }, async (request, reply) => {
    const parsed = RegisterPushDeviceSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Registro de notificaciones inválido' })
    }

    await registerPushDevice(
      request.citizen.sub,
      parsed.data.expo_push_token,
      parsed.data.platform,
      parsed.data.app_version ?? null,
    )

    return reply.status(200).send({ ok: true })
  })

  app.delete('/devices', {
    preHandler: requireAuth,
    config: { rateLimit: { max: 20, timeWindow: '1 min' } },
  }, async (request, reply) => {
    const parsed = UnregisterPushDeviceSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Token de notificaciones inválido' })
    }

    const disabled = await unregisterPushDevice(request.citizen.sub, parsed.data.expo_push_token)
    return reply.send({ ok: true, disabled })
  })

  app.get('/devices/status', {
    preHandler: requireAuth,
    config: { rateLimit: { max: 60, timeWindow: '1 min' } },
  }, async (request, reply) => {
    return reply.send(await getPushDeviceStatus(request.citizen.sub))
  })

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
