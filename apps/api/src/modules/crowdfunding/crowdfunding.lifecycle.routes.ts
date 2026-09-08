import type { FastifyInstance, FastifyReply } from 'fastify'
import { z } from 'zod'
import { requireAdmin, requireAuth, requireVerified } from '../../middleware/auth'
import {
  executeIdempotentMutation,
  normalizeRequestedIdempotencyKey,
  type IdempotentMutationResult,
} from '../../lib/idempotency'
import { createCampaignDraftSchema } from './crowdfunding.schema'
import {
  getOwnCampaignLifecycle,
  reviewCampaignLifecycle,
  submitOwnCampaignForReview,
  updateOwnCampaignDraft,
} from './crowdfunding.lifecycle.service'

const campaignParamsSchema = z.object({ campaignId: z.string().uuid() })
const lifecycleReviewSchema = z.object({
  decision: z.enum(['approve', 'request_changes', 'reject', 'suspend']),
  notes: z.string().trim().min(10).max(2_000).optional(),
}).superRefine((input, ctx) => {
  if (input.decision !== 'approve' && !input.notes) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['notes'],
      message: 'Esta decisión requiere observaciones de al menos 10 caracteres.',
    })
  }
})

function sendMutation<T>(reply: FastifyReply, result: IdempotentMutationResult<T>) {
  reply.header('Idempotency-Key', result.idempotencyKey)
  reply.header('Idempotency-Replayed', result.replayed ? 'true' : 'false')
  return reply.status(result.statusCode).send(result.value)
}

export async function crowdfundingLifecycleRoutes(app: FastifyInstance): Promise<void> {
  app.get('/me/campaigns/:campaignId', { preHandler: requireAuth }, async (request, reply) => {
    const params = campaignParamsSchema.safeParse(request.params)
    if (!params.success) {
      return reply.status(400).send({ error: 'Campaña inválida', code: 'INVALID_CAMPAIGN_ID' })
    }
    return reply.send(await getOwnCampaignLifecycle(request.citizen.sub, params.data.campaignId))
  })

  app.put('/me/campaigns/:campaignId', { preHandler: requireAuth }, async (request, reply) => {
    const params = campaignParamsSchema.safeParse(request.params)
    const body = createCampaignDraftSchema.safeParse(request.body)
    if (!params.success || !body.success) {
      return reply.status(400).send({
        error: 'Borrador de campaña inválido',
        code: 'INVALID_CAMPAIGN_DRAFT',
        details: body.success ? undefined : body.error.flatten(),
      })
    }

    const result = await executeIdempotentMutation({
      citizenId: request.citizen.sub,
      scope: `crowdfunding:campaign:update:${params.data.campaignId}`,
      payload: body.data,
      requestedKey: normalizeRequestedIdempotencyKey(request.headers['idempotency-key']),
      successStatus: 200,
      operation: async () => ({
        campaign: await updateOwnCampaignDraft(request.citizen.sub, params.data.campaignId, body.data),
      }),
    })
    return sendMutation(reply, result)
  })

  app.post('/me/campaigns/:campaignId/submit-review', { preHandler: requireVerified }, async (request, reply) => {
    const params = campaignParamsSchema.safeParse(request.params)
    if (!params.success) {
      return reply.status(400).send({ error: 'Campaña inválida', code: 'INVALID_CAMPAIGN_ID' })
    }

    const result = await executeIdempotentMutation({
      citizenId: request.citizen.sub,
      scope: `crowdfunding:campaign:submit-review:${params.data.campaignId}`,
      payload: { campaignId: params.data.campaignId },
      requestedKey: normalizeRequestedIdempotencyKey(request.headers['idempotency-key']),
      successStatus: 200,
      operation: async () => ({
        campaign: await submitOwnCampaignForReview(request.citizen.sub, params.data.campaignId),
        nextStep: 'admin_compliance_review' as const,
      }),
    })
    return sendMutation(reply, result)
  })

  app.post('/admin/lifecycle/campaigns/:campaignId/review', { preHandler: requireAdmin }, async (request, reply) => {
    const params = campaignParamsSchema.safeParse(request.params)
    const body = lifecycleReviewSchema.safeParse(request.body)
    if (!params.success || !body.success) {
      return reply.status(400).send({
        error: 'Revisión de campaña inválida',
        code: 'INVALID_CAMPAIGN_REVIEW',
        details: body.success ? undefined : body.error.flatten(),
      })
    }

    const result = await executeIdempotentMutation({
      citizenId: request.citizen.sub,
      scope: `crowdfunding:campaign:admin-review:${params.data.campaignId}`,
      payload: body.data,
      requestedKey: normalizeRequestedIdempotencyKey(request.headers['idempotency-key']),
      successStatus: 200,
      operation: async () => ({
        campaign: await reviewCampaignLifecycle(
          request.citizen.sub,
          params.data.campaignId,
          body.data,
        ),
      }),
    })
    return sendMutation(reply, result)
  })
}
