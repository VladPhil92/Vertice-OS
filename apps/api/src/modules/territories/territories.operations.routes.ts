import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAdmin, requireSuperadmin } from '../../middleware/auth'
import { COHORT_ROLES, LAUNCH_STATES, assignLaunchCohortMember, getLaunchPlan, upsertLaunchPlan } from './territories.operations'
import { getNationalLaunchOperations } from './territories.operations.ranking'

const CodeParams = z.object({ code: z.string().trim().min(2).max(32) })
const BoardQuery = z.object({ limit: z.coerce.number().int().min(1).max(100).default(50) })
const LaunchPlanBody = z.object({
  operational_state: z.enum(LAUNCH_STATES),
  reason: z.string().trim().min(8).max(1000),
  target_active_citizens: z.number().int().min(0).max(100000).optional(),
  target_verified_actions: z.number().int().min(0).max(100000).optional(),
  target_local_leaders: z.number().int().min(0).max(10000).optional(),
  target_moderators: z.number().int().min(0).max(10000).optional(),
  launch_window_start: z.string().date().nullable().optional(),
  launch_window_end: z.string().date().nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
})
const CohortBody = z.object({
  citizen_id: z.string().uuid(),
  cohort_role: z.enum(COHORT_ROLES),
  notes: z.string().trim().max(500).nullable().optional(),
})

/**
 * National rollout control plane.
 * Read access requires a live admin role; mutations require live superadmin.
 * Cohort roles are labels for launch coordination only and never feed the auth
 * middleware, civic assurance, reputation, governance eligibility or ranking.
 */
export async function territoryLaunchOperationsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/board', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = BoardQuery.safeParse(request.query)
    if (!parsed.success) return reply.status(400).send({ error: 'Parámetros de operaciones inválidos' })
    const data = await getNationalLaunchOperations(parsed.data.limit)
    return reply.send({
      data,
      count: data.length,
      authority_boundary: 'operational_only',
      excluded_signals: ['payments', 'donations', 'payouts', 'subscription', 'kyc_kyb', 'ideology'],
    })
  })

  app.get('/:code', { preHandler: requireAdmin }, async (request, reply) => {
    const params = CodeParams.safeParse(request.params)
    if (!params.success) return reply.status(400).send({ error: 'Código territorial inválido' })
    return reply.send(await getLaunchPlan(params.data.code))
  })

  app.put('/:code', {
    preHandler: requireSuperadmin,
    config: { rateLimit: { max: 30, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const params = CodeParams.safeParse(request.params)
    const body = LaunchPlanBody.safeParse(request.body)
    if (!params.success || !body.success) {
      return reply.status(400).send({
        error: 'Plan de lanzamiento inválido',
        details: body.success ? undefined : body.error.flatten().fieldErrors,
      })
    }
    return reply.send(await upsertLaunchPlan({
      actorId: request.citizen.sub,
      territoryCode: params.data.code,
      operationalState: body.data.operational_state,
      reason: body.data.reason,
      targetActiveCitizens: body.data.target_active_citizens,
      targetVerifiedActions: body.data.target_verified_actions,
      targetLocalLeaders: body.data.target_local_leaders,
      targetModerators: body.data.target_moderators,
      launchWindowStart: body.data.launch_window_start,
      launchWindowEnd: body.data.launch_window_end,
      notes: body.data.notes,
    }))
  })

  app.post('/:code/cohort', {
    preHandler: requireSuperadmin,
    config: { rateLimit: { max: 60, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const params = CodeParams.safeParse(request.params)
    const body = CohortBody.safeParse(request.body)
    if (!params.success || !body.success) {
      return reply.status(400).send({ error: 'Asignación de cohorte inválida' })
    }
    return reply.status(201).send(await assignLaunchCohortMember({
      actorId: request.citizen.sub,
      territoryCode: params.data.code,
      citizenId: body.data.citizen_id,
      cohortRole: body.data.cohort_role,
      notes: body.data.notes,
    }))
  })
}
