import { randomUUID } from 'crypto'
import type { FastifyInstance } from 'fastify'
import { requireVerified } from '../../middleware/auth'
import { getCache, setCache, delCache, TTL } from '../../lib/cache'
import {
  CivicQuerySchema,
  TerritorialAnalysisSchema,
  DebateSynthesisSchema,
  PolicyDraftSchema,
  LegalAnalysisSchema,
} from './ai.schema'
import {
  civicQuery,
  analyzeTerritorial,
  synthesizeDebate,
  draftPolicy,
  analyzeLegal,
} from './ai.service'
import { getReportById } from '../territorial/territorial.service'
import { getProposalById } from '../governance/governance.service'

type ConvTurn = { role: 'user' | 'assistant'; content: string }
const CONV_NS = 'ai:conv'
const MAX_HISTORY = 20

async function loadHistory(sessionId: string, citizenId: string): Promise<ConvTurn[]> {
  const stored = await getCache<{ citizenId: string; turns: ConvTurn[] }>(CONV_NS, sessionId)
  if (!stored || stored.citizenId !== citizenId) return []
  return stored.turns
}

async function saveHistory(sessionId: string, citizenId: string, turns: ConvTurn[]): Promise<void> {
  const trimmed = turns.slice(-MAX_HISTORY)
  await setCache(CONV_NS, sessionId, { citizenId, turns: trimmed }, TTL.CONVERSATION)
}

export async function aiRoutes(app: FastifyInstance): Promise<void> {

  // ── POST /ai/query — consulta ciudadana libre con memoria de sesión ────────

  app.post('/query', {
    preHandler: requireVerified,
    config: { rateLimit: { max: 30, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const parsed = CivicQuerySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors })
    }

    const citizenId = request.citizen.sub
    const sessionId = parsed.data.session_id ?? randomUUID()

    // Load persisted history; merge with any client-provided fallback
    const persisted = await loadHistory(sessionId, citizenId)
    const history = persisted.length > 0
      ? persisted
      : (parsed.data.conversation_history ?? [])

    const result = await civicQuery({
      message: parsed.data.message,
      locality: parsed.data.locality,
      neighborhood: parsed.data.neighborhood,
      topic: parsed.data.topic,
      conversation_history: history,
      citizen_id: citizenId,
    })

    // Persist updated history
    const newHistory: ConvTurn[] = [
      ...history,
      { role: 'user', content: parsed.data.message },
      { role: 'assistant', content: result.response },
    ]
    await saveHistory(sessionId, citizenId, newHistory)

    return reply.send({ ...result, session_id: sessionId })
  })

  // ── DELETE /ai/session — borrar sesión de conversación ────────────────────

  app.delete('/session', {
    preHandler: requireVerified,
    config: { rateLimit: { max: 60, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const body = request.body as { session_id?: string }
    if (!body.session_id) {
      return reply.status(400).send({ error: 'session_id requerido' })
    }
    await delCache(CONV_NS, body.session_id)
    return reply.status(204).send()
  })

  // ── POST /ai/territorial/analyze — análisis de patrones territoriales ──────

  app.post('/territorial/analyze', {
    preHandler: requireVerified,
    config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const parsed = TerritorialAnalysisSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors })
    }

    const reportResults = await Promise.allSettled(
      parsed.data.report_ids.map(id => getReportById(id)),
    )

    const reports = reportResults
      .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof getReportById>>> => r.status === 'fulfilled')
      .map(r => ({
        id: r.value.id,
        category: r.value.category,
        title: r.value.title,
        description: r.value.description,
        urgency_score: r.value.urgency_score ?? 0.5,
        status: r.value.status,
        neighborhood: r.value.neighborhood ?? undefined,
      }))

    if (reports.length === 0) {
      return reply.status(400).send({ error: 'No se encontraron reportes válidos', code: 'NO_VALID_REPORTS' })
    }

    const result = await analyzeTerritorial({
      reports,
      locality: parsed.data.locality,
      neighborhood: parsed.data.neighborhood,
      citizen_id: request.citizen.sub,
    })
    return reply.send(result)
  })

  // ── POST /ai/governance/synthesize — síntesis de debate ──────────────────

  app.post('/governance/synthesize', {
    preHandler: requireVerified,
    config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const parsed = DebateSynthesisSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors })
    }

    const proposal = await getProposalById(parsed.data.proposal_id)

    const result = await synthesizeDebate({
      proposal_title: proposal.title,
      proposal_description: proposal.description,
      category: proposal.category,
      scope: proposal.scope,
    })
    return reply.send(result)
  })

  // ── POST /ai/governance/draft-policy — borrador de política pública ───────

  app.post('/governance/draft-policy', {
    preHandler: requireVerified,
    config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const parsed = PolicyDraftSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors })
    }

    const result = await draftPolicy({
      ...parsed.data,
      citizen_id: request.citizen.sub,
    })
    return reply.send(result)
  })

  // ── POST /ai/legal/analyze — análisis jurídico y generación de documento ──

  app.post('/legal/analyze', {
    preHandler: requireVerified,
    config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const parsed = LegalAnalysisSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors })
    }

    const result = await analyzeLegal({
      ...parsed.data,
      citizen_id: request.citizen.sub,
    })
    return reply.send(result)
  })
}
