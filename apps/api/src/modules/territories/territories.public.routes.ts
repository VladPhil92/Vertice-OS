import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getPublicCityOverview } from './territories.public'

const CodeParams = z.object({ code: z.string().trim().min(2).max(32) })
const OverviewQuery = z.object({ feed_limit: z.coerce.number().int().min(1).max(12).default(8) })

/** Public, aggregate-only city projection. No PII or operator-only blockers. */
export async function territoryPublicRoutes(app: FastifyInstance): Promise<void> {
  app.get('/:code', async (request, reply) => {
    const params = CodeParams.safeParse(request.params)
    const query = OverviewQuery.safeParse(request.query)
    if (!params.success || !query.success) {
      return reply.status(400).send({ error: 'Parámetros de ciudad inválidos' })
    }
    return reply.send(await getPublicCityOverview(params.data.code, query.data.feed_limit))
  })
}
