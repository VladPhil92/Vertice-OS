import { z } from 'zod'
import { LEGAL_TYPES, LEGAL_DOCUMENT_STATUSES, URGENCY_LEVELS } from './legal.types'

// ── Crear documento (inicia el proceso del ciudadano) ─────────────────────────

export const CreateLegalDocumentSchema = z.object({
  situation_description: z
    .string()
    .min(30, 'Describe la situación con al menos 30 caracteres')
    .max(8000),
  evidence_description: z.string().max(2000).optional(),
  location: z.string().max(300).optional(),
  evidence_urls: z.array(z.string().url()).max(10).default([]),
  category: z.string().max(100).default('general'),
})

// ── Actualizar borrador (el ciudadano edita el documento generado) ─────────────

export const UpdateLegalDocumentSchema = z.object({
  document_draft: z.string().min(50).max(50_000).optional(),
  status: z.enum(LEGAL_DOCUMENT_STATUSES).optional(),
  entity_response: z.string().max(10_000).optional(),
})

// ── Marcar como enviado ────────────────────────────────────────────────────────

export const SubmitLegalDocumentSchema = z.object({
  submitted_via: z.enum(['email', 'portal', 'manual']),
  notes: z.string().max(1000).optional(),
})

// ── Listar documentos del ciudadano ───────────────────────────────────────────

export const ListLegalDocumentsSchema = z.object({
  status: z.enum(LEGAL_DOCUMENT_STATUSES).optional(),
  legal_type: z.enum(LEGAL_TYPES).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

// ── Types inferidos ────────────────────────────────────────────────────────────

export type CreateLegalDocumentInput  = z.infer<typeof CreateLegalDocumentSchema>
export type UpdateLegalDocumentInput  = z.infer<typeof UpdateLegalDocumentSchema>
export type SubmitLegalDocumentInput  = z.infer<typeof SubmitLegalDocumentSchema>
export type ListLegalDocumentsInput   = z.infer<typeof ListLegalDocumentsSchema>
