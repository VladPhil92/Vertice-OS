import type { FastifyInstance } from 'fastify'
import { CommunityFeedQuerySchema, CommunityLeaderboardQuerySchema } from './community.schema'
import { getCommunityLeaderboard, listCommunityFeed } from './community.service'

export async function communityRoutes(app: FastifyInstance): Promise<void> {
  // Public-by-design civic activity surface. It only exposes already-public
  // report/proposal content plus deterministic, explainable derived scores.
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
    })
  })
}
