import type { FastifyInstance } from 'fastify'
import { requireAuth, requireVerified } from '../../middleware/auth'
import {
  CivicActivityParamsSchema,
  CivicActivityValidationSchema,
  CivicAvatarBatchQuerySchema,
  CivicProfileParamsSchema,
  CommunityFeedQuerySchema,
  CommunityLeaderboardQuerySchema,
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
  listCommunityFeed,
  listFollowingFeed,
  removeActivityValidation,
  setActivityValidation,
  unfollowCivicProfile,
  updateCivicProfile,
} from './community.service'
import {
  confirmCivicAvatarUpload,
  createCivicAvatarUploadIntent,
  getCivicAvatarState,
  listPublicCivicAvatars,
  removeCivicAvatar,
} from './civic-avatar.service'

export async function communityRoutes(app: FastifyInstance): Promise<void> {
  // Public activity is privacy-safe: actors that have not opted into a public
  // civic profile remain anonymous and never appear in the leaderboard.
  app.get('/feed', async (request, reply) => {
    const parsed = CommunityFeedQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Parámetros inválidos',
        details: parsed.error.flatten().fieldErrors,
      })
    }

    const data = await listCommunityFeed(parsed.data)
    return reply.send({
      data,
      count: data.length,
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

  app.get('/following/feed', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = CommunityFeedQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Parámetros inválidos',
        details: parsed.error.flatten().fieldErrors,
      })
    }
    const data = await listFollowingFeed(request.citizen.sub, parsed.data)
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

    const data = await getCommunityLeaderboard(parsed.data)
    return reply.send({
      data,
      count: data.length,
      ranking_basis: 'acciones + evidencia + resultados verificados',
      excludes: ['seguidores', 'likes', 'impresiones', 'corroboraciones comunitarias'],
      scoring_version: 'civic-action-v1',
      visibility: 'solo perfiles cívicos publicados voluntariamente',
    })
  })

  // Batch avatar lookup prevents N+1 requests in feed/ranking clients and only
  // returns media for citizens who explicitly published their civic profile.
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
    return reply.send(await updateCivicProfile(request.citizen.sub, parsed.data))
  })

  app.get('/profile/me/avatar', { preHandler: requireAuth }, async (request, reply) => {
    return reply.send(await getCivicAvatarState(request.citizen.sub))
  })

  app.post('/profile/me/avatar/upload-intent', {
    preHandler: requireAuth,
    config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
  }, async (request, reply) => {
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

    // The policy attestation is deliberately separate from identity proofing.
    // Browser face checks assist quality control but never create a biometric
    // identity record and verification_level remains the source of truth.
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
    return reply.send(await getPublicCivicProfile(parsed.data.citizenId))
  })

  app.get('/profiles/:citizenId/follow-state', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = CivicProfileParamsSchema.safeParse(request.params)
    if (!parsed.success) return reply.status(400).send({ error: 'Perfil inválido' })
    return reply.send(await getFollowState(request.citizen.sub, parsed.data.citizenId))
  })

  app.post('/profiles/:citizenId/follow', {
    preHandler: requireAuth,
    config: { rateLimit: { max: 120, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const parsed = CivicProfileParamsSchema.safeParse(request.params)
    if (!parsed.success) return reply.status(400).send({ error: 'Perfil inválido' })
    return reply.send(await followCivicProfile(request.citizen.sub, parsed.data.citizenId))
  })

  app.delete('/profiles/:citizenId/follow', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = CivicProfileParamsSchema.safeParse(request.params)
    if (!parsed.success) return reply.status(400).send({ error: 'Perfil inválido' })
    return reply.send(await unfollowCivicProfile(request.citizen.sub, parsed.data.citizenId))
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
