import { config } from '../../config'
import { getAIServiceSecret } from '../../lib/feature-secrets'

// ── Generic HTTP bridge to the Python AI service ──────────────────────────────

async function callAI<TReq, TRes>(path: string, body: TReq): Promise<TRes> {
  const url = `${config.AI_SERVICE_URL}${path}`
  const serviceSecret = getAIServiceSecret()

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(serviceSecret ? { 'X-Service-Key': serviceSecret } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw Object.assign(
      new Error(`AI service error ${res.status}: ${text.slice(0, 200)}`),
      { statusCode: 502, code: 'AI_SERVICE_ERROR' },
    )
  }

  return res.json() as Promise<TRes>
}

// ── Types matching the Python models ──────────────────────────────────────────

export interface CivicQueryRequest {
  message: string
  citizen_id?: string
  locality?: string
  neighborhood?: string
  topic?: string
  conversation_history?: Array<{ role: 'user' | 'assistant'; content: string }>
}

export interface CivicQueryResponse {
  response: string
  intent: string
  agent_used: string
  confidence: number
  audit_id: string
}

export interface TerritorialAnalysisRequest {
  reports: Array<{
    id: string
    category: string
    title: string
    description?: string
    urgency_score: number
    status: string
    neighborhood?: string
  }>
  locality?: string
  neighborhood?: string
  citizen_id?: string
}

export interface TerritorialAnalysisResponse {
  analysis: string
  urgency_level: string
  report_count: number
  audit_id: string
}

export interface DebateSynthesisRequest {
  proposal_title: string
  proposal_description: string
  category: string
  scope: string
  comments?: string[]
}

export interface DebateSynthesisResponse {
  synthesis: string
  comment_count: number
  audit_id: string
}

export interface PolicyDraftRequest {
  citizen_demand: string
  category: string
  scope: string
  territory?: string
  citizen_id?: string
}

export interface PolicyDraftResponse {
  draft: string
  audit_id: string
}

export interface LegalAnalysisRequest {
  description: string
  evidence_description?: string
  location?: string
  citizen_name?: string
  category?: string
  citizen_id?: string
}

export interface LegalAnalysisResponse {
  legal_type: string
  urgency: string
  rights_affected: string[]
  target_entity: {
    name: string
    type: string
    address: string
    email: string
    phone: string
    contact_person: string
  }
  response_deadline_days: number
  document_draft: string
  legal_orientation: string
  alternative_remedies: string[]
  legal_basis: string[]
  next_steps: string[]
  audit_id: string
}

// ── Public service functions ──────────────────────────────────────────────────

export function civicQuery(
  body: CivicQueryRequest,
): Promise<CivicQueryResponse> {
  return callAI('/civic/query', body)
}

export function analyzeTerritorial(
  body: TerritorialAnalysisRequest,
): Promise<TerritorialAnalysisResponse> {
  return callAI('/territorial/analyze', body)
}

export function synthesizeDebate(
  body: DebateSynthesisRequest,
): Promise<DebateSynthesisResponse> {
  return callAI('/governance/synthesize', body)
}

export function draftPolicy(
  body: PolicyDraftRequest,
): Promise<PolicyDraftResponse> {
  return callAI('/governance/draft-policy', body)
}

export function analyzeLegal(
  body: LegalAnalysisRequest,
): Promise<LegalAnalysisResponse> {
  return callAI('/legal/analyze', body)
}