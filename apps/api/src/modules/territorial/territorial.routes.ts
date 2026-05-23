import { FastifyInstance } from 'fastify'
import { requireVerified } from '../../middleware/auth'
import { CreateReportSchema, ListReportsSchema, NearbySchema, UpdateStatusSchema } from './territorial.schema'
import {
  createReport,
  listReports,
  getReportById,
  getNearbyReports,
  updateReportStatus,
  getTerritorialStats,
} from './territorial.service'

export async function territorialRoutes(app: FastifyInstance): Promise<void> {
  // ── Públicos ──────────────────────────────────────────────────────────────

  // GET /territorial/reports — listado con filtros opcionales
  app.get('/reports', async (request, reply) => {
    const parsed = ListReportsSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Parámetros inválidos', details: parsed.error.flatten().fieldErrors })
    }
    const reports = await listReports(parsed.data)
    return reply.send({ data: reports, count: reports.length })
  })

  // GET /territorial/reports/nearby — reportes cercanos por coordenadas
  app.get('/reports/nearby', async (request, reply) => {
    const parsed = NearbySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Parámetros inválidos', details: parsed.error.flatten().fieldErrors })
    }
    const reports = await getNearbyReports(parsed.data)
    return reply.send({ data: reports, count: reports.length })
  })

  // GET /territorial/stats — estadísticas agregadas por categoría
  app.get('/stats', async (_request, reply) => {
    const stats = await getTerritorialStats()
    return reply.send(stats)
  })

  // GET /territorial/reports/:id — detalle de un reporte
  app.get('/reports/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const report = await getReportById(id)
    return reply.send(report)
  })

  // ── Requieren identidad verificada (lvl ≥ 1) ──────────────────────────────

  // POST /territorial/reports — crear reporte
  app.post('/reports', {
    preHandler: requireVerified,
    config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const parsed = CreateReportSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors })
    }
    const report = await createReport(request.citizen.sub, parsed.data)
    return reply.status(201).send(report)
  })

  // PATCH /territorial/reports/:id/status — actualizar estado
  app.patch('/reports/:id/status', {
    preHandler: requireVerified,
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = UpdateStatusSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors })
    }
    const report = await updateReportStatus(id, parsed.data)
    return reply.send(report)
  })
}
