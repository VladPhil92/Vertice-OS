import type { FastifyInstance, FastifyReply } from 'fastify'
import { requireVerified, requireModerator } from '../../middleware/auth'
import {
  executeIdempotentMutation,
  normalizeRequestedIdempotencyKey,
  type IdempotentMutationResult,
} from '../../lib/idempotency'
import { assertCommunityContentAllowed } from '../community/community.content-filter'
import { ensureCommunityPolicyAccepted } from '../community/community.safety.service'
import {
  assertCommunityTargetVisible,
  filterVisibleCommunityTargets,
} from '../community/community.visibility.service'
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

function sendMutation<T>(reply: FastifyReply, result: IdempotentMutationResult<T>) {
  reply.header('Idempotency-Key', result.idempotencyKey)
  reply.header('Idempotency-Replayed', result.replayed ? 'true' : 'false')
  return reply.status(result.statusCode).send(result.value)
}

export async function territorialRoutes(app: FastifyInstance): Promise<void> {
  app.get('/reports', async (request, reply) => {
    const parsed = ListReportsSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Parámetros inválidos', details: parsed.error.flatten().fieldErrors })
    }
    const raw = await listReports(parsed.data)
    const reports = await filterVisibleCommunityTargets('report', raw)
    return reply.send({ data: reports, count: reports.length })
  })

  app.get('/reports/nearby', async (request, reply) => {
    const parsed = NearbySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Parámetros inválidos', details: parsed.error.flatten().fieldErrors })
    }
    const raw = await getNearbyReports(parsed.data)
    const reports = await filterVisibleCommunityTargets('report', raw)
    return reply.send({ data: reports, count: reports.length })
  })

  app.get('/stats', async (_request, reply) => reply.send(await getTerritorialStats()))

  app.get('/reports/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    await assertCommunityTargetVisible('report', id)
    return reply.send(await getReportById(id))
  })

  // Upload intents are intentionally ephemeral and are not replayed from the
  // idempotency ledger: a stored provider upload URL may expire.
  app.post('/media/upload-intent', {
    preHandler: requireVerified,
    config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
  }, async (request, reply) => reply.send(await createReportMediaUploadIntent(request.citizen.sub)))

  app.post('/media/confirm', {
    preHandler: requireVerified,
    config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const parsed = ConfirmReportMediaSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Evidencia inválida', details: parsed.error.flatten().fieldErrors })
    }
    return reply.send(await confirmReportMediaUpload(request.citizen.sub, parsed.data.media_asset_id))
  })

  app.post('/reports', {
    preHandler: requireVerified,
    config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const parsed = CreateReportSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors })
    }
    await ensureCommunityPolicyAccepted(request.citizen.sub)
    assertCommunityContentAllowed([
      { field: 'title', value: parsed.data.title },
      { field: 'description', value: parsed.data.description },
      { field: 'subcategory', value: parsed.data.subcategory },
      { field: 'address_reference', value: parsed.data.address_reference },
    ])
    const result = await executeIdempotentMutation({
      citizenId: request.citizen.sub,
      scope: 'territorial:report:create',
      payload: parsed.data,
      requestedKey: normalizeRequestedIdempotencyKey(request.headers['idempotency-key']),
      successStatus: 201,
      operation: () => createReport(request.citizen.sub, parsed.data),
    })
    return sendMutation(reply, result)
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
    await ensureCommunityPolicyAccepted(request.citizen.sub)
    const result = await executeIdempotentMutation({
      citizenId: request.citizen.sub,
      scope: `territorial:report:evidence:${params.data.id}`,
      payload: body.data,
      requestedKey: normalizeRequestedIdempotencyKey(request.headers['idempotency-key']),
      operation: () => attachReportEvidence(
        request.citizen.sub,
        params.data.id,
        body.data.media_asset_ids,
      ),
    })
    return sendMutation(reply, result)
  })

  app.patch('/reports/:id/status', { preHandler: requireModerator }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = UpdateStatusSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors })
    }
    return reply.send(await updateReportStatus(id, parsed.data))
  })

  // Moderators intentionally bypass the public visibility overlay so actioned
  // records remain inspectable in the moderation/operations control plane.
  app.get('/admin/reports', { preHandler: requireModerator }, async (request, reply) => {
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
