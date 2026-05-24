// ── Ciudadano ─────────────────────────────────────────────────────────────────

export type VerificationLevel = 0 | 1 | 2

export type VerificationLevelName =
  | 'registrado'
  | 'cedula_confirmada'
  | 'identidad_completa'

export interface CitizenProfile {
  id: string
  did: string
  email: string | null
  displayName: string | null
  neighborhood: string | null
  localityId: number | null
  verificationLevel: VerificationLevel
  reputationScore: number
  participationCount: number
  isActive: boolean
  createdAt: string
  lastActiveAt: string | null
}

// ── Identidad DID ─────────────────────────────────────────────────────────────

export interface VerificationMethod {
  id: string
  type: string
  controller: string
  publicKeyMultibase: string
}

export interface ServiceEndpoint {
  id: string
  type: string
  serviceEndpoint: string
}

export interface DIDDocument {
  '@context': string[]
  id: string
  controller: string
  verificationMethod: VerificationMethod[]
  authentication: string[]
  service: ServiceEndpoint[]
  created: string
  updated: string
  verificationLevel: VerificationLevel
}

export interface VerificationStatus {
  citizen_id: string
  did: string
  level: VerificationLevel
  level_name: VerificationLevelName
  can_vote: boolean
  can_propose: boolean
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface AuthTokens {
  access_token: string
  refresh_token: string
  expires_in: number
}

export interface JWTPayload {
  sub: string
  did: string
  level: VerificationLevel
  iat: number
  exp: number
}

// ── Localidad ─────────────────────────────────────────────────────────────────

export type LocalityCode = 'CTG-01' | 'CTG-02' | 'CTG-03' | 'CTG-04'

export interface Locality {
  id: number
  name: string
  code: LocalityCode
  populationEstimate: number | null
  areaKm2: number | null
}

// ── Reportes territoriales ────────────────────────────────────────────────────

export type ReportCategory =
  | 'infraestructura'
  | 'seguridad'
  | 'ambiente'
  | 'servicios_publicos'
  | 'espacio_publico'
  | 'movilidad'
  | 'salud'
  | 'educacion'
  | 'otro'

export type ReportStatus = 'open' | 'in_review' | 'resolved' | 'rejected'

export interface TerritorialReport {
  id: string
  citizenId: string | null
  category: ReportCategory
  subcategory: string | null
  title: string
  description: string
  neighborhood: string | null
  localityId: number | null
  addressReference: string | null
  urgencyScore: number | null
  sentimentScore: number | null
  status: ReportStatus
  mediaUrls: string[]
  ipfsHash: string | null
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
}

// ── Propuestas ────────────────────────────────────────────────────────────────

export type ProposalStatus =
  | 'idea'
  | 'draft'
  | 'debate'
  | 'voting'
  | 'approved'
  | 'rejected'
  | 'implemented'

export type ProposalScope =
  | 'neighborhood'
  | 'locality'
  | 'city'
  | 'regional'
  | 'national'

export interface Proposal {
  id: string
  authorId: string | null
  title: string
  description: string
  executiveSummary: string | null
  category: string
  scope: ProposalScope
  status: ProposalStatus
  endorsementCount: number
  commentCount: number
  viewCount: number
  quorumRequired: number | null
  approvalThreshold: number | null
  eligibleVoters: number | null
  totalVotes: number
  approveVotesWeighted: number
  rejectVotesWeighted: number
  abstainVotesWeighted: number
  votingStartsAt: string | null
  votingEndsAt: string | null
  decidedAt: string | null
  blockchainTxHash: string | null
  ipfsProposalUri: string | null
  createdAt: string
}

export type VoteValue = 1 | 0 | -1

// ── Reputación ────────────────────────────────────────────────────────────────

export type ReputationLevel =
  | 'observador'
  | 'participante'
  | 'activista'
  | 'lider'
  | 'embajador'

export interface ReputationProfile {
  citizen_id: string
  reputation_score: number
  level: ReputationLevel
  event_counts: Record<string, number>
  badges_count: number
  total_votes: number
  total_proposals: number
  total_reports: number
  last_activity_at: string | null
  calculated_at: string
}

// ── Documentos legales ────────────────────────────────────────────────────────

export type LegalDocumentType =
  | 'derecho_peticion'
  | 'tutela'
  | 'accion_popular'
  | 'accion_cumplimiento'
  | 'denuncia_penal'
  | 'queja'

export type LegalDocumentStatus =
  | 'draft'
  | 'ready'
  | 'submitted'
  | 'responded'
  | 'closed'

export type LegalUrgency = 'alta' | 'media' | 'baja'

export interface TargetEntity {
  name: string
  type: string
  address?: string
  email?: string
  phone?: string
}

export interface LegalDocument {
  id: string
  citizenId: string
  legalType: LegalDocumentType
  status: LegalDocumentStatus
  urgency: LegalUrgency
  situationDescription: string
  evidenceDescription: string | null
  location: string | null
  evidenceUrls: string[]
  rightsAffected: string[]
  targetEntity: TargetEntity | null
  responseDeadlineDays: number
  legalBasis: string[]
  alternativeRemedies: string[]
  nextSteps: string[]
  legalOrientation: string
  documentDraft: string
  submittedAt: string | null
  submittedVia: string | null
  entityResponse: string | null
  entityRespondedAt: string | null
  responseDeadlineAt: string | null
  createdAt: string
  updatedAt: string
}

// ── AI Service ────────────────────────────────────────────────────────────────

export interface CivicQueryRequest {
  query: string
  session_id?: string
  citizen_id?: string
  locality?: string
}

export interface CivicQueryResponse {
  response: string
  intent: string
  session_id: string
  sources?: string[]
  actions?: string[]
}

// ── Paginación ────────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  has_more: boolean
}

// ── Errores de API ────────────────────────────────────────────────────────────

export interface ApiError {
  error: string
  code: string
  details?: Record<string, string[]>
}
