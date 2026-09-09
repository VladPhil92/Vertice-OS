import { Prisma } from '@prisma/client'

import { prisma } from '../../lib/prisma'
import type { CitizenRole } from '../../lib/jwt'

export const DELEGABLE_ROLES = ['moderator', 'admin', 'superadmin'] as const
export type DelegableRole = (typeof DELEGABLE_ROLES)[number]

const ROLE_PRIORITY: CitizenRole[] = ['citizen', 'moderator', 'admin', 'superadmin']
const SUPERADMIN_AUTHORITY_LOCK = 'vertice-superadmin-authority'
const MANUAL_GRANT_SOURCE = 'superadmin_dashboard'
const MIN_REASON_LENGTH = 8
const MAX_REASON_LENGTH = 500

type ActiveGrantRow = {
  role: string
  source: string
}

export interface RoleDelegationResult {
  citizen_id: string
  roles: CitizenRole[]
  changed_role: DelegableRole
}

function isCitizenRole(value: unknown): value is CitizenRole {
  return typeof value === 'string' && ROLE_PRIORITY.includes(value as CitizenRole)
}

function isDelegableRole(value: unknown): value is DelegableRole {
  return typeof value === 'string' && DELEGABLE_ROLES.includes(value as DelegableRole)
}

function normalizeReason(value: unknown): string {
  if (typeof value !== 'string') {
    throw Object.assign(new Error('Debes indicar el motivo de la operación'), {
      statusCode: 400,
      code: 'ROLE_REASON_REQUIRED',
    })
  }
  const reason = value.trim()
  if (reason.length < MIN_REASON_LENGTH || reason.length > MAX_REASON_LENGTH) {
    throw Object.assign(new Error('El motivo debe tener entre 8 y 500 caracteres'), {
      statusCode: 400,
      code: 'INVALID_ROLE_REASON',
    })
  }
  return reason
}

function orderedRoles(rows: ActiveGrantRow[]): CitizenRole[] {
  const active = rows.map((row) => row.role).filter(isCitizenRole)
  return ROLE_PRIORITY.filter((role) => active.includes(role))
}

function highestRole(roles: CitizenRole[]): CitizenRole {
  for (const role of [...ROLE_PRIORITY].reverse()) {
    if (roles.includes(role)) return role
  }
  return 'citizen'
}

async function lockSuperadminAuthority(tx: Prisma.TransactionClient): Promise<void> {
  await tx.$queryRaw<Array<{ lock_result: string | null }>>(Prisma.sql`
    SELECT pg_advisory_xact_lock(hashtext(${SUPERADMIN_AUTHORITY_LOCK}))::text AS lock_result
  `)
}

/**
 * P2 TOCTOU boundary.
 *
 * requireSuperadmin protects the HTTP boundary, but authority can be revoked
 * between middleware completion and acquisition of the transaction-scoped
 * Superadmin advisory lock. Revalidate the actor *inside the same transaction*
 * immediately after the lock and before reading or mutating the target.
 *
 * The database's has_trusted_superadmin_lineage() function is the canonical
 * provenance contract introduced by privilege_provenance_hardening. It proves
 * an active, acyclic lineage back to the pinned CTG One root.
 */
async function requireLiveSuperadminAuthority(
  tx: Prisma.TransactionClient,
  actorId: string,
  actorSessionId: string | undefined,
): Promise<void> {
  if (!actorSessionId) {
    throw Object.assign(new Error('Vuelve a iniciar sesión y activa explícitamente Superadmin'), {
      statusCode: 401,
      code: 'ROLE_SWITCH_REAUTH_REQUIRED',
    })
  }

  const [row] = await tx.$queryRaw<Array<{ authorized: boolean }>>(Prisma.sql`
    SELECT EXISTS (
      SELECT 1
      FROM sessions s
      INNER JOIN citizen_role_grants g
        ON g.citizen_id = s.citizen_id
       AND g.role = 'superadmin'
       AND g.revoked_at IS NULL
      WHERE s.id = ${actorSessionId}::uuid
        AND s.citizen_id = ${actorId}::uuid
        AND s.revoked_at IS NULL
        AND s.expires_at > NOW()
        AND s.active_role = 'superadmin'
        AND has_trusted_superadmin_lineage(${actorId}::uuid)
    ) AS authorized
  `)

  if (!row?.authorized) {
    throw Object.assign(new Error('La autoridad Superadmin cambió antes de completar la operación'), {
      statusCode: 403,
      code: 'SUPERADMIN_AUTHORITY_STALE',
    })
  }
}

async function requireCitizen(tx: Prisma.TransactionClient, citizenId: string): Promise<void> {
  const citizen = await tx.citizen.findUnique({
    where: { id: citizenId },
    select: { id: true },
  })
  if (!citizen) {
    throw Object.assign(new Error('Usuario no encontrado'), {
      statusCode: 404,
      code: 'USER_NOT_FOUND',
    })
  }
}

async function getActiveGrantRows(tx: Prisma.TransactionClient, citizenId: string): Promise<ActiveGrantRow[]> {
  return tx.$queryRaw<ActiveGrantRow[]>(Prisma.sql`
    SELECT role, source
    FROM citizen_role_grants
    WHERE citizen_id = ${citizenId}::uuid
      AND revoked_at IS NULL
    ORDER BY granted_at ASC, role ASC
  `)
}

async function ensureCitizenBaseline(tx: Prisma.TransactionClient, citizenId: string): Promise<void> {
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO citizen_role_grants
      (citizen_id, role, source, granted_by_citizen_id, granted_at, revoked_at)
    VALUES
      (${citizenId}::uuid, 'citizen', 'session_baseline', NULL, NOW(), NULL)
    ON CONFLICT (citizen_id, role)
    DO UPDATE SET revoked_at = NULL
  `)
}

async function writeRoleAudit(
  tx: Prisma.TransactionClient,
  params: {
    actorId: string
    action: 'role.grant' | 'role.revoke'
    targetCitizenId: string
    reason: string
    role: DelegableRole
  },
): Promise<void> {
  const metadata = JSON.stringify({ role: params.role, source: MANUAL_GRANT_SOURCE })
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO admin_audit_log
      (actor_id, action, target_type, target_id, result, reason, metadata)
    VALUES
      (
        ${params.actorId}::uuid,
        ${params.action},
        'citizen',
        ${params.targetCitizenId},
        'success',
        ${params.reason},
        ${metadata}::jsonb
      )
  `)
}

export async function grantCitizenRole(
  actorId: string,
  actorSessionId: string | undefined,
  targetCitizenId: string,
  roleRaw: unknown,
  reasonRaw: unknown,
): Promise<RoleDelegationResult> {
  if (!isDelegableRole(roleRaw)) {
    throw Object.assign(new Error('Rol no delegable'), {
      statusCode: 400,
      code: 'INVALID_DELEGABLE_ROLE',
    })
  }
  const role = roleRaw
  const reason = normalizeReason(reasonRaw)

  return prisma.$transaction(async (tx) => {
    await lockSuperadminAuthority(tx)
    await requireLiveSuperadminAuthority(tx, actorId, actorSessionId)
    await requireCitizen(tx, targetCitizenId)

    let activeRows = await getActiveGrantRows(tx, targetCitizenId)
    if (activeRows.some((row) => row.role === role)) {
      throw Object.assign(new Error('El usuario ya tiene ese rol activo'), {
        statusCode: 409,
        code: 'ROLE_ALREADY_GRANTED',
      })
    }

    if (!activeRows.some((row) => row.role === 'citizen')) {
      await ensureCitizenBaseline(tx, targetCitizenId)
      activeRows = [...activeRows, { role: 'citizen', source: 'session_baseline' }]
    }

    await tx.$executeRaw(Prisma.sql`
      INSERT INTO citizen_role_grants
        (citizen_id, role, source, granted_by_citizen_id, granted_at, revoked_at)
      VALUES
        (${targetCitizenId}::uuid, ${role}, ${MANUAL_GRANT_SOURCE}, ${actorId}::uuid, NOW(), NULL)
      ON CONFLICT (citizen_id, role)
      DO UPDATE SET
        source = EXCLUDED.source,
        granted_by_citizen_id = EXCLUDED.granted_by_citizen_id,
        granted_at = NOW(),
        revoked_at = NULL
    `)

    const nextRoles = ROLE_PRIORITY.filter((candidate) =>
      candidate === role || activeRows.some((row) => row.role === candidate),
    )
    await tx.citizen.update({
      where: { id: targetCitizenId },
      data: { role: highestRole(nextRoles) },
    })

    await writeRoleAudit(tx, {
      actorId,
      action: 'role.grant',
      targetCitizenId,
      reason,
      role,
    })

    return {
      citizen_id: targetCitizenId,
      roles: nextRoles,
      changed_role: role,
    }
  })
}

export async function revokeCitizenRole(
  actorId: string,
  actorSessionId: string | undefined,
  targetCitizenId: string,
  roleRaw: unknown,
  reasonRaw: unknown,
): Promise<RoleDelegationResult> {
  if (!isDelegableRole(roleRaw)) {
    throw Object.assign(new Error('Rol no revocable desde este plano'), {
      statusCode: 400,
      code: 'INVALID_DELEGABLE_ROLE',
    })
  }
  const role = roleRaw
  const reason = normalizeReason(reasonRaw)

  return prisma.$transaction(async (tx) => {
    await lockSuperadminAuthority(tx)
    await requireLiveSuperadminAuthority(tx, actorId, actorSessionId)
    await requireCitizen(tx, targetCitizenId)

    let activeRows = await getActiveGrantRows(tx, targetCitizenId)
    const grant = activeRows.find((row) => row.role === role)
    if (!grant) {
      throw Object.assign(new Error('El usuario no tiene ese rol activo'), {
        statusCode: 409,
        code: 'ROLE_NOT_GRANTED',
      })
    }

    if (role === 'superadmin' && grant.source === 'ctg_one_bootstrap') {
      throw Object.assign(new Error('El Superadmin raíz no puede revocarse desde el plano ordinario'), {
        statusCode: 409,
        code: 'ROOT_SUPERADMIN_PROTECTED',
      })
    }

    if (role === 'superadmin') {
      const [row] = await tx.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
        SELECT COUNT(*) AS total
        FROM citizen_role_grants
        WHERE role = 'superadmin'
          AND revoked_at IS NULL
      `)
      if (Number(row?.total ?? 0) <= 1) {
        throw Object.assign(new Error('No puedes eliminar al último Superadmin de VÉRTICE'), {
          statusCode: 409,
          code: 'LAST_SUPERADMIN_PROTECTED',
        })
      }
    }

    await tx.$executeRaw(Prisma.sql`
      UPDATE citizen_role_grants
      SET revoked_at = NOW()
      WHERE citizen_id = ${targetCitizenId}::uuid
        AND role = ${role}
        AND revoked_at IS NULL
    `)

    await tx.$executeRaw(Prisma.sql`
      UPDATE sessions
      SET active_role = 'citizen'
      WHERE citizen_id = ${targetCitizenId}::uuid
        AND revoked_at IS NULL
        AND active_role = ${role}
    `)

    activeRows = activeRows.filter((row) => row.role !== role)
    if (!activeRows.some((row) => row.role === 'citizen')) {
      await ensureCitizenBaseline(tx, targetCitizenId)
      activeRows = [...activeRows, { role: 'citizen', source: 'session_baseline' }]
    }
    const nextRoles = orderedRoles(activeRows)

    await tx.citizen.update({
      where: { id: targetCitizenId },
      data: { role: highestRole(nextRoles) },
    })

    await writeRoleAudit(tx, {
      actorId,
      action: 'role.revoke',
      targetCitizenId,
      reason,
      role,
    })

    return {
      citizen_id: targetCitizenId,
      roles: nextRoles,
      changed_role: role,
    }
  })
}
