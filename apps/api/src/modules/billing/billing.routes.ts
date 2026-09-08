import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../../middleware/auth'
import { getBillingCatalog, getEffectiveBillingAccess } from './billing.service'
import {
  cancelMyProSubscription,
  createProCheckout,
  processMercadoPagoWebhook,
  reconcileMyBilling,
} from './payment.service'
import { processWompiPayoutWebhook } from './crowdfunding-payout.service'

const checkoutSchema = z.object({
  billingCycle: z.enum(['monthly', 'annual']),
})

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function webhookDataId(request: FastifyRequest): string | undefined {
  const query = request.query as Record<string, unknown>
  const body = request.body && typeof request.body === 'object'
    ? request.body as { data?: { id?: unknown } }
    : undefined
  const queryId = query['data.id']
  if (typeof queryId === 'string' && queryId) return queryId
  const bodyId = body?.data?.id
  return typeof bodyId === 'string' || typeof bodyId === 'number' ? String(bodyId) : undefined
}

export async function billingRoutes(app: FastifyInstance): Promise<void> {
  app.get('/plans', async (_request, reply) => {
    return reply.send(getBillingCatalog())
  })

  app.get('/me', { preHandler: requireAuth }, async (request, reply) => {
    return reply.send(await getEffectiveBillingAccess(request.citizen.sub))
  })

  app.post('/checkout', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = checkoutSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Ciclo de facturación inválido',
        code: 'INVALID_BILLING_CYCLE',
        details: parsed.error.flatten(),
      })
    }

    return reply.status(201).send(await createProCheckout(
      request.citizen.sub,
      parsed.data.billingCycle,
      headerValue(request.headers['idempotency-key']),
    ))
  })

  app.post('/cancel', { preHandler: requireAuth }, async (request, reply) => {
    return reply.send(await cancelMyProSubscription(request.citizen.sub))
  })

  app.post('/reconcile', { preHandler: requireAuth }, async (request, reply) => {
    return reply.send(await reconcileMyBilling(request.citizen.sub))
  })

  // This endpoint is intentionally unauthenticated at the session layer: its
  // authority is the provider-scoped HMAC signature, never a browser token.
  app.post('/webhooks/mercadopago', async (request, reply) => {
    const result = await processMercadoPagoWebhook({
      xSignature: headerValue(request.headers['x-signature']),
      xRequestId: headerValue(request.headers['x-request-id']),
      dataId: webhookDataId(request),
      body: request.body,
    })
    return reply.status(200).send(result)
  })

  // Wompi payout events use their own signature contract. The signed event is
  // only a trigger: the payout service re-fetches provider state server-to-
  // server before mutating the local payout ledger.
  app.post('/webhooks/wompi-payouts', async (request, reply) => {
    const result = await processWompiPayoutWebhook({
      xEventChecksum: headerValue(request.headers['x-event-checksum']),
      body: request.body,
    })
    return reply.status(200).send(result)
  })
}
