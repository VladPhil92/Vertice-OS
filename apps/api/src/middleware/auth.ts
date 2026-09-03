import { Prisma } from '@prisma/client'
import type { FastifyRequest, FastifyReply } from 'fastify'
import type { AccessTokenPayload, CitizenRole } from '../lib/jwt'
import { prisma } from '../lib/prisma'

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

async function requireLiveRole(
  request: FastifyRequest,
  reply: FastifyReply,
  acceptedRoles: CitizenRole[],
): Promise<void> {
  await requireAuth(request, reply)
  if (reply.sent) return

  const activeRole = request.citizen.role
  if (!acceptedRoles.includes(activeRole)) {
    reply.status(403).send({ error: 'Acceso restringido', code: 'FORBIDDEN' })
    return
  }

  const rows = request.citizen.sid
    ? await prisma.$queryRaw<Array<{ ok: number }>>(Prisma.sql`
        SELECT 1 AS ok
        FROM citizen_role_grants g
        JOIN sessions s
          ON s.citizen_id = g.citizen_id
         AND s.id = ${request.citizen.sid}::uuid
         AND s.revoked_at IS NULL
         AND s.expires_at > NOW()
         AND s.active_role = ${activeRole}
        WHERE g.citizen_id = ${request.citizen.sub}::uuid
          AND g.role = ${activeRole}
          AND g.revoked_at IS NULL
        LIMIT 1
      `)
    : await prisma.$queryRaw<Array<{ ok: number }>>(Prisma.sql`
        SELECT 1 AS ok
        FROM citizen_role_grants
        WHERE citizen_id = ${request.citizen.sub}::uuid
          AND role = ${activeRole}
          AND revoked_at IS NULL
        LIMIT 1
      `)

  if (!rows[0]) {
    reply.status(403).send({ error: 'El rol activo ya no está autorizado', code: 'ROLE_GRANT_REVOKED' })
  }
}

export async function requireModerator(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await requireLiveRole(request, reply, ['moderator', 'admin', 'superadmin'])
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await requireLiveRole(request, reply, ['admin', 'superadmin'])
}

export async function requireSuperadmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await requireLiveRole(request, reply, ['superadmin'])
}
