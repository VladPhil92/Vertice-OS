import type { FastifyInstance } from 'fastify'
import { requireVerified } from '../../middleware/auth'
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

export async function legalRoutes(app: FastifyInstance): Promise<void> {

  // ── GET /legal — Listar documentos del ciudadano ──────────────────────────

  app.get<{ Querystring: ListLegalDocumentsInput }>(
    '/',
    { preHandler: requireVerified },
    async (request, reply) => {
      const citizenId = (request as any).citizen.sub as string
      const parsed = ListLegalDocumentsSchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Parámetros inválidos', code: 'INVALID_QUERY' })
      }

      const docs = await listLegalDocuments(citizenId, parsed.data)
      return reply.send({ documents: docs, count: docs.length })
    }
  )

  // ── POST /legal — Crear nuevo documento (inicia análisis IA) ─────────────

  app.post<{ Body: CreateLegalDocumentInput }>(
    '/',
    { preHandler: requireVerified },
    async (request, reply) => {
      const citizenId = (request as any).citizen.sub as string
      const parsed = CreateLegalDocumentSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Datos inválidos',
          code: 'INVALID_INPUT',
          details: parsed.error.flatten().fieldErrors,
        })
      }

      try {
        const doc = await createLegalDocument(citizenId, parsed.data)
        return reply.status(201).send(doc)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error desconocido'
        app.log.error('[legal] createLegalDocument error: %s', message)
        return reply.status(503).send({
          error: 'El servicio de análisis legal no está disponible en este momento',
          code: 'AI_SERVICE_UNAVAILABLE',
        })
      }
    }
  )

  // ── GET /legal/:id — Obtener documento ───────────────────────────────────

  app.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requireVerified },
    async (request, reply) => {
      const citizenId = (request as any).citizen.sub as string
      const doc = await getLegalDocument(request.params.id, citizenId)
      if (!doc) {
        return reply.status(404).send({ error: 'Documento no encontrado', code: 'NOT_FOUND' })
      }
      return reply.send(doc)
    }
  )

  // ── PUT /legal/:id — Editar borrador ─────────────────────────────────────
  // El ciudadano puede editar el texto del documento antes de enviarlo

  app.put<{ Params: { id: string }; Body: UpdateLegalDocumentInput }>(
    '/:id',
    { preHandler: requireVerified },
    async (request, reply) => {
      const citizenId = (request as any).citizen.sub as string
      const parsed = UpdateLegalDocumentSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Datos inválidos',
          code: 'INVALID_INPUT',
          details: parsed.error.flatten().fieldErrors,
        })
      }

      const doc = await updateLegalDocument(request.params.id, citizenId, parsed.data)
      if (!doc) {
        return reply.status(404).send({ error: 'Documento no encontrado', code: 'NOT_FOUND' })
      }
      return reply.send(doc)
    }
  )

  // ── POST /legal/:id/submit — Marcar como enviado ──────────────────────────

  app.post<{ Params: { id: string }; Body: SubmitLegalDocumentInput }>(
    '/:id/submit',
    { preHandler: requireVerified },
    async (request, reply) => {
      const citizenId = (request as any).citizen.sub as string
      const parsed = SubmitLegalDocumentSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Datos inválidos', code: 'INVALID_INPUT' })
      }

      const doc = await submitLegalDocument(request.params.id, citizenId, parsed.data)
      if (!doc) {
        return reply.status(400).send({
          error: 'No se puede enviar — el documento debe estar en estado draft o ready',
          code: 'INVALID_STATUS',
        })
      }
      return reply.send(doc)
    }
  )

  // ── DELETE /legal/:id — Eliminar borrador ─────────────────────────────────

  app.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requireVerified },
    async (request, reply) => {
      const citizenId = (request as any).citizen.sub as string
      const deleted = await deleteLegalDocument(request.params.id, citizenId)
      if (!deleted) {
        return reply.status(400).send({
          error: 'Solo se pueden eliminar documentos en estado draft',
          code: 'DELETE_NOT_ALLOWED',
        })
      }
      return reply.status(204).send()
    }
  )
}
