// ── Evento que genera puntos de reputación ────────────────────────────────────

export const REPUTATION_EVENTS = [
  'vote_cast',
  'proposal_created',
  'proposal_approved',
  'proposal_rejected',
  'report_submitted',
  'report_resolved',
  'endorsement_given',
  'badge_earned',
  'delegation_given',
  'delegation_received',
] as const

export type ReputationEvent = typeof REPUTATION_EVENTS[number]

// Puntos base por evento (pueden ser negativos para penalizaciones)
export const EVENT_POINTS: Record<ReputationEvent, number> = {
  vote_cast:           5,
  proposal_created:   10,
  proposal_approved:  30,
  proposal_rejected:  -5,
  report_submitted:    8,
  report_resolved:    15,
  endorsement_given:   2,
  badge_earned:       20,
  delegation_given:    5,
  delegation_received: 3,
}

// ── Estructura del perfil de reputación ──────────────────────────────────────

export interface ReputationProfile {
  citizen_id:       string
  reputation_score: number       // 0–100+, sin techo duro
  level:            ReputationLevel
  event_counts:     Partial<Record<ReputationEvent, number>>
  badges_count:     number
  total_votes:      number
  total_proposals:  number
  total_reports:    number
  last_activity_at: string | null
  calculated_at:    string
}

export type ReputationLevel =
  | 'observador'   // 0–19
  | 'participante' // 20–49
  | 'activista'    // 50–99
  | 'lider'        // 100–199
  | 'embajador'    // 200+

export function scoreToLevel(score: number): ReputationLevel {
  if (score >= 200) return 'embajador'
  if (score >= 100) return 'lider'
  if (score >= 50)  return 'activista'
  if (score >= 20)  return 'participante'
  return 'observador'
}

// ── Historial de eventos de reputación ───────────────────────────────────────

export interface ReputationEventRecord {
  citizen_id:   string
  event_type:   ReputationEvent
  points:       number
  reference_id: string | null   // ID del objeto relacionado (proposalId, reportId, etc.)
  created_at:   string
}

// ── Relaciones del grafo (Neo4j) ──────────────────────────────────────────────

export interface CitizenGraph {
  citizen_id:        string
  delegates_to:      string[]   // citizen_ids
  delegated_from:    string[]   // citizen_ids
  voted_on:          string[]   // proposal_ids
  created_proposals: string[]   // proposal_ids
  submitted_reports: string[]   // report_ids
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  citizen_id:       string
  reputation_score: number
  level:            ReputationLevel
  rank:             number
}

// ── Raw rows de Neo4j ─────────────────────────────────────────────────────────

export interface Neo4jEventCount {
  event_type: string
  count:      number | { low: number; high: number }  // neo4j Integer
}

export interface Neo4jScoreRow {
  citizen_id:       string
  reputation_score: number | { low: number; high: number }
}
