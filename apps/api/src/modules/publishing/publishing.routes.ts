import type { FastifyInstance } from 'fastify'
import { ENTITLEMENTS } from '../billing/billing.catalog'
import { requireEntitlement } from '../billing/billing.middleware'
import { PublicationParamsSchema, ScheduleCivicPublicationSchema } from './publishing.schema'
import {
  cancelScheduledPublication,
  listMyScheduledPublications,
  scheduleCivicPublication,
} from './publishing.service'

export async function publishingRoutes(app: FastifyInstance): Promise<void> {
  const proPublishing = requireEntitlement(ENTITLEMENTS.PUBLISHING_AUTOMATION)

  app.get('/scheduled', { preHandler: proPublishing }, async (request, reply) => {
    const publications = await listMyScheduledPublications(request.citizen.sub)
    return reply.send({ publications, count: publications.length })
  })

  app.post('/scheduled', {
    preHandler: proPublishing,
    config: { rateLimit: { max: 30, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const parsed = ScheduleCivicPublicationSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Publicación programada inválida',
        code: 'INVALID_SCHEDULED_PUBLICATION',
        details: parsed.error.flatten().fieldErrors,
      })
    }
    return reply.status(201).send(await scheduleCivicPublication(request.citizen.sub, parsed.data))
  })

  app.delete('/scheduled/:publicationId', { preHandler: proPublishing }, async (request, reply) => {
    const parsed = PublicationParamsSchema.safeParse(request.params)
    if (!parsed.success) return reply.status(400).send({ error: 'Publicación inválida' })
    return reply.send(await cancelScheduledPublication(request.citizen.sub, parsed.data.publicationId))
  })
}
