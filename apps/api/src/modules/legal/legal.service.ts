import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { getCache, setCache, delCache, TTL } from '../../lib/cache'
import { config } from '../../config'
import {
  LegalDocument,
  LegalDocumentSummary,
  LegalDocumentRow,
  LegalType,
  LegalDocumentStatus,
  UrgencyLevel,
  TargetEntity,
} from './legal.types'
import type {
  CreateLegalDocumentInput,
  UpdateLegalDocumentInput,
  SubmitLegalDocumentInput,
  ListLegalDocumentsInput,
} from './legal.schema'

// ── Cache ─────────────────────────────────────────────────────────────────────

const NS = {
  doc:  'legal:doc',
  list: 'legal:list',
} as const

const DOC_TTL  = TTL.REPORT   // 120 s
const LIST_TTL = TTL.SESSION  // 60 s

// ── Normalización ─────────────────────────────────────────────────────────────

function safeParseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try { return JSON.parse(raw) as T } catch { return fallback }
}

function normalizeDoc(row: LegalDocumentRow): LegalDocument {
  const targetRaw = safeParseJson<TargetEntity | null>(row.target_entity, null)
  return {
    id:                     row.id,
    citizen_id:             row.citizen_id,
    legal_type:             row.legal_type as LegalType,
    status:                 row.status as LegalDocumentStatus,
    urgency:                row.urgency as UrgencyLevel,
    situation_description:  row.situation_description,
    evidence_description:   row.evidence_description,
    location:               row.location,
    evidence_urls:          safeParseJson<string[]>(row.evidence_urls, []),
    rights_affected:        safeParseJson<string[]>(row.rights_affected, []),
    target_entity:          targetRaw ?? {
      name: 'Alcaldía Distrital de Cartagena',
      type: 'distrital',
      address: 'Calle 36 No. 6-60, Centro Histórico',
      email: 'alcaldia@cartagena.gov.co',
      phone: '(605) 650-5000',
      contact_person: 'Secretario(a) General',
    },
    response_deadline_days: Number(row.response_deadline_days),
    legal_basis:            safeParseJson<string[]>(row.legal_basis, []),
    alternative_remedies:   safeParseJson<string[]>(row.alternative_remedies, []),
    next_steps:             safeParseJson<string[]>(row.next_steps, []),
    legal_orientation:      row.legal_orientation,
    ai_audit_id:            row.ai_audit_id,
    document_draft:         row.document_draft,
    submitted_at:           row.submitted_at?.toISOString() ?? null,
    submitted_via:          (row.submitted_via as LegalDocument['submitted_via']) ?? null,
    entity_response:        row.entity_response,
    entity_responded_at:    row.entity_responded_at?.toISOString() ?? null,
    response_deadline_at:   row.response_deadline_at?.toISOString() ?? null,
    created_at:             row.created_at.toISOString(),
    updated_at:             row.updated_at.toISOString(),
  }
}

// ── AI service call ───────────────────────────────────────────────────────────

interface AILegalResponse {
  legal_type:             string
  urgency:                string
  rights_affected:        string[]
  target_entity:          TargetEntity
  response_deadline_days: number
  document_draft:         string
  legal_orientation:      string
  alternative_remedies:   string[]
  legal_basis:            string[]
  next_steps:             string[]
  audit_id:               string
}

async function callLegalAI(input: CreateLegalDocumentInput): Promise<AILegalResponse> {
  const aiUrl = config.AI_SERVICE_URL
  if (!aiUrl) throw new Error('AI_SERVICE_URL no configurado')

  const res = await fetch(`${aiUrl}/legal/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Service-Key': config.AI_SERVICE_SECRET ?? '',
    },
    body: JSON.stringify({
      description:          input.situation_description,
      evidence_description: input.evidence_description,
      location:             input.location,
      category:             input.category,
    }),
    signal: AbortSignal.timeout(45_000),
  })

  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`AI service error ${res.status}: ${txt.slice(0, 200)}`)
  }

  return res.json() as Promise<AILegalResponse>
}

// ── Servicio público ──────────────────────────────────────────────────────────

export async function createLegalDocument(
  citizenId: string,
  input: CreateLegalDocumentInput
): Promise<LegalDocument> {
  // Llama al servicio IA para análisis
  const ai = await callLegalAI(input)

  // Calcula la fecha límite de respuesta
  const deadlineDays = ai.response_deadline_days || 15
  const responseDeadlineAt = new Date()
  responseDeadlineAt.setDate(responseDeadlineAt.getDate() + deadlineDays)

  const rows = await prisma.$queryRaw<LegalDocumentRow[]>(
    Prisma.sql`
      INSERT INTO legal_documents (
        citizen_id, legal_type, status, urgency,
        situation_description, evidence_description, location, evidence_urls,
        rights_affected, target_entity, response_deadline_days, legal_basis,
        alternative_remedies, next_steps, legal_orientation, ai_audit_id,
        document_draft, response_deadline_at
      ) VALUES (
        ${citizenId}::uuid,
        ${ai.legal_type},
        'draft',
        ${ai.urgency},
        ${input.situation_description},
        ${input.evidence_description ?? null},
        ${input.location ?? null},
        ${JSON.stringify(input.evidence_urls)}::jsonb,
        ${JSON.stringify(ai.rights_affected)}::jsonb,
        ${JSON.stringify(ai.target_entity)}::jsonb,
        ${deadlineDays},
        ${JSON.stringify(ai.legal_basis)}::jsonb,
        ${JSON.stringify(ai.alternative_remedies)}::jsonb,
        ${JSON.stringify(ai.next_steps)}::jsonb,
        ${ai.legal_orientation},
        ${ai.audit_id},
        ${ai.document_draft},
        ${responseDeadlineAt}
      )
      RETURNING *
    `
  )

  await delCache(NS.list, citizenId)
  return normalizeDoc(rows[0]!)
}

export async function getLegalDocument(
  documentId: string,
  citizenId: string
): Promise<LegalDocument | null> {
  const cached = await getCache<LegalDocument>(NS.doc, documentId)
  if (cached && cached.citizen_id === citizenId) return cached

  const rows = await prisma.$queryRaw<LegalDocumentRow[]>(
    Prisma.sql`
      SELECT * FROM legal_documents
      WHERE id = ${documentId}::uuid
        AND citizen_id = ${citizenId}::uuid
    `
  )
  if (!rows.length) return null

  const doc = normalizeDoc(rows[0]!)
  await setCache(NS.doc, documentId, doc, DOC_TTL)
  return doc
}

export async function listLegalDocuments(
  citizenId: string,
  input: ListLegalDocumentsInput
): Promise<LegalDocumentSummary[]> {
  const cacheKey = `${citizenId}:${input.status ?? 'all'}:${input.legal_type ?? 'all'}:${input.offset}`
  const cached = await getCache<LegalDocumentSummary[]>(NS.list, cacheKey)
  if (cached) return cached

  const conditions: Prisma.Sql[] = [Prisma.sql`citizen_id = ${citizenId}::uuid`]
  if (input.status)     conditions.push(Prisma.sql`status = ${input.status}`)
  if (input.legal_type) conditions.push(Prisma.sql`legal_type = ${input.legal_type}`)

  const where = Prisma.join(conditions, ' AND ')
  const rows = await prisma.$queryRaw<{
    id: string; legal_type: string; status: string; urgency: string
    target_entity: string | null; location: string | null
    created_at: Date; submitted_at: Date | null
  }[]>(
    Prisma.sql`
      SELECT id, legal_type, status, urgency, target_entity, location, created_at, submitted_at
      FROM legal_documents
      WHERE ${where}
      ORDER BY created_at DESC
      LIMIT ${input.limit}
      OFFSET ${input.offset}
    `
  )

  const summaries: LegalDocumentSummary[] = rows.map((r) => {
    const te = safeParseJson<TargetEntity | null>(r.target_entity, null)
    return {
      id:           r.id,
      legal_type:   r.legal_type as LegalType,
      status:       r.status as LegalDocumentStatus,
      urgency:      r.urgency as UrgencyLevel,
      target_name:  te?.name ?? 'Entidad por determinar',
      location:     r.location,
      created_at:   r.created_at.toISOString(),
      submitted_at: r.submitted_at?.toISOString() ?? null,
    }
  })

  await setCache(NS.list, cacheKey, summaries, LIST_TTL)
  return summaries
}

export async function updateLegalDocument(
  documentId: string,
  citizenId: string,
  input: UpdateLegalDocumentInput
): Promise<LegalDocument | null> {
  const sets: Prisma.Sql[] = [Prisma.sql`updated_at = NOW()`]
  if (input.document_draft !== undefined) sets.push(Prisma.sql`document_draft = ${input.document_draft}`)
  if (input.status !== undefined)         sets.push(Prisma.sql`status = ${input.status}`)
  if (input.entity_response !== undefined) {
    sets.push(Prisma.sql`entity_response = ${input.entity_response}`)
    sets.push(Prisma.sql`entity_responded_at = NOW()`)
    sets.push(Prisma.sql`status = 'responded'`)
  }

  const rows = await prisma.$queryRaw<LegalDocumentRow[]>(
    Prisma.sql`
      UPDATE legal_documents
      SET ${Prisma.join(sets, ', ')}
      WHERE id = ${documentId}::uuid
        AND citizen_id = ${citizenId}::uuid
      RETURNING *
    `
  )
  if (!rows.length) return null

  const doc = normalizeDoc(rows[0]!)
  await setCache(NS.doc, documentId, doc, DOC_TTL)
  await delCache(NS.list, citizenId)
  return doc
}

export async function submitLegalDocument(
  documentId: string,
  citizenId: string,
  input: SubmitLegalDocumentInput
): Promise<LegalDocument | null> {
  const rows = await prisma.$queryRaw<LegalDocumentRow[]>(
    Prisma.sql`
      UPDATE legal_documents
      SET
        status = 'submitted',
        submitted_at = NOW(),
        submitted_via = ${input.submitted_via},
        updated_at = NOW()
      WHERE id = ${documentId}::uuid
        AND citizen_id = ${citizenId}::uuid
        AND status IN ('draft', 'ready')
      RETURNING *
    `
  )
  if (!rows.length) return null

  const doc = normalizeDoc(rows[0]!)
  await setCache(NS.doc, documentId, doc, DOC_TTL)
  await delCache(NS.list, citizenId)
  return doc
}

export async function deleteLegalDocument(
  documentId: string,
  citizenId: string
): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ id: string }[]>(
    Prisma.sql`
      DELETE FROM legal_documents
      WHERE id = ${documentId}::uuid
        AND citizen_id = ${citizenId}::uuid
        AND status = 'draft'
      RETURNING id
    `
  )
  if (!rows.length) return false

  await delCache(NS.doc, documentId)
  await delCache(NS.list, citizenId)
  return true
}
