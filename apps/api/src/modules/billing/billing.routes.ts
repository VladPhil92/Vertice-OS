import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../middleware/auth'
import { getBillingCatalog, getEffectiveBillingAccess } from './billing.service'

export async function billingRoutes(app: FastifyInstance): Promise<void> {
  app.get('/plans', async (_request, reply) => {
    return reply.send(getBillingCatalog())
  })

  app.get('/me', { preHandler: requireAuth }, async (request, reply) => {
    return reply.send(await getEffectiveBillingAccess(request.citizen.sub))
  })
}
