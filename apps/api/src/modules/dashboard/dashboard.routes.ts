import type { FastifyInstance } from 'fastify'
import { requireAdmin, requireAuth } from '../../middleware/auth'
import { getCitizenCommandCenter } from './dashboard.service'
import { getPilotControlCenter } from './pilot.service'

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  app.get('/me', { preHandler: requireAuth }, async (request, reply) => {
    const dashboard = await getCitizenCommandCenter(request.citizen.sub)
    return reply.send(dashboard)
  })

  app.get('/admin/pilot', { preHandler: requireAdmin }, async (_request, reply) => {
    return reply.send(await getPilotControlCenter())
  })
}
