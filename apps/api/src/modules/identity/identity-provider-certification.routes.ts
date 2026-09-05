import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireSuperadmin } from '../../middleware/auth'
import {
  certifyExternalProviderFromPersistedEvents,
  listExternalProviderCertifications,
  revokeExternalProviderCertification,
} from './identity-provider-external-certification.service'

const EventIdSchema = z.string().min(1).max(191).regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,190}$/)

const CertifyBodySchema = z.object({
  verified_event_id: EventIdSchema,
  revoked_event_id: EventIdSchema,
  expired_event_id: EventIdSchema,
}).strict()

const RevokeBodySchema = z.object({
  reason: z.string().trim().min(10).max(500),
}).strict()

export async function identityProviderCertificationRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireSuperadmin)

  app.get('/', async (_request, reply) => {
    const certifications = await listExternalProviderCertifications()
    return reply.send({ certifications })
  })

  app.post('/:provider/certify', async (request, reply) => {
    const { provider } = request.params as { provider: string }
    const parsed = CertifyBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Contrato de certificación inválido',
        code: 'INVALID_PROVIDER_CERTIFICATION_BODY',
      })
    }

    const result = await certifyExternalProviderFromPersistedEvents(
      provider,
      parsed.data,
      request.citizen.sub,
    )
    return reply.status(result.duplicate ? 200 : 201).send({
      certified: true,
      duplicate: result.duplicate,
      certification: result.certification,
    })
  })

  app.post('/:provider/revoke', async (request, reply) => {
    const { provider } = request.params as { provider: string }
    const parsed = RevokeBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'La razón de revocación es inválida',
        code: 'INVALID_PROVIDER_CERTIFICATION_REVOCATION_BODY',
      })
    }

    const certification = await revokeExternalProviderCertification(
      provider,
      request.citizen.sub,
      parsed.data.reason,
    )
    return reply.send({ revoked: true, certification })
  })
}
