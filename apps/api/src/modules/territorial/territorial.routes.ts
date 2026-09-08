import type { FastifyInstance } from 'fastify'
import { requireVerified, requireModerator } from '../../middleware/auth'
import {
  AttachReportMediaSchema,
  ConfirmReportMediaSchema,
  CreateReportSchema,
  ListReportsSchema,
  NearbySchema,
  ReportIdParamsSchema,
  UpdateStatusSchema,
} from './territorial.schema'
import {
  createReport,
  listReports,
  getReportById,
  getNearbyReports,
  updateReportStatus,
  getTerritorialStats,
} from './territorial.service'
import {
  attachReportEvidence,
  confirmReportMediaUpload,
  createReportMediaUploadIntent,
} from './report-media.service'

export async function territorialRoutes(app: FastifyInstance): Promise<void> {
  app.get('/reports', async (request, reply) => {
    const parsed = ListReportsSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Parámetros inválidos', details: parsed.error.flatten().fieldErrors })
    }
    const reports = await listReports(parsed.data)
    return reply.send({ data: reports, count: reports.length })
  })

  app.get('/reports/nearby', async (request, reply) => {
    const parsed = NearbySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Parámetros inválidos', details: parsed.error.flatten().fieldErrors })
    }
    const reports = await getNearbyReports(parsed.data)
    return reply.send({ data: reports, count: reports.length })
  })

  app.get('/stats', async (_request, reply) => {
    return reply.send(await getTerritorialStats())
  })

  // Preserve the legacy route contract here: service-level lookup remains the
  // authority for not-found behavior. New evidence mutations validate UUIDs.
  app.get('/reports/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    return reply.send(await getReportById(id))
  })

  app.post('/media/upload-intent', {
    preHandler: requireVerified,
    config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    return reply.send(await createReportMediaUploadIntent(request.citizen.sub))
  })

  app.post('/media/confirm', {
    preHandler: requireVerified,
    config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const parsed = ConfirmReportMediaSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Evidencia inválida',
        details: parsed.error.flatten().fieldErrors,
      })
    }
    return reply.send(await confirmReportMediaUpload(
      request.citizen.sub,
      parsed.data.media_asset_id,
    ))
  })

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

  app.post('/reports/:id/media', {
    preHandler: requireVerified,
    config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const params = ReportIdParamsSchema.safeParse(request.params)
    const body = AttachReportMediaSchema.safeParse(request.body)
    if (!params.success || !body.success) {
      return reply.status(400).send({
        error: 'Evidencia inválida',
        details: body.success ? undefined : body.error.flatten().fieldErrors,
      })
    }
    return reply.send(await attachReportEvidence(
      request.citizen.sub,
      params.data.id,
      body.data.media_asset_ids,
    ))
  })

  app.patch('/reports/:id/status', {
    preHandler: requireModerator,
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = UpdateStatusSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors })
    }
    return reply.send(await updateReportStatus(id, parsed.data))
  })

  app.get('/admin/reports', {
    preHandler: requireModerator,
  }, async (request, reply) => {
    const { status, category, locality_id } = request.query as {
      status?: string; category?: string; locality_id?: string
    }
    const reports = await listReports({
      status: status as Parameters<typeof listReports>[0]['status'],
      category: category as Parameters<typeof listReports>[0]['category'],
      locality_id: locality_id ? Number(locality_id) : undefined,
      limit: 100,
      offset: 0,
    })
    return reply.send({ data: reports, count: reports.length })
  })
}
