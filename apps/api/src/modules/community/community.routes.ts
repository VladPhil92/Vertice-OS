import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../middleware/auth'
import {
  CommunityFeedQuerySchema,
  CommunityLeaderboardQuerySchema,
  UpdateCivicProfileSchema,
} from './community.schema'
import {
  getCivicProfile,
  getCommunityLeaderboard,
  listCommunityFeed,
  updateCivicProfile,
} from './community.service'

export async function communityRoutes(app: FastifyInstance): Promise<void> {
  // Public activity is privacy-safe: actors that have not opted into a public
  // civic profile remain anonymous and never appear in the leaderboard.
  app.get('/feed', async (request, reply) => {
    const parsed = CommunityFeedQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Parámetros inválidos',
        details: parsed.error.flatten().fieldErrors,
      })
    }

    const data = await listCommunityFeed(parsed.data)
    return reply.send({
      data,
      count: data.length,
      scoring: {
        version: 'civic-action-v1',
        max_score: 100,
        dimensions: {
          evidence: 25,
          results: 20,
          impact: 15,
          validation: 10,
          transparency: 5,
          collaboration: 5,
          continuity: 5,
          confidence: 15,
        },
        note: 'El score prioriza evidencia y resultados. Seguidores, likes y popularidad no suman puntos.',
      },
    })
  })

  app.get('/leaderboard', async (request, reply) => {
    const parsed = CommunityLeaderboardQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Parámetros inválidos',
        details: parsed.error.flatten().fieldErrors,
      })
    }

    const data = await getCommunityLeaderboard(parsed.data)
    return reply.send({
      data,
      count: data.length,
      ranking_basis: 'acciones + evidencia + resultados verificados',
      excludes: ['seguidores', 'likes', 'impresiones'],
      scoring_version: 'civic-action-v1',
      visibility: 'solo perfiles cívicos publicados voluntariamente',
    })
  })

  app.get('/profile/me', { preHandler: requireAuth }, async (request, reply) => {
    return reply.send(await getCivicProfile(request.citizen.sub))
  })

  app.patch('/profile/me', {
    preHandler: requireAuth,
    config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const parsed = UpdateCivicProfileSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Perfil cívico inválido',
        details: parsed.error.flatten().fieldErrors,
      })
    }
    return reply.send(await updateCivicProfile(request.citizen.sub, parsed.data))
  })
}
