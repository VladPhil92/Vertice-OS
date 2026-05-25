import { FastifyInstance } from 'fastify'
import { requireVerified } from '../../middleware/auth'
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

export async function aiRoutes(app: FastifyInstance): Promise<void> {

  // ── POST /ai/query — consulta ciudadana libre ─────────────────────────────

  app.post('/query', {
    preHandler: requireVerified,
    config: { rateLimit: { max: 30, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const parsed = CivicQuerySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors })
    }

    const result = await civicQuery({
      ...parsed.data,
      citizen_id: request.citizen.sub,
    })
    return reply.send(result)
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

    // Fetch report details from the DB to pass to the AI service
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
