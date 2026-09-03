import { Prisma } from '@prisma/client'
import type { FastifyInstance } from 'fastify'

import { config } from '../../config'
import { recordAuditEvent } from '../../lib/audit'
import { prisma } from '../../lib/prisma'
import type { AccessTokenPayload, CitizenRole } from '../../lib/jwt'

export const CITIZEN_ROLES = ['citizen', 'moderator', 'admin', 'superadmin'] as const
const BOOTSTRAP_AUTHORITY = 'bootstrap_superadmin'

function isCitizenRole(value: unknown): value is CitizenRole {
  return typeof value === 'string' && CITIZEN_ROLES.includes(value as CitizenRole)
}

function highestRole(roles: CitizenRole[]): CitizenRole {
  for (const role of [...CITIZEN_ROLES].reverse()) {
    if (roles.includes(role)) return role
  }
  return 'citizen'
}

export async function getAssignedRoles(citizenId: string): Promise<CitizenRole[]> {
  const rows = await prisma.$queryRaw<Array<{ role: string }>>(Prisma.sql`
    SELECT role
    FROM citizen_role_grants
    WHERE citizen_id = ${citizenId}::uuid
      AND revoked_at IS NULL
  `)
  const assigned = rows.map((row) => row.role).filter(isCitizenRole)
  return CITIZEN_ROLES.filter((role) => assigned.includes(role))
}

export async function ensureRoleGrant(
  citizenId: string,
  role: CitizenRole,
  source: string,
  grantedByCitizenId?: string | null,
): Promise<void> {
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO citizen_role_grants
      (citizen_id, role, source, granted_by_citizen_id, granted_at, revoked_at)
    VALUES
      (${citizenId}::uuid, ${role}, ${source}, ${grantedByCitizenId ?? null}::uuid, NOW(), NULL)
    ON CONFLICT (citizen_id, role)
    DO UPDATE SET
      source = EXCLUDED.source,
      granted_by_citizen_id = EXCLUDED.granted_by_citizen_id,
      granted_at = NOW(),
      revoked_at = NULL
  `)
}

export async function ensureBaselineRoleGrants(citizenId: string, preferredRole: CitizenRole): Promise<CitizenRole> {
  await ensureRoleGrant(citizenId, 'citizen', 'session_baseline')
  if (preferredRole !== 'citizen') {
    await ensureRoleGrant(citizenId, preferredRole, 'legacy_role')
  }
  return preferredRole
}

export async function bootstrapFederatedSuperadmin(
  citizenId: string,
  authorities: string[],
): Promise<CitizenRole | null> {
  await ensureRoleGrant(citizenId, 'citizen', 'ctg_one')
  if (!authorities.includes(BOOTSTRAP_AUTHORITY)) return null

  const [existing] = await prisma.$queryRaw<Array<{ has_grant: boolean; total_superadmins: bigint }>>(Prisma.sql`
    SELECT
      EXISTS(
        SELECT 1 FROM citizen_role_grants
        WHERE citizen_id = ${citizenId}::uuid
          AND role = 'superadmin'
          AND revoked_at IS NULL
      ) AS has_grant,
      (
        SELECT COUNT(*) FROM citizen_role_grants
        WHERE role = 'superadmin' AND revoked_at IS NULL
      ) AS total_superadmins
  `)

  // CTG One may only establish the very first VERTICE superadmin. Once a
  // superadmin exists, all future grants are controlled from VERTICE itself.
  if (!existing?.has_grant && Number(existing?.total_superadmins ?? 0) > 0) return null

  for (const role of CITIZEN_ROLES) {
    await ensureRoleGrant(citizenId, role, 'ctg_one_bootstrap')
  }
  await prisma.citizen.update({ where: { id: citizenId }, data: { role: 'superadmin' } })

  await recordAuditEvent({
    actorId: citizenId,
    action: 'role.bootstrap_superadmin',
    targetType: 'citizen',
    targetId: citizenId,
    result: 'granted',
    metadata: { source: 'ctg_one_federation' },
  })
  return 'superadmin'
}

export async function setSessionActiveRole(sessionId: string, citizenId: string, role: CitizenRole): Promise<void> {
  await prisma.$executeRaw(Prisma.sql`
    UPDATE sessions
    SET active_role = ${role}
    WHERE id = ${sessionId}::uuid
      AND citizen_id = ${citizenId}::uuid
      AND revoked_at IS NULL
  `)
}

export async function getRoleContext(citizenId: string, sessionId?: string): Promise<{
  assigned_roles: CitizenRole[]
  active_role: CitizenRole
}> {
  const assignedRoles = await getAssignedRoles(citizenId)
  if (!assignedRoles.includes('citizen')) {
    await ensureRoleGrant(citizenId, 'citizen', 'session_baseline')
    assignedRoles.unshift('citizen')
  }

  let activeRole: CitizenRole = 'citizen'
  if (sessionId) {
    const rows = await prisma.$queryRaw<Array<{ active_role: string }>>(Prisma.sql`
      SELECT active_role
      FROM sessions
      WHERE id = ${sessionId}::uuid
        AND citizen_id = ${citizenId}::uuid
        AND revoked_at IS NULL
        AND expires_at > NOW()
      LIMIT 1
    `)
    if (isCitizenRole(rows[0]?.active_role) && assignedRoles.includes(rows[0].active_role as CitizenRole)) {
      activeRole = rows[0].active_role as CitizenRole
    }
  }
  return { assigned_roles: assignedRoles, active_role: activeRole }
}

export async function switchSessionRole(
  app: FastifyInstance,
  payload: AccessTokenPayload,
  requestedRole: unknown,
): Promise<{ access_token: string; token_type: 'Bearer'; expires_in: number; active_role: CitizenRole }> {
  if (!payload.sid) {
    throw Object.assign(new Error('Vuelve a iniciar sesión antes de cambiar de rol'), {
      statusCode: 401,
      code: 'ROLE_SWITCH_REAUTH_REQUIRED',
    })
  }
  if (!isCitizenRole(requestedRole)) {
    throw Object.assign(new Error('Rol inválido'), { statusCode: 400, code: 'INVALID_ROLE' })
  }

  const rows = await prisma.$queryRaw<Array<{ did: string; verification_level: number }>>(Prisma.sql`
    SELECT c.did, c.verification_level
    FROM sessions s
    JOIN citizens c ON c.id = s.citizen_id
    JOIN citizen_role_grants g
      ON g.citizen_id = s.citizen_id
     AND g.role = ${requestedRole}
     AND g.revoked_at IS NULL
    WHERE s.id = ${payload.sid}::uuid
      AND s.citizen_id = ${payload.sub}::uuid
      AND s.revoked_at IS NULL
      AND s.expires_at > NOW()
    LIMIT 1
  `)
  const citizen = rows[0]
  if (!citizen) {
    throw Object.assign(new Error('Ese rol no está asignado a tu cuenta'), {
      statusCode: 403,
      code: 'ROLE_NOT_GRANTED',
    })
  }

  await setSessionActiveRole(payload.sid, payload.sub, requestedRole)
  const nextPayload: AccessTokenPayload = {
    sub: payload.sub,
    did: citizen.did,
    lvl: citizen.verification_level,
    role: requestedRole,
    sid: payload.sid,
  }
  const accessToken = app.jwt.sign(nextPayload, { expiresIn: config.JWT_ACCESS_EXPIRY_SECONDS })

  await recordAuditEvent({
    actorId: payload.sub,
    action: 'role.switch',
    targetType: 'session',
    targetId: payload.sid,
    result: 'success',
    metadata: { from: payload.role, to: requestedRole },
  })

  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: config.JWT_ACCESS_EXPIRY_SECONDS,
    active_role: requestedRole,
  }
}

export async function listCitizensForRoleAdmin(query: string): Promise<Array<{
  id: string
  email: string | null
  display_name: string | null
  roles: CitizenRole[]
}>> {
  const pattern = `%${query.trim()}%`
  const rows = await prisma.$queryRaw<Array<{
    id: string
    email: string | null
    display_name: string | null
    roles: string[] | null
  }>>(Prisma.sql`
    SELECT
      c.id,
      c.email,
      c.display_name,
      COALESCE(
        ARRAY_AGG(g.role ORDER BY g.role) FILTER (WHERE g.revoked_at IS NULL),
        ARRAY[]::text[]
      ) AS roles
    FROM citizens c
    LEFT JOIN citizen_role_grants g ON g.citizen_id = c.id
    WHERE ${query.trim() === ''} OR c.email ILIKE ${pattern} OR c.display_name ILIKE ${pattern} OR c.id::text ILIKE ${pattern}
    GROUP BY c.id, c.email, c.display_name
    ORDER BY c.created_at DESC
    LIMIT 25
  `)

  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    roles: CITIZEN_ROLES.filter((role) => (row.roles ?? []).includes(role)),
  }))
}

export async function replaceCitizenRoles(
  actorId: string,
  targetCitizenId: string,
  requestedRolesRaw: unknown,
): Promise<CitizenRole[]> {
  if (!Array.isArray(requestedRolesRaw) || !requestedRolesRaw.every(isCitizenRole)) {
    throw Object.assign(new Error('Lista de roles inválida'), { statusCode: 400, code: 'INVALID_ROLES' })
  }

  const requested = Array.from(new Set<CitizenRole>(['citizen', ...requestedRolesRaw]))
  const current = await getAssignedRoles(targetCitizenId)
  if (current.length === 0) {
    const exists = await prisma.citizen.findUnique({ where: { id: targetCitizenId }, select: { id: true } })
    if (!exists) throw Object.assign(new Error('Usuario no encontrado'), { statusCode: 404, code: 'USER_NOT_FOUND' })
  }

  if (current.includes('superadmin') && !requested.includes('superadmin')) {
    const [row] = await prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
      SELECT COUNT(*) AS total
      FROM citizen_role_grants
      WHERE role = 'superadmin' AND revoked_at IS NULL
    `)
    if (Number(row?.total ?? 0) <= 1) {
      throw Object.assign(new Error('No puedes eliminar al último superadmin de VÉRTICE'), {
        statusCode: 409,
        code: 'LAST_SUPERADMIN_PROTECTED',
      })
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const role of requested) {
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO citizen_role_grants
          (citizen_id, role, source, granted_by_citizen_id, granted_at, revoked_at)
        VALUES
          (${targetCitizenId}::uuid, ${role}, 'superadmin_dashboard', ${actorId}::uuid, NOW(), NULL)
        ON CONFLICT (citizen_id, role)
        DO UPDATE SET
          source = EXCLUDED.source,
          granted_by_citizen_id = EXCLUDED.granted_by_citizen_id,
          granted_at = NOW(),
          revoked_at = NULL
      `)
    }

    const roleList = Prisma.join(requested.map((role) => Prisma.sql`${role}`))
    await tx.$executeRaw(Prisma.sql`
      UPDATE citizen_role_grants
      SET revoked_at = NOW()
      WHERE citizen_id = ${targetCitizenId}::uuid
        AND revoked_at IS NULL
        AND role NOT IN (${roleList})
    `)
    await tx.citizen.update({
      where: { id: targetCitizenId },
      data: { role: highestRole(requested) },
    })
    await tx.$executeRaw(Prisma.sql`
      UPDATE sessions
      SET active_role = 'citizen'
      WHERE citizen_id = ${targetCitizenId}::uuid
        AND revoked_at IS NULL
        AND active_role NOT IN (${roleList})
    `)
  })

  await recordAuditEvent({
    actorId,
    action: 'role.replace_grants',
    targetType: 'citizen',
    targetId: targetCitizenId,
    result: 'success',
    metadata: { before: current, after: requested },
  })
  return requested
}
