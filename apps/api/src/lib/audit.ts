import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { logger } from './logger'

/**
 * Registro de solo-inserción para acciones sensibles ejecutadas por un rol
 * admin/moderador: quién, qué hizo, sobre qué, cuándo, con qué resultado.
 * No hay UPDATE/DELETE expuesto desde la aplicación — es el registro de
 * decisiones humanas dentro del producto, no un log de infraestructura.
 *
 * Se registra en best-effort (nunca bloquea ni revierte la acción que audita):
 * un fallo al escribir la auditoría es un problema operativo a vigilar, no
 * una razón para negarle al moderador la acción que ya autorizó su rol.
 */
export async function recordAuditEvent(params: {
  actorId: string
  action: string
  targetType: string
  targetId: string
  result: string
  reason?: string | null
  metadata?: Record<string, unknown>
}): Promise<void> {
  try {
    await prisma.$queryRaw(Prisma.sql`
      INSERT INTO admin_audit_log (actor_id, action, target_type, target_id, result, reason, metadata)
      VALUES (
        ${params.actorId}::uuid,
        ${params.action},
        ${params.targetType},
        ${params.targetId},
        ${params.result},
        ${params.reason ?? null},
        ${params.metadata ? JSON.stringify(params.metadata) : null}::jsonb
      )
    `)
  } catch (err) {
    logger.error('[audit] failed to record audit event', err)
  }
}
