import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { enqueueJob } from '../../lib/jobs'
import { requireAdmin } from '../../middleware/auth'
import {
  buildAccountingExport,
  getFinanceOperationsStatus,
  listFinanceRiskFlags,
  reconcileFinanceLedger,
  requestCrowdfundingRefund,
  reviewFinanceRiskFlag,
  scanFinanceRisk,
} from './finance-operations.service'
import {
  listCampaignPayouts,
  previewCampaignPayoutDestination,
  reconcileCampaignPayout,
} from './crowdfunding-payout.service'
import { requestFlexibleCampaignPayout } from './crowdfunding-flexible-payout.service'
import {
  certifyCrowdfundingPayoutOperations,
  getCrowdfundingPayoutOperationsStatus,
} from './payout-operations.service'

const uuidSchema = z.string().uuid()

const refundParamsSchema = z.object({ transactionId: uuidSchema })
const refundBodySchema = z.object({
  reason: z.string().trim().min(10).max(500),
})

const riskQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(250).default(100),
})

const riskParamsSchema = z.object({ flagId: uuidSchema })
const riskReviewBodySchema = z.object({
  status: z.enum(['reviewed', 'dismissed', 'escalated']),
  notes: z.string().trim().min(3).max(1000).optional(),
})

const exportQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
})

const payoutCertificationSchema = z.object({
  status: z.enum(['pending', 'verified', 'rejected', 'suspended']),
  evidenceReference: z.string().trim().min(5).max(300).optional(),
  notes: z.string().trim().max(2000).optional(),
})

const payoutCampaignParamsSchema = z.object({ campaignId: uuidSchema })
const payoutRequestParamsSchema = z.object({ payoutRequestId: uuidSchema })
const payoutListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(250).default(100),
})

const brebKeyTypeSchema = z.enum([
  'ALPHANUMERIC',
  'MAIL',
  'PHONE',
  'IDENTIFICATION',
  'ESTABLISHMENT_CODE',
])

type BrebKeyInput = {
  keyType: z.infer<typeof brebKeyTypeSchema>
  key: string
}

function validBrebKey(value: BrebKeyInput): boolean {
  const key = value.key.trim()
  switch (value.keyType) {
    case 'ALPHANUMERIC': return /^@[A-Za-z0-9]{5,20}$/.test(key)
    case 'MAIL': return z.string().email().safeParse(key).success
    case 'PHONE': return /^3\d{9}$/.test(key)
    case 'IDENTIFICATION': return /^[A-Za-z0-9]{1,18}$/.test(key)
    case 'ESTABLISHMENT_CODE': return /^\d{8}$/.test(key)
  }
}

function addBrebKeyIssue(value: BrebKeyInput, ctx: z.RefinementCtx): void {
  if (!validBrebKey(value)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['key'],
      message: 'Formato de llave BRE-B inválido para el tipo seleccionado',
    })
  }
}

const payoutPreviewBodySchema = z.object({
  keyType: brebKeyTypeSchema,
  key: z.string().trim().min(1).max(254),
}).superRefine(addBrebKeyIssue)

const payoutRequestBodySchema = z.object({
  destination: z.object({
    keyType: brebKeyTypeSchema,
    key: z.string().trim().min(1).max(254),
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(254),
    confirmedHolderName: z.string().trim().min(2).max(180),
    confirmedFinancialEntityCode: z.string().trim().min(1).max(20),
  }).superRefine(addBrebKeyIssue),
})

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export async function financeOperationsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/status', { preHandler: requireAdmin }, async (_request, reply) => {
    return reply.send(await getFinanceOperationsStatus())
  })

  app.post('/reconcile', { preHandler: requireAdmin }, async (request, reply) => {
    return reply.send(await reconcileFinanceLedger({
      actorId: request.citizen.sub,
      triggerKind: 'manual',
    }))
  })

  app.post('/reconcile/enqueue', { preHandler: requireAdmin }, async (request, reply) => {
    await enqueueJob('reconcile_payment_ledger', { requestedByCitizenId: request.citizen.sub })
    return reply.status(202).send({ queued: true })
  })

  app.post('/risk/scan', { preHandler: requireAdmin }, async (request, reply) => {
    return reply.send(await scanFinanceRisk(request.citizen.sub))
  })

  app.get('/risk', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = riskQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Consulta de riesgo inválida', code: 'INVALID_RISK_QUERY' })
    }
    return reply.send({ flags: await listFinanceRiskFlags(parsed.data.limit) })
  })

  app.post('/risk/:flagId/review', { preHandler: requireAdmin }, async (request, reply) => {
    const params = riskParamsSchema.safeParse(request.params)
    const body = riskReviewBodySchema.safeParse(request.body)
    if (!params.success || !body.success) {
      return reply.status(400).send({ error: 'Revisión de riesgo inválida', code: 'INVALID_RISK_REVIEW' })
    }
    return reply.send(await reviewFinanceRiskFlag({
      actorId: request.citizen.sub,
      flagId: params.data.flagId,
      status: body.data.status,
      notes: body.data.notes,
    }))
  })

  app.post('/refunds/:transactionId', { preHandler: requireAdmin }, async (request, reply) => {
    const params = refundParamsSchema.safeParse(request.params)
    const body = refundBodySchema.safeParse(request.body)
    if (!params.success || !body.success) {
      return reply.status(400).send({ error: 'Solicitud de reembolso inválida', code: 'INVALID_REFUND_REQUEST' })
    }
    return reply.status(202).send(await requestCrowdfundingRefund({
      actorId: request.citizen.sub,
      transactionId: params.data.transactionId,
      reason: body.data.reason,
      requestedIdempotencyKey: headerValue(request.headers['idempotency-key']),
    }))
  })

  app.get('/export.csv', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = exportQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Rango contable inválido', code: 'INVALID_ACCOUNTING_RANGE' })
    }
    const { from, to } = parsed.data
    const maxRangeMs = 92 * 24 * 60 * 60 * 1000
    if (to <= from || to.getTime() - from.getTime() > maxRangeMs) {
      return reply.status(400).send({
        error: 'El rango debe ser positivo y no superar 92 días.',
        code: 'INVALID_ACCOUNTING_RANGE',
      })
    }

    const csv = await buildAccountingExport(from, to)
    const fileDate = from.toISOString().slice(0, 10)
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="vertice-finance-${fileDate}.csv"`)
      .send(csv)
  })

  app.post('/payout-certification', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = payoutCertificationSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Certificación de desembolsos inválida',
        code: 'INVALID_PAYOUT_CERTIFICATION',
        details: parsed.error.flatten(),
      })
    }
    return reply.status(201).send(await certifyCrowdfundingPayoutOperations({
      actorId: request.citizen.sub,
      status: parsed.data.status,
      evidenceReference: parsed.data.evidenceReference,
      notes: parsed.data.notes,
    }))
  })

  app.get('/payouts/status', { preHandler: requireAdmin }, async (_request, reply) => {
    return reply.send(await getCrowdfundingPayoutOperationsStatus())
  })

  app.get('/payouts', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = payoutListQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Consulta de desembolsos inválida', code: 'INVALID_PAYOUT_QUERY' })
    }
    return reply.send({ payouts: await listCampaignPayouts(parsed.data.limit) })
  })

  app.post('/payouts/destinations/preview', { preHandler: requireAdmin }, async (request, reply) => {
    const body = payoutPreviewBodySchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({
        error: 'Llave BRE-B inválida',
        code: 'INVALID_BREB_DESTINATION',
        details: body.error.flatten(),
      })
    }
    return reply.send(await previewCampaignPayoutDestination(body.data))
  })

  app.post('/payouts/campaigns/:campaignId', { preHandler: requireAdmin }, async (request, reply) => {
    const params = payoutCampaignParamsSchema.safeParse(request.params)
    const body = payoutRequestBodySchema.safeParse(request.body)
    if (!params.success || !body.success) {
      return reply.status(400).send({
        error: 'Solicitud de desembolso inválida',
        code: 'INVALID_PAYOUT_REQUEST',
        details: body.success ? undefined : body.error.flatten(),
      })
    }

    return reply.status(202).send(await requestFlexibleCampaignPayout({
      actorId: request.citizen.sub,
      campaignId: params.data.campaignId,
      destination: body.data.destination,
      requestedIdempotencyKey: headerValue(request.headers['idempotency-key']),
    }))
  })

  app.post('/payouts/:payoutRequestId/reconcile', { preHandler: requireAdmin }, async (request, reply) => {
    const params = payoutRequestParamsSchema.safeParse(request.params)
    if (!params.success) {
      return reply.status(400).send({ error: 'Desembolso inválido', code: 'INVALID_PAYOUT_REQUEST_ID' })
    }
    return reply.send(await reconcileCampaignPayout({
      payoutRequestId: params.data.payoutRequestId,
      actorId: request.citizen.sub,
    }))
  })

  app.post('/payouts/:payoutRequestId/reconcile/enqueue', { preHandler: requireAdmin }, async (request, reply) => {
    const params = payoutRequestParamsSchema.safeParse(request.params)
    if (!params.success) {
      return reply.status(400).send({ error: 'Desembolso inválido', code: 'INVALID_PAYOUT_REQUEST_ID' })
    }
    await enqueueJob('reconcile_crowdfunding_payout', {
      payoutRequestId: params.data.payoutRequestId,
      requestedByCitizenId: request.citizen.sub,
    })
    return reply.status(202).send({ queued: true })
  })
}
