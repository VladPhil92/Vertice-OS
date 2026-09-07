import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireSuperadmin } from '../../middleware/auth'
import {
  getSuperadminControlPlaneOverview,
  listSuperadminAuditEvents,
} from './control-plane.service'

const AuditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(30),
})

export async function superadminControlPlaneRoutes(app: FastifyInstance): Promise<void> {
  app.get('/overview', {
    preHandler: requireSuperadmin,
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  }, async (_request, reply) => {
    return reply.send(await getSuperadminControlPlaneOverview())
  })

  app.get('/audit', {
    preHandler: requireSuperadmin,
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const parsed = AuditQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Consulta de auditoría inválida',
        code: 'INVALID_AUDIT_QUERY',
      })
    }
    return reply.send({
      data: await listSuperadminAuditEvents(parsed.data.limit),
      limit: parsed.data.limit,
    })
  })
}
