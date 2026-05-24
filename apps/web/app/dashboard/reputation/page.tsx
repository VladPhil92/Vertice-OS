'use client'

import { useEffect, useState } from 'react'
import { Star, CheckSquare, FileText, Map, Award, TrendingUp } from 'lucide-react'
import { apiFetch } from '@/lib/api'

// ─── Types ──────────────────────────────────────────────────────────────────

type ReputationLevel = 'observador' | 'participante' | 'activista' | 'lider' | 'embajador'

interface ReputationProfile {
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

// ─── Constants ───────────────────────────────────────────────────────────────

const LEVEL_CONFIG: Record<
  ReputationLevel,
  { label: string; description: string; colorClass: string; glowStyle?: React.CSSProperties }
> = {
  observador: {
    label: 'OBSERVADOR',
    description: 'Bienvenido a VÉRTICE OS',
    colorClass: 'text-tertiary',
  },
  participante: {
    label: 'PARTICIPANTE',
    description: 'Ciudadano activo',
    colorClass: 'text-secondary',
  },
  activista: {
    label: 'ACTIVISTA',
    description: 'Voz influyente en tu comunidad',
    colorClass: 'text-cyan',
  },
  lider: {
    label: 'LÍDER',
    description: 'Referente en tu localidad',
    colorClass: 'text-gold',
  },
  embajador: {
    label: 'EMBAJADOR',
    description: 'Pilar de la democracia en Cartagena',
    colorClass: 'text-gold',
    glowStyle: { textShadow: '0 0 24px rgba(200,168,75,0.55)' },
  },
}

const EVENT_LABELS: Record<string, string> = {
  vote_cast:            'Votos emitidos',
  proposal_created:     'Propuestas creadas',
  proposal_approved:    'Propuestas aprobadas',
  report_submitted:     'Reportes enviados',
  report_resolved:      'Reportes resueltos',
  endorsement_given:    'Avales dados',
  badge_earned:         'Insignias ganadas',
  delegation_given:     'Delegaciones dadas',
  delegation_received:  'Delegaciones recibidas',
}

const EVENT_POINTS: Record<string, number> = {
  vote_cast:           5,
  proposal_created:    10,
  proposal_approved:   30,
  proposal_rejected:   -5,
  report_submitted:    8,
  report_resolved:     15,
  endorsement_given:   2,
  badge_earned:        20,
  delegation_given:    5,
  delegation_received: 3,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string | null) {
  if (!iso) return 'Sin actividad'
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ReputationPage() {
  const [profile, setProfile] = useState<ReputationProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch<ReputationProfile>('/reputation/me')
        setProfile(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const levelCfg = profile ? LEVEL_CONFIG[profile.level] : null

  const activeEvents = profile
    ? Object.entries(profile.event_counts).filter(([, count]) => count > 0)
    : []

  return (
    <div>
      <main className="mx-auto max-w-5xl px-6 py-10">
        {/* ── Page header ────────────────────────────────────────────────── */}
        <div className="mb-10">
          <span className="section-tag">Módulo de Reputación</span>
          <h1 className="font-display text-3xl font-700 text-primary">
            Tu reputación cívica
          </h1>
          <p className="mt-2 font-mono text-sm text-secondary">
            Cada acción que tomas en VÉRTICE OS construye tu credencial democrática.
          </p>
        </div>

        {/* ── Loading ────────────────────────────────────────────────────── */}
        {loading && (
          <div className="flex items-center justify-center py-32">
            <div className="animate-spin rounded-full h-8 w-8 border-t border-gold" />
          </div>
        )}

        {/* ── Error ─────────────────────────────────────────────────────── */}
        {error && (
          <div className="rounded border border-red-500/30 bg-red-500/10 p-4 font-mono text-sm text-red-400">
            {error}
          </div>
        )}

        {/* ── Content ────────────────────────────────────────────────────── */}
        {profile && levelCfg && (
          <div className="space-y-8">

            {/* Score card */}
            <div className="relative flex flex-col items-center justify-center gap-4 border border-border bg-surface py-14 px-8 text-center overflow-hidden">
              {/* decorative corner lines */}
              <span className="absolute top-0 left-0 w-6 h-6 border-t border-l border-gold/40" />
              <span className="absolute top-0 right-0 w-6 h-6 border-t border-r border-gold/40" />
              <span className="absolute bottom-0 left-0 w-6 h-6 border-b border-l border-gold/40" />
              <span className="absolute bottom-0 right-0 w-6 h-6 border-b border-r border-gold/40" />

              {/* Star icon */}
              <Star
                size={20}
                strokeWidth={1.5}
                className="text-gold opacity-60"
              />

              {/* Score number */}
              <div
                className="font-display text-7xl font-700 text-gold leading-none"
                style={{ letterSpacing: '-0.03em' }}
              >
                {profile.reputation_score.toLocaleString('es-CO')}
              </div>
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-tertiary">
                puntos de reputación
              </p>

              {/* Level badge */}
              <div className="flex flex-col items-center gap-1.5">
                <span
                  className={`font-mono text-[11px] font-600 uppercase tracking-[0.25em] ${levelCfg.colorClass}`}
                  style={levelCfg.glowStyle}
                >
                  {levelCfg.label}
                </span>
                <span className="font-mono text-sm text-secondary">
                  {levelCfg.description}
                </span>
              </div>

              {/* Last activity */}
              <p className="mt-2 font-mono text-[10px] text-tertiary uppercase tracking-[0.15em]">
                Actualizado: {formatDate(profile.calculated_at)}
              </p>
            </div>

            {/* Stats grid */}
            <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
              {/* Votos */}
              <div className="flex flex-col gap-3 bg-bg p-6">
                <div className="flex items-center gap-2">
                  <CheckSquare size={16} strokeWidth={1.5} className="text-cyan" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary">
                    Votos emitidos
                  </span>
                </div>
                <div className="font-display text-4xl font-700 text-cyan">
                  {profile.total_votes}
                </div>
              </div>

              {/* Propuestas */}
              <div className="flex flex-col gap-3 bg-bg p-6">
                <div className="flex items-center gap-2">
                  <FileText size={16} strokeWidth={1.5} className="text-gold" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary">
                    Propuestas creadas
                  </span>
                </div>
                <div className="font-display text-4xl font-700 text-gold">
                  {profile.total_proposals}
                </div>
              </div>

              {/* Reportes */}
              <div className="flex flex-col gap-3 bg-bg p-6">
                <div className="flex items-center gap-2">
                  <Map size={16} strokeWidth={1.5} className="text-gold" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary">
                    Reportes enviados
                  </span>
                </div>
                <div className="font-display text-4xl font-700 text-gold">
                  {profile.total_reports}
                </div>
              </div>

              {/* Insignias */}
              <div className="flex flex-col gap-3 bg-bg p-6">
                <div className="flex items-center gap-2">
                  <Award size={16} strokeWidth={1.5} className="text-cyan" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary">
                    Insignias obtenidas
                  </span>
                </div>
                <div className="font-display text-4xl font-700 text-cyan">
                  {profile.badges_count}
                </div>
              </div>
            </div>

            {/* Event breakdown */}
            {activeEvents.length > 0 && (
              <div>
                <div className="mb-4 flex items-center gap-3">
                  <TrendingUp size={14} strokeWidth={1.5} className="text-gold" />
                  <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-tertiary">
                    Desglose de actividad
                  </h2>
                </div>

                <div className="space-y-px bg-border">
                  {activeEvents.map(([eventType, count]) => {
                    const label  = EVENT_LABELS[eventType] ?? eventType
                    const points = EVENT_POINTS[eventType] ?? 0
                    const total  = points * count
                    const isNeg  = points < 0

                    return (
                      <div
                        key={eventType}
                        className="flex items-center justify-between gap-4 bg-surface px-5 py-4"
                      >
                        {/* Event name + count */}
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="flex-shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary w-6 text-right">
                            {count}×
                          </span>
                          <span className="font-mono text-sm text-primary truncate">
                            {label}
                          </span>
                        </div>

                        {/* Points */}
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="font-mono text-[10px] text-tertiary">
                            {points > 0 ? `+${points}` : points} pts ea.
                          </span>
                          <span
                            className={`font-display text-base font-700 ${
                              isNeg ? 'text-red-400' : 'text-gold'
                            }`}
                          >
                            {total > 0 ? `+${total}` : total}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Last activity footer */}
            {profile.last_activity_at && (
              <p className="font-mono text-[10px] text-tertiary text-center uppercase tracking-[0.15em]">
                Última actividad: {formatDate(profile.last_activity_at)}
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
