import { Prisma } from '@prisma/client'
import { createHmac } from 'crypto'
import { prisma } from '../../lib/prisma'
import { logger } from '../../lib/logger'
import { getCache, setCache, delCache, TTL } from '../../lib/cache'
import { redis } from '../../lib/redis'
import { config } from '../../config'
import { recordReputationEvent } from '../reputation/reputation.service'
import type {
  Proposal,
  ProposalSummary,
  ProposalRow,
  VoteTally,
  VoteReceipt,
  VoteRow,
  EndorseResult,
  Delegation,
  DelegationRow,
  GovernanceStats,
  StatsCountRow,
  ProposalScope,
  ProposalStatus,
} from './governance.types'
import type { CreateProposalInput, ListProposalsInput, AdvanceStageInput, CreateDelegationInput } from './governance.schema'
import { publish } from '../../lib/pubsub'
import { enqueueJob } from '../../lib/jobs'
import { createNotification } from '../notifications/notifications.service'
import { recordAuditEvent } from '../../lib/audit'

function fireReputation(params: Parameters<typeof recordReputationEvent>[0]): void {
  recordReputationEvent(params).catch((err: unknown) =>
    logger.error('[governance] reputation event failed', err),
  )
}

// ── Config ────────────────────────────────────────────────────────────────────

const QUORUM_CONFIG: Record<ProposalScope, {
  quorum: number; approval: number
  minHours: number; maxHours: number; defaultHours: number
}> = {
  neighborhood: { quorum: 0.15, approval: 0.40, minHours: 24,  maxHours: 72,  defaultHours: 48  },
  locality:     { quorum: 0.20, approval: 0.50, minHours: 48,  maxHours: 96,  defaultHours: 72  },
  city:         { quorum: 0.25, approval: 0.55, minHours: 72,  maxHours: 168, defaultHours: 120 },
  regional:     { quorum: 0.30, approval: 0.60, minHours: 120, maxHours: 240, defaultHours: 168 },
  national:     { quorum: 0.40, approval: 0.66, minHours: 120, maxHours: 240, defaultHours: 168 },
}

const ENDORSEMENTS_REQUIRED = 10

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeProposal(row: ProposalRow): Proposal {
  return {
    ...row,
    scope: row.scope as ProposalScope,
    status: row.status as ProposalStatus,
    endorsement_count: Number(row.endorsement_count),
    comment_count: Number(row.comment_count),
    view_count: Number(row.view_count),
    total_votes: Number(row.total_votes),
    approve_votes_weighted: Number(row.approve_votes_weighted),
    reject_votes_weighted: Number(row.reject_votes_weighted),
    abstain_votes_weighted: Number(row.abstain_votes_weighted),
    quorum_required: row.quorum_required !== null ? Number(row.quorum_required) : null,
    approval_threshold: row.approval_threshold !== null ? Number(row.approval_threshold) : null,
    eligible_voters: row.eligible_voters !== null ? Number(row.eligible_voters) : null,
    execution_deadline: row.execution_deadline instanceof Date
      ? row.execution_deadline.toISOString().split('T')[0]
      : row.execution_deadline,
  }
}

function normalizeProposalSummary(row: ProposalRow): ProposalSummary {
  return {
    id: row.id,
    author_id: row.author_id,
    title: row.title,
    category: row.category,
    scope: row.scope as ProposalScope,
    status: row.status as ProposalStatus,
    endorsement_count: Number(row.endorsement_count),
    total_votes: Number(row.total_votes),
    approve_votes_weighted: Number(row.approve_votes_weighted),
    reject_votes_weighted: Number(row.reject_votes_weighted),
    voting_ends_at: row.voting_ends_at,
    created_at: row.created_at,
  }
}

function normalizeDelegation(row: DelegationRow): Delegation {
  return row as Delegation
}

function makeError(message: string, statusCode: number, code: string): Error {
  return Object.assign(new Error(message), { statusCode, code })
}

function voteNullifier(citizenId: string, proposalId: string): string {
  // Clave dedicada, distinta de JWT_SECRET: rotar el secreto de sesión no debe
  // volver irreconocible el historial de nulificadores ya emitidos. En
  // producción VOTE_NULLIFIER_SECRET es obligatorio (ver config.ts); el
  // fallback a JWT_SECRET solo cubre desarrollo local.
  const key = config.VOTE_NULLIFIER_SECRET ?? config.JWT_SECRET
  return createHmac('sha256', key)
    .update(`${citizenId}:${proposalId}`)
    .digest('hex')
}

/**
 * Un ciudadano verificado = un voto. Siempre 1.0, sin importar la reputación.
 *
 * Antes escalaba de 1.0 a 1.5 según reputation_score — hasta 50% más poder de
 * voto para algunas cuentas que otras. La reputación la calcula la propia
 * plataforma (avales, participación, moderadores), así que ponderar el voto
 * con ella crea un circuito autorreferencial: el sistema decide quién se
 * comporta "bien" y luego le da más poder político a quien se comporta así.
 * Eso favorece a usuarios antiguos, penaliza a disidentes y desincentiva la
 * disidencia legítima — inaceptable para una plataforma de participación
 * política sin un marco jurídico y comunitario explícito que lo respalde.
 *
 * La reputación sigue existiendo para moderación, insignias y prioridad de
 * respuestas — nunca para multiplicar el valor de un voto. Reintroducir voto
 * ponderado debe ser una decisión deliberada y visible, no un flag que
 * alguien reactiva sin darse cuenta.
 *
 * El parámetro se conserva (sin usarse) para no romper las llamadas
 * existentes; ver los dos call-sites en castVote.
 */
function computeVoteWeight(_reputationScore: number): number {
  return 1.0
}

/**
 * Congela el padrón de votantes elegibles para una propuesta en el instante
 * debate→voting, dentro de la transacción `tx` que también la mueve a
 * 'voting'. Reemplaza el antiguo computeEligibleVoters(), que solo devolvía
 * un COUNT(*): el número no dejaba rastro de QUIÉNES eran esos ciudadanos, ni
 * permitía responder después "¿quién podía votar?" o auditar si el cálculo
 * fue correcto — y ese conteo vivía separado del propio cálculo de quórum
 * (proposals.eligible_voters), pudiendo desincronizarse si algo fallaba entre
 * medias.
 *
 * P0 Identity Assurance: el padrón y su denominador de quórum deben usar la
 * misma política de admisión que el endpoint de voto. Solo entran ciudadanos
 * con contacto verificado (nivel >= 2) y una ExternalIdentity emitida por un
 * proveedor explícitamente autorizado. Si no hay proveedores configurados,
 * el padrón queda vacío: fail-closed.
 */
async function freezeVoterRoll(
  tx: Prisma.TransactionClient,
  proposalId: string,
  proposal: Proposal,
): Promise<number> {
  const trustedProviders = config.CIVIC_IDENTITY_ASSURANCE_PROVIDERS
  if (trustedProviders.length === 0) return 0

  const assuredIdentity = Prisma.sql`
    c.verification_level >= 2
    AND EXISTS (
      SELECT 1
      FROM external_identities ei
      WHERE ei.citizen_id = c.id
        AND ei.provider IN (${Prisma.join(trustedProviders)})
    )
  `

  let whereClause: Prisma.Sql
  let reason: string

  switch (proposal.scope) {
    case 'neighborhood':
      whereClause = Prisma.sql`WHERE ${assuredIdentity} AND c.neighborhood = ${proposal.neighborhood}`
      reason = 'neighborhood_match'
      break
    case 'locality':
      whereClause = Prisma.sql`WHERE ${assuredIdentity} AND c.locality_id = ${proposal.locality_id}`
      reason = 'locality_match'
      break
    // city/regional/national: no hay modelo de multi-ciudad todavía, así que
    // el universo citywide sigue siendo correcto para estos ámbitos.
    case 'city':
    case 'regional':
    case 'national':
    default:
      whereClause = Prisma.sql`WHERE ${assuredIdentity}`
      reason = 'citywide'
  }

  const inserted = await tx.$queryRaw<Array<{ citizen_id: string }>>(Prisma.sql`
    INSERT INTO proposal_voter_roll
      (proposal_id, citizen_id, neighborhood, locality_id, verification_level, eligibility_reason)
    SELECT ${proposalId}::uuid, c.id, c.neighborhood, c.locality_id, c.verification_level, ${reason}
    FROM citizens c
    ${whereClause}
    ON CONFLICT (proposal_id, citizen_id) DO NOTHING
    RETURNING citizen_id
  `)

  return inserted.length
}

// ── createProposal ─────────────────────────────────────────────────────────────

export async function createProposal(
  authorId: string,
  data: CreateProposalInput,
): Promise<Proposal> {
  // Snapshot del territorio del autor. Sin esto el cálculo de quórum contaba
  // a TODOS los ciudadanos verificados de la ciudad para una propuesta de
  // barrio, inflando o desvirtuando su electorado real — ver
  // computeEligibleVoters().
  const authorRows = await prisma.$queryRaw<Array<{ locality_id: number | null; neighborhood: string | null }>>(Prisma.sql`
    SELECT locality_id, neighborhood FROM citizens WHERE id = ${authorId}::uuid
  `)
  const localityId = authorRows[0]?.locality_id ?? null
  const neighborhood = authorRows[0]?.neighborhood ?? null

  if (data.scope === 'neighborhood' && !neighborhood) {
    throw makeError(
      'Tu perfil no tiene barrio registrado — no se puede fijar el electorado de una propuesta de barrio',
      400, 'MISSING_NEIGHBORHOOD',
    )
  }
  if (data.scope === 'locality' && !localityId) {
    throw makeError(
      'Tu perfil no tiene localidad registrada — no se puede fijar el electorado de una propuesta de localidad',
      400, 'MISSING_LOCALITY',
    )
  }

  const rows = await prisma.$queryRaw<ProposalRow[]>(Prisma.sql`
    INSERT INTO proposals (author_id, title, description, executive_summary, category, scope, locality_id, neighborhood)
    VALUES (
      ${authorId}::uuid,
      ${data.title},
      ${data.description},
      ${data.executive_summary ?? null},
      ${data.category},
      ${data.scope},
      ${localityId},
      ${neighborhood}
    )
    RETURNING *
  `)
  const created = normalizeProposal(rows[0])
  fireReputation({ citizen_id: authorId, event_type: 'proposal_created', reference_id: created.id })
  return created
}

// ── listProposals ──────────────────────────────────────────────────────────────

export async function listProposals(filters: ListProposalsInput): Promise<ProposalSummary[]> {
  const conditions: Prisma.Sql[] = []

  if (filters.status) conditions.push(Prisma.sql`status = ${filters.status}`)
  if (filters.category) conditions.push(Prisma.sql`category = ${filters.category}`)
  if (filters.scope) conditions.push(Prisma.sql`scope = ${filters.scope}`)
  if (filters.author_id) conditions.push(Prisma.sql`author_id = ${filters.author_id}::uuid`)

  const where = conditions.length > 0
    ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
    : Prisma.sql``

  const rows = await prisma.$queryRaw<ProposalRow[]>(Prisma.sql`
    SELECT id, author_id, title, category, scope, status,
           endorsement_count, total_votes, approve_votes_weighted,
           reject_votes_weighted, voting_ends_at, created_at
    FROM proposals
    ${where}
    ORDER BY
      CASE WHEN status IN ('idea', 'draft') THEN endorsement_count END DESC NULLS LAST,
      created_at DESC
    LIMIT ${filters.limit} OFFSET ${filters.offset}
  `)

  return rows.map(normalizeProposalSummary)
}

// ── getProposalById ────────────────────────────────────────────────────────────

export async function getProposalById(id: string): Promise<Proposal> {
  const cached = await getCache<Proposal>('proposal', id)
  if (cached) return cached

  const rows = await prisma.$queryRaw<ProposalRow[]>(Prisma.sql`
    SELECT * FROM proposals WHERE id = ${id}::uuid
  `)

  if (rows.length === 0) throw makeError('Propuesta no encontrada', 404, 'PROPOSAL_NOT_FOUND')

  const proposal = normalizeProposal(rows[0])
  await setCache('proposal', id, proposal, TTL.REPORT)

  // fire-and-forget view increment
  prisma.$queryRaw(Prisma.sql`
    UPDATE proposals SET view_count = view_count + 1 WHERE id = ${id}::uuid
  `).catch(() => undefined)

  return proposal
}

// ── endorseProposal ────────────────────────────────────────────────────────────

export async function endorseProposal(
  proposalId: string,
  citizenId: string,
): Promise<EndorseResult> {
  const rows = await prisma.$queryRaw<Pick<ProposalRow, 'id' | 'status' | 'endorsement_count'>[]>(Prisma.sql`
    SELECT id, status, endorsement_count FROM proposals WHERE id = ${proposalId}::uuid
  `)

  if (rows.length === 0) throw makeError('Propuesta no encontrada', 404, 'PROPOSAL_NOT_FOUND')

  const proposal = rows[0]
  if (!['idea', 'draft'].includes(proposal.status)) {
    throw makeError('Solo se pueden avalar propuestas en fase idea o borrador', 400, 'WRONG_STATUS')
  }

  // Guardar el aval + actualizar el contador + (si corresponde) avanzar de
  // etapa son una sola transacción indivisible. Antes eran tres sentencias
  // sueltas: si el proceso caía entre el INSERT y el UPDATE del contador, el
  // aval quedaba registrado en proposal_endorsements pero endorsement_count
  // no lo reflejaba — el número mostrado se desincronizaba del real.
  //
  // Postgres es la fuente de verdad de "quién avaló", no Redis. La
  // restricción UNIQUE de proposal_endorsements es lo único que realmente
  // impide el doble aval; el INSERT ... ON CONFLICT es atómico igual que el
  // SADD de Redis que reemplaza, así que la protección contra condiciones de
  // carrera se mantiene.
  const result = await prisma.$transaction(async (tx) => {
    const inserted = await tx.$queryRaw<Array<{ citizen_id: string }>>(Prisma.sql`
      INSERT INTO proposal_endorsements (proposal_id, citizen_id)
      VALUES (${proposalId}::uuid, ${citizenId}::uuid)
      ON CONFLICT (proposal_id, citizen_id) DO NOTHING
      RETURNING citizen_id
    `)
    if (inserted.length === 0) {
      throw makeError('Ya avalaste esta propuesta', 409, 'ALREADY_ENDORSED')
    }

    const updated = await tx.$queryRaw<Pick<ProposalRow, 'endorsement_count' | 'status'>[]>(Prisma.sql`
      UPDATE proposals
      SET endorsement_count = endorsement_count + 1
      WHERE id = ${proposalId}::uuid
      RETURNING endorsement_count, status
    `)

    let currentStatus = updated[0].status as ProposalStatus
    let advanced = false
    const newCount = Number(updated[0].endorsement_count)

    if (newCount >= ENDORSEMENTS_REQUIRED && currentStatus === 'idea') {
      const advancedRows = await tx.$queryRaw<Pick<ProposalRow, 'status'>[]>(Prisma.sql`
        UPDATE proposals
        SET status = 'draft', draft_started_at = NOW()
        WHERE id = ${proposalId}::uuid AND status = 'idea'
        RETURNING status
      `)
      if (advancedRows.length > 0) {
        currentStatus = 'draft'
        advanced = true
      }
    }

    return { endorsement_count: newCount, status: currentStatus, advanced }
  })

  // Best-effort: acelera lecturas del set (p.ej. "¿ya avalé?" en el frontend)
  // pero ya no es la guarda de duplicados.
  redis.sadd(`vertice:endorsed:${proposalId}`, citizenId).catch(() => null)

  await delCache('proposal', proposalId)
  fireReputation({ citizen_id: citizenId, event_type: 'endorsement_given', reference_id: proposalId })
  publish('governance', 'proposal:endorsed', {
    proposal_id: proposalId,
    endorsement_count: result.endorsement_count,
    status: result.status,
  }).catch(() => null)

  return { proposal_id: proposalId, ...result }
}

// ── advanceProposalStage ───────────────────────────────────────────────────────

export async function advanceProposalStage(
  proposalId: string,
  citizenId: string,
  options: AdvanceStageInput = {},
): Promise<Proposal> {
  const rows = await prisma.$queryRaw<ProposalRow[]>(Prisma.sql`
    SELECT * FROM proposals WHERE id = ${proposalId}::uuid
  `)

  if (rows.length === 0) throw makeError('Propuesta no encontrada', 404, 'PROPOSAL_NOT_FOUND')

  const proposal = normalizeProposal(rows[0])

  // voting finalization is open to anyone once the period expires
  const isVotingFinalization = proposal.status === 'voting' &&
    proposal.voting_ends_at !== null &&
    new Date() >= proposal.voting_ends_at

  if (!isVotingFinalization && proposal.author_id !== citizenId) {
    throw makeError('Solo el autor puede avanzar la propuesta', 403, 'NOT_AUTHOR')
  }

  let updatedRows: ProposalRow[]

  switch (proposal.status) {
    case 'idea': {
      if (proposal.endorsement_count < ENDORSEMENTS_REQUIRED) {
        throw makeError(
          `Se requieren al menos ${ENDORSEMENTS_REQUIRED} avales para avanzar`,
          400,
          'INSUFFICIENT_ENDORSEMENTS',
        )
      }
      updatedRows = await prisma.$queryRaw<ProposalRow[]>(Prisma.sql`
        UPDATE proposals SET status = 'draft', draft_started_at = NOW()
        WHERE id = ${proposalId}::uuid RETURNING *
      `)
      break
    }

    case 'draft': {
      updatedRows = await prisma.$queryRaw<ProposalRow[]>(Prisma.sql`
        UPDATE proposals SET status = 'debate', debate_started_at = NOW()
        WHERE id = ${proposalId}::uuid RETURNING *
      `)
      break
    }

    case 'debate': {
      const scope = proposal.scope
      const cfg = QUORUM_CONFIG[scope]
      const durationHours = options.voting_duration_hours ?? cfg.defaultHours
      const clampedHours = Math.max(cfg.minHours, Math.min(cfg.maxHours, durationHours))
      const votingEndsAt = new Date(Date.now() + clampedHours * 3600 * 1000)

      // El padrón se congela y la propuesta pasa a 'voting' en la misma
      // transacción: eligible_voters es literalmente cuántas filas quedaron
      // en proposal_voter_roll, así que no pueden desincronizarse.
      updatedRows = await prisma.$transaction(async (tx) => {
        const eligibleVoters = await freezeVoterRoll(tx, proposalId, proposal)
        return tx.$queryRaw<ProposalRow[]>(Prisma.sql`
          UPDATE proposals
          SET status = 'voting',
              voting_starts_at = NOW(),
              voting_ends_at = ${votingEndsAt},
              quorum_required = ${cfg.quorum},
              approval_threshold = ${cfg.approval},
              eligible_voters = ${eligibleVoters}
          WHERE id = ${proposalId}::uuid RETURNING *
        `)
      })
      break
    }

    case 'voting': {
      if (!isVotingFinalization) {
        throw makeError('La votación aún está activa', 400, 'VOTING_STILL_ACTIVE')
      }

      const result = computeVotingResult(proposal)

      // Cierre idempotente: el UPDATE solo afecta la fila si SIGUE en
      // 'voting', y el job que registra el resultado on-chain se encola en
      // la MISMA transacción que ese cambio de estado. Antes el UPDATE no
      // filtraba por status, así que dos finalizaciones concurrentes (dos
      // clientes disparando el cierre automático a la vez, por ejemplo)
      // podían "cerrar" la misma votación dos veces y disparar el registro
      // blockchain y la notificación por duplicado. Ahora solo la solicitud
      // que gana la carrera hace el cambio; las demás ven 0 filas afectadas
      // y no repiten ningún efecto secundario.
      const closed = await prisma.$transaction(async (tx) => {
        const closedRows = await tx.$queryRaw<ProposalRow[]>(Prisma.sql`
          UPDATE proposals
          SET status = ${result}, decided_at = NOW()
          WHERE id = ${proposalId}::uuid AND status = 'voting'
          RETURNING *
        `)
        if (closedRows.length === 0) return null

        await enqueueJob('record_voting_result', {
          proposalId: proposal.id,
          title: proposal.title,
          description: proposal.description,
          totalVotes: proposal.total_votes,
          approveWeighted: proposal.approve_votes_weighted,
          rejectWeighted: proposal.reject_votes_weighted,
          abstainWeighted: proposal.abstain_votes_weighted,
          result,
          ipfsResultUri: proposal.ipfs_result_uri,
        }, tx)

        return closedRows
      })

      if (closed === null) {
        // Otra solicitud ya cerró esta votación primero — no hay nada nuevo
        // que hacer; devolvemos el estado actual sin re-notificar.
        const current = await prisma.$queryRaw<ProposalRow[]>(Prisma.sql`
          SELECT * FROM proposals WHERE id = ${proposalId}::uuid
        `)
        return normalizeProposal(current[0])
      }

      updatedRows = closed
      break
    }

    default:
      throw makeError(`Estado '${proposal.status}' no permite avance manual`, 400, 'TERMINAL_STATUS')
  }

  await delCache('proposal', proposalId)
  await delCache('stats', 'global')

  const advanced = normalizeProposal(updatedRows[0])

  // Notify the author about stage change
  const STAGE_LABEL: Record<string, string> = {
    draft: 'Borrador',
    debate: 'En debate',
    voting: 'En votación',
    approved: 'Aprobada',
    rejected: 'Rechazada',
    quorum_failed: 'Sin quórum',
  }
  if (advanced.author_id && STAGE_LABEL[advanced.status]) {
    createNotification(
      advanced.author_id,
      'proposal_stage',
      `Propuesta avanzó a: ${STAGE_LABEL[advanced.status]}`,
      `"${advanced.title}" cambió de etapa a ${STAGE_LABEL[advanced.status]}.`,
      `/dashboard/governance/${advanced.id}`,
    ).catch(() => null)
  }

  return advanced
}

function computeVotingResult(proposal: Proposal): 'approved' | 'rejected' | 'quorum_failed' {
  const cfg = QUORUM_CONFIG[proposal.scope]
  const eligibleVoters = proposal.eligible_voters ?? 0

  if (eligibleVoters === 0) return 'quorum_failed'

  const participationRate = proposal.total_votes / eligibleVoters
  if (participationRate < cfg.quorum) return 'quorum_failed'

  const totalWeighted =
    proposal.approve_votes_weighted +
    proposal.reject_votes_weighted +
    proposal.abstain_votes_weighted

  const approvalRate = totalWeighted > 0
    ? proposal.approve_votes_weighted / totalWeighted
    : 0

  return approvalRate >= cfg.approval ? 'approved' : 'rejected'
}

// ── castVote ──────────────────────────────────────────────────────────────────

export async function castVote(
  proposalId: string,
  citizenId: string,
  voteValue: -1 | 0 | 1,
): Promise<VoteReceipt> {
  const rows = await prisma.$queryRaw<ProposalRow[]>(Prisma.sql`
    SELECT id, status, voting_ends_at FROM proposals WHERE id = ${proposalId}::uuid
  `)

  if (rows.length === 0) throw makeError('Propuesta no encontrada', 404, 'PROPOSAL_NOT_FOUND')

  const proposal = rows[0]

  if (proposal.status !== 'voting') {
    throw makeError('La propuesta no está en período de votación', 400, 'WRONG_STATUS')
  }

  if (proposal.voting_ends_at && new Date() >= proposal.voting_ends_at) {
    throw makeError('El período de votación ha cerrado', 400, 'VOTING_CLOSED')
  }

  const nullifier = voteNullifier(citizenId, proposalId)

  // Get citizen reputation and check for double vote in one query
  const checkRows = await prisma.$queryRaw<Array<{
    already_voted: bigint | number
    reputation_score: string | number
  }>>(Prisma.sql`
    SELECT
      (SELECT COUNT(*) FROM votes WHERE nullifier_hash = ${nullifier})::int AS already_voted,
      c.reputation_score
    FROM citizens c
    WHERE c.id = ${citizenId}::uuid
  `)

  if (checkRows.length === 0) throw makeError('Ciudadano no encontrado', 404, 'CITIZEN_NOT_FOUND')

  if (Number(checkRows[0].already_voted) > 0) {
    throw makeError('Ya has votado en esta propuesta', 409, 'ALREADY_VOTED')
  }

  const voteWeight = computeVoteWeight(Number(checkRows[0].reputation_score))

  // Insert with ON CONFLICT DO NOTHING as race-condition safety net
  const voteRows = await prisma.$queryRaw<VoteRow[]>(Prisma.sql`
    INSERT INTO votes (proposal_id, nullifier_hash, vote_weight, vote_value)
    VALUES (${proposalId}::uuid, ${nullifier}, ${voteWeight}, ${voteValue})
    ON CONFLICT (nullifier_hash) DO NOTHING
    RETURNING id, vote_weight, vote_value, created_at
  `)

  if (voteRows.length === 0) {
    throw makeError('Ya has votado en esta propuesta', 409, 'ALREADY_VOTED')
  }

  // ── Liquid democracy: aggregate delegated weight ───────────────────────────
  // Una delegación solo puede aportar peso si el delegador también cumple la
  // política P0 de identidad cívica vigente. Así no se puede eludir la puerta
  // de identidad votando indirectamente a través de una cuenta asegurada.
  const trustedProviders = config.CIVIC_IDENTITY_ASSURANCE_PROVIDERS
  const delegatedAssurance = trustedProviders.length > 0
    ? Prisma.sql`
        AND c.verification_level >= 2
        AND EXISTS (
          SELECT 1
          FROM external_identities ei
          WHERE ei.citizen_id = c.id
            AND ei.provider IN (${Prisma.join(trustedProviders)})
        )
      `
    : Prisma.sql`AND FALSE`

  // El nullifier de cada delegador se calcula con voteNullifier() (la misma
  // función usada en todo el módulo) y NO se recalcula en SQL crudo.
  const delegatorRows = await prisma.$queryRaw<Array<{
    delegator_id: string
    reputation_score: string
  }>>(Prisma.sql`
    SELECT d.delegator_id, c.reputation_score
    FROM delegations d
    JOIN citizens c ON c.id = d.delegator_id
    WHERE d.delegate_id   = ${citizenId}::uuid
      AND d.is_active     = true
      AND d.delegation_type IN ('general', 'domain')
      ${delegatedAssurance}
  `)

  const delegatorNullifiers = delegatorRows.map(d => voteNullifier(d.delegator_id, proposalId))
  const alreadyVotedRows = delegatorNullifiers.length > 0
    ? await prisma.$queryRaw<Array<{ nullifier_hash: string }>>(Prisma.sql`
        SELECT nullifier_hash FROM votes WHERE nullifier_hash IN (${Prisma.join(delegatorNullifiers)})
      `)
    : []
  const alreadyVoted = new Set(alreadyVotedRows.map(r => r.nullifier_hash))
  const delegators = delegatorRows.filter(
    (d, i) => !alreadyVoted.has(delegatorNullifiers[i]),
  )

  const delegatedWeight = delegators.reduce(
    (sum, d) => sum + computeVoteWeight(Number(d.reputation_score)),
    0,
  )
  const totalWeight = voteWeight + delegatedWeight

  // Update weighted tally on proposal with combined weight
  await prisma.$queryRaw(Prisma.sql`
    UPDATE proposals SET
      total_votes = total_votes + 1,
      approve_votes_weighted  = approve_votes_weighted  + CASE WHEN ${voteValue} =  1 THEN ${totalWeight}::decimal ELSE 0 END,
      reject_votes_weighted   = reject_votes_weighted   + CASE WHEN ${voteValue} = -1 THEN ${totalWeight}::decimal ELSE 0 END,
      abstain_votes_weighted  = abstain_votes_weighted  + CASE WHEN ${voteValue} =  0 THEN ${totalWeight}::decimal ELSE 0 END
    WHERE id = ${proposalId}::uuid
  `)

  await delCache('proposal', proposalId)

  const vote = voteRows[0]
  fireReputation({ citizen_id: citizenId, event_type: 'vote_cast', reference_id: proposalId })
  publish('governance', 'proposal:vote_cast', { proposal_id: proposalId, vote_value: voteValue }).catch(() => null)
  return {
    vote_id: vote.id,
    vote_weight: totalWeight,
    vote_value: vote.vote_value,
    proposal_id: proposalId,
    created_at: vote.created_at,
    delegated_count: delegators.length,
  }
}

// ── getVoteTally ──────────────────────────────────────────────────────────────

export async function getVoteTally(proposalId: string): Promise<VoteTally> {
  const rows = await prisma.$queryRaw<ProposalRow[]>(Prisma.sql`
    SELECT id, status, total_votes, approve_votes_weighted, reject_votes_weighted,
           abstain_votes_weighted, quorum_required, approval_threshold, eligible_voters,
           voting_ends_at
    FROM proposals WHERE id = ${proposalId}::uuid
  `)

  if (rows.length === 0) throw makeError('Propuesta no encontrada', 404, 'PROPOSAL_NOT_FOUND')

  const row = rows[0]
  const totalVotes = Number(row.total_votes)
  const approveW = Number(row.approve_votes_weighted)
  const rejectW = Number(row.reject_votes_weighted)
  const abstainW = Number(row.abstain_votes_weighted)
  const eligibleVoters = row.eligible_voters !== null ? Number(row.eligible_voters) : null
  const quorumRequired = row.quorum_required !== null ? Number(row.quorum_required) : null

  let quorumReached: boolean | null = null
  let approvalPercentage: number | null = null

  if (quorumRequired !== null && eligibleVoters !== null && eligibleVoters > 0) {
    quorumReached = totalVotes / eligibleVoters >= quorumRequired
  }

  const totalW = approveW + rejectW + abstainW
  if (totalW > 0) {
    approvalPercentage = Math.round((approveW / totalW) * 10000) / 100
  }

  return {
    proposal_id: proposalId,
    status: row.status as ProposalStatus,
    total_votes: totalVotes,
    approve_weighted: approveW,
    reject_weighted: rejectW,
    abstain_weighted: abstainW,
    quorum_required: quorumRequired,
    approval_threshold: row.approval_threshold !== null ? Number(row.approval_threshold) : null,
    eligible_voters: eligibleVoters,
    quorum_reached: quorumReached,
    approval_percentage: approvalPercentage,
    voting_ends_at: row.voting_ends_at,
  }
}

// ── createDelegation ──────────────────────────────────────────────────────────

export async function createDelegation(
  delegatorId: string,
  data: CreateDelegationInput,
): Promise<Delegation> {
  if (delegatorId === data.delegate_id) {
    throw makeError('No puedes delegarte a ti mismo', 400, 'SELF_DELEGATION')
  }

  // Check 1-level circular: does delegate already delegate back to delegator?
  const circular = await prisma.$queryRaw<Array<{ exists: boolean }>>(Prisma.sql`
    SELECT EXISTS(
      SELECT 1 FROM delegations
      WHERE delegator_id = ${data.delegate_id}::uuid
        AND delegate_id = ${delegatorId}::uuid
        AND is_active = true
    ) AS exists
  `)

  if (circular[0].exists) {
    throw makeError('Esta delegación crearía un ciclo', 400, 'CIRCULAR_DELEGATION')
  }

  // Deactivate conflicting active delegation (same type + scope)
  if (data.delegation_type === 'general') {
    await prisma.$queryRaw(Prisma.sql`
      UPDATE delegations SET is_active = false, revoked_at = NOW()
      WHERE delegator_id = ${delegatorId}::uuid
        AND delegation_type = 'general'
        AND is_active = true
    `)
  } else if (data.delegation_type === 'domain' && data.domain) {
    await prisma.$queryRaw(Prisma.sql`
      UPDATE delegations SET is_active = false, revoked_at = NOW()
      WHERE delegator_id = ${delegatorId}::uuid
        AND delegation_type = 'domain'
        AND domain = ${data.domain}
        AND is_active = true
    `)
  } else if (data.delegation_type === 'proposal' && data.proposal_id) {
    await prisma.$queryRaw(Prisma.sql`
      UPDATE delegations SET is_active = false, revoked_at = NOW()
      WHERE delegator_id = ${delegatorId}::uuid
        AND delegation_type = 'proposal'
        AND proposal_id = ${data.proposal_id}::uuid
        AND is_active = true
    `)
  }

  const validUntil = data.valid_until ? new Date(data.valid_until) : null

  const rows = await prisma.$queryRaw<DelegationRow[]>(Prisma.sql`
    INSERT INTO delegations (delegator_id, delegate_id, delegation_type, domain, proposal_id, valid_until)
    VALUES (
      ${delegatorId}::uuid,
      ${data.delegate_id}::uuid,
      ${data.delegation_type},
      ${data.domain ?? null},
      ${data.proposal_id ? Prisma.sql`${data.proposal_id}::uuid` : Prisma.sql`NULL`},
      ${validUntil}
    )
    RETURNING *
  `)

  return normalizeDelegation(rows[0])
}

// ── revokeDelegation ──────────────────────────────────────────────────────────

export async function revokeDelegation(delegationId: string, citizenId: string): Promise<void> {
  const rows = await prisma.$queryRaw<Array<{ id: string; delegator_id: string }>>(Prisma.sql`
    SELECT id, delegator_id FROM delegations WHERE id = ${delegationId}::uuid AND is_active = true
  `)

  if (rows.length === 0) throw makeError('Delegación no encontrada', 404, 'DELEGATION_NOT_FOUND')
  if (rows[0].delegator_id !== citizenId) {
    throw makeError('No puedes revocar una delegación que no te pertenece', 403, 'NOT_DELEGATOR')
  }

  await prisma.$queryRaw(Prisma.sql`
    UPDATE delegations SET is_active = false, revoked_at = NOW()
    WHERE id = ${delegationId}::uuid
  `)
}

// ── getMyDelegations ──────────────────────────────────────────────────────────

export async function getMyDelegations(citizenId: string): Promise<Delegation[]> {
  const rows = await prisma.$queryRaw<DelegationRow[]>(Prisma.sql`
    SELECT * FROM delegations
    WHERE delegator_id = ${citizenId}::uuid AND is_active = true
    ORDER BY created_at DESC
  `)
  return rows.map(normalizeDelegation)
}

// ── getGovernanceStats ─────────────────────────────────────────────────────────

export async function getGovernanceStats(): Promise<GovernanceStats> {
  const cached = await getCache<GovernanceStats>('stats', 'global')
  if (cached) return cached

  const [statusRows, categoryRows, countsRow] = await Promise.all([
    prisma.$queryRaw<StatsCountRow[]>(Prisma.sql`
      SELECT status, COUNT(*) as count FROM proposals GROUP BY status
    `),
    prisma.$queryRaw<StatsCountRow[]>(Prisma.sql`
      SELECT category, COUNT(*) as count FROM proposals GROUP BY category
    `),
    prisma.$queryRaw<Array<{ active_votes: bigint | number; total_votes_cast: bigint | number }>>(Prisma.sql`
      SELECT
        (SELECT COUNT(*) FROM proposals WHERE status = 'voting')   AS active_votes,
        (SELECT COUNT(*) FROM votes)                               AS total_votes_cast
    `),
  ])

  const byStatus = statusRows.map(r => ({
    status: r.status as string,
    count: Number(r.count),
  }))

  const totalProposals = byStatus.reduce((sum, r) => sum + r.count, 0)

  const stats: GovernanceStats = {
    total_proposals: totalProposals,
    by_status: byStatus,
    by_category: categoryRows.map(r => ({ category: r.category as string, count: Number(r.count) })),
    active_votes: Number(countsRow[0].active_votes),
    total_votes_cast: Number(countsRow[0].total_votes_cast),
  }

  await setCache('stats', 'global', stats, TTL.STATS)
  return stats
}

// ── Admin: force-advance any proposal ────────────────────────────────────────

export async function adminAdvanceProposal(proposalId: string, actorId: string): Promise<Proposal> {
  const rows = await prisma.$queryRaw<ProposalRow[]>(Prisma.sql`
    SELECT * FROM proposals WHERE id = ${proposalId}::uuid
  `)
  if (rows.length === 0) throw makeError('Propuesta no encontrada', 404, 'PROPOSAL_NOT_FOUND')
  const proposal = normalizeProposal(rows[0])

  const TRANSITIONS: Partial<Record<ProposalStatus, string>> = {
    idea:    'draft',
    draft:   'debate',
    debate:  'voting',
    voting:  'approved',
  }
  const next = TRANSITIONS[proposal.status]
  if (!next) {
    await recordAuditEvent({
      actorId, action: 'admin_advance_proposal', targetType: 'proposal', targetId: proposalId,
      result: 'rejected', reason: `estado actual '${proposal.status}' no admite avance forzado`,
    })
    throw makeError('No se puede avanzar desde el estado actual', 400, 'INVALID_TRANSITION')
  }

  const updated = await prisma.$queryRaw<ProposalRow[]>(Prisma.sql`
    UPDATE proposals SET status = ${next}::text, updated_at = NOW()
    WHERE id = ${proposalId}::uuid RETURNING *
  `)
  await delCache('proposal', proposalId)
  await recordAuditEvent({
    actorId, action: 'admin_advance_proposal', targetType: 'proposal', targetId: proposalId,
    result: 'success', metadata: { from: proposal.status, to: next },
  })
  return normalizeProposal(updated[0])
}

// ── Admin: archive / reject any proposal ─────────────────────────────────────

export async function adminArchiveProposal(proposalId: string, actorId: string, reason: string): Promise<Proposal> {
  const rows = await prisma.$queryRaw<ProposalRow[]>(Prisma.sql`
    UPDATE proposals
    SET status = 'archived', rejection_reason = ${reason}, updated_at = NOW()
    WHERE id = ${proposalId}::uuid
    RETURNING *
  `)
  if (rows.length === 0) {
    await recordAuditEvent({
      actorId, action: 'admin_archive_proposal', targetType: 'proposal', targetId: proposalId,
      result: 'not_found', reason,
    })
    throw makeError('Propuesta no encontrada', 404, 'PROPOSAL_NOT_FOUND')
  }
  await delCache('proposal', proposalId)
  await recordAuditEvent({
    actorId, action: 'admin_archive_proposal', targetType: 'proposal', targetId: proposalId,
    result: 'success', reason,
  })
  return normalizeProposal(rows[0])
}

// ── Admin: list all proposals with any filter ─────────────────────────────────

export async function adminListProposals(status?: string): Promise<ProposalSummary[]> {
  const whereClause = status
    ? Prisma.sql`WHERE status = ${status}`
    : Prisma.empty

  const rows = await prisma.$queryRaw<ProposalRow[]>(Prisma.sql`
    SELECT id, author_id, title, category, scope, status, endorsement_count,
           total_votes, created_at, updated_at
    FROM proposals
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT 200
  `)
  return rows.map(normalizeProposalSummary)
}
