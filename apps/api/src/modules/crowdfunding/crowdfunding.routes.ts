import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../middleware/auth'
import { CROWDFUNDING_CATEGORIES, CROWDFUNDING_GUARDRAILS, ALLOWED_FUNDING_MODELS, CAMPAIGN_STATUSES } from './crowdfunding.policy'
import { createCampaignDraftSchema } from './crowdfunding.schema'
import { createCampaignDraft, listOwnCampaigns, listPublicCampaigns } from './crowdfunding.service'

export async function crowdfundingRoutes(app: FastifyInstance): Promise<void> {
  app.get('/config', async (_request, reply) => {
    return reply.send({
      categories: CROWDFUNDING_CATEGORIES,
      fundingModels: ALLOWED_FUNDING_MODELS,
      campaignStatuses: CAMPAIGN_STATUSES,
      guardrails: CROWDFUNDING_GUARDRAILS,
      currency: 'COP',
    })
  })

  app.get('/campaigns', async (_request, reply) => {
    return reply.send({ campaigns: await listPublicCampaigns() })
  })

  app.get('/me/campaigns', { preHandler: requireAuth }, async (request, reply) => {
    return reply.send({ campaigns: await listOwnCampaigns(request.citizen.sub) })
  })

  app.post('/campaigns', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = createCampaignDraftSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Datos de campaña inválidos',
        code: 'INVALID_CAMPAIGN_DRAFT',
        details: parsed.error.flatten(),
      })
    }

    const campaign = await createCampaignDraft(request.citizen.sub, parsed.data)
    return reply.status(201).send({
      campaign,
      nextStep: 'compliance_review',
      activationRequiresReview: true,
    })
  })
}
