import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAuth, requireSuperadmin } from '../../middleware/auth'
import { getTerritoryFeed } from './territories.feed'
import { getNationalActivationRanking } from './territories.ranking'
import { territoryLaunchOperationsRoutes } from './territories.operations.routes'
import {
  ACTIVATION_STATUSES,
  TERRITORY_LEVELS,
  getActivationMetrics,
  getMyTerritory,
  getTerritory,
  listTerritories,
  setActivationStatus,
  setMyTerritory,
  syncDivipolaCatalog,
} from './territories.service'

const ListQuery = z.object({
  level: z.enum(TERRITORY_LEVELS).optional(),
  parent_code: z.string().trim().max(32).optional(),
  activation_status: z.enum(ACTIVATION_STATUSES).optional(),
  q: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

const TerritoryParams = z.object({ code: z.string().trim().min(2).max(32) })
const SelectTerritoryBody = z.object({
  territory_code: z.string().trim().min(2).max(32),
  neighborhood: z.string().trim().max(120).nullable().optional(),
})
const ActivationBody = z.object({
  status: z.enum(ACTIVATION_STATUSES),
  reason: z.string().trim().min(8).max(500),
})
const RankingQuery = z.object({ limit: z.coerce.number().int().min(1).max(100).default(25) })
const FeedQuery = z.object({ limit: z.coerce.number().int().min(1).max(30).default(12) })

export async function territoriesRoutes(app: FastifyInstance): Promise<void> {
  // Register the Phase 7B control plane before the generic /:code routes.
  // All mutations inside this subtree require live superadmin authority.
  await app.register(territoryLaunchOperationsRoutes, { prefix: '/admin/operations' })

  app.get('/', async (request, reply) => {
    const parsed = ListQuery.safeParse(request.query)
    if (!parsed.success) return reply.status(400).send({ error: 'Filtros territoriales inválidos', details: parsed.error.flatten().fieldErrors })
    const data = await listTerritories(parsed.data)
    return reply.send({ data, count: data.length })
  })

  app.get('/activation/ranking', async (request, reply) => {
    const parsed = RankingQuery.safeParse(request.query)
    if (!parsed.success) return reply.status(400).send({ error: 'Parámetros inválidos', details: parsed.error.flatten().fieldErrors })
    const data = await getNationalActivationRanking(parsed.data.limit)
    return reply.send({
      data,
      count: data.length,
      scoring_boundary: 'civic_activity_only',
      note: 'El momentum territorial no concede identidad, reputación, autoridad ni peso de voto.',
    })
  })

  app.get('/me', { preHandler: requireAuth }, async (request, reply) => {
    return reply.send(await getMyTerritory(request.citizen.sub))
  })

  app.put('/me', {
    preHandler: requireAuth,
    config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const parsed = SelectTerritoryBody.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Territorio inválido', details: parsed.error.flatten().fieldErrors })
    const result = await setMyTerritory(request.citizen.sub, parsed.data.territory_code, parsed.data.neighborhood)
    return reply.send({
      ...result,
      territory_assurance: 'self_asserted',
      governance_effect: 'none_without_territory_assurance',
    })
  })

  app.post('/admin/sync-divipola', {
    preHandler: requireSuperadmin,
    config: { rateLimit: { max: 4, timeWindow: '1 hour' } },
  }, async (_request, reply) => reply.send(await syncDivipolaCatalog({ force: true })))

  app.patch('/admin/:code/activation', {
    preHandler: requireSuperadmin,
    config: { rateLimit: { max: 30, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const params = TerritoryParams.safeParse(request.params)
    const body = ActivationBody.safeParse(request.body)
    if (!params.success || !body.success) {
      return reply.status(400).send({
        error: 'Cambio de activación inválido',
        details: body.success ? undefined : body.error.flatten().fieldErrors,
      })
    }
    return reply.send(await setActivationStatus({
      actorId: request.citizen.sub,
      territoryCode: params.data.code,
      status: body.data.status,
      reason: body.data.reason,
    }))
  })

  app.get('/:code/feed', async (request, reply) => {
    const params = TerritoryParams.safeParse(request.params)
    const query = FeedQuery.safeParse(request.query)
    if (!params.success || !query.success) return reply.status(400).send({ error: 'Feed territorial inválido' })
    return reply.send(await getTerritoryFeed(params.data.code, query.data.limit))
  })

  app.get('/:code/activation', async (request, reply) => {
    const parsed = TerritoryParams.safeParse(request.params)
    if (!parsed.success) return reply.status(400).send({ error: 'Código territorial inválido' })
    return reply.send(await getActivationMetrics(parsed.data.code))
  })

  app.get('/:code', async (request, reply) => {
    const parsed = TerritoryParams.safeParse(request.params)
    if (!parsed.success) return reply.status(400).send({ error: 'Código territorial inválido' })
    return reply.send(await getTerritory(parsed.data.code))
  })
}
