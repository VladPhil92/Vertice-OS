import { FastifyRequest, FastifyReply } from 'fastify'
import { AccessTokenPayload } from '../lib/jwt'

declare module 'fastify' {
  interface FastifyRequest {
    citizen: AccessTokenPayload
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify<AccessTokenPayload>()
    request.citizen = request.user as AccessTokenPayload
  } catch {
    reply.status(401).send({ error: 'No autorizado', code: 'UNAUTHORIZED' })
  }
}

export async function requireVerified(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await requireAuth(request, reply)
  if (reply.sent) return

  if (request.citizen.lvl < 1) {
    reply.status(403).send({ error: 'Identidad no verificada', code: 'IDENTITY_NOT_VERIFIED' })
  }
}
