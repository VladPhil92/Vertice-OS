import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../middleware/auth'
import { createVeriffVerificationSession } from './identity-provider-veriff'

/**
 * Citizen-facing provider bootstrap routes.
 *
 * VÉRTICE sends only its opaque citizen UUID as vendorData/endUserId. Document
 * media and identity attributes are collected in Veriff's hosted flow and are
 * never proxied through the VÉRTICE web application.
 */
export async function identityProviderSessionRoutes(app: FastifyInstance): Promise<void> {
  app.post('/veriff/session', {
    preHandler: requireAuth,
    config: { rateLimit: { max: 3, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const session = await createVeriffVerificationSession(request.citizen.sub)
    return reply.status(201).send(session)
  })
}
