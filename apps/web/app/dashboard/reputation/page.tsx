'use client'

import { useEffect, useState } from 'react'
import { Star, CheckSquare, FileText, Map, Award, TrendingUp, MapPin, ShieldCheck, Flame } from 'lucide-react'
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
  { label: string; description: string; colorClass: string; glowStyle?: React.CSSProperties; threshold: number }
> = {
  observador: {
    label: 'OBSERVADOR',
    description: 'Bienvenido a VÉRTICE OS',
    colorClass: 'text-tertiary',
    threshold: 0,
  },
  participante: {
    label: 'PARTICIPANTE',
    description: 'Ciudadano activo',
    colorClass: 'text-secondary',
    threshold: 100,
  },
  activista: {
    label: 'ACTIVISTA',
    description: 'Voz influyente en tu comunidad',
    colorClass: 'text-cyan',
    threshold: 500,
  },
  lider: {
    label: 'LÍDER',
    description: 'Referente en tu localidad',
    colorClass: 'text-gold',
    threshold: 1500,
  },
  embajador: {
    label: 'EMBAJADOR',
    description: 'Pilar de la democracia en Cartagena',
    colorClass: 'text-gold',
    glowStyle: { textShadow: '0 0 24px rgba(200,168,75,0.55)' },
    threshold: 3000,
  },
}

const LEVEL_ORDER: ReputationLevel[] = ['observador', 'participante', 'activista', 'lider', 'embajador']

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

function computeLevelProgress(score: number, level: ReputationLevel): { pct: number; ptsToNext: number | null } {
  const idx = LEVEL_ORDER.indexOf(level)
  const currentThreshold = LEVEL_CONFIG[level].threshold
  const nextLevel = LEVEL_ORDER[idx + 1]
  if (!nextLevel) return { pct: 100, ptsToNext: null }
  const nextThreshold = LEVEL_CONFIG[nextLevel].threshold
  const range = nextThreshold - currentThreshold
  const progress = Math.max(0, score - currentThreshold)
  return {
    pct: Math.min(100, Math.round((progress / range) * 100)),
    ptsToNext: Math.max(0, nextThreshold - score),
  }
}

function computeTopPercent(score: number): number {
  if (score > 800) return 8
  if (score > 500) return 20
  if (score > 200) return 40
  return 60
}

// ─── Badge config ────────────────────────────────────────────────────────────

function buildBadges(profile: ReputationProfile) {
  return [
    { id: 'CITIZEN_VERIFIED',      label: 'Vigilante',   desc: 'Identidad verificada',  color: '#4ECDC4', earned: true },
    { id: 'TERRITORY_CHAMPION',    label: 'Constructor', desc: 'Impacto territorial',    color: '#C8A84B', earned: profile.total_reports >= 5 },
    { id: 'PROPOSAL_APPROVED',     label: 'Propulsor',   desc: 'Propuesta aprobada',     color: '#27AE60', earned: profile.total_proposals >= 1 },
    { id: 'GOVERNANCE_PARTICIPANT',label: 'Debatiente',  desc: 'Participa en debate',    color: '#1A7FBF', earned: profile.total_votes >= 5 },
    { id: 'DELEGATE',              label: 'Delegado',    desc: 'Rol de delegado',        color: '#9B59B6', earned: false },
  ]
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="max-w-2xl mx-auto pb-24 animate-pulse">
      {/* Profile header skeleton */}
      <div className="bg-surface border-b border-border px-4 pt-6 pb-4">
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 rounded-full bg-border flex-shrink-0" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-4 w-32 bg-border rounded" />
            <div className="h-3 w-48 bg-border rounded" />
            <div className="h-5 w-24 bg-border rounded" />
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="h-3 w-20 bg-border rounded" />
            <div className="h-7 w-14 bg-border rounded" />
            <div className="h-3 w-16 bg-border rounded" />
          </div>
        </div>
      </div>
      {/* Content skeletons */}
      <div className="px-4 mt-6 space-y-4">
        <div className="h-40 w-full bg-surface rounded border border-border" />
        <div className="h-16 w-full bg-surface rounded border border-border" />
        <div className="h-24 w-full bg-surface rounded border border-border" />
        <div className="h-32 w-full bg-surface rounded border border-border" />
      </div>
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ReputationPage() {
  const [profile, setProfile]   = useState<ReputationProfile | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'resumen' | 'actividad' | 'logros'>('resumen')

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

  if (loading) return <Skeleton />

  if (error) {
    return (
      <div className="max-w-2xl mx-auto pb-24 flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
        <p className="font-mono text-[13px] text-tertiary text-center">
          No se pudo cargar tu perfil de reputación
        </p>
        <button
          onClick={() => { setError(null); setLoading(true); apiFetch<ReputationProfile>('/reputation/me').then(setProfile).catch((e) => setError(e instanceof Error ? e.message : 'Error')).finally(() => setLoading(false)) }}
          className="border border-border bg-surface font-mono text-[11px] uppercase tracking-[0.15em] text-gold px-4 py-2"
        >
          Reintentar
        </button>
      </div>
    )
  }

  if (!profile) return null

  const levelCfg   = LEVEL_CONFIG[profile.level]
  const score      = profile.reputation_score
  const { pct, ptsToNext } = computeLevelProgress(score, profile.level)
  const topPercent = computeTopPercent(score)
  const badges     = buildBadges(profile)
  const circumference = 2 * Math.PI * 70
  const strokeOffset  = circumference * (1 - Math.min(score, 1000) / 1000)

  const activeEvents = Object.entries(profile.event_counts).filter(([, count]) => count > 0)

  // Derive initials — fallback "MA" per spec
  const initials = 'MA'

  // Civic streak — derive from last activity (placeholder calculation)
  const streakDays = profile.last_activity_at
    ? Math.max(1, Math.floor((Date.now() - new Date(profile.last_activity_at).getTime()) / 86400000) > 30 ? 1 : 14)
    : 0

  const tabs: { key: 'resumen' | 'actividad' | 'logros'; label: string }[] = [
    { key: 'resumen',   label: 'Resumen' },
    { key: 'actividad', label: 'Actividad' },
    { key: 'logros',    label: 'Logros' },
  ]

  return (
    <div className="max-w-2xl mx-auto pb-24">

      {/* ── 1. Profile header card ───────────────────────────────────────── */}
      <div className="bg-surface border-b border-border px-4 pt-6 pb-4">
        <div className="flex items-start gap-4">

          {/* Avatar */}
          <div className="h-16 w-16 rounded-full bg-navy border-2 border-gold flex items-center justify-center flex-shrink-0">
            <span className="font-display text-xl font-bold text-gold">{initials}</span>
          </div>

          {/* Name + location + badge */}
          <div className="flex-1 min-w-0">
            <p className="font-display text-lg font-bold text-primary leading-tight">
              Ciudadano Activo
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              <MapPin size={14} className="text-gold flex-shrink-0" />
              <span className="font-mono text-[11px] text-tertiary">
                Cartagena de Indias
              </span>
              <span className="font-mono text-[11px] text-tertiary">·</span>
              <span className="font-mono text-[11px] text-tertiary">
                Miembro desde 2024
              </span>
            </div>
            <div className="mt-2 inline-flex">
              <span
                className="bg-gold/15 border border-gold/30 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-gold"
                style={{ letterSpacing: '0.2em' }}
              >
                {levelCfg.label}
              </span>
            </div>
          </div>

          {/* Score display */}
          <div className="flex flex-col items-end flex-shrink-0">
            <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-tertiary">
              Participación cívica
            </span>
            <div className="flex items-baseline gap-0.5 mt-0.5">
              <span className="font-display text-2xl font-bold text-gold leading-none">
                {score.toLocaleString('es-CO')}
              </span>
              <span className="font-mono text-[10px] text-gold ml-0.5">Pts</span>
            </div>
            <span className={`font-mono text-[9px] mt-1 ${levelCfg.colorClass}`}>
              {levelCfg.description}
            </span>
          </div>
        </div>
      </div>

      {/* ── 2. Verification banner ──────────────────────────────────────────── */}
      <div className="bg-gold/[0.08] border-y border-gold/20 px-4 py-3 flex items-center gap-3">
        <ShieldCheck size={16} className="text-gold flex-shrink-0" />
        <span className="font-mono text-[11px] text-secondary flex-1">
          Perfil verificado con Cédula de Ciudadanía
        </span>
        <button className="font-mono text-[10px] text-gold flex-shrink-0 whitespace-nowrap">
          Documentos adjuntados →
        </button>
      </div>

      {/* ── 3. Tabs row ─────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-bg border-b border-border flex">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={[
              'flex-1 py-3 font-mono text-[11px] uppercase tracking-[0.1em] transition-colors',
              activeTab === tab.key
                ? 'border-b-2 border-gold text-gold'
                : 'text-tertiary border-b-2 border-transparent',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab content: Resumen ─────────────────────────────────────────────── */}
      {activeTab === 'resumen' && (
        <>
          {/* ── 4. Score section ──────────────────────────────────────────── */}
          <div className="px-4 mt-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-tertiary mb-5">
              Tu impacto ciudadano
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-6">
              {/* Score ring */}
              <div className="flex-shrink-0">
                <svg width={160} height={160} viewBox="0 0 160 160">
                  {/* Background circle */}
                  <circle
                    cx={80}
                    cy={80}
                    r={70}
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth={12}
                    fill="none"
                  />
                  {/* Progress circle */}
                  <circle
                    cx={80}
                    cy={80}
                    r={70}
                    stroke="#C8A84B"
                    strokeWidth={12}
                    fill="none"
                    strokeDasharray={`${circumference}`}
                    strokeDashoffset={`${strokeOffset}`}
                    strokeLinecap="round"
                    transform="rotate(-90 80 80)"
                    style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                  />
                  {/* Center score */}
                  <text
                    x="50%"
                    y="50%"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#C8A84B"
                    fontSize={28}
                    fontFamily="var(--font-syne, sans-serif)"
                    fontWeight={800}
                    dy={-6}
                  >
                    {score.toLocaleString('es-CO')}
                  </text>
                  {/* "Puntos" label */}
                  <text
                    x="50%"
                    y="50%"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="rgba(240,237,232,0.22)"
                    fontSize={9}
                    fontFamily="var(--font-dm-mono, monospace)"
                    dy={16}
                    letterSpacing={2}
                  >
                    PUNTOS
                  </text>
                </svg>
              </div>

              {/* Score breakdown */}
              {activeEvents.length > 0 && (
                <div className="flex-1 w-full space-y-2">
                  {activeEvents.map(([eventType, count]) => {
                    const label  = EVENT_LABELS[eventType] ?? eventType
                    const points = EVENT_POINTS[eventType] ?? 0
                    const total  = points * count
                    return (
                      <div key={eventType} className="flex items-center justify-between gap-3">
                        <span className="font-mono text-[12px] text-secondary truncate">
                          {label}
                        </span>
                        <span className="font-mono text-[10px] text-gold bg-gold/10 px-2 py-0.5 flex-shrink-0">
                          {total > 0 ? `+${total}` : total} pts
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── 5. Stats strip ──────────────────────────────────────────────── */}
          <div className="mt-6 px-4">
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {[
                { label: 'Reportes',  value: profile.total_reports },
                { label: 'Apoyos',    value: profile.event_counts?.endorsement_given ?? 0 },
                { label: 'Votaciones',value: profile.total_votes },
                { label: 'Legales',   value: profile.event_counts?.legal_action_submitted ?? 0 },
                { label: 'Propuestas',value: profile.total_proposals },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="flex-shrink-0 border border-border bg-surface px-3 py-2.5 flex flex-col items-center gap-1 min-w-[80px]"
                >
                  <span className="font-display text-lg font-bold text-primary leading-none">
                    {stat.value}
                  </span>
                  <span className="font-mono text-[9px] uppercase text-tertiary text-center">
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── 6. Level progress ───────────────────────────────────────────── */}
          <div className="mt-6 px-4">
            <div className="border border-border bg-surface p-5">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-[10px] uppercase text-tertiary tracking-widest">
                  Nivel de contribución
                </span>
                <span
                  className="bg-gold/15 border border-gold/30 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-gold"
                >
                  {levelCfg.label}
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-1 w-full bg-border rounded overflow-hidden">
                <div
                  className="h-full rounded"
                  style={{ width: `${pct}%`, backgroundColor: '#C8A84B', transition: 'width 0.5s ease' }}
                />
              </div>

              {/* Next level label */}
              <p className="font-mono text-[11px] text-tertiary mt-2">
                {ptsToNext !== null
                  ? `${ptsToNext.toLocaleString('es-CO')} pts para el siguiente nivel`
                  : 'Has alcanzado el nivel máximo'}
              </p>

              {/* Civic streak */}
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex items-center gap-2">
                  <Flame size={16} className="text-gold flex-shrink-0" />
                  <span className="font-mono text-[11px] text-secondary">
                    Tu racha cívica:
                  </span>
                  <span className="font-mono text-[11px] text-gold font-semibold">
                    {streakDays} días
                  </span>
                </div>
                <p className="font-mono text-[11px] text-tertiary mt-1 ml-6">
                  como participante activo
                </p>
              </div>
            </div>
          </div>

          {/* ── 7. Community comparison ─────────────────────────────────────── */}
          <div className="mt-4 px-4">
            <div className="border border-border bg-surface p-4 flex items-center gap-4">
              <TrendingUp size={24} className="text-cyan flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-mono text-[12px] text-secondary">
                  Estás en el{' '}
                  <span className="text-gold font-semibold">top {topPercent}%</span>
                  {' '}de{' '}
                  <span className="text-primary">15.121 ciudadanos activos</span>
                </p>
                {/* Comparison bar */}
                <div className="mt-2 h-1 w-full bg-border rounded overflow-hidden">
                  <div
                    className="h-full rounded"
                    style={{
                      width: `${100 - topPercent}%`,
                      backgroundColor: '#4ECDC4',
                      transition: 'width 0.5s ease',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── 8. Badges ───────────────────────────────────────────────────── */}
          <div className="mt-6 px-4 mb-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <span className="font-mono text-[10px] uppercase text-tertiary tracking-widest">
                Badges y reconocimientos
              </span>
              <button className="font-mono text-[10px] text-gold">
                Ver todos →
              </button>
            </div>

            {/* Badge grid */}
            <div className="flex flex-wrap gap-3">
              {badges.map((badge) => (
                <div
                  key={badge.id}
                  className={[
                    'border p-3 flex flex-col items-center gap-1.5 text-center',
                    'w-[calc(33.333%-8px)]',
                    badge.earned ? '' : 'opacity-40',
                  ].join(' ')}
                  style={{
                    borderColor: badge.earned ? `${badge.color}33` : undefined,
                  }}
                >
                  {/* Icon circle */}
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center border"
                    style={{ borderColor: `${badge.color}40` }}
                  >
                    <Award size={18} style={{ color: badge.color }} />
                  </div>
                  <span className="font-mono text-[10px] text-primary leading-tight">
                    {badge.label}
                  </span>
                  <span className="font-mono text-[9px] text-tertiary leading-tight">
                    {badge.desc}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Tab content: Actividad ───────────────────────────────────────────── */}
      {activeTab === 'actividad' && (
        <div className="px-4 mt-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-tertiary mb-4">
            Desglose de actividad
          </p>
          {activeEvents.length === 0 ? (
            <p className="font-mono text-[13px] text-tertiary text-center py-12">
              Sin actividad registrada aún.
            </p>
          ) : (
            <div className="space-y-px border border-border">
              {activeEvents.map(([eventType, count]) => {
                const label  = EVENT_LABELS[eventType] ?? eventType
                const points = EVENT_POINTS[eventType] ?? 0
                const total  = points * count
                const isNeg  = points < 0
                return (
                  <div
                    key={eventType}
                    className="flex items-center justify-between gap-4 bg-surface px-4 py-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex-shrink-0 font-mono text-[10px] uppercase tracking-[0.15em] text-tertiary w-6 text-right">
                        {count}×
                      </span>
                      <span className="font-mono text-[12px] text-primary truncate">
                        {label}
                      </span>
                    </div>
                    <span
                      className={`font-display text-base font-bold flex-shrink-0 ${
                        isNeg ? 'text-red-400' : 'text-gold'
                      }`}
                    >
                      {total > 0 ? `+${total}` : total}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
          {profile.last_activity_at && (
            <p className="font-mono text-[10px] text-tertiary text-center mt-6 uppercase tracking-[0.15em]">
              Última actividad: {formatDate(profile.last_activity_at)}
            </p>
          )}
        </div>
      )}

      {/* ── Tab content: Logros ─────────────────────────────────────────────── */}
      {activeTab === 'logros' && (
        <div className="px-4 mt-6 mb-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-tertiary mb-4">
            Insignias obtenidas: {badges.filter((b) => b.earned).length} / {badges.length}
          </p>
          <div className="flex flex-wrap gap-3">
            {badges.map((badge) => (
              <div
                key={badge.id}
                className={[
                  'border p-4 flex flex-col items-center gap-2 text-center',
                  'w-[calc(50%-6px)]',
                  badge.earned ? '' : 'opacity-40',
                ].join(' ')}
                style={{ borderColor: badge.earned ? `${badge.color}33` : undefined }}
              >
                <div
                  className="h-12 w-12 rounded-full flex items-center justify-center border"
                  style={{ borderColor: `${badge.color}40` }}
                >
                  <Award size={22} style={{ color: badge.color }} />
                </div>
                <span className="font-mono text-[11px] text-primary">{badge.label}</span>
                <span className="font-mono text-[9px] text-tertiary">{badge.desc}</span>
                {badge.earned && (
                  <span
                    className="font-mono text-[8px] uppercase tracking-[0.15em] px-2 py-0.5"
                    style={{ color: badge.color, backgroundColor: `${badge.color}15` }}
                  >
                    Obtenido
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
