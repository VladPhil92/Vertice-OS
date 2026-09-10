import type { FastifyInstance, FastifyReply } from 'fastify'
import { requireVerified, requireModerator } from '../../middleware/auth'
import {
  executeIdempotentMutation,
  normalizeRequestedIdempotencyKey,
  type IdempotentMutationResult,
} from '../../lib/idempotency'
import { assertCommunityContentAllowed } from '../community/community.content-filter'
import { ensureCommunityPolicyAccepted } from '../community/community.safety.service'
import {
  CreateProposalSchema,
  ListProposalsSchema,
  AdminListProposalsSchema,
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

function sendMutation<T>(reply: FastifyReply, result: IdempotentMutationResult<T>) {
  reply.header('Idempotency-Key', result.idempotencyKey)
  reply.header('Idempotency-Replayed', result.replayed ? 'true' : 'false')
  return reply.status(result.statusCode).send(result.value)
}

export async function governanceRoutes(app: FastifyInstance): Promise<void> {
  app.get('/proposals', async (request, reply) => {
    const parsed = ListProposalsSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Parámetros inválidos', details: parsed.error.flatten().fieldErrors })
    }
    const proposals = await listProposals(parsed.data)
    return reply.send({ data: proposals, count: proposals.length })
  })

  app.get('/proposals/stats', async (_request, reply) => reply.send(await getGovernanceStats()))

  app.get('/proposals/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    return reply.send(await getProposalById(id))
  })

  app.get('/proposals/:id/tally', async (request, reply) => {
    const { id } = request.params as { id: string }
    return reply.send(await getVoteTally(id))
  })

  app.post('/proposals', {
    preHandler: requireVerified,
    config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const parsed = CreateProposalSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors })
    }
    await ensureCommunityPolicyAccepted(request.citizen.sub)
    assertCommunityContentAllowed([
      { field: 'title', value: parsed.data.title },
      { field: 'description', value: parsed.data.description },
      { field: 'executive_summary', value: parsed.data.executive_summary },
    ])
    const result = await executeIdempotentMutation({
      citizenId: request.citizen.sub,
      scope: 'governance:proposal:create',
      payload: parsed.data,
      requestedKey: normalizeRequestedIdempotencyKey(request.headers['idempotency-key']),
      successStatus: 201,
      operation: () => createProposal(request.citizen.sub, parsed.data),
    })
    return sendMutation(reply, result)
  })

  app.post('/proposals/:id/endorse', {
    preHandler: requireVerified,
    config: { rateLimit: { max: 50, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const result = await executeIdempotentMutation({
      citizenId: request.citizen.sub,
      scope: `governance:proposal:endorse:${id}`,
      payload: {},
      requestedKey: normalizeRequestedIdempotencyKey(request.headers['idempotency-key']),
      operation: () => endorseProposal(id, request.citizen.sub),
    })
    return sendMutation(reply, result)
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
    const result = await executeIdempotentMutation({
      citizenId: request.citizen.sub,
      scope: `governance:proposal:vote:${id}`,
      payload: parsed.data,
      requestedKey: normalizeRequestedIdempotencyKey(request.headers['idempotency-key']),
      successStatus: 201,
      operation: () => castVoteLedger(id, request.citizen.sub, parsed.data.vote_value),
    })
    return sendMutation(reply, result)
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
    const result = await executeIdempotentMutation({
      citizenId: request.citizen.sub,
      scope: `governance:proposal:advance:${id}`,
      payload: parsed.data,
      requestedKey: normalizeRequestedIdempotencyKey(request.headers['idempotency-key']),
      operation: () => advanceProposalStageSafely(id, request.citizen.sub, parsed.data),
    })
    return sendMutation(reply, result)
  })

  app.post('/delegations', {
    preHandler: requireVerified,
    config: { rateLimit: { max: 30, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const parsed = CreateDelegationSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors })
    }
    const result = await executeIdempotentMutation({
      citizenId: request.citizen.sub,
      scope: 'governance:delegation:create',
      payload: parsed.data,
      requestedKey: normalizeRequestedIdempotencyKey(request.headers['idempotency-key']),
      successStatus: 201,
      operation: () => createDelegation(request.citizen.sub, parsed.data),
    })
    return sendMutation(reply, result)
  })

  app.get('/delegations/me', { preHandler: requireVerified }, async (request, reply) => {
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

  app.get('/admin/proposals', {
    preHandler: requireModerator,
    config: { rateLimit: { max: 120, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const parsed = AdminListProposalsSchema.safeParse(request.query)
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
    return reply.send(await adminAdvanceProposalSafely(id, request.citizen.sub))
  })

  app.post('/admin/proposals/:id/archive', {
    preHandler: requireModerator,
    config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = AdminArchiveSchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors })
    }
    return reply.send(await adminArchiveProposalSafely(id, request.citizen.sub, parsed.data.reason))
  })
}
