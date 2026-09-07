import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'

interface ControlPlaneSummaryRow {
  citizens_total: bigint
  active_citizens: bigint
  verified_citizens: bigint
  moderators: bigint
  admins: bigint
  superadmins: bigint
  privileged_sessions: bigint
  reports_open: bigint
  reports_in_progress: bigint
  proposals_active: bigint
  proposals_voting: bigint
  audit_24h: bigint
}

interface AuditEventRow {
  id: string
  actor_id: string
  actor_name: string | null
  actor_email: string | null
  action: string
  target_type: string
  target_id: string
  result: string
  reason: string | null
  metadata: unknown
  created_at: Date
}

export interface SuperadminControlPlaneOverview {
  authority: {
    citizens_total: number
    active_citizens: number
    verified_citizens: number
    moderators: number
    admins: number
    superadmins: number
    privileged_sessions: number
  }
  operations: {
    reports_open: number
    reports_in_progress: number
    proposals_active: number
    proposals_voting: number
    audit_events_24h: number
  }
  guardrails: {
    last_superadmin_protected: true
    audit_log_append_only: true
    vote_mutation_exposed: false
    manual_identity_override_exposed: false
  }
  generated_at: string
}

export interface SuperadminAuditEvent {
  id: string
  actor: {
    citizen_id: string
    display_name: string | null
    email: string | null
  }
  action: string
  target: {
    type: string
    id: string
  }
  result: string
  reason: string | null
  metadata: unknown
  created_at: string
}

export async function getSuperadminControlPlaneOverview(): Promise<SuperadminControlPlaneOverview> {
  const rows = await prisma.$queryRaw<ControlPlaneSummaryRow[]>(Prisma.sql`
    SELECT
      (SELECT COUNT(*) FROM citizens) AS citizens_total,
      (SELECT COUNT(*) FROM citizens WHERE is_active = TRUE) AS active_citizens,
      (SELECT COUNT(*) FROM citizens WHERE is_active = TRUE AND verification_level >= 1) AS verified_citizens,
      (SELECT COUNT(*) FROM citizen_role_grants WHERE role = 'moderator' AND revoked_at IS NULL) AS moderators,
      (SELECT COUNT(*) FROM citizen_role_grants WHERE role = 'admin' AND revoked_at IS NULL) AS admins,
      (SELECT COUNT(*) FROM citizen_role_grants WHERE role = 'superadmin' AND revoked_at IS NULL) AS superadmins,
      (
        SELECT COUNT(*)
        FROM sessions
        WHERE revoked_at IS NULL
          AND expires_at > NOW()
          AND active_role IN ('moderator', 'admin', 'superadmin')
      ) AS privileged_sessions,
      (SELECT COUNT(*) FROM territorial_reports WHERE status = 'open') AS reports_open,
      (SELECT COUNT(*) FROM territorial_reports WHERE status = 'in_progress') AS reports_in_progress,
      (
        SELECT COUNT(*)
        FROM proposals
        WHERE status IN ('idea', 'draft', 'debate', 'voting')
      ) AS proposals_active,
      (SELECT COUNT(*) FROM proposals WHERE status = 'voting') AS proposals_voting,
      (
        SELECT COUNT(*)
        FROM admin_audit_log
        WHERE created_at >= NOW() - INTERVAL '24 hours'
      ) AS audit_24h
  `)

  const row = rows[0]
  if (!row) {
    throw Object.assign(new Error('No fue posible construir el estado del plano de control'), {
      statusCode: 503,
      code: 'CONTROL_PLANE_OVERVIEW_UNAVAILABLE',
    })
  }

  return {
    authority: {
      citizens_total: Number(row.citizens_total),
      active_citizens: Number(row.active_citizens),
      verified_citizens: Number(row.verified_citizens),
      moderators: Number(row.moderators),
      admins: Number(row.admins),
      superadmins: Number(row.superadmins),
      privileged_sessions: Number(row.privileged_sessions),
    },
    operations: {
      reports_open: Number(row.reports_open),
      reports_in_progress: Number(row.reports_in_progress),
      proposals_active: Number(row.proposals_active),
      proposals_voting: Number(row.proposals_voting),
      audit_events_24h: Number(row.audit_24h),
    },
    guardrails: {
      last_superadmin_protected: true,
      audit_log_append_only: true,
      vote_mutation_exposed: false,
      manual_identity_override_exposed: false,
    },
    generated_at: new Date().toISOString(),
  }
}

export async function listSuperadminAuditEvents(limit: number): Promise<SuperadminAuditEvent[]> {
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)))
  const rows = await prisma.$queryRaw<AuditEventRow[]>(Prisma.sql`
    SELECT
      a.id::text,
      a.actor_id::text,
      c.display_name AS actor_name,
      c.email AS actor_email,
      a.action,
      a.target_type,
      a.target_id,
      a.result,
      a.reason,
      a.metadata,
      a.created_at
    FROM admin_audit_log a
    INNER JOIN citizens c ON c.id = a.actor_id
    ORDER BY a.created_at DESC, a.id DESC
    LIMIT ${safeLimit}
  `)

  return rows.map((row) => ({
    id: row.id,
    actor: {
      citizen_id: row.actor_id,
      display_name: row.actor_name,
      email: row.actor_email,
    },
    action: row.action,
    target: {
      type: row.target_type,
      id: row.target_id,
    },
    result: row.result,
    reason: row.reason,
    metadata: row.metadata,
    created_at: row.created_at.toISOString(),
  }))
}
