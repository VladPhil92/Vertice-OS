import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { requireAdmin, requireAuth, requireModerator } from '../../middleware/auth'
import { assertClosedPilotEmailAllowed, getClosedPilotAccessState } from '../../lib/closed-pilot-access'
import { prisma } from '../../lib/prisma'
import { PilotFeedbackSchema, PilotIncidentSchema, PilotTelemetrySchema } from './pilot.schema'
import {
  getPilotObservabilityState,
  getPilotOperationsSummary,
  recordPilotFeedback,
  recordPilotIncident,
  recordPilotTelemetry,
} from './pilot.service'

function requireConfiguredPilot(reply: FastifyReply): boolean {
  const access = getClosedPilotAccessState()
  if (!access.enabled || !access.configured || access.mode !== 'closed_invite_only') {
    reply.status(503).send({
      error: 'El piloto cerrado no está activo',
      code: 'CLOSED_PILOT_NOT_ACTIVE',
    })
    return false
  }

  const observability = getPilotObservabilityState()
  if (!observability.configured) {
    reply.status(503).send({
      error: 'La observabilidad del piloto no está configurada',
      code: 'PILOT_OBSERVABILITY_NOT_CONFIGURED',
    })
    return false
  }

  return true
}

async function requirePilotParticipant(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await requireAuth(request, reply)
  if (reply.sent || !requireConfiguredPilot(reply)) return

  const citizen = await prisma.citizen.findUnique({
    where: { id: request.citizen.sub },
    select: { email: true, isActive: true },
  })
  if (!citizen?.isActive) {
    reply.status(403).send({ error: 'Cuenta inactiva', code: 'PILOT_ACCOUNT_INACTIVE' })
    return
  }

  // Revalidate the invitation on every participant entry point. This closes the
  // short access-token window that could otherwise exist if pilot mode is
  // activated after an uninvited user already authenticated.
  assertClosedPilotEmailAllowed(citizen.email)
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
    const observability = getPilotObservabilityState()
    return reply.send({
      status: 'active',
      mode: access.mode,
      cohort_size: access.cohort_size,
      telemetry_retention_days: observability.retention_days,
      observability_storage: observability.storage,
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
