import type { CivicActionStatus } from './civic-actions.schema'

export const CIVIC_REPUTATION_VERSION = 'civic-reputation-v1'

export const CIVIC_SCORE_MAX = {
  evidence: 25,
  results: 20,
  impact: 15,
  fulfillment: 15,
  validation: 10,
  continuity: 5,
  transparency: 5,
  collaboration: 5,
} as const

export type CivicScoreDimension = keyof typeof CIVIC_SCORE_MAX
export type CivicConfidenceLevel = 'low' | 'medium' | 'high'
export type CivicEvidenceLevel = 0 | 1 | 2 | 3 | 4

export type CivicScoreDimensions = Record<CivicScoreDimension, number>

export interface CivicActionScoringInput {
  status: CivicActionStatus
  evidence_count: number
  external_evidence_count: number
  hashed_evidence_count: number
  corroborations: number
  disputes: number
  collaborators_count: number
  beneficiaries_estimate: number | null
  problem: string
  objective: string
  result_summary: string | null
  neighborhood: string | null
  target_date: string | null
  created_at: string
}

export interface CivicScoreExplanation {
  dimension: CivicScoreDimension
  label: string
  points: number
  max_points: number
}

export interface CivicScoreResult {
  score_version: typeof CIVIC_REPUTATION_VERSION
  civic_score: number
  score_dimensions: CivicScoreDimensions
  score_explanation: CivicScoreExplanation[]
  confidence_score: number
  confidence_level: CivicConfidenceLevel
  evidence_level: CivicEvidenceLevel
}

const LABELS: Record<CivicScoreDimension, string> = {
  evidence: 'Evidencia',
  results: 'Resultados',
  impact: 'Impacto comunitario',
  fulfillment: 'Cumplimiento',
  validation: 'Validación ciudadana',
  continuity: 'Continuidad',
  transparency: 'Transparencia',
  collaboration: 'Colaboración',
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function resultPoints(status: CivicActionStatus): number {
  switch (status) {
    case 'verified': return 20
    case 'under_verification': return 16
    case 'result_declared': return 13
    case 'in_progress': return 7
    case 'preparing': return 4
    case 'proposed': return 2
    case 'disputed': return 7
    case 'no_evidence': return 4
    case 'not_completed': return 2
    case 'cancelled': return 0
  }
}

function fulfillmentPoints(status: CivicActionStatus, targetDate: string | null): number {
  if (status === 'verified') return 15
  if (status === 'under_verification' || status === 'result_declared') return 11
  if (status === 'not_completed' || status === 'no_evidence' || status === 'cancelled') return 0
  if (status === 'disputed') return 4

  if (targetDate) {
    const deadline = new Date(`${targetDate}T23:59:59.999Z`).getTime()
    if (Number.isFinite(deadline) && deadline < Date.now()) return status === 'in_progress' ? 3 : 1
  }
  return status === 'in_progress' ? 6 : status === 'preparing' ? 4 : 2
}

function impactPoints(beneficiaries: number | null): number {
  if (beneficiaries == null) return 2
  if (beneficiaries >= 500) return 15
  if (beneficiaries >= 200) return 13
  if (beneficiaries >= 50) return 11
  if (beneficiaries >= 10) return 8
  if (beneficiaries >= 1) return 5
  return 2
}

function validationPoints(corroborations: number, disputes: number): number {
  const total = corroborations + disputes
  if (total <= 0) return 0

  // Unique verified citizens can contribute at most ten points. Disputes reduce
  // the signal rather than becoming negative reputation by themselves.
  const rawPositive = Math.min(10, corroborations * 2)
  const disputeRatio = disputes / total
  return clamp(Math.round(rawPositive * (1 - disputeRatio)), 0, 10)
}

function continuityPoints(status: CivicActionStatus, createdAt: string): number {
  if (status === 'verified') return 5
  if (status === 'cancelled') return 0

  const ageDays = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000))
  if (ageDays >= 30) return 5
  if (ageDays >= 14) return 4
  if (ageDays >= 7) return 3
  return status === 'in_progress' || status === 'result_declared' || status === 'under_verification' ? 2 : 1
}

function evidencePoints(input: CivicActionScoringInput): number {
  const submitted = Math.min(20, input.evidence_count * 6)
  const externallyReferenced = Math.min(5, input.external_evidence_count * 3)
  return clamp(submitted + externallyReferenced, 0, 25)
}

function transparencyPoints(input: CivicActionScoringInput): number {
  let points = 0
  if (input.problem.trim().length >= 80) points += 1
  if (input.objective.trim().length >= 50) points += 1
  if (input.neighborhood) points += 1
  if (input.target_date) points += 1
  if (input.result_summary?.trim().length && input.result_summary.trim().length >= 40) points += 1
  return clamp(points, 0, 5)
}

function confidenceScore(input: CivicActionScoringInput): number {
  const evidenceSignal = Math.min(
    40,
    input.evidence_count * 9 + input.external_evidence_count * 6 + input.hashed_evidence_count * 3,
  )
  const reviewSignal = input.status === 'verified'
    ? 25
    : input.status === 'under_verification'
      ? 15
      : input.status === 'result_declared'
        ? 6
        : 0
  const totalValidation = input.corroborations + input.disputes
  const netRatio = totalValidation > 0
    ? Math.max(0, (input.corroborations - input.disputes) / totalValidation)
    : 0
  const validationSignal = Math.min(20, totalValidation * 4) * netRatio
  const traceabilitySignal = Math.min(15, input.hashed_evidence_count * 5)
  const disputePenalty = Math.min(30, input.disputes * 6)
  return clamp(Math.round(evidenceSignal + reviewSignal + validationSignal + traceabilitySignal - disputePenalty), 0, 100)
}

function evidenceLevel(input: CivicActionScoringInput, confidence: number): CivicEvidenceLevel {
  if (input.evidence_count <= 0) return 0

  let level: CivicEvidenceLevel = 1
  if (input.corroborations >= 2 && input.corroborations > input.disputes) level = 2
  if (
    input.external_evidence_count > 0
    && ['under_verification', 'verified'].includes(input.status)
  ) level = 3
  if (input.status === 'verified' && confidence >= 85) level = 4
  return level
}

export function scoreCivicAction(input: CivicActionScoringInput): CivicScoreResult {
  const dimensions: CivicScoreDimensions = {
    evidence: evidencePoints(input),
    results: resultPoints(input.status),
    impact: impactPoints(input.beneficiaries_estimate),
    fulfillment: fulfillmentPoints(input.status, input.target_date),
    validation: validationPoints(input.corroborations, input.disputes),
    continuity: continuityPoints(input.status, input.created_at),
    transparency: transparencyPoints(input),
    collaboration: clamp(input.collaborators_count, 0, 5),
  }

  const civicScore = clamp(
    Object.values(dimensions).reduce((sum, value) => sum + value, 0),
    0,
    100,
  )
  const confidence = confidenceScore(input)
  const confidenceLevel: CivicConfidenceLevel = confidence >= 70 ? 'high' : confidence >= 35 ? 'medium' : 'low'

  return {
    score_version: CIVIC_REPUTATION_VERSION,
    civic_score: civicScore,
    score_dimensions: dimensions,
    score_explanation: (Object.keys(dimensions) as CivicScoreDimension[]).map((dimension) => ({
      dimension,
      label: LABELS[dimension],
      points: dimensions[dimension],
      max_points: CIVIC_SCORE_MAX[dimension],
    })),
    confidence_score: confidence,
    confidence_level: confidenceLevel,
    evidence_level: evidenceLevel(input, confidence),
  }
}
