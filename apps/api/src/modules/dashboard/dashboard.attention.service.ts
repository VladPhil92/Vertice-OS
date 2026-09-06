import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'

interface CivicEvidenceAttentionRow {
  id: string
  title: string
  status: string
  updated_at: Date
  total_matches: bigint
}

export interface CivicEvidenceAttentionItem {
  id: string
  title: string
  status: string
  updated_at: string
  reason: 'evidence_required'
  reason_label: string
  href: string
}

export interface CivicEvidenceAttentionQueue {
  total: number
  items: CivicEvidenceAttentionItem[]
}

function reasonLabel(status: string): string {
  if (status === 'result_declared' || status === 'under_verification') {
    return 'El resultado necesita evidencia admisible.'
  }
  if (status === 'disputed' || status === 'no_evidence') {
    return 'La evidencia fue cuestionada o sigue siendo insuficiente.'
  }
  return 'La gestión está en curso sin evidencia admisible.'
}

export async function getCivicEvidenceAttentionQueue(
  citizenId: string,
): Promise<CivicEvidenceAttentionQueue> {
  const rows = await prisma.$queryRaw<CivicEvidenceAttentionRow[]>(Prisma.sql`
    SELECT
      a.id::text,
      a.title,
      a.status,
      a.updated_at,
      COUNT(*) OVER() AS total_matches
    FROM civic_actions a
    WHERE a.actor_id = ${citizenId}::uuid
      AND a.status IN (
        'in_progress',
        'result_declared',
        'under_verification',
        'no_evidence',
        'disputed'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM civic_action_evidence e
        WHERE e.action_id = a.id
          AND e.review_status <> 'rejected'
      )
    ORDER BY
      CASE a.status
        WHEN 'result_declared' THEN 0
        WHEN 'under_verification' THEN 1
        WHEN 'disputed' THEN 2
        WHEN 'no_evidence' THEN 3
        ELSE 4
      END,
      a.updated_at DESC
    LIMIT 5
  `)

  return {
    total: Number(rows[0]?.total_matches ?? 0),
    items: rows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      updated_at: row.updated_at.toISOString(),
      reason: 'evidence_required' as const,
      reason_label: reasonLabel(row.status),
      href: `/dashboard/community/actions/${row.id}`,
    })),
  }
}
