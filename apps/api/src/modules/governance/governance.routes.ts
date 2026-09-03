import type { FastifyInstance } from 'fastify'
import { requireVerified, requireModerator } from '../../middleware/auth'
import {
  CreateProposalSchema,
  ListProposalsSchema,
  CastVoteSchema,
  AdvanceStageSchema,
  AdminArchiveSchema,
  CreateDelegationSchema,
} from './governance.schema'
import {
  createProposal,
  listProposals,
  getProposalById,
  endorseProposal,
  getVoteTally,
  createDelegation,
  revokeDelegation,
  getMyDelegations,
  getGovernanceStats,
} from './governance.service'
import { adminAdvanceProposalSafely } from './governance.admin-transition'
import { adminArchiveProposalSafely } from './governance.admin-security'
import { advanceProposalStageSafely } from './governance.lifecycle'
import { castVoteLedger } from './governance.vote-ledger'

export async function governanceRoutes(app: FastifyInstance): Promise<void> {
  // ── Públicos ──────────────────────────────────────────────────────────────

  app.get('/proposals', async (request, reply) => {
    const parsed = ListProposalsSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Parámetros inválidos', details: parsed.error.flatten().fieldErrors })
    }
    const proposals = await listProposals(parsed.data)
    return reply.send({ data: proposals, count: proposals.length })
  })

  app.get('/proposals/stats', async (_request, reply) => {
    const stats = await getGovernanceStats()
    return reply.send(stats)
  })

  app.get('/proposals/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const proposal = await getProposalById(id)
    return reply.send(proposal)
  })

  app.get('/proposals/:id/tally', async (request, reply) => {
    const { id } = request.params as { id: string }
    const tally = await getVoteTally(id)
    return reply.send(tally)
  })

  // ── Requieren identidad verificada ──────────────────────────────────────

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

  app.post('/proposals/:id/endorse', {
    preHandler: requireVerified,
    config: { rateLimit: { max: 50, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const result = await endorseProposal(id, request.citizen.sub)
    return reply.send(result)
  })

  app.post('/proposals/:id/vote', {
    preHandler: requireVerified,
    config: { rateLimit: { max: 100, timeWindow: '1 day' } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = CastVoteSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors })
    }

    const receipt = await castVoteLedger(id, request.citizen.sub, parsed.data.vote_value)
    return reply.status(201).send(receipt)
  })

  app.patch('/proposals/:id/advance', {
    preHandler: requireVerified,
    config: { rateLimit: { max: 30, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = AdvanceStageSchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors })
    }
    const proposal = await advanceProposalStageSafely(id, request.citizen.sub, parsed.data)
    return reply.send(proposal)
  })

  // ── Delegaciones ──────────────────────────────────────────────────────────

  app.post('/delegations', {
    preHandler: requireVerified,
    config: { rateLimit: { max: 30, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const parsed = CreateDelegationSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors })
    }
    const delegation = await createDelegation(request.citizen.sub, parsed.data)
    return reply.status(201).send(delegation)
  })

  app.get('/delegations/me', {
    preHandler: requireVerified,
  }, async (request, reply) => {
    const delegations = await getMyDelegations(request.citizen.sub)
    return reply.send({ data: delegations, count: delegations.length })
  })

  app.delete('/delegations/:id', {
    preHandler: requireVerified,
    config: { rateLimit: { max: 30, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    await revokeDelegation(id, request.citizen.sub)
    return reply.send({ success: true })
  })

  // ── Admin / Moderación ────────────────────────────────────────────────────

  // Admin listing reuses the validated public query contract instead of the
  // legacy raw query that referenced non-existent proposal columns.
  app.get('/admin/proposals', {
    preHandler: requireModerator,
    config: { rateLimit: { max: 120, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const parsed = ListProposalsSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Parámetros inválidos', details: parsed.error.flatten().fieldErrors })
    }
    const proposals = await listProposals(parsed.data)
    return reply.send({ data: proposals, count: proposals.length })
  })

  app.post('/admin/proposals/:id/advance', {
    preHandler: requireModerator,
    config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const proposal = await adminAdvanceProposalSafely(id, request.citizen.sub)
    return reply.send(proposal)
  })

  // Archival is moderation only before a civic vote opens. Successful state
  // mutation and its actor/reason audit row are committed atomically.
  app.post('/admin/proposals/:id/archive', {
    preHandler: requireModerator,
    config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = AdminArchiveSchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors })
    }
    const proposal = await adminArchiveProposalSafely(id, request.citizen.sub, parsed.data.reason)
    return reply.send(proposal)
  })
}
