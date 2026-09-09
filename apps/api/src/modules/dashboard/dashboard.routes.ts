import type { FastifyInstance } from 'fastify'
import { requireAdmin, requireAuth } from '../../middleware/auth'
import { ENTITLEMENTS } from '../billing/billing.catalog'
import { requireEntitlement } from '../billing/billing.middleware'
import { getMyTerritory } from '../territories/territories.service'
import { getCivicEvidenceAttentionQueue } from './dashboard.attention.service'
import { buildCitizenOperationalCsv } from './dashboard.export.service'
import { getCivicActionResolutionPlan } from './dashboard.resolution.service'
import { getCitizenCommandCenter } from './dashboard.service'
import { getPilotControlCenter } from './pilot.service'

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  app.get('/me', { preHandler: requireAuth }, async (request, reply) => {
    const [dashboard, territory] = await Promise.all([
      getCitizenCommandCenter(request.citizen.sub),
      getMyTerritory(request.citizen.sub),
    ])
    return reply.send({
      ...dashboard,
      profile: {
        ...dashboard.profile,
        territory_code: territory.territory_code,
        territory_name: territory.territory_name,
        territory_level: territory.territory_level,
        department_code: territory.department_code,
        department_name: territory.department_name,
        territory_activation_status: territory.activation_status,
      },
    })
  })

  app.get('/me/attention', { preHandler: requireAuth }, async (request, reply) => {
    return reply.send(await getCivicEvidenceAttentionQueue(request.citizen.sub))
  })

  app.get('/me/resolution', { preHandler: requireAuth }, async (request, reply) => {
    return reply.send(await getCivicActionResolutionPlan(request.citizen.sub))
  })

  app.get('/me/export.csv', { preHandler: requireEntitlement(ENTITLEMENTS.EXPORT_REPORTS) }, async (request, reply) => {
    const csv = await buildCitizenOperationalCsv(request.citizen.sub)
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
    reply.header('Content-Disposition', `attachment; filename="vertice-operacion-${date}.csv"`)
    reply.type('text/csv; charset=utf-8')
    return reply.send(`\uFEFF${csv}`)
  })

  app.get('/admin/pilot', { preHandler: requireAdmin }, async (_request, reply) => {
    return reply.send(await getPilotControlCenter())
  })
}
