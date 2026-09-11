import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { requireAdmin, requireAuth, requireModerator } from '../../middleware/auth'
import { getClosedPilotAccessState } from '../../lib/closed-pilot-access'
import { PilotFeedbackSchema, PilotIncidentSchema, PilotTelemetrySchema } from './pilot.schema'
import {
  getPilotOperationsSummary,
  recordPilotFeedback,
  recordPilotIncident,
  recordPilotTelemetry,
} from './pilot.service'

function requireConfiguredPilot(reply: FastifyReply): boolean {
  const state = getClosedPilotAccessState()
  if (!state.enabled || !state.configured || state.mode !== 'closed_invite_only') {
    reply.status(503).send({
      error: 'El piloto cerrado no está activo',
      code: 'CLOSED_PILOT_NOT_ACTIVE',
    })
    return false
  }
  return true
}

async function requirePilotParticipant(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await requireAuth(request, reply)
  if (reply.sent) return
  requireConfiguredPilot(reply)
}

async function requirePilotOperator(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await requireModerator(request, reply)
  if (reply.sent) return
  requireConfiguredPilot(reply)
}

async function requirePilotAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await requireAdmin(request, reply)
  if (reply.sent) return
  requireConfiguredPilot(reply)
}

export async function pilotRoutes(app: FastifyInstance): Promise<void> {
  app.get('/status', { preHandler: requirePilotParticipant }, async (_request, reply) => {
    const access = getClosedPilotAccessState()
    return reply.send({
      status: 'active',
      mode: access.mode,
      cohort_size: access.cohort_size,
      telemetry_retention_days: 30,
      money_enabled: false,
      governance_authority: 'consultative_only',
    })
  })

  app.post('/telemetry', {
    preHandler: requirePilotParticipant,
    config: { rateLimit: { max: 240, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const parsed = PilotTelemetrySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Evento de piloto inválido',
        code: 'INVALID_PILOT_TELEMETRY',
        details: parsed.error.flatten().fieldErrors,
      })
    }

    return reply.status(202).send(await recordPilotTelemetry(request.citizen.sub, parsed.data))
  })

  app.post('/feedback', {
    preHandler: requirePilotParticipant,
    config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const parsed = PilotFeedbackSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Feedback de piloto inválido',
        code: 'INVALID_PILOT_FEEDBACK',
        details: parsed.error.flatten().fieldErrors,
      })
    }

    return reply.status(202).send(await recordPilotFeedback(request.citizen.sub, parsed.data))
  })

  app.get('/admin/summary', {
    preHandler: requirePilotOperator,
    config: { rateLimit: { max: 120, timeWindow: '1 hour' } },
  }, async (_request, reply) => reply.send(await getPilotOperationsSummary()))

  app.post('/admin/incidents', {
    preHandler: requirePilotAdmin,
    config: { rateLimit: { max: 30, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const parsed = PilotIncidentSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Incidente de piloto inválido',
        code: 'INVALID_PILOT_INCIDENT',
        details: parsed.error.flatten().fieldErrors,
      })
    }

    return reply.status(201).send(await recordPilotIncident(request.citizen.sub, parsed.data))
  })
}
