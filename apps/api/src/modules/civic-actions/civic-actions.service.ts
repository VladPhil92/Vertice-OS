import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import {
  scoreCivicAction,
  type CivicScoreResult,
} from './civic-actions.score'
import type {
  CivicActionEvidenceInput,
  CivicActionLeaderboardQuery,
  CivicActionListQuery,
  CivicActionReviewDecision,
  CivicActionReviewInput,
  CivicActionStatus,
  CivicActionValidationInput,
  CivicActionValidationStance,
  CreateCivicActionInput,
  UpdateCivicActionInput,
} from './civic-actions.schema'

interface CivicActionRow {
  id: string
  actor_id: string
  display_name: string | null
  actor_neighborhood: string | null
  civic_profile_type: string
  civic_organization: string | null
  public_civic_profile: boolean
  title: string
  problem: string
  objective: string
  category: string
  neighborhood: string | null
  locality_id: number | null
  beneficiaries_estimate: number | null
  status: CivicActionStatus
  result_summary: string | null
  target_date: Date | string | null
  started_at: Date | null
  completed_at: Date | null
  created_at: Date
  updated_at: Date
  evidence_count: bigint
  external_evidence_count: bigint
  hashed_evidence_count: bigint
  collaborators_count: bigint
  corroborations: bigint
  disputes: bigint
}

export interface CivicAction extends CivicScoreResult {
  id: string
  actor: {
    id: string
    display_name: string
    neighborhood: string | null
    actor_kind: string
    organization: string | null
  }
  title: string
  problem: string
  objective: string
  category: string
  neighborhood: string | null
  locality_id: number | null
  beneficiaries_estimate: number | null
  status: CivicActionStatus
  result_summary: string | null
  target_date: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  evidence_count: number
  external_evidence_count: number
  collaborators_count: number
  community_validation: {
    corroborations: number
    disputes: number
    total: number
  }
}

export interface CivicActionEvidence {
  id: string
  action_id: string
  submitted_by: string
  evidence_type: string
  evidence_url: string
  description: string | null
  source_url: string | null
  content_hash: string | null
  review_status: string
  created_at: string
}

export interface CivicActionValidationState {
  corroborations: number
  disputes: number
  total: number
  my_stance: CivicActionValidationStance | null
  my_note: string | null
}

export interface CivicActionLeaderboardEntry {
  actor_id: string
  display_name: string
  neighborhood: string | null
  actor_kind: string
  organization: string | null
  actions_count: number
  verified_actions: number
  evidence_count: number
  average_action_score: number
  average_confidence_score: number
  verification_rate: number
  leader_score: number
  rank: number
}

const OWNER_TRANSITIONS: Record<CivicActionStatus, CivicActionStatus[]> = {
  proposed: ['preparing', 'cancelled'],
  preparing: ['in_progress', 'cancelled'],
  in_progress: ['result_declared', 'not_completed', 'cancelled'],
  result_declared: ['in_progress', 'cancelled'],
  under_verification: [],
  verified: [],
  not_completed: ['in_progress', 'cancelled'],
  no_evidence: ['in_progress', 'result_declared', 'cancelled'],
  disputed: ['in_progress', 'result_declared', 'cancelled'],
  cancelled: [],
}

const REVIEW_TRANSITIONS: Record<CivicActionReviewDecision, CivicActionStatus[]> = {
  under_verification: ['result_declared', 'disputed', 'no_evidence'],
  verified: ['under_verification'],
  disputed: ['result_declared', 'under_verification'],
  no_evidence: ['result_declared', 'under_verification'],
}

function dateOnly(value: Date | string | null): string | null {
  if (!value) return null
  if (typeof value === 'string') return value.slice(0, 10)
  return value.toISOString().slice(0, 10)
}

function actionProjection() {
  return Prisma.sql`
    a.id::text,
    a.actor_id::text,
    actor.display_name,
    actor.neighborhood AS actor_neighborhood,
    actor.civic_profile_type,
    actor.civic_organization,
    actor.public_civic_profile,
    a.title,
    a.problem,
    a.objective,
    a.category,
    a.neighborhood,
    a.locality_id,
    a.beneficiaries_estimate,
    a.status,
    a.result_summary,
    a.target_date,
    a.started_at,
    a.completed_at,
    a.created_at,
    a.updated_at,
    (
      SELECT COUNT(*) FROM civic_action_evidence e
      WHERE e.action_id = a.id AND e.review_status <> 'rejected'
    ) AS evidence_count,
    (
      SELECT COUNT(*) FROM civic_action_evidence e
      WHERE e.action_id = a.id
        AND e.review_status <> 'rejected'
        AND e.evidence_type = 'external_record'
    ) AS external_evidence_count,
    (
      SELECT COUNT(*) FROM civic_action_evidence e
      WHERE e.action_id = a.id
        AND e.review_status <> 'rejected'
        AND e.content_hash IS NOT NULL
    ) AS hashed_evidence_count,
    (
      SELECT COUNT(*) FROM civic_action_collaborators c
      WHERE c.action_id = a.id AND c.citizen_id <> a.actor_id
    ) AS collaborators_count,
    (
      SELECT COUNT(*) FROM civic_action_validations v
      JOIN citizens validator ON validator.id = v.citizen_id
      WHERE v.action_id = a.id
        AND v.stance = 'corroborate'
        AND validator.is_active = TRUE
        AND validator.verification_level >= 1
    ) AS corroborations,
    (
      SELECT COUNT(*) FROM civic_action_validations v
      JOIN citizens validator ON validator.id = v.citizen_id
      WHERE v.action_id = a.id
        AND v.stance = 'dispute'
        AND validator.is_active = TRUE
        AND validator.verification_level >= 1
    ) AS disputes
  `
}

function mapAction(row: CivicActionRow): CivicAction {
  const evidenceCount = Number(row.evidence_count)
  const externalEvidenceCount = Number(row.external_evidence_count)
  const hashedEvidenceCount = Number(row.hashed_evidence_count)
  const collaboratorsCount = Number(row.collaborators_count)
  const corroborations = Number(row.corroborations)
  const disputes = Number(row.disputes)
  const targetDate = dateOnly(row.target_date)

  const scoring = scoreCivicAction({
    status: row.status,
    evidence_count: evidenceCount,
    external_evidence_count: externalEvidenceCount,
    hashed_evidence_count: hashedEvidenceCount,
    corroborations,
    disputes,
    collaborators_count: collaboratorsCount,
    beneficiaries_estimate: row.beneficiaries_estimate,
    problem: row.problem,
    objective: row.objective,
    result_summary: row.result_summary,
    neighborhood: row.neighborhood,
    target_date: targetDate,
    created_at: row.created_at.toISOString(),
  })

  return {
    id: row.id,
    actor: {
      id: row.actor_id,
      display_name: row.display_name ?? 'Perfil cívico VÉRTICE',
      neighborhood: row.actor_neighborhood,
      actor_kind: row.civic_profile_type,
      organization: row.civic_organization,
    },
    title: row.title,
    problem: row.problem,
    objective: row.objective,
    category: row.category,
    neighborhood: row.neighborhood,
    locality_id: row.locality_id,
    beneficiaries_estimate: row.beneficiaries_estimate,
    status: row.status,
    result_summary: row.result_summary,
    target_date: targetDate,
    started_at: row.started_at?.toISOString() ?? null,
    completed_at: row.completed_at?.toISOString() ?? null,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
    evidence_count: evidenceCount,
    external_evidence_count: externalEvidenceCount,
    collaborators_count: collaboratorsCount,
    community_validation: {
      corroborations,
      disputes,
      total: corroborations + disputes,
    },
    ...scoring,
  }
}

async function loadPublicActions(input: CivicActionListQuery, fetchLimit = input.limit): Promise<CivicAction[]> {
  const statusFilter = input.status ? Prisma.sql`AND a.status = ${input.status}` : Prisma.empty
  const neighborhoodFilter = input.neighborhood
    ? Prisma.sql`AND LOWER(COALESCE(a.neighborhood, actor.neighborhood, '')) = LOWER(${input.neighborhood})`
    : Prisma.empty
  const categoryFilter = input.category
    ? Prisma.sql`AND LOWER(a.category) = LOWER(${input.category})`
    : Prisma.empty

  const rows = await prisma.$queryRaw<CivicActionRow[]>(Prisma.sql`
    SELECT ${actionProjection()}
    FROM civic_actions a
    JOIN citizens actor ON actor.id = a.actor_id
    WHERE actor.is_active = TRUE
      AND actor.public_civic_profile = TRUE
      AND a.status <> 'cancelled'
      ${statusFilter}
      ${neighborhoodFilter}
      ${categoryFilter}
    ORDER BY a.updated_at DESC
    LIMIT ${fetchLimit}
  `)
  return rows.map(mapAction)
}

export async function listCivicActions(input: CivicActionListQuery): Promise<CivicAction[]> {
  return loadPublicActions(input)
}

export async function listMyCivicActions(citizenId: string, input: CivicActionListQuery): Promise<CivicAction[]> {
  const statusFilter = input.status ? Prisma.sql`AND a.status = ${input.status}` : Prisma.empty
  const neighborhoodFilter = input.neighborhood
    ? Prisma.sql`AND LOWER(COALESCE(a.neighborhood, actor.neighborhood, '')) = LOWER(${input.neighborhood})`
    : Prisma.empty
  const categoryFilter = input.category
    ? Prisma.sql`AND LOWER(a.category) = LOWER(${input.category})`
    : Prisma.empty

  const rows = await prisma.$queryRaw<CivicActionRow[]>(Prisma.sql`
    SELECT ${actionProjection()}
    FROM civic_actions a
    JOIN citizens actor ON actor.id = a.actor_id
    WHERE a.actor_id = ${citizenId}::uuid
      ${statusFilter}
      ${neighborhoodFilter}
      ${categoryFilter}
    ORDER BY a.updated_at DESC
    LIMIT ${input.limit}
  `)
  return rows.map(mapAction)
}

async function getActionRow(actionId: string, viewerId: string): Promise<CivicActionRow> {
  const rows = await prisma.$queryRaw<CivicActionRow[]>(Prisma.sql`
    SELECT ${actionProjection()}
    FROM civic_actions a
    JOIN citizens actor ON actor.id = a.actor_id
    WHERE a.id = ${actionId}::uuid
      AND (
        actor.public_civic_profile = TRUE
        OR a.actor_id = ${viewerId}::uuid
        OR EXISTS (
          SELECT 1 FROM civic_action_collaborators c
          WHERE c.action_id = a.id AND c.citizen_id = ${viewerId}::uuid
        )
      )
    LIMIT 1
  `)
  const row = rows[0]
  if (!row) {
    throw Object.assign(new Error('Acción cívica no encontrada'), {
      statusCode: 404,
      code: 'CIVIC_ACTION_NOT_FOUND',
    })
  }
  return row
}

export async function getCivicAction(actionId: string, viewerId: string): Promise<CivicAction> {
  return mapAction(await getActionRow(actionId, viewerId))
}

export async function createCivicAction(citizenId: string, input: CreateCivicActionInput): Promise<CivicAction> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    INSERT INTO civic_actions (
      actor_id,
      title,
      problem,
      objective,
      category,
      neighborhood,
      locality_id,
      beneficiaries_estimate,
      target_date
    ) VALUES (
      ${citizenId}::uuid,
      ${input.title},
      ${input.problem},
      ${input.objective},
      ${input.category},
      ${input.neighborhood ?? null},
      ${input.locality_id ?? null},
      ${input.beneficiaries_estimate ?? null},
      ${input.target_date ?? null}::date
    )
    RETURNING id::text
  `)
  const actionId = rows[0]?.id
  if (!actionId) throw new Error('No fue posible crear la acción cívica')

  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO civic_action_collaborators (action_id, citizen_id, collaboration_role)
    VALUES (${actionId}::uuid, ${citizenId}::uuid, 'owner')
    ON CONFLICT (action_id, citizen_id) DO NOTHING
  `)

  return getCivicAction(actionId, citizenId)
}

async function getOwnerState(actionId: string): Promise<{ actor_id: string; status: CivicActionStatus }> {
  const rows = await prisma.$queryRaw<Array<{ actor_id: string; status: CivicActionStatus }>>(Prisma.sql`
    SELECT actor_id::text, status
    FROM civic_actions
    WHERE id = ${actionId}::uuid
    LIMIT 1
  `)
  const row = rows[0]
  if (!row) {
    throw Object.assign(new Error('Acción cívica no encontrada'), {
      statusCode: 404,
      code: 'CIVIC_ACTION_NOT_FOUND',
    })
  }
  return row
}

function assertOwner(citizenId: string, actorId: string): void {
  if (citizenId !== actorId) {
    throw Object.assign(new Error('Solo el responsable puede modificar esta acción'), {
      statusCode: 403,
      code: 'CIVIC_ACTION_OWNER_REQUIRED',
    })
  }
}

function assertOwnerTransition(current: CivicActionStatus, next: CivicActionStatus): void {
  if (!OWNER_TRANSITIONS[current].includes(next)) {
    throw Object.assign(new Error(`Transición no permitida: ${current} → ${next}`), {
      statusCode: 409,
      code: 'CIVIC_ACTION_INVALID_TRANSITION',
    })
  }
}

export async function updateCivicAction(
  citizenId: string,
  actionId: string,
  input: UpdateCivicActionInput,
): Promise<CivicAction> {
  const current = await getOwnerState(actionId)
  assertOwner(citizenId, current.actor_id)
  if (input.status) assertOwnerTransition(current.status, input.status)

  await prisma.$executeRaw(Prisma.sql`
    UPDATE civic_actions
    SET
      title = CASE WHEN ${input.title !== undefined} THEN ${input.title ?? ''} ELSE title END,
      problem = CASE WHEN ${input.problem !== undefined} THEN ${input.problem ?? ''} ELSE problem END,
      objective = CASE WHEN ${input.objective !== undefined} THEN ${input.objective ?? ''} ELSE objective END,
      category = CASE WHEN ${input.category !== undefined} THEN ${input.category ?? ''} ELSE category END,
      neighborhood = CASE WHEN ${input.neighborhood !== undefined} THEN ${input.neighborhood ?? null} ELSE neighborhood END,
      locality_id = CASE WHEN ${input.locality_id !== undefined} THEN ${input.locality_id ?? null} ELSE locality_id END,
      beneficiaries_estimate = CASE WHEN ${input.beneficiaries_estimate !== undefined} THEN ${input.beneficiaries_estimate ?? null} ELSE beneficiaries_estimate END,
      target_date = CASE WHEN ${input.target_date !== undefined} THEN ${input.target_date ?? null}::date ELSE target_date END,
      result_summary = CASE WHEN ${input.result_summary !== undefined} THEN ${input.result_summary ?? null} ELSE result_summary END,
      status = ${input.status ?? current.status},
      started_at = CASE
        WHEN ${input.status === 'in_progress'} THEN COALESCE(started_at, NOW())
        ELSE started_at
      END,
      completed_at = CASE
        WHEN ${input.status === 'result_declared'} THEN NOW()
        WHEN ${input.status === 'in_progress'} THEN NULL
        ELSE completed_at
      END,
      updated_at = NOW()
    WHERE id = ${actionId}::uuid
  `)
  return getCivicAction(actionId, citizenId)
}

async function canSubmitEvidence(citizenId: string, actionId: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ ok: number }>>(Prisma.sql`
    SELECT 1 AS ok
    FROM civic_actions a
    WHERE a.id = ${actionId}::uuid
      AND (
        a.actor_id = ${citizenId}::uuid
        OR EXISTS (
          SELECT 1 FROM civic_action_collaborators c
          WHERE c.action_id = a.id AND c.citizen_id = ${citizenId}::uuid
        )
      )
    LIMIT 1
  `)
  return Boolean(rows[0])
}

export async function addCivicActionEvidence(
  citizenId: string,
  actionId: string,
  input: CivicActionEvidenceInput,
): Promise<CivicActionEvidence> {
  if (!(await canSubmitEvidence(citizenId, actionId))) {
    throw Object.assign(new Error('No tienes permiso para adjuntar evidencia a esta acción'), {
      statusCode: 403,
      code: 'CIVIC_ACTION_EVIDENCE_FORBIDDEN',
    })
  }

  const rows = await prisma.$queryRaw<Array<{
    id: string
    created_at: Date
  }>>(Prisma.sql`
    INSERT INTO civic_action_evidence (
      action_id,
      submitted_by,
      evidence_type,
      evidence_url,
      description,
      source_url,
      content_hash
    ) VALUES (
      ${actionId}::uuid,
      ${citizenId}::uuid,
      ${input.evidence_type},
      ${input.evidence_url},
      ${input.description ?? null},
      ${input.source_url ?? null},
      ${input.content_hash ?? null}
    )
    ON CONFLICT DO NOTHING
    RETURNING id::text, created_at
  `)

  const row = rows[0]
  if (!row) {
    throw Object.assign(new Error('Esta evidencia ya fue registrada en otra acción'), {
      statusCode: 409,
      code: 'DUPLICATE_CIVIC_EVIDENCE',
    })
  }

  await prisma.$executeRaw(Prisma.sql`
    UPDATE civic_actions SET updated_at = NOW() WHERE id = ${actionId}::uuid
  `)

  return {
    id: row.id,
    action_id: actionId,
    submitted_by: citizenId,
    evidence_type: input.evidence_type,
    evidence_url: input.evidence_url,
    description: input.description ?? null,
    source_url: input.source_url ?? null,
    content_hash: input.content_hash ?? null,
    review_status: 'pending',
    created_at: row.created_at.toISOString(),
  }
}

export async function listCivicActionEvidence(actionId: string, viewerId: string): Promise<CivicActionEvidence[]> {
  await getActionRow(actionId, viewerId)
  const rows = await prisma.$queryRaw<Array<{
    id: string
    action_id: string
    submitted_by: string
    evidence_type: string
    evidence_url: string
    description: string | null
    source_url: string | null
    content_hash: string | null
    review_status: string
    created_at: Date
  }>>(Prisma.sql`
    SELECT
      id::text,
      action_id::text,
      submitted_by::text,
      evidence_type,
      evidence_url,
      description,
      source_url,
      content_hash,
      review_status,
      created_at
    FROM civic_action_evidence
    WHERE action_id = ${actionId}::uuid
      AND review_status <> 'rejected'
    ORDER BY created_at DESC
  `)
  return rows.map((row) => ({ ...row, created_at: row.created_at.toISOString() }))
}

export async function getCivicActionValidationState(
  actionId: string,
  viewerId?: string,
): Promise<CivicActionValidationState> {
  const exists = await prisma.$queryRaw<Array<{ actor_id: string }>>(Prisma.sql`
    SELECT actor_id::text
    FROM civic_actions
    WHERE id = ${actionId}::uuid AND status <> 'cancelled'
    LIMIT 1
  `)
  if (!exists[0]) {
    throw Object.assign(new Error('Acción cívica no encontrada'), {
      statusCode: 404,
      code: 'CIVIC_ACTION_NOT_FOUND',
    })
  }

  const [summaryRows, viewerRows] = await Promise.all([
    prisma.$queryRaw<Array<{ corroborations: bigint; disputes: bigint }>>(Prisma.sql`
      SELECT
        COUNT(*) FILTER (WHERE v.stance = 'corroborate') AS corroborations,
        COUNT(*) FILTER (WHERE v.stance = 'dispute') AS disputes
      FROM civic_action_validations v
      JOIN citizens validator ON validator.id = v.citizen_id
      WHERE v.action_id = ${actionId}::uuid
        AND validator.is_active = TRUE
        AND validator.verification_level >= 1
    `),
    viewerId
      ? prisma.$queryRaw<Array<{ stance: CivicActionValidationStance; note: string | null }>>(Prisma.sql`
          SELECT stance, note
          FROM civic_action_validations
          WHERE action_id = ${actionId}::uuid AND citizen_id = ${viewerId}::uuid
          LIMIT 1
        `)
      : Promise.resolve([]),
  ])

  const corroborations = Number(summaryRows[0]?.corroborations ?? 0)
  const disputes = Number(summaryRows[0]?.disputes ?? 0)
  return {
    corroborations,
    disputes,
    total: corroborations + disputes,
    my_stance: viewerRows[0]?.stance ?? null,
    my_note: viewerRows[0]?.note ?? null,
  }
}

export async function setCivicActionValidation(
  citizenId: string,
  actionId: string,
  input: CivicActionValidationInput,
): Promise<CivicActionValidationState> {
  const owner = await getOwnerState(actionId)
  if (owner.actor_id === citizenId) {
    throw Object.assign(new Error('No puedes validar tu propia gestión'), {
      statusCode: 409,
      code: 'SELF_VALIDATION_NOT_ALLOWED',
    })
  }
  if (owner.status === 'cancelled') {
    throw Object.assign(new Error('No se puede validar una acción cancelada'), {
      statusCode: 409,
      code: 'CIVIC_ACTION_NOT_VALIDATABLE',
    })
  }

  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO civic_action_validations (action_id, citizen_id, stance, note)
    VALUES (${actionId}::uuid, ${citizenId}::uuid, ${input.stance}, ${input.note ?? null})
    ON CONFLICT (action_id, citizen_id)
    DO UPDATE SET stance = EXCLUDED.stance, note = EXCLUDED.note, updated_at = NOW()
  `)
  return getCivicActionValidationState(actionId, citizenId)
}

export async function removeCivicActionValidation(
  citizenId: string,
  actionId: string,
): Promise<CivicActionValidationState> {
  await prisma.$executeRaw(Prisma.sql`
    DELETE FROM civic_action_validations
    WHERE action_id = ${actionId}::uuid AND citizen_id = ${citizenId}::uuid
  `)
  return getCivicActionValidationState(actionId, citizenId)
}

export async function reviewCivicAction(
  reviewerId: string,
  actionId: string,
  input: CivicActionReviewInput,
): Promise<CivicAction> {
  const current = await getOwnerState(actionId)
  if (!REVIEW_TRANSITIONS[input.decision].includes(current.status)) {
    throw Object.assign(new Error(`Revisión no permitida: ${current.status} → ${input.decision}`), {
      statusCode: 409,
      code: 'CIVIC_ACTION_INVALID_REVIEW_TRANSITION',
    })
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO civic_action_reviews (action_id, reviewer_id, decision, note)
      VALUES (${actionId}::uuid, ${reviewerId}::uuid, ${input.decision}, ${input.note ?? null})
    `)
    await tx.$executeRaw(Prisma.sql`
      UPDATE civic_actions
      SET
        status = ${input.decision},
        completed_at = CASE WHEN ${input.decision === 'verified'} THEN COALESCE(completed_at, NOW()) ELSE completed_at END,
        updated_at = NOW()
      WHERE id = ${actionId}::uuid
    `)
    if (input.decision === 'verified') {
      await tx.$executeRaw(Prisma.sql`
        UPDATE civic_action_evidence
        SET review_status = 'accepted'
        WHERE action_id = ${actionId}::uuid AND review_status = 'pending'
      `)
    }
  })

  return getCivicAction(actionId, reviewerId)
}

export async function getCivicActionLeaderboard(
  input: CivicActionLeaderboardQuery,
): Promise<CivicActionLeaderboardEntry[]> {
  const actions = await loadPublicActions({
    limit: 100,
    neighborhood: input.neighborhood,
  }, 500)

  const grouped = new Map<string, {
    actor_id: string
    display_name: string
    neighborhood: string | null
    actor_kind: string
    organization: string | null
    actions_count: number
    verified_actions: number
    evidence_count: number
    score_total: number
    confidence_total: number
  }>()

  for (const action of actions) {
    const current = grouped.get(action.actor.id) ?? {
      actor_id: action.actor.id,
      display_name: action.actor.display_name,
      neighborhood: action.actor.neighborhood,
      actor_kind: action.actor.actor_kind,
      organization: action.actor.organization,
      actions_count: 0,
      verified_actions: 0,
      evidence_count: 0,
      score_total: 0,
      confidence_total: 0,
    }
    current.actions_count += 1
    current.verified_actions += action.status === 'verified' ? 1 : 0
    current.evidence_count += action.evidence_count
    current.score_total += action.civic_score
    current.confidence_total += action.confidence_score
    grouped.set(action.actor.id, current)
  }

  return [...grouped.values()]
    .map((entry) => {
      const averageActionScore = Math.round(entry.score_total / Math.max(1, entry.actions_count))
      const averageConfidenceScore = Math.round(entry.confidence_total / Math.max(1, entry.actions_count))
      const verificationRate = Math.round((entry.verified_actions / Math.max(1, entry.actions_count)) * 100)
      const leaderScore = Math.round(
        averageActionScore * 0.75
        + averageConfidenceScore * 0.15
        + verificationRate * 0.10,
      )
      const { score_total: _scoreTotal, confidence_total: _confidenceTotal, ...publicEntry } = entry
      return {
        ...publicEntry,
        average_action_score: averageActionScore,
        average_confidence_score: averageConfidenceScore,
        verification_rate: verificationRate,
        leader_score: Math.max(0, Math.min(100, leaderScore)),
      }
    })
    .sort((a, b) => b.leader_score - a.leader_score || b.verified_actions - a.verified_actions)
    .slice(0, input.limit)
    .map((entry, index) => ({ ...entry, rank: index + 1 }))
}
