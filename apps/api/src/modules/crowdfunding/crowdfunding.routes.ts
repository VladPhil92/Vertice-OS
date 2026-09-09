import type { FastifyInstance, FastifyReply } from 'fastify'
import { requireAdmin, requireAuth, requireVerified } from '../../middleware/auth'
import {
  executeIdempotentMutation,
  normalizeRequestedIdempotencyKey,
  type IdempotentMutationResult,
} from '../../lib/idempotency'
import { ENTITLEMENTS } from '../billing/billing.catalog'
import { requireEntitlement } from '../billing/billing.middleware'
import { assertFinancialCapabilityEnabled } from '../billing/finance-control-plane.service'
import { createCrowdfundingContributionCheckout } from '../billing/payment.service'
import {
  ALLOWED_FUNDING_MODELS,
  CAMPAIGN_STATUSES,
  CROWDFUNDING_CATEGORIES,
  CROWDFUNDING_CATEGORY_CATALOG,
  CROWDFUNDING_FEE_POLICY,
  CROWDFUNDING_GUARDRAILS,
  FUNDING_POLICIES,
} from './crowdfunding.policy'
import {
  campaignIdParamsSchema,
  campaignReviewSchema,
  citizenIdParamsSchema,
  contributionCheckoutSchema,
  createCampaignDraftSchema,
  payoutDestinationPreviewSchema,
  payoutDestinationRegistrationSchema,
  payoutProfileReviewSchema,
} from './crowdfunding.schema'
import {
  createCampaignDraft,
  getCampaignAnalytics,
  listOwnCampaigns,
  listPublicCampaigns,
} from './crowdfunding.service'
import {
  activateCampaign,
  getPayoutReadiness,
  listComplianceQueue,
  requestPayoutReview,
  reviewCampaign,
  reviewPayoutProfile,
} from './crowdfunding.compliance.service'
import {
  getCampaignActivationReadiness,
  getCrowdfundingReadiness,
} from './crowdfunding.readiness.service'
import { assertCampaignContributionReady } from './crowdfunding.checkout-gate.service'
import {
  previewCampaignPayoutDestination,
  registerVerifiedPayoutDestination,
} from '../billing/crowdfunding-payout.service'

function sendMutation<T>(reply: FastifyReply, result: IdempotentMutationResult<T>) {
  reply.header('Idempotency-Key', result.idempotencyKey)
  reply.header('Idempotency-Replayed', result.replayed ? 'true' : 'false')
  return reply.status(result.statusCode).send(result.value)
}

export async function crowdfundingRoutes(app: FastifyInstance): Promise<void> {
  app.get('/config', async (_request, reply) => reply.send({
    categories: CROWDFUNDING_CATEGORIES,
    categoryCatalog: CROWDFUNDING_CATEGORY_CATALOG,
    fundingModels: ALLOWED_FUNDING_MODELS,
    fundingPolicies: FUNDING_POLICIES,
    campaignStatuses: CAMPAIGN_STATUSES,
    feePolicy: CROWDFUNDING_FEE_POLICY,
    guardrails: CROWDFUNDING_GUARDRAILS,
    currency: 'COP',
  }))

  app.get('/campaigns', async (_request, reply) => reply.send({ campaigns: await listPublicCampaigns() }))

  app.get('/me/campaigns', { preHandler: requireAuth }, async (request, reply) => {
    return reply.send({ campaigns: await listOwnCampaigns(request.citizen.sub) })
  })

  app.get('/me/readiness', { preHandler: requireAuth }, async (request, reply) => {
    return reply.send(await getCrowdfundingReadiness(request.citizen.sub))
  })

  app.get('/me/campaigns/:campaignId/readiness', { preHandler: requireAuth }, async (request, reply) => {
    const params = campaignIdParamsSchema.safeParse(request.params)
    if (!params.success) {
      return reply.status(400).send({ error: 'Campaña inválida', code: 'INVALID_CAMPAIGN_ID' })
    }
    return reply.send(await getCampaignActivationReadiness(request.citizen.sub, params.data.campaignId))
  })

  app.get('/me/payout-readiness', { preHandler: requireAuth }, async (request, reply) => {
    return reply.send(await getPayoutReadiness(request.citizen.sub))
  })

  app.post('/me/payout-readiness/request-review', { preHandler: requireVerified }, async (request, reply) => {
    return reply.send(await requestPayoutReview(request.citizen.sub))
  })

  // Self-service only: the beneficiary is the only one who may resolve and
  // confirm the BRE-B destination bound to their own payout profile. An
  // admin can request a payout, but only to whatever destination the
  // beneficiary already verified here.
  app.post('/me/payout-destination/preview', { preHandler: requireVerified }, async (request, reply) => {
    const body = payoutDestinationPreviewSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({
        error: 'Llave BRE-B inválida',
        code: 'INVALID_BREB_DESTINATION',
        details: body.error.flatten(),
      })
    }
    return reply.send(await previewCampaignPayoutDestination(body.data))
  })

  app.post('/me/payout-destination', { preHandler: requireVerified }, async (request, reply) => {
    const body = payoutDestinationRegistrationSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({
        error: 'Destino de desembolso inválido',
        code: 'INVALID_BREB_DESTINATION',
        details: body.error.flatten(),
      })
    }
    return reply.send(await registerVerifiedPayoutDestination({
      citizenId: request.citizen.sub,
      key: body.data.key,
      keyType: body.data.keyType,
      confirmedHolderName: body.data.confirmedHolderName,
      confirmedFinancialEntityCode: body.data.confirmedFinancialEntityCode,
    }))
  })

  app.get(
    '/me/analytics',
    { preHandler: requireEntitlement(ENTITLEMENTS.CAMPAIGN_ANALYTICS) },
    async (request, reply) => reply.send(await getCampaignAnalytics(request.citizen.sub)),
  )

  app.post('/campaigns', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = createCampaignDraftSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Datos de campaña inválidos',
        code: 'INVALID_CAMPAIGN_DRAFT',
        details: parsed.error.flatten(),
      })
    }

    const result = await executeIdempotentMutation({
      citizenId: request.citizen.sub,
      scope: 'crowdfunding:campaign:create',
      payload: parsed.data,
      requestedKey: normalizeRequestedIdempotencyKey(request.headers['idempotency-key']),
      successStatus: 201,
      operation: async () => ({
        campaign: await createCampaignDraft(request.citizen.sub, parsed.data),
        nextStep: 'compliance_review' as const,
        activationRequiresReview: true,
      }),
    })
    return sendMutation(reply, result)
  })

  app.post('/me/campaigns/:campaignId/activate', { preHandler: requireVerified }, async (request, reply) => {
    const params = campaignIdParamsSchema.safeParse(request.params)
    if (!params.success) {
      return reply.status(400).send({ error: 'Campaña inválida', code: 'INVALID_CAMPAIGN_ID' })
    }
    return reply.send(await activateCampaign(request.citizen.sub, params.data.campaignId))
  })

  app.post(
    '/campaigns/:campaignId/contributions/checkout',
    { preHandler: requireEntitlement(ENTITLEMENTS.CROWDFUNDING_CONTRIBUTE) },
    async (request, reply) => {
      const params = campaignIdParamsSchema.safeParse(request.params)
      const body = contributionCheckoutSchema.safeParse(request.body)
      if (!params.success || !body.success) {
        return reply.status(400).send({
          error: 'Datos de aporte inválidos',
          code: 'INVALID_CONTRIBUTION',
          details: body.success ? undefined : body.error.flatten(),
        })
      }

      // Phase IV runtime stop is independent of campaign readiness. It blocks
      // only NEW collection while leaving reconciliation/refunds/webhooks alive.
      await assertFinancialCapabilityEnabled('crowdfunding_collection')

      // Re-evaluate the beneficiary + payout path on every checkout. This is a
      // live circuit breaker: an already-active campaign cannot keep taking
      // money after financial readiness degrades.
      await assertCampaignContributionReady(params.data.campaignId)

      const result = await executeIdempotentMutation({
        citizenId: request.citizen.sub,
        scope: `crowdfunding:contribution-checkout:${params.data.campaignId}`,
        payload: body.data,
        requestedKey: normalizeRequestedIdempotencyKey(request.headers['idempotency-key']),
        successStatus: 201,
        operation: (effectiveKey) => createCrowdfundingContributionCheckout({
          citizenId: request.citizen.sub,
          campaignId: params.data.campaignId,
          amountCop: body.data.amount_cop,
          platformTipCop: body.data.platform_tip_cop,
          isAnonymous: body.data.is_anonymous,
          requestedIdempotencyKey: effectiveKey,
        }),
      })
      return sendMutation(reply, result)
    },
  )

  app.get('/admin/review-queue', { preHandler: requireAdmin }, async (_request, reply) => {
    return reply.send(await listComplianceQueue())
  })

  app.post('/admin/campaigns/:campaignId/review', { preHandler: requireAdmin }, async (request, reply) => {
    const params = campaignIdParamsSchema.safeParse(request.params)
    const body = campaignReviewSchema.safeParse(request.body)
    if (!params.success || !body.success) {
      return reply.status(400).send({ error: 'Revisión inválida', code: 'INVALID_CAMPAIGN_REVIEW' })
    }
    return reply.send(await reviewCampaign(params.data.campaignId, body.data))
  })

  app.post('/admin/payout-profiles/:citizenId/review', { preHandler: requireAdmin }, async (request, reply) => {
    const params = citizenIdParamsSchema.safeParse(request.params)
    const body = payoutProfileReviewSchema.safeParse(request.body)
    if (!params.success || !body.success) {
      return reply.status(400).send({ error: 'Revisión inválida', code: 'INVALID_PAYOUT_REVIEW' })
    }
    return reply.send(await reviewPayoutProfile(
      request.citizen.sub,
      params.data.citizenId,
      body.data,
    ))
  })
}
