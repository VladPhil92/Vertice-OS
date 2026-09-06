import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'

export type CivicResolutionStep = 'reopen_execution' | 'attach_evidence' | 'declare_result'
export type CivicResolutionPriority = 'urgent' | 'high' | 'normal'

interface CivicResolutionRow {
  id: string
  title: string
  status: string
  updated_at: Date
  evidence_count: bigint
  next_step: CivicResolutionStep
  total_matches: bigint
}

export interface CivicResolutionItem {
  id: string
  title: string
  status: string
  updated_at: string
  evidence_count: number
  next_step: CivicResolutionStep
  next_step_label: string
  detail: string
  follow_up_label: string
  priority: CivicResolutionPriority
  href: string
}

export interface CivicResolutionPlan {
  total: number
  items: CivicResolutionItem[]
}

function describeResolution(row: CivicResolutionRow): Omit<
  CivicResolutionItem,
  'id' | 'title' | 'status' | 'updated_at' | 'evidence_count' | 'next_step' | 'href'
> {
  if (row.next_step === 'reopen_execution') {
    return {
      next_step_label: 'Reabrir ejecución',
      detail: 'La acción fue disputada o quedó sin evidencia suficiente. Reabre la ejecución antes de corregirla.',
      follow_up_label: 'Después: incorpora evidencia nueva o corregida.',
      priority: 'urgent',
    }
  }

  if (row.next_step === 'declare_result') {
    return {
      next_step_label: 'Declarar resultado',
      detail: 'La acción ya tiene evidencia admisible y puede avanzar desde ejecución hacia un resultado observable.',
      follow_up_label: 'Después: el resultado y su evidencia podrán pasar a revisión.',
      priority: 'normal',
    }
  }

  if (row.status === 'result_declared') {
    return {
      next_step_label: 'Adjuntar evidencia del resultado',
      detail: 'El resultado ya fue declarado, pero todavía no tiene evidencia admisible que lo respalde.',
      follow_up_label: 'Después: la acción queda lista para revisión de evidencia.',
      priority: 'high',
    }
  }

  return {
    next_step_label: 'Adjuntar evidencia',
    detail: 'La gestión está en ejecución, pero todavía no tiene evidencia admisible asociada.',
    follow_up_label: 'Después: declara el resultado cuando la gestión concluya.',
    priority: 'normal',
  }
}

export async function getCivicActionResolutionPlan(citizenId: string): Promise<CivicResolutionPlan> {
  const rows = await prisma.$queryRaw<CivicResolutionRow[]>(Prisma.sql`
    WITH action_state AS (
      SELECT
        a.id::text,
        a.title,
        a.status,
        a.updated_at,
        (
          SELECT COUNT(*)
          FROM civic_action_evidence e
          WHERE e.action_id = a.id
            AND e.review_status <> 'rejected'
        ) AS evidence_count
      FROM civic_actions a
      WHERE a.actor_id = ${citizenId}::uuid
        AND a.status IN ('in_progress', 'result_declared', 'no_evidence', 'disputed')
    ), resolution_state AS (
      SELECT
        action_state.*,
        CASE
          WHEN status IN ('disputed', 'no_evidence') THEN 'reopen_execution'
          WHEN status = 'in_progress' AND evidence_count = 0 THEN 'attach_evidence'
          WHEN status = 'in_progress' AND evidence_count > 0 THEN 'declare_result'
          WHEN status = 'result_declared' AND evidence_count = 0 THEN 'attach_evidence'
          ELSE NULL
        END AS next_step
      FROM action_state
    )
    SELECT
      id,
      title,
      status,
      updated_at,
      evidence_count,
      next_step,
      COUNT(*) OVER() AS total_matches
    FROM resolution_state
    WHERE next_step IS NOT NULL
    ORDER BY
      CASE
        WHEN next_step = 'reopen_execution' THEN 0
        WHEN status = 'result_declared' THEN 1
        WHEN next_step = 'declare_result' THEN 2
        ELSE 3
      END,
      updated_at DESC
    LIMIT 5
  `)

  return {
    total: Number(rows[0]?.total_matches ?? 0),
    items: rows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      updated_at: row.updated_at.toISOString(),
      evidence_count: Number(row.evidence_count),
      next_step: row.next_step,
      ...describeResolution(row),
      href: `/dashboard/community/actions/${row.id}`,
    })),
  }
}
