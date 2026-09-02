'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  Award,
  BadgeCheck,
  BarChart3,
  CheckCircle2,
  FileText,
  Flame,
  MapPin,
  MessageSquare,
  ShieldCheck,
  Star,
  Target,
  TrendingUp,
  Users,
  Vote,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { CivicBarList, CivicDonut, CivicTrendChart } from '@/components/ui/CivicCharts'

type ReputationLevel = 'observador' | 'participante' | 'activista' | 'lider' | 'embajador'
type TabKey = 'resumen' | 'actividad' | 'logros'

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

interface AuthProfile {
  id: string
  did: string
  email: string | null
  neighborhood: string | null
  locality_id: number | null
  reputation_score: string
  verification_level: number
  created_at: string
  last_active_at: string | null
}

interface IdentityStatus {
  citizen_id: string
  did: string
  level: 0 | 1 | 2
  level_name: 'registrado' | 'documento_declarado' | 'contacto_verificado'
  can_vote: boolean
  can_propose: boolean
}

interface ReputationAnalytics {
  citizen_id: string
  score_history: Array<{ period: string; points: number; cumulative_score: number }>
  community: { rank: number; participants: number; top_percent: number }
  streak: { current_days: number; active_dates: string[] }
  event_breakdown: Array<{
    event_type: string
    count: number
    points_per_event: number
    points_total: number
  }>
  generated_at: string
}

const LEVEL_CONFIG: Record<
  ReputationLevel,
  { label: string; description: string; threshold: number; accent: string }
> = {
  observador: {
    label: 'Observador',
    description: 'Conociendo la plataforma cívica',
    threshold: 0,
    accent: '#7B8799',
  },
  participante: {
    label: 'Participante',
    description: 'Participación ciudadana activa',
    threshold: 20,
    accent: '#4A90E2',
  },
  activista: {
    label: 'Activista',
    description: 'Aporta de forma sostenida a su comunidad',
    threshold: 50,
    accent: '#178C8C',
  },
  lider: {
    label: 'Líder',
    description: 'Referente de participación cívica',
    threshold: 100,
    accent: '#F5B700',
  },
  embajador: {
    label: 'Embajador',
    description: 'Trayectoria cívica consolidada',
    threshold: 200,
    accent: '#D72638',
  },
}

const LEVEL_ORDER: ReputationLevel[] = ['observador', 'participante', 'activista', 'lider', 'embajador']

const EVENT_META: Record<string, { label: string; points: number; color: string }> = {
  vote_cast: { label: 'Participación en votaciones', points: 5, color: '#4A90E2' },
  proposal_created: { label: 'Propuestas ciudadanas', points: 10, color: '#9B59B6' },
  proposal_approved: { label: 'Propuestas aprobadas', points: 30, color: '#2BA745' },
  proposal_rejected: { label: 'Propuestas no aprobadas', points: -5, color: '#D72638' },
  report_submitted: { label: 'Reportes creados', points: 8, color: '#0A2A66' },
  report_resolved: { label: 'Reportes resueltos', points: 15, color: '#178C8C' },
  endorsement_given: { label: 'Apoyos realizados', points: 2, color: '#F5B700' },
  badge_earned: { label: 'Reconocimientos', points: 20, color: '#D98B00' },
  delegation_given: { label: 'Delegaciones realizadas', points: 5, color: '#476FB5' },
  delegation_received: { label: 'Delegaciones recibidas', points: 3, color: '#6750A4' },
}

const MONTHS: Record<string, string> = {
  '01': 'ene',
  '02': 'feb',
  '03': 'mar',
  '04': 'abr',
  '05': 'may',
  '06': 'jun',
  '07': 'jul',
  '08': 'ago',
  '09': 'sep',
  '10': 'oct',
  '11': 'nov',
  '12': 'dic',
}

function formatDate(iso: string | null) {
  if (!iso) return 'Sin actividad registrada'
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))
}

function formatMemberSince(iso: string) {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso))
}

function computeLevelProgress(score: number, level: ReputationLevel) {
  const index = LEVEL_ORDER.indexOf(level)
  const next = LEVEL_ORDER[index + 1]
  if (!next) return { pct: 100, nextLabel: null as string | null, ptsToNext: 0 }

  const currentThreshold = LEVEL_CONFIG[level].threshold
  const nextThreshold = LEVEL_CONFIG[next].threshold
  const progress = score - currentThreshold
  const range = nextThreshold - currentThreshold
  return {
    pct: Math.max(0, Math.min(100, Math.round((progress / range) * 100))),
    nextLabel: LEVEL_CONFIG[next].label,
    ptsToNext: Math.max(0, nextThreshold - score),
  }
}

function verificationCopy(status: IdentityStatus) {
  if (status.level >= 2) {
    return {
      title: 'Contacto verificado',
      description: 'Tu identidad cívica tiene documento declarado y contacto verificado.',
      color: '#2BA745',
      background: '#EAF6ED',
    }
  }
  if (status.level >= 1) {
    return {
      title: 'Documento declarado',
      description: 'Tu documento fue confirmado. Verifica tu contacto para ampliar capacidades.',
      color: '#0A2A66',
      background: '#EDF3FA',
    }
  }
  return {
    title: 'Identidad registrada',
    description: 'Completa la verificación para habilitar más mecanismos de participación.',
    color: '#9A6A00',
    background: '#FFF5D8',
  }
}

function buildAchievements(profile: ReputationProfile) {
  const endorsements = profile.event_counts.endorsement_given ?? 0
  return [
    {
      id: 'reporter',
      label: 'Vigilante activo',
      description: 'Ha registrado al menos un reporte',
      earned: profile.total_reports > 0,
      color: '#0A2A66',
      icon: FileText,
    },
    {
      id: 'voter',
      label: 'Votante comprometido',
      description: 'Ha participado en votaciones',
      earned: profile.total_votes > 0,
      color: '#4A90E2',
      icon: Vote,
    },
    {
      id: 'proposer',
      label: 'Constructor de ciudad',
      description: 'Ha creado una propuesta ciudadana',
      earned: profile.total_proposals > 0,
      color: '#9B59B6',
      icon: MessageSquare,
    },
    {
      id: 'supporter',
      label: 'Aliado comunitario',
      description: 'Ha apoyado iniciativas de otros ciudadanos',
      earned: endorsements > 0,
      color: '#178C8C',
      icon: Users,
    },
    {
      id: 'recognized',
      label: 'Reconocimiento cívico',
      description: 'Tiene reconocimientos registrados en su historial',
      earned: profile.badges_count > 0,
      color: '#F5B700',
      icon: Award,
    },
  ]
}

function localDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function lastSevenDays() {
  const result: Array<{ key: string; label: string }> = []
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(Date.now() - offset * 86400000)
    result.push({
      key: localDateKey(date),
      label: new Intl.DateTimeFormat('es-CO', {
        timeZone: 'America/Bogota',
        weekday: 'narrow',
      }).format(date),
    })
  }
  return result
}

function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse pb-24">
      <div className="h-48 rounded-[28px] border border-[#E1E7EF] bg-white" />
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="h-80 rounded-[24px] border border-[#E1E7EF] bg-white" />
        <div className="h-80 rounded-[24px] border border-[#E1E7EF] bg-white" />
      </div>
    </div>
  )
}

export default function ReputationPage() {
  const [profile, setProfile] = useState<ReputationProfile | null>(null)
  const [authProfile, setAuthProfile] = useState<AuthProfile | null>(null)
  const [identity, setIdentity] = useState<IdentityStatus | null>(null)
  const [analytics, setAnalytics] = useState<ReputationAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('resumen')

  useEffect(() => {
    async function load() {
      try {
        const [reputation, citizen, status, analyticsResult] = await Promise.all([
          apiFetch<ReputationProfile>('/reputation/me'),
          apiFetch<AuthProfile>('/auth/me'),
          apiFetch<IdentityStatus>('/identity/status'),
          apiFetch<ReputationAnalytics>('/reputation/me/analytics').catch(() => null),
        ])
        setProfile(reputation)
        setAuthProfile(citizen)
        setIdentity(status)
        setAnalytics(analyticsResult)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No fue posible cargar el perfil cívico')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const sevenDays = useMemo(() => lastSevenDays(), [])

  if (loading) return <ProfileSkeleton />

  if (error || !profile || !authProfile || !identity) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 text-center">
        <ShieldCheck size={34} className="text-[#D72638]" />
        <h1 className="mt-5 font-display text-2xl font-extrabold text-[#0A2A66]">Perfil no disponible</h1>
        <p className="mt-3 text-sm leading-6 text-[#607087]">{error ?? 'No se recibió información suficiente del perfil.'}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 rounded-xl bg-[#0A2A66] px-5 py-3 text-xs font-extrabold text-white"
        >
          Reintentar
        </button>
      </div>
    )
  }

  const score = profile.reputation_score
  const level = LEVEL_CONFIG[profile.level]
  const levelProgress = computeLevelProgress(score, profile.level)
  const verification = verificationCopy(identity)
  const endorsements = profile.event_counts.endorsement_given ?? 0
  const achievements = buildAchievements(profile)
  const activeDateSet = new Set(analytics?.streak.active_dates ?? [])

  const breakdown = analytics?.event_breakdown ?? Object.entries(profile.event_counts).map(([eventType, count]) => ({
    event_type: eventType,
    count,
    points_per_event: EVENT_META[eventType]?.points ?? 0,
    points_total: count * (EVENT_META[eventType]?.points ?? 0),
  }))

  const positiveBreakdown = breakdown
    .filter((item) => item.points_total > 0)
    .sort((a, b) => b.points_total - a.points_total)

  const donutSegments = positiveBreakdown.slice(0, 6).map((item) => ({
    label: EVENT_META[item.event_type]?.label ?? item.event_type,
    value: item.points_total,
    color: EVENT_META[item.event_type]?.color ?? '#7B8799',
  }))

  const trendPoints = analytics?.score_history.map((point) => ({
    label: MONTHS[point.period.slice(5, 7)] ?? point.period.slice(5, 7),
    value: point.cumulative_score,
  })) ?? []

  const maxBreakdown = Math.max(1, ...positiveBreakdown.map((item) => item.points_total))
  const barData = positiveBreakdown.slice(0, 6).map((item) => ({
    label: EVENT_META[item.event_type]?.label ?? item.event_type,
    value: item.points_total,
    total: maxBreakdown,
    color: EVENT_META[item.event_type]?.color ?? '#7B8799',
    meta: `${item.count} acciones · ${item.points_total > 0 ? '+' : ''}${item.points_total} pts`,
  }))

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: 'resumen', label: 'Resumen' },
    { key: 'actividad', label: 'Actividad' },
    { key: 'logros', label: 'Logros' },
  ]

  return (
    <div className="mx-auto max-w-6xl pb-28">
      <section className="overflow-hidden rounded-[28px] border border-[#E1E7EF] bg-white shadow-[0_18px_55px_rgba(10,42,102,.07)]">
        <div className="h-2 bg-[linear-gradient(90deg,#F5B700_0_33%,#0A2A66_33%_66%,#D72638_66%_100%)]" />
        <div className="grid gap-6 px-5 py-7 sm:px-7 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex min-w-0 items-center gap-4 sm:gap-5">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-4 border-white bg-[#0A2A66] shadow-[0_0_0_2px_#F5B700]">
              <span className="font-display text-2xl font-extrabold text-white">V</span>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-extrabold tracking-[-0.03em] text-[#0A2A66] sm:text-3xl">
                  Ciudadano VÉRTICE
                </h1>
                <span
                  className="rounded-full px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.12em]"
                  style={{ color: verification.color, backgroundColor: verification.background }}
                >
                  {verification.title}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-[#6A768A]">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={13} className="text-[#D72638]" />
                  {authProfile.neighborhood ? `${authProfile.neighborhood}, Cartagena` : 'Cartagena de Indias'}
                </span>
                <span>Ciudadano desde {formatMemberSince(authProfile.created_at)}</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[#DCE4EE] bg-[#F8FAFC] px-3 py-1.5 text-[10px] font-extrabold text-[#0A2A66]">
                  {level.label}
                </span>
                {identity.can_vote && (
                  <span className="rounded-full bg-[#EDF4FD] px-3 py-1.5 text-[10px] font-bold text-[#326FAE]">Puede votar</span>
                )}
                {identity.can_propose && (
                  <span className="rounded-full bg-[#EAF6ED] px-3 py-1.5 text-[10px] font-bold text-[#23883B]">Puede proponer</span>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#E1E7EF] bg-[#F8FAFC] px-5 py-4 lg:min-w-56">
            <div className="flex items-center justify-between gap-5">
              <div>
                <div className="text-[9px] font-extrabold uppercase tracking-[0.13em] text-[#7B8799]">Puntuación cívica</div>
                <div className="mt-1 font-display text-4xl font-extrabold tracking-[-0.04em] text-[#0A2A66]">
                  {score.toLocaleString('es-CO')}
                </div>
                <div className="mt-1 text-[10px] font-bold" style={{ color: level.accent }}>{level.description}</div>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm">
                <Star size={23} style={{ color: level.accent }} />
              </div>
            </div>
          </div>
        </div>

        <div
          className="flex flex-col gap-2 border-t border-[#E1E7EF] px-5 py-3.5 sm:flex-row sm:items-center sm:px-7"
          style={{ backgroundColor: verification.background }}
        >
          <BadgeCheck size={17} style={{ color: verification.color }} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <span className="text-xs font-extrabold" style={{ color: verification.color }}>{verification.title}. </span>
            <span className="text-xs font-semibold text-[#526176]">{verification.description}</span>
          </div>
          <span className="text-[10px] font-bold text-[#6A768A]">Nivel {identity.level} de 2</span>
        </div>
      </section>

      <div className="mt-5 flex overflow-x-auto rounded-2xl border border-[#E1E7EF] bg-white p-1.5 shadow-sm">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`min-w-32 flex-1 rounded-xl px-4 py-2.5 text-xs font-extrabold transition ${
              activeTab === tab.key ? 'bg-[#0A2A66] text-white' : 'text-[#607087] hover:bg-[#F5F7FA]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'resumen' && (
        <div className="mt-5 space-y-5">
          <section className="grid gap-5 lg:grid-cols-[1.08fr_.92fr]">
            <div className="rounded-[24px] border border-[#E1E7EF] bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-extrabold text-[#0A2A66]">Tu impacto ciudadano</div>
                  <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7B8799]">Composición de puntos registrados</div>
                </div>
                <span className="rounded-full bg-[#F8FAFC] px-3 py-1.5 text-[10px] font-bold text-[#607087]">Datos verificables</span>
              </div>

              <div className="grid gap-7 sm:grid-cols-[auto_1fr] sm:items-center">
                <div className="mx-auto sm:mx-0">
                  <CivicDonut value={score} segments={donutSegments} />
                </div>
                <div className="space-y-3">
                  {donutSegments.length > 0 ? donutSegments.map((segment) => (
                    <div key={segment.label} className="flex items-center justify-between gap-4">
                      <span className="flex min-w-0 items-center gap-2 text-xs font-semibold text-[#526176]">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} />
                        <span className="truncate">{segment.label}</span>
                      </span>
                      <span className="shrink-0 text-xs font-extrabold text-[#0A2A66]">+{segment.value} pts</span>
                    </div>
                  )) : (
                    <div className="rounded-2xl bg-[#F8FAFC] p-5 text-center text-xs font-semibold text-[#7B8799]">
                      Tus puntos aparecerán aquí cuando registres actividad cívica.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-[#E1E7EF] bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-extrabold text-[#0A2A66]">Nivel de contribución</div>
                  <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7B8799]">Progreso cívico</div>
                </div>
                <span className="rounded-full px-3 py-1 text-[10px] font-extrabold" style={{ color: level.accent, backgroundColor: `${level.accent}12` }}>
                  {level.label}
                </span>
              </div>

              <div className="mt-7">
                <div className="mb-2 flex items-center justify-between text-[10px] font-bold text-[#6A768A]">
                  <span>{level.label}</span>
                  <span>{levelProgress.pct}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-[#E9EDF3]">
                  <div className="h-full rounded-full bg-[linear-gradient(90deg,#4A90E2,#0A2A66)] transition-[width] duration-500" style={{ width: `${levelProgress.pct}%` }} />
                </div>
                <p className="mt-3 text-xs font-semibold leading-5 text-[#607087]">
                  {levelProgress.nextLabel
                    ? `${levelProgress.ptsToNext} puntos para alcanzar el nivel ${levelProgress.nextLabel}.`
                    : 'Has alcanzado el nivel más alto del sistema actual.'}
                </p>
              </div>

              <div className="mt-7 border-t border-[#E1E7EF] pt-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Flame size={19} className="text-[#D72638]" />
                    <div>
                      <div className="text-xs font-extrabold text-[#0A2A66]">Tu racha cívica</div>
                      <div className="mt-0.5 text-[10px] font-semibold text-[#7B8799]">Actividad en días consecutivos</div>
                    </div>
                  </div>
                  <div className="font-display text-2xl font-extrabold text-[#2BA745]">
                    {analytics ? `${analytics.streak.current_days} días` : '—'}
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-7 gap-2">
                  {sevenDays.map((day) => {
                    const active = activeDateSet.has(day.key)
                    return (
                      <div key={day.key} className="text-center">
                        <div className={`mx-auto h-8 w-8 rounded-full border-2 ${active ? 'border-[#2BA745] bg-[#2BA745]' : 'border-[#DDE4EC] bg-white'}`} />
                        <div className="mt-1.5 text-[9px] font-bold uppercase text-[#8A96A7]">{day.label}</div>
                      </div>
                    )
                  })}
                </div>
                {!analytics && <p className="mt-3 text-[10px] font-semibold text-[#8A96A7]">La analítica temporal no está disponible en este momento.</p>}
              </div>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { label: 'Reportes', value: profile.total_reports, icon: FileText, color: '#0A2A66' },
              { label: 'Apoyos', value: endorsements, icon: Users, color: '#2BA745' },
              { label: 'Votaciones', value: profile.total_votes, icon: Vote, color: '#4A90E2' },
              { label: 'Propuestas', value: profile.total_proposals, icon: MessageSquare, color: '#9B59B6' },
              { label: 'Reconocimientos', value: profile.badges_count, icon: Award, color: '#F5B700' },
            ].map((stat) => {
              const Icon = stat.icon
              return (
                <div key={stat.label} className="rounded-2xl border border-[#E1E7EF] bg-white p-4 shadow-sm">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ color: stat.color, backgroundColor: `${stat.color}12` }}>
                    <Icon size={17} />
                  </div>
                  <div className="mt-4 font-display text-2xl font-extrabold text-[#0A2A66]">{stat.value.toLocaleString('es-CO')}</div>
                  <div className="mt-1 text-[10px] font-bold text-[#6A768A]">{stat.label}</div>
                </div>
              )
            })}
          </section>

          <section className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
            <div className="rounded-[24px] border border-[#E1E7EF] bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-sm font-extrabold text-[#0A2A66]">
                    <TrendingUp size={17} className="text-[#2BA745]" /> Evolución de tu participación
                  </div>
                  <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7B8799]">Puntuación acumulada por mes</div>
                </div>
                {analytics && <span className="text-[10px] font-bold text-[#7B8799]">Últimos {trendPoints.length} meses activos</span>}
              </div>
              <CivicTrendChart points={trendPoints} />
            </div>

            <div className="rounded-[24px] border border-[#E1E7EF] bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-2 text-sm font-extrabold text-[#0A2A66]">
                <Target size={17} className="text-[#D72638]" /> Comparación comunitaria
              </div>
              {analytics ? (
                <>
                  <div className="mt-7 text-center">
                    <div className="text-xs font-bold text-[#607087]">Estás en el</div>
                    <div className="mt-1 font-display text-5xl font-extrabold tracking-[-0.05em] text-[#2BA745]">top {analytics.community.top_percent}%</div>
                    <div className="mt-2 text-xs font-semibold text-[#6A768A]">
                      Posición {analytics.community.rank.toLocaleString('es-CO')} de {analytics.community.participants.toLocaleString('es-CO')} participantes con actividad
                    </div>
                  </div>
                  <div className="mt-7 h-3 overflow-hidden rounded-full bg-[linear-gradient(90deg,#D72638,#F5B700,#2BA745)]">
                    <div
                      className="h-full w-1 border-x-2 border-white bg-[#0A2A66] shadow"
                      style={{ marginLeft: `${Math.max(0, Math.min(99, 100 - analytics.community.top_percent))}%` }}
                    />
                  </div>
                  <div className="mt-2 flex justify-between text-[9px] font-bold text-[#8A96A7]"><span>100%</span><span>50%</span><span>Top 1%</span></div>
                </>
              ) : (
                <div className="mt-6 rounded-2xl bg-[#F8FAFC] p-6 text-center text-xs font-semibold leading-5 text-[#7B8799]">
                  La comparación comunitaria no está disponible. No se muestran porcentajes estimados.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[24px] border border-[#E1E7EF] bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-extrabold text-[#0A2A66]"><BarChart3 size={17} className="text-[#4A90E2]" /> Cómo se compone tu puntuación</div>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7B8799]">Contribución por tipo de actividad</div>
              </div>
              <span className="rounded-full bg-[#EDF4FD] px-3 py-1.5 text-[10px] font-bold text-[#326FAE]">Fuente: eventos de reputación</span>
            </div>
            {barData.length > 0 ? <CivicBarList data={barData} /> : (
              <div className="rounded-2xl border border-dashed border-[#D8E0EA] bg-[#F8FAFC] p-8 text-center text-xs font-semibold text-[#7B8799]">Aún no hay actividad suficiente para construir la distribución.</div>
            )}
          </section>

          <section className="rounded-[24px] border border-[#E1E7EF] bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold text-[#0A2A66]">Hitos y reconocimientos</div>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7B8799]">Logros derivados de tu actividad real</div>
              </div>
              <span className="text-[10px] font-bold text-[#607087]">{achievements.filter((item) => item.earned).length} de {achievements.length} alcanzados</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {achievements.map((achievement) => {
                const Icon = achievement.icon
                return (
                  <div key={achievement.id} className={`rounded-2xl border p-4 text-center ${achievement.earned ? 'border-[#DCE4EE] bg-white' : 'border-[#E9EDF3] bg-[#F8FAFC] opacity-50'}`}>
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full" style={{ color: achievement.color, backgroundColor: `${achievement.color}12` }}>
                      <Icon size={21} />
                    </div>
                    <div className="mt-3 text-[11px] font-extrabold leading-4 text-[#0A2A66]">{achievement.label}</div>
                    <div className="mt-1 text-[9px] font-semibold leading-4 text-[#7B8799]">{achievement.description}</div>
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      )}

      {activeTab === 'actividad' && (
        <section className="mt-5 rounded-[24px] border border-[#E1E7EF] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E1E7EF] pb-5">
            <div>
              <div className="flex items-center gap-2 text-sm font-extrabold text-[#0A2A66]"><Activity size={17} className="text-[#4A90E2]" /> Actividad acumulada</div>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7B8799]">Eventos que construyen tu trayectoria cívica</p>
            </div>
            <div className="text-right text-[10px] font-semibold text-[#7B8799]">Última actividad<br /><strong className="text-[#0A2A66]">{formatDate(profile.last_activity_at)}</strong></div>
          </div>

          <div className="mt-5 divide-y divide-[#E9EDF3]">
            {breakdown.length > 0 ? breakdown.map((item) => {
              const meta = EVENT_META[item.event_type]
              return (
                <div key={item.event_type} className="grid gap-3 py-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: meta?.color ?? '#7B8799' }} />
                    <div>
                      <div className="text-xs font-extrabold text-[#0A2A66]">{meta?.label ?? item.event_type}</div>
                      <div className="mt-0.5 text-[10px] font-semibold text-[#7B8799]">{item.count} eventos registrados</div>
                    </div>
                  </div>
                  <div className="text-xs font-bold text-[#607087]">{item.points_per_event > 0 ? '+' : ''}{item.points_per_event} pts / acción</div>
                  <div className={`text-right font-display text-xl font-extrabold ${item.points_total < 0 ? 'text-[#D72638]' : 'text-[#2BA745]'}`}>
                    {item.points_total > 0 ? '+' : ''}{item.points_total}
                  </div>
                </div>
              )
            }) : (
              <div className="py-14 text-center text-xs font-semibold text-[#7B8799]">Todavía no hay eventos de participación registrados.</div>
            )}
          </div>
        </section>
      )}

      {activeTab === 'logros' && (
        <section className="mt-5 rounded-[24px] border border-[#E1E7EF] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-extrabold text-[#0A2A66]"><Award size={18} className="text-[#F5B700]" /> Logros de participación</div>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7B8799]">Hitos calculados desde tu historial, no desde datos simulados</p>
            </div>
            <div className="rounded-2xl bg-[#FFF5D8] px-4 py-2 text-center">
              <div className="font-display text-2xl font-extrabold text-[#9A6A00]">{profile.badges_count}</div>
              <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#9A6A00]">Reconocimientos registrados</div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {achievements.map((achievement) => {
              const Icon = achievement.icon
              return (
                <div key={achievement.id} className={`rounded-[20px] border p-5 ${achievement.earned ? 'border-[#DCE4EE] bg-white' : 'border-[#E9EDF3] bg-[#F8FAFC] opacity-55'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ color: achievement.color, backgroundColor: `${achievement.color}12` }}>
                      <Icon size={21} />
                    </div>
                    {achievement.earned ? <CheckCircle2 size={19} className="text-[#2BA745]" /> : <ShieldCheck size={19} className="text-[#A8B1BE]" />}
                  </div>
                  <div className="mt-4 text-sm font-extrabold text-[#0A2A66]">{achievement.label}</div>
                  <p className="mt-2 text-xs font-semibold leading-5 text-[#6A768A]">{achievement.description}</p>
                  <div className="mt-4 text-[9px] font-extrabold uppercase tracking-[0.12em]" style={{ color: achievement.earned ? achievement.color : '#8A96A7' }}>
                    {achievement.earned ? 'Alcanzado' : 'Pendiente'}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#0A2A66] px-5 py-4 text-white">
        <div className="flex items-center gap-3">
          <ShieldCheck size={18} className="text-[#F5B700]" />
          <div>
            <div className="text-xs font-extrabold">Tu perfil se calcula con actividad registrada</div>
            <div className="mt-0.5 text-[10px] font-semibold text-white/65">Sin porcentajes, rachas ni niveles inventados en la interfaz.</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold text-white/70">
          <BarChart3 size={14} /> Actualizado {formatDate(profile.calculated_at)}
        </div>
      </div>
    </div>
  )
}
