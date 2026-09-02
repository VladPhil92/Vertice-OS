import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../middleware/auth'
import { getCitizenCommandCenter } from './dashboard.service'

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  app.get('/me', { preHandler: requireAuth }, async (request, reply) => {
    const dashboard = await getCitizenCommandCenter(request.citizen.sub)
    return reply.send(dashboard)
  })
}
