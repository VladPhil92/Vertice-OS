import type { FastifyInstance } from 'fastify'
import { requireVerified } from '../../middleware/auth'
import {
  executeIdempotentMutation,
  normalizeRequestedIdempotencyKey,
} from '../../lib/idempotency'
import {
  CreateLegalDocumentSchema,
  UpdateLegalDocumentSchema,
  SubmitLegalDocumentSchema,
  ListLegalDocumentsSchema,
  type CreateLegalDocumentInput,
  type UpdateLegalDocumentInput,
  type SubmitLegalDocumentInput,
  type ListLegalDocumentsInput,
} from './legal.schema'
import {
  createLegalDocument,
  getLegalDocument,
  listLegalDocuments,
  updateLegalDocument,
  submitLegalDocument,
  deleteLegalDocument,
} from './legal.service'

function isStructuredHttpError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false

  const candidate = error as { statusCode?: unknown; code?: unknown }
  return typeof candidate.statusCode === 'number'
    && Number.isInteger(candidate.statusCode)
    && candidate.statusCode >= 400
    && candidate.statusCode <= 599
    && typeof candidate.code === 'string'
    && candidate.code.length > 0
}

export async function legalRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: ListLegalDocumentsInput }>(
    '/',
    { preHandler: requireVerified },
    async (request, reply) => {
      const citizenId = request.citizen.sub
      const parsed = ListLegalDocumentsSchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Parámetros inválidos', code: 'INVALID_QUERY' })
      }
      const docs = await listLegalDocuments(citizenId, parsed.data)
      return reply.send({ documents: docs, count: docs.length })
    },
  )

  // AI generation is expensive and creates a durable document. A repeated
  // browser request must replay the first result instead of invoking the AI and
  // inserting a second legal draft.
  app.post<{ Body: CreateLegalDocumentInput }>(
    '/',
    { preHandler: requireVerified },
    async (request, reply) => {
      const citizenId = request.citizen.sub
      const parsed = CreateLegalDocumentSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Datos inválidos',
          code: 'INVALID_INPUT',
          details: parsed.error.flatten().fieldErrors,
        })
      }

      try {
        const result = await executeIdempotentMutation({
          citizenId,
          scope: 'legal:document:create',
          payload: parsed.data,
          requestedKey: normalizeRequestedIdempotencyKey(request.headers['idempotency-key']),
          successStatus: 201,
          operation: () => createLegalDocument(citizenId, parsed.data),
        })
        reply.header('Idempotency-Key', result.idempotencyKey)
        reply.header('Idempotency-Replayed', result.replayed ? 'true' : 'false')
        return reply.status(result.statusCode).send(result.value)
      } catch (err: unknown) {
        // Preserve validation/idempotency HTTP contracts. In particular,
        // INVALID_IDEMPOTENCY_KEY is a client 400 and must never be disguised
        // as an AI provider outage.
        if (isStructuredHttpError(err)) throw err

        const message = err instanceof Error ? err.message : 'Error desconocido'
        app.log.error('[legal] createLegalDocument error: %s', message)
        return reply.status(503).send({
          error: 'El servicio de análisis legal no está disponible en este momento',
          code: 'AI_SERVICE_UNAVAILABLE',
        })
      }
    },
  )

  app.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requireVerified },
    async (request, reply) => {
      const doc = await getLegalDocument(request.params.id, request.citizen.sub)
      if (!doc) return reply.status(404).send({ error: 'Documento no encontrado', code: 'NOT_FOUND' })
      return reply.send(doc)
    },
  )

  app.put<{ Params: { id: string }; Body: UpdateLegalDocumentInput }>(
    '/:id',
    { preHandler: requireVerified },
    async (request, reply) => {
      const citizenId = request.citizen.sub
      const parsed = UpdateLegalDocumentSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Datos inválidos',
          code: 'INVALID_INPUT',
          details: parsed.error.flatten().fieldErrors,
        })
      }
      const doc = await updateLegalDocument(request.params.id, citizenId, parsed.data)
      if (!doc) return reply.status(404).send({ error: 'Documento no encontrado', code: 'NOT_FOUND' })
      return reply.send(doc)
    },
  )

  app.post<{ Params: { id: string }; Body: SubmitLegalDocumentInput }>(
    '/:id/submit',
    { preHandler: requireVerified },
    async (request, reply) => {
      const citizenId = request.citizen.sub
      const parsed = SubmitLegalDocumentSchema.safeParse(request.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Datos inválidos', code: 'INVALID_INPUT' })

      const doc = await submitLegalDocument(request.params.id, citizenId, parsed.data)
      if (!doc) {
        return reply.status(400).send({
          error: 'No se puede enviar — el documento debe estar en estado draft o ready',
          code: 'INVALID_STATUS',
        })
      }
      return reply.send(doc)
    },
  )

  app.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requireVerified },
    async (request, reply) => {
      const deleted = await deleteLegalDocument(request.params.id, request.citizen.sub)
      if (!deleted) {
        return reply.status(400).send({
          error: 'Solo se pueden eliminar documentos en estado draft',
          code: 'DELETE_NOT_ALLOWED',
        })
      }
      return reply.status(204).send()
    },
  )
}
