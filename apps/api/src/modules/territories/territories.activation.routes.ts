import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAdmin, requireAuth, requireSuperadmin } from '../../middleware/auth'
import { COHORT_ROLES } from './territories.operations'
import {
  INTEREST_STATUSES,
  listActivationInterestsForAdmin,
  listMyActivationInterests,
  reviewActivationInterest,
  submitActivationInterest,
  withdrawActivationInterest,
} from './territories.activation'

const CodeParams = z.object({ code: z.string().trim().min(2).max(32) })
const InterestParams = z.object({
  code: z.string().trim().min(2).max(32),
  role: z.enum(COHORT_ROLES),
})
const InterestIdParams = z.object({ id: z.string().uuid() })
const SubmitBody = z.object({
  interest_role: z.enum(COHORT_ROLES),
  message: z.string().trim().max(500).nullable().optional(),
})
const AdminQuery = z.object({
  status: z.enum(INTEREST_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})
const ReviewBody = z.object({
  status: z.enum(['approved', 'declined']),
  reason: z.string().trim().min(8).max(1000),
})

/**
 * Phase 7C citizen activation workflow.
 * Approval is operational review only. It never creates a role grant, cohort
 * assignment, identity/territory assurance, reputation or governance authority.
 */
export async function territoryCitizenActivationRoutes(app: FastifyInstance): Promise<void> {
  app.get('/me/interests', { preHandler: requireAuth }, async (request, reply) => {
    const data = await listMyActivationInterests(request.citizen.sub)
    return reply.send({ data, count: data.length, authority_effect: 'none' })
  })

  app.post('/:code/interests', {
    preHandler: requireAuth,
    config: { rateLimit: { max: 12, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const params = CodeParams.safeParse(request.params)
    const body = SubmitBody.safeParse(request.body)
    if (!params.success || !body.success) {
      return reply.status(400).send({ error: 'Manifestación de interés inválida' })
    }
    const result = await submitActivationInterest({
      citizenId: request.citizen.sub,
      territoryCode: params.data.code,
      interestRole: body.data.interest_role,
      message: body.data.message,
    })
    return reply.status(201).send(result)
  })

  app.delete('/:code/interests/:role', {
    preHandler: requireAuth,
    config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const params = InterestParams.safeParse(request.params)
    if (!params.success) return reply.status(400).send({ error: 'Manifestación de interés inválida' })
    return reply.send(await withdrawActivationInterest({
      citizenId: request.citizen.sub,
      territoryCode: params.data.code,
      interestRole: params.data.role,
    }))
  })

  app.get('/admin/:code/interests', { preHandler: requireAdmin }, async (request, reply) => {
    const params = CodeParams.safeParse(request.params)
    const query = AdminQuery.safeParse(request.query)
    if (!params.success || !query.success) {
      return reply.status(400).send({ error: 'Cola de activación inválida' })
    }
    const data = await listActivationInterestsForAdmin({
      territoryCode: params.data.code,
      status: query.data.status,
      limit: query.data.limit,
    })
    return reply.send({ data, count: data.length, authority_boundary: 'operational_only' })
  })

  app.patch('/admin/interests/:id', {
    preHandler: requireSuperadmin,
    config: { rateLimit: { max: 60, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const params = InterestIdParams.safeParse(request.params)
    const body = ReviewBody.safeParse(request.body)
    if (!params.success || !body.success) {
      return reply.status(400).send({ error: 'Revisión de interés inválida' })
    }
    return reply.send(await reviewActivationInterest({
      actorId: request.citizen.sub,
      interestId: params.data.id,
      status: body.data.status,
      reason: body.data.reason,
    }))
  })
}
