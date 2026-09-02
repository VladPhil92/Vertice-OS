import type { FastifyInstance } from 'fastify'
import { requireVerified } from '../../middleware/auth'
import {
  EscalateControlSchema,
  EscalateProposalSchema,
  ListCivicCasesSchema,
} from './workflow.schema'
import {
  analyzeReportWorkflow,
  createControlFromReport,
  createProposalFromReport,
  getCivicCase,
  getCivicCaseForReport,
  listCivicCases,
} from './workflow.service'

export async function workflowRoutes(app: FastifyInstance): Promise<void> {
  app.get('/cases', {
    preHandler: requireVerified,
  }, async (request, reply) => {
    const parsed = ListCivicCasesSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Parámetros inválidos', code: 'INVALID_QUERY' })
    }

    const cases = await listCivicCases(request.citizen.sub, parsed.data.limit)
    return reply.send({ data: cases, count: cases.length })
  })

  app.get('/cases/:id', {
    preHandler: requireVerified,
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const civicCase = await getCivicCase(request.citizen.sub, id)
    return reply.send(civicCase)
  })

  app.get('/reports/:reportId', {
    preHandler: requireVerified,
  }, async (request, reply) => {
    const { reportId } = request.params as { reportId: string }
    const civicCase = await getCivicCaseForReport(request.citizen.sub, reportId)
    return reply.send({ case: civicCase })
  })

  app.post('/reports/:reportId/analyze', {
    preHandler: requireVerified,
    config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const { reportId } = request.params as { reportId: string }
    const result = await analyzeReportWorkflow(request.citizen.sub, reportId)
    return reply.send(result)
  })

  app.post('/reports/:reportId/proposal', {
    preHandler: requireVerified,
    config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const { reportId } = request.params as { reportId: string }
    const parsed = EscalateProposalSchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Datos inválidos',
        code: 'INVALID_INPUT',
        details: parsed.error.flatten().fieldErrors,
      })
    }

    const result = await createProposalFromReport(request.citizen.sub, reportId, parsed.data)
    return reply.status(201).send(result)
  })

  app.post('/reports/:reportId/control', {
    preHandler: requireVerified,
    config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const { reportId } = request.params as { reportId: string }
    const parsed = EscalateControlSchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Datos inválidos',
        code: 'INVALID_INPUT',
        details: parsed.error.flatten().fieldErrors,
      })
    }

    const result = await createControlFromReport(request.citizen.sub, reportId, parsed.data)
    return reply.status(201).send(result)
  })
}
