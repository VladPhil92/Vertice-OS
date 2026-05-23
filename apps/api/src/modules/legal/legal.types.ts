// ── Tipos de instrumento jurídico ─────────────────────────────────────────────

export const LEGAL_TYPES = [
  'derecho_de_peticion',
  'tutela',
  'accion_popular',
  'accion_de_cumplimiento',
  'denuncia_penal',
  'queja',
] as const

export type LegalType = typeof LEGAL_TYPES[number]

// ── Estados del documento ─────────────────────────────────────────────────────

export const LEGAL_DOCUMENT_STATUSES = [
  'draft',       // Borrador generado, pendiente de revisión del ciudadano
  'ready',       // Revisado y listo para enviar
  'submitted',   // Enviado a la entidad
  'responded',   // La entidad respondió
  'escalated',   // Se escaló a otro instrumento (ej. tutela tras petición sin respuesta)
  'closed',      // Caso cerrado
] as const

export type LegalDocumentStatus = typeof LEGAL_DOCUMENT_STATUSES[number]

// ── Urgencia ──────────────────────────────────────────────────────────────────

export const URGENCY_LEVELS = ['baja', 'media', 'alta', 'critica'] as const
export type UrgencyLevel = typeof URGENCY_LEVELS[number]

// ── Entidad destino ───────────────────────────────────────────────────────────

export interface TargetEntity {
  name:           string
  type:           'distrital' | 'departamental' | 'nacional' | 'privada'
  address:        string
  email:          string
  phone:          string
  contact_person: string
}

// ── Documento legal completo ──────────────────────────────────────────────────

export interface LegalDocument {
  id:                     string
  citizen_id:             string
  legal_type:             LegalType
  status:                 LegalDocumentStatus
  urgency:                UrgencyLevel

  // Reporte del ciudadano
  situation_description:  string
  evidence_description:   string | null
  location:               string | null
  evidence_urls:          string[]

  // Análisis IA
  rights_affected:        string[]
  target_entity:          TargetEntity
  response_deadline_days: number
  legal_basis:            string[]
  alternative_remedies:   string[]
  next_steps:             string[]
  legal_orientation:      string
  ai_audit_id:            string | null

  // Documento generado (editable por el ciudadano)
  document_draft:         string

  // Remisión
  submitted_at:           string | null
  submitted_via:          'email' | 'portal' | 'manual' | null
  entity_response:        string | null
  entity_responded_at:    string | null
  response_deadline_at:   string | null

  created_at:             string
  updated_at:             string
}

export interface LegalDocumentSummary {
  id:          string
  legal_type:  LegalType
  status:      LegalDocumentStatus
  urgency:     UrgencyLevel
  target_name: string
  location:    string | null
  created_at:  string
  submitted_at: string | null
}

// ── Raw rows de PostgreSQL ────────────────────────────────────────────────────

export interface LegalDocumentRow {
  id:                     string
  citizen_id:             string
  legal_type:             string
  status:                 string
  urgency:                string
  situation_description:  string
  evidence_description:   string | null
  location:               string | null
  evidence_urls:          string | null  // JSON array
  rights_affected:        string | null  // JSON array
  target_entity:          string | null  // JSON object
  response_deadline_days: bigint
  legal_basis:            string | null  // JSON array
  alternative_remedies:   string | null  // JSON array
  next_steps:             string | null  // JSON array
  legal_orientation:      string
  ai_audit_id:            string | null
  document_draft:         string
  submitted_at:           Date | null
  submitted_via:          string | null
  entity_response:        string | null
  entity_responded_at:    Date | null
  response_deadline_at:   Date | null
  created_at:             Date
  updated_at:             Date
}
