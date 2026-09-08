import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../../middleware/auth'
import {
  executeIdempotentMutation,
  normalizeRequestedIdempotencyKey,
} from '../../lib/idempotency'
import { getBillingCatalog, getEffectiveBillingAccess } from './billing.service'
import {
  cancelMyProSubscription,
  createProCheckout,
  processMercadoPagoWebhook,
  reconcileMyBilling,
} from './payment.service'

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
  app.get('/plans', async (_request, reply) => reply.send(getBillingCatalog()))

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

    const result = await executeIdempotentMutation({
      citizenId: request.citizen.sub,
      scope: 'billing:pro-checkout',
      payload: parsed.data,
      requestedKey: normalizeRequestedIdempotencyKey(request.headers['idempotency-key']),
      successStatus: 201,
      // The same effective key is forwarded to the payment ledger. This binds
      // the generic API receipt to Mercado Pago checkout reconciliation instead
      // of creating two unrelated idempotency domains.
      operation: (effectiveKey) => createProCheckout(
        request.citizen.sub,
        parsed.data.billingCycle,
        effectiveKey,
      ),
    })
    reply.header('Idempotency-Key', result.idempotencyKey)
    reply.header('Idempotency-Replayed', result.replayed ? 'true' : 'false')
    return reply.status(result.statusCode).send(result.value)
  })

  app.post('/cancel', { preHandler: requireAuth }, async (request, reply) => {
    return reply.send(await cancelMyProSubscription(request.citizen.sub))
  })

  app.post('/reconcile', { preHandler: requireAuth }, async (request, reply) => {
    return reply.send(await reconcileMyBilling(request.citizen.sub))
  })

  // Provider webhook authority and deduplication remain provider-scoped. It is
  // intentionally not routed through the citizen idempotency ledger.
  app.post('/webhooks/mercadopago', async (request, reply) => {
    const result = await processMercadoPagoWebhook({
      xSignature: headerValue(request.headers['x-signature']),
      xRequestId: headerValue(request.headers['x-request-id']),
      dataId: webhookDataId(request),
      body: request.body,
    })
    return reply.status(200).send(result)
  })
}
