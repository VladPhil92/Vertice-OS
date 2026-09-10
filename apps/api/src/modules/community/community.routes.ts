import type { FastifyInstance } from 'fastify'
import { requireAuth, requireModerator, requireVerified } from '../../middleware/auth'
import {
  CivicActivityParamsSchema,
  CivicActivityValidationSchema,
  CivicAvatarBatchQuerySchema,
  CivicProfileParamsSchema,
  CommunityFeedQuerySchema,
  CommunityLeaderboardQuerySchema,
  CommunityModerationQueueQuerySchema,
  CommunityModerationResolutionSchema,
  CommunityPolicyAcceptanceSchema,
  CommunitySafetyReportParamsSchema,
  CommunitySafetyReportSchema,
  ConfirmCivicAvatarSchema,
  UpdateCivicProfileSchema,
} from './community.schema'
import {
  followCivicProfile,
  getActivityValidationState,
  getCivicProfile,
  getCommunityLeaderboard,
  getFollowState,
  getPublicCivicProfile,
  listFollowingFeed,
  removeActivityValidation,
  setActivityValidation,
  unfollowCivicProfile,
  updateCivicProfile,
} from './community.service'
import { listCommunityFeedResilient } from './community.resilience.service'
import {
  acceptCommunityPolicy,
  blockCommunityUser,
  ensureCommunityPolicyAccepted,
  getCommunityBlockState,
  getCommunityPolicyState,
  listCommunityBlocks,
  listCommunityModerationQueue,
  reportCommunityTarget,
  resolveCommunitySafetyReport,
  unblockCommunityUser,
} from './community.safety.service'
import {
  assertCommunityInteractionAllowed,
  assertCommunityProfileVisible,
  filterCommunityActivitiesForViewer,
  filterVisibleCommunityActivities,
  filterVisibleCommunityLeaders,
} from './community.visibility.service'
import { assertCommunityContentAllowed } from './community.content-filter'
import {
  confirmCivicAvatarUpload,
  createCivicAvatarUploadIntent,
  getCivicAvatarState,
  listPublicCivicAvatars,
  removeCivicAvatar,
} from './civic-avatar.service'

export async function communityRoutes(app: FastifyInstance): Promise<void> {
  app.get('/feed', async (request, reply) => {
    const parsed = CommunityFeedQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Parámetros inválidos',
        details: parsed.error.flatten().fieldErrors,
      })
    }

    const result = await listCommunityFeedResilient(parsed.data)
    const data = await filterVisibleCommunityActivities(result.data)
    return reply.send({
      data,
      count: data.length,
      availability: result.availability,
      scoring: {
        version: 'civic-action-v1',
        max_score: 100,
        dimensions: {
          evidence: 25,
          results: 20,
          impact: 15,
          validation: 10,
          transparency: 5,
          collaboration: 5,
          continuity: 5,
          confidence: 15,
        },
        note: 'El score prioriza evidencia y resultados. Seguidores, likes y popularidad no suman puntos.',
      },
      social_graph: {
        version: 'community-v2',
        note: 'Corroboraciones y disputas son señales comunitarias separadas del estado de verificación y del score v1.',
      },
    })
  })

  app.get('/feed/me', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = CommunityFeedQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Parámetros inválidos',
        details: parsed.error.flatten().fieldErrors,
      })
    }
    const result = await listCommunityFeedResilient(parsed.data)
    const data = await filterCommunityActivitiesForViewer(request.citizen.sub, result.data)
    return reply.send({
      data,
      count: data.length,
      availability: result.availability,
      scoring: {
        version: 'civic-action-v1',
        note: 'El score prioriza evidencia y resultados. Seguidores, likes y popularidad no suman puntos.',
      },
      social_graph: { version: 'community-v2' },
    })
  })

  app.get('/following/feed', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = CommunityFeedQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Parámetros inválidos',
        details: parsed.error.flatten().fieldErrors,
      })
    }
    const raw = await listFollowingFeed(request.citizen.sub, parsed.data)
    const data = await filterCommunityActivitiesForViewer(request.citizen.sub, raw)
    return reply.send({ data, count: data.length, scope: 'following' })
  })

  app.get('/leaderboard', async (request, reply) => {
    const parsed = CommunityLeaderboardQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Parámetros inválidos',
        details: parsed.error.flatten().fieldErrors,
      })
    }

    const raw = await getCommunityLeaderboard(parsed.data)
    const data = await filterVisibleCommunityLeaders(raw)
    return reply.send({
      data,
      count: data.length,
      ranking_basis: 'acciones + evidencia + resultados verificados',
      excludes: ['seguidores', 'likes', 'impresiones', 'corroboraciones comunitarias'],
      scoring_version: 'civic-action-v1',
      visibility: 'solo perfiles cívicos publicados voluntariamente y no ocultados por moderación',
    })
  })

  app.get('/avatars', async (request, reply) => {
    const parsed = CivicAvatarBatchQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Consulta de imágenes inválida',
        details: parsed.error.flatten().fieldErrors,
      })
    }
    const data = await listPublicCivicAvatars(parsed.data.ids)
    return reply.send({ data, count: Object.keys(data).length })
  })

  app.get('/profile/me', { preHandler: requireAuth }, async (request, reply) => {
    return reply.send(await getCivicProfile(request.citizen.sub))
  })

  app.patch('/profile/me', {
    preHandler: requireAuth,
    config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const parsed = UpdateCivicProfileSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Perfil cívico inválido',
        details: parsed.error.flatten().fieldErrors,
      })
    }
    await ensureCommunityPolicyAccepted(request.citizen.sub)
    assertCommunityContentAllowed([
      { field: 'bio', value: parsed.data.bio },
      { field: 'organization', value: parsed.data.organization },
    ])
    return reply.send(await updateCivicProfile(request.citizen.sub, parsed.data))
  })

  app.get('/profile/me/avatar', { preHandler: requireAuth }, async (request, reply) => {
    return reply.send(await getCivicAvatarState(request.citizen.sub))
  })

  app.post('/profile/me/avatar/upload-intent', {
    preHandler: requireAuth,
    config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    await ensureCommunityPolicyAccepted(request.citizen.sub)
    return reply.send(await createCivicAvatarUploadIntent(request.citizen.sub))
  })

  app.post('/profile/me/avatar/confirm', {
    preHandler: requireAuth,
    config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const parsed = ConfirmCivicAvatarSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Foto de perfil inválida',
        details: parsed.error.flatten().fieldErrors,
      })
    }
    await ensureCommunityPolicyAccepted(request.citizen.sub)
    return reply.send(await confirmCivicAvatarUpload(
      request.citizen.sub,
      parsed.data.asset_id,
    ))
  })

  app.delete('/profile/me/avatar', {
    preHandler: requireAuth,
    config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    return reply.send(await removeCivicAvatar(request.citizen.sub))
  })

  app.get('/profiles/:citizenId', async (request, reply) => {
    const parsed = CivicProfileParamsSchema.safeParse(request.params)
    if (!parsed.success) return reply.status(400).send({ error: 'Perfil inválido' })
    await assertCommunityProfileVisible(parsed.data.citizenId)
    const profile = await getPublicCivicProfile(parsed.data.citizenId)
    const recentActions = await filterVisibleCommunityActivities(profile.recent_actions)
    return reply.send({ ...profile, recent_actions: recentActions })
  })

  app.get('/profiles/:citizenId/follow-state', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = CivicProfileParamsSchema.safeParse(request.params)
    if (!parsed.success) return reply.status(400).send({ error: 'Perfil inválido' })
    await assertCommunityProfileVisible(parsed.data.citizenId)
    await assertCommunityInteractionAllowed(request.citizen.sub, parsed.data.citizenId)
    return reply.send(await getFollowState(request.citizen.sub, parsed.data.citizenId))
  })

  app.post('/profiles/:citizenId/follow', {
    preHandler: requireAuth,
    config: { rateLimit: { max: 120, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const parsed = CivicProfileParamsSchema.safeParse(request.params)
    if (!parsed.success) return reply.status(400).send({ error: 'Perfil inválido' })
    await assertCommunityProfileVisible(parsed.data.citizenId)
    await assertCommunityInteractionAllowed(request.citizen.sub, parsed.data.citizenId)
    return reply.send(await followCivicProfile(request.citizen.sub, parsed.data.citizenId))
  })

  app.delete('/profiles/:citizenId/follow', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = CivicProfileParamsSchema.safeParse(request.params)
    if (!parsed.success) return reply.status(400).send({ error: 'Perfil inválido' })
    return reply.send(await unfollowCivicProfile(request.citizen.sub, parsed.data.citizenId))
  })

  // User-generated-content safety controls.
  app.get('/safety/policy', { preHandler: requireAuth }, async (request, reply) => {
    return reply.send(await getCommunityPolicyState(request.citizen.sub))
  })

  app.post('/safety/policy/accept', {
    preHandler: requireAuth,
    config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const parsed = CommunityPolicyAcceptanceSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(409).send({ error: 'Versión de política inválida', code: 'COMMUNITY_POLICY_VERSION_STALE' })
    return reply.send(await acceptCommunityPolicy(request.citizen.sub, parsed.data.policy_version, 'app'))
  })

  app.get('/safety/blocks', { preHandler: requireAuth }, async (request, reply) => {
    const data = await listCommunityBlocks(request.citizen.sub)
    return reply.send({ data, count: data.length })
  })

  app.get('/profiles/:citizenId/block-state', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = CivicProfileParamsSchema.safeParse(request.params)
    if (!parsed.success) return reply.status(400).send({ error: 'Perfil inválido' })
    return reply.send(await getCommunityBlockState(request.citizen.sub, parsed.data.citizenId))
  })

  app.post('/profiles/:citizenId/block', {
    preHandler: requireAuth,
    config: { rateLimit: { max: 60, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const parsed = CivicProfileParamsSchema.safeParse(request.params)
    if (!parsed.success) return reply.status(400).send({ error: 'Perfil inválido' })
    return reply.send(await blockCommunityUser(request.citizen.sub, parsed.data.citizenId))
  })

  app.delete('/profiles/:citizenId/block', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = CivicProfileParamsSchema.safeParse(request.params)
    if (!parsed.success) return reply.status(400).send({ error: 'Perfil inválido' })
    return reply.send(await unblockCommunityUser(request.citizen.sub, parsed.data.citizenId))
  })

  app.post('/safety/reports', {
    preHandler: requireAuth,
    config: { rateLimit: { max: 30, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const parsed = CommunitySafetyReportSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Denuncia inválida', details: parsed.error.flatten().fieldErrors })
    }
    return reply.status(201).send(await reportCommunityTarget(request.citizen.sub, parsed.data))
  })

  app.get('/moderation/reports', {
    preHandler: requireModerator,
    config: { rateLimit: { max: 240, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const parsed = CommunityModerationQueueQuerySchema.safeParse(request.query)
    if (!parsed.success) return reply.status(400).send({ error: 'Consulta de moderación inválida' })
    const data = await listCommunityModerationQueue(parsed.data)
    return reply.send({ data, count: data.length })
  })

  app.post('/moderation/reports/:reportId/resolve', {
    preHandler: requireModerator,
    config: { rateLimit: { max: 120, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const params = CommunitySafetyReportParamsSchema.safeParse(request.params)
    const body = CommunityModerationResolutionSchema.safeParse(request.body)
    if (!params.success || !body.success) return reply.status(400).send({ error: 'Resolución de moderación inválida' })
    return reply.send(await resolveCommunitySafetyReport(request.citizen.sub, params.data.reportId, body.data))
  })

  app.get('/activities/:type/:activityId/validations', async (request, reply) => {
    const parsed = CivicActivityParamsSchema.safeParse(request.params)
    if (!parsed.success) return reply.status(400).send({ error: 'Actividad inválida' })
    return reply.send(await getActivityValidationState(parsed.data.type, parsed.data.activityId))
  })

  app.put('/activities/:type/:activityId/validation', {
    preHandler: requireVerified,
    config: { rateLimit: { max: 60, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const params = CivicActivityParamsSchema.safeParse(request.params)
    const body = CivicActivityValidationSchema.safeParse(request.body)
    if (!params.success || !body.success) {
      return reply.status(400).send({
        error: 'Validación comunitaria inválida',
        details: body.success ? undefined : body.error.flatten().fieldErrors,
      })
    }
    return reply.send(await setActivityValidation(
      request.citizen.sub,
      params.data.type,
      params.data.activityId,
      body.data,
    ))
  })

  app.delete('/activities/:type/:activityId/validation', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = CivicActivityParamsSchema.safeParse(request.params)
    if (!parsed.success) return reply.status(400).send({ error: 'Actividad inválida' })
    return reply.send(await removeActivityValidation(
      request.citizen.sub,
      parsed.data.type,
      parsed.data.activityId,
    ))
  })
}
