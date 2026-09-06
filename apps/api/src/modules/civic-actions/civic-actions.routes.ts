import type { FastifyInstance } from 'fastify'
import { requireAuth, requireModerator, requireVerified } from '../../middleware/auth'
import {
  CivicActionEvidenceSchema,
  CivicActionLeaderboardQuerySchema,
  CivicActionListQuerySchema,
  CivicActionParamsSchema,
  CivicActionReviewSchema,
  CivicActionValidationSchema,
  CreateCivicActionSchema,
  UpdateCivicActionSchema,
} from './civic-actions.schema'
import { CIVIC_REPUTATION_VERSION, CIVIC_SCORE_MAX } from './civic-actions.score'
import {
  addCivicActionEvidence,
  createCivicAction,
  getCivicAction,
  getCivicActionLeaderboard,
  getCivicActionValidationState,
  listCivicActionEvidence,
  listCivicActions,
  listMyCivicActions,
  removeCivicActionValidation,
  reviewCivicAction,
  setCivicActionValidation,
  updateCivicAction,
} from './civic-actions.service'

export async function civicActionsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (request, reply) => {
    const parsed = CivicActionListQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Parámetros inválidos',
        details: parsed.error.flatten().fieldErrors,
      })
    }
    const data = await listCivicActions(parsed.data)
    return reply.send({
      data,
      count: data.length,
      scoring: {
        version: CIVIC_REPUTATION_VERSION,
        max_score: 100,
        dimensions: CIVIC_SCORE_MAX,
        confidence_is_separate: true,
        excludes: ['seguidores', 'likes', 'impresiones'],
      },
    })
  })

  app.get('/mine', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = CivicActionListQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Parámetros inválidos' })
    }
    const data = await listMyCivicActions(request.citizen.sub, parsed.data)
    return reply.send({ data, count: data.length })
  })

  app.get('/leaderboard', async (request, reply) => {
    const parsed = CivicActionLeaderboardQuerySchema.safeParse(request.query)
    if (!parsed.success) return reply.status(400).send({ error: 'Parámetros inválidos' })
    const data = await getCivicActionLeaderboard(parsed.data)
    return reply.send({
      data,
      count: data.length,
      ranking_basis: 'score de acciones + confianza de evidencia + tasa de verificación',
      excludes: ['seguidores', 'likes', 'impresiones'],
      scoring_version: CIVIC_REPUTATION_VERSION,
    })
  })

  app.post('/', {
    preHandler: requireVerified,
    config: { rateLimit: { max: 30, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const parsed = CreateCivicActionSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Acción cívica inválida',
        details: parsed.error.flatten().fieldErrors,
      })
    }
    const action = await createCivicAction(request.citizen.sub, parsed.data)
    return reply.status(201).send(action)
  })

  app.get('/:actionId', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = CivicActionParamsSchema.safeParse(request.params)
    if (!parsed.success) return reply.status(400).send({ error: 'Acción inválida' })
    return reply.send(await getCivicAction(parsed.data.actionId, request.citizen.sub))
  })

  app.patch('/:actionId', {
    preHandler: requireVerified,
    config: { rateLimit: { max: 60, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const params = CivicActionParamsSchema.safeParse(request.params)
    const body = UpdateCivicActionSchema.safeParse(request.body)
    if (!params.success || !body.success) {
      return reply.status(400).send({
        error: 'Actualización inválida',
        details: body.success ? undefined : body.error.flatten().fieldErrors,
      })
    }
    return reply.send(await updateCivicAction(
      request.citizen.sub,
      params.data.actionId,
      body.data,
    ))
  })

  app.get('/:actionId/evidence', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = CivicActionParamsSchema.safeParse(request.params)
    if (!parsed.success) return reply.status(400).send({ error: 'Acción inválida' })
    return reply.send({
      data: await listCivicActionEvidence(parsed.data.actionId, request.citizen.sub),
    })
  })

  app.post('/:actionId/evidence', {
    preHandler: requireVerified,
    config: { rateLimit: { max: 60, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const params = CivicActionParamsSchema.safeParse(request.params)
    const body = CivicActionEvidenceSchema.safeParse(request.body)
    if (!params.success || !body.success) {
      return reply.status(400).send({
        error: 'Evidencia inválida',
        details: body.success ? undefined : body.error.flatten().fieldErrors,
      })
    }
    return reply.status(201).send(await addCivicActionEvidence(
      request.citizen.sub,
      params.data.actionId,
      body.data,
    ))
  })

  app.get('/:actionId/validations', async (request, reply) => {
    const parsed = CivicActionParamsSchema.safeParse(request.params)
    if (!parsed.success) return reply.status(400).send({ error: 'Acción inválida' })
    return reply.send(await getCivicActionValidationState(parsed.data.actionId))
  })

  app.put('/:actionId/validation', {
    preHandler: requireVerified,
    config: { rateLimit: { max: 60, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const params = CivicActionParamsSchema.safeParse(request.params)
    const body = CivicActionValidationSchema.safeParse(request.body)
    if (!params.success || !body.success) {
      return reply.status(400).send({
        error: 'Validación inválida',
        details: body.success ? undefined : body.error.flatten().fieldErrors,
      })
    }
    return reply.send(await setCivicActionValidation(
      request.citizen.sub,
      params.data.actionId,
      body.data,
    ))
  })

  app.delete('/:actionId/validation', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = CivicActionParamsSchema.safeParse(request.params)
    if (!parsed.success) return reply.status(400).send({ error: 'Acción inválida' })
    return reply.send(await removeCivicActionValidation(
      request.citizen.sub,
      parsed.data.actionId,
    ))
  })

  app.post('/:actionId/review', {
    preHandler: requireModerator,
    config: { rateLimit: { max: 120, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const params = CivicActionParamsSchema.safeParse(request.params)
    const body = CivicActionReviewSchema.safeParse(request.body)
    if (!params.success || !body.success) {
      return reply.status(400).send({
        error: 'Revisión inválida',
        details: body.success ? undefined : body.error.flatten().fieldErrors,
      })
    }
    return reply.send(await reviewCivicAction(
      request.citizen.sub,
      params.data.actionId,
      body.data,
    ))
  })
}
