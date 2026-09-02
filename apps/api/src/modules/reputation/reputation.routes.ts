import type { FastifyInstance } from 'fastify'
import { requireVerified } from '../../middleware/auth'
import {
  RecordEventSchema,
  GetProfileSchema,
  LeaderboardQuerySchema,
  type RecordEventInput,
  type LeaderboardInput,
} from './reputation.schema'
import {
  recordReputationEvent,
  getReputationProfile,
  getReputationAnalytics,
  getLeaderboard,
  getCitizenGraph,
} from './reputation.service'

export async function reputationRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /reputation/profile/:citizenId ────────────────────────────────────
  // Pública — cualquiera puede ver el perfil de reputación de un ciudadano

  app.get<{ Params: { citizenId: string } }>(
    '/profile/:citizenId',
    async (request, reply) => {
      const parsed = GetProfileSchema.safeParse({ citizen_id: request.params.citizenId })
      if (!parsed.success) {
        return reply.status(400).send({ error: 'citizenId inválido', code: 'INVALID_CITIZEN_ID' })
      }

      const profile = await getReputationProfile(parsed.data.citizen_id)
      return reply.send(profile)
    },
  )

  // ── GET /reputation/me ─────────────────────────────────────────────────────
  // Privado — perfil del ciudadano autenticado

  app.get(
    '/me',
    { preHandler: requireVerified },
    async (request, reply) => {
      const citizenId = (request as unknown as { citizen: { sub: string } }).citizen.sub
      const profile = await getReputationProfile(citizenId)
      return reply.send(profile)
    },
  )

  // ── GET /reputation/me/analytics ───────────────────────────────────────────
  // Privado — historial, ranking y racha derivados de eventos reales.
  // No expone PII ni sustituye PostgreSQL como fuente de verdad.

  app.get(
    '/me/analytics',
    { preHandler: requireVerified },
    async (request, reply) => {
      const citizenId = (request as unknown as { citizen: { sub: string } }).citizen.sub
      const analytics = await getReputationAnalytics(citizenId)
      return reply.send(analytics)
    },
  )

  // ── GET /reputation/graph/:citizenId ──────────────────────────────────────
  // Pública — grafo de relaciones cívicas del ciudadano

  app.get<{ Params: { citizenId: string } }>(
    '/graph/:citizenId',
    async (request, reply) => {
      const parsed = GetProfileSchema.safeParse({ citizen_id: request.params.citizenId })
      if (!parsed.success) {
        return reply.status(400).send({ error: 'citizenId inválido', code: 'INVALID_CITIZEN_ID' })
      }

      const graph = await getCitizenGraph(parsed.data.citizen_id)
      return reply.send(graph)
    },
  )

  // ── GET /reputation/leaderboard ───────────────────────────────────────────
  // Pública — ranking de ciudadanos por puntaje de reputación

  app.get<{ Querystring: LeaderboardInput }>(
    '/leaderboard',
    async (request, reply) => {
      const parsed = LeaderboardQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Parámetros inválidos', code: 'INVALID_QUERY' })
      }

      const entries = await getLeaderboard(parsed.data)
      return reply.send({ entries, count: entries.length })
    },
  )

  // ── POST /reputation/events ───────────────────────────────────────────────
  // Interno — registrar un evento de reputación

  app.post<{ Body: RecordEventInput }>(
    '/events',
    { preHandler: requireVerified },
    async (request, reply) => {
      const parsed = RecordEventSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Datos del evento inválidos',
          code: 'INVALID_EVENT',
          details: parsed.error.flatten().fieldErrors,
        })
      }

      const event = await recordReputationEvent(parsed.data)
      return reply.status(201).send(event)
    },
  )
}
