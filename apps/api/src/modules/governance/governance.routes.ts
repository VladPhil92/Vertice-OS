import { FastifyInstance } from 'fastify'
import { requireVerified } from '../../middleware/auth'
import {
  CreateProposalSchema,
  ListProposalsSchema,
  CastVoteSchema,
  AdvanceStageSchema,
  CreateDelegationSchema,
} from './governance.schema'
import {
  createProposal,
  listProposals,
  getProposalById,
  endorseProposal,
  advanceProposalStage,
  castVote,
  getVoteTally,
  createDelegation,
  revokeDelegation,
  getMyDelegations,
  getGovernanceStats,
} from './governance.service'

export async function governanceRoutes(app: FastifyInstance): Promise<void> {
  // ── Públicos ──────────────────────────────────────────────────────────────

  // GET /governance/proposals — listado con filtros
  app.get('/proposals', async (request, reply) => {
    const parsed = ListProposalsSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Parámetros inválidos', details: parsed.error.flatten().fieldErrors })
    }
    const proposals = await listProposals(parsed.data)
    return reply.send({ data: proposals, count: proposals.length })
  })

  // GET /governance/proposals/stats — estadísticas agregadas
  app.get('/proposals/stats', async (_request, reply) => {
    const stats = await getGovernanceStats()
    return reply.send(stats)
  })

  // GET /governance/proposals/:id — detalle completo
  app.get('/proposals/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const proposal = await getProposalById(id)
    return reply.send(proposal)
  })

  // GET /governance/proposals/:id/tally — conteo de votos en tiempo real
  app.get('/proposals/:id/tally', async (request, reply) => {
    const { id } = request.params as { id: string }
    const tally = await getVoteTally(id)
    return reply.send(tally)
  })

  // ── Requieren identidad verificada (lvl ≥ 1) ──────────────────────────────

  // POST /governance/proposals — crear propuesta
  app.post('/proposals', {
    preHandler: requireVerified,
    config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const parsed = CreateProposalSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors })
    }
    const proposal = await createProposal(request.citizen.sub, parsed.data)
    return reply.status(201).send(proposal)
  })

  // POST /governance/proposals/:id/endorse — avalar una propuesta
  app.post('/proposals/:id/endorse', {
    preHandler: requireVerified,
    config: { rateLimit: { max: 50, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const result = await endorseProposal(id, request.citizen.sub)
    return reply.send(result)
  })

  // POST /governance/proposals/:id/vote — votar en una propuesta
  app.post('/proposals/:id/vote', {
    preHandler: requireVerified,
    config: { rateLimit: { max: 100, timeWindow: '1 day' } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = CastVoteSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors })
    }
    const receipt = await castVote(id, request.citizen.sub, parsed.data.vote_value)
    return reply.status(201).send(receipt)
  })

  // PATCH /governance/proposals/:id/advance — avanzar ciclo de vida
  app.patch('/proposals/:id/advance', {
    preHandler: requireVerified,
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = AdvanceStageSchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors })
    }
    const proposal = await advanceProposalStage(id, request.citizen.sub, parsed.data)
    return reply.send(proposal)
  })

  // ── Delegaciones ──────────────────────────────────────────────────────────

  // POST /governance/delegations — crear delegación
  app.post('/delegations', {
    preHandler: requireVerified,
  }, async (request, reply) => {
    const parsed = CreateDelegationSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors })
    }
    const delegation = await createDelegation(request.citizen.sub, parsed.data)
    return reply.status(201).send(delegation)
  })

  // GET /governance/delegations/me — mis delegaciones activas
  app.get('/delegations/me', {
    preHandler: requireVerified,
  }, async (request, reply) => {
    const delegations = await getMyDelegations(request.citizen.sub)
    return reply.send({ data: delegations, count: delegations.length })
  })

  // DELETE /governance/delegations/:id — revocar delegación
  app.delete('/delegations/:id', {
    preHandler: requireVerified,
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    await revokeDelegation(id, request.citizen.sub)
    return reply.send({ success: true })
  })
}
