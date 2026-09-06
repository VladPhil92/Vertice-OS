'use client'

import { useEffect, useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  BadgeCheck,
  BarChart3,
  CheckCircle2,
  FilePlus2,
  FileText,
  Loader2,
  MapPin,
  Medal,
  MessageSquareWarning,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  ThumbsUp,
  Trophy,
  UserRound,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'

type ActivityType = 'report' | 'proposal'
type FeedFilter = 'all' | 'following' | ActivityType
type VerificationState = 'declared' | 'evidence_backed' | 'verified'
type ActorKind = 'citizen' | 'social_leader' | 'candidate' | 'organization_rep' | 'public_official'
type ValidationStance = 'corroborate' | 'dispute'

interface CivicActivity {
  id: string
  type: ActivityType
  actor: {
    id: string | null
    display_name: string
    neighborhood: string | null
    actor_kind: ActorKind
    organization: string | null
    public_profile: boolean
    platform_reputation_score: number | null
  }
  title: string
  summary: string
  category: string
  status: string
  neighborhood: string | null
  evidence_count: number
  verification_state: VerificationState
  civic_score: number
  score_dimensions: {
    evidence: number
    results: number
    impact: number
    validation: number
    transparency: number
    collaboration: number
    continuity: number
    confidence: number
  }
  community_validation: {
    corroborations: number
    disputes: number
    total: number
  }
  created_at: string
  updated_at: string
  href: string
}

interface LeaderEntry {
  citizen_id: string
  display_name: string
  neighborhood: string | null
  actor_kind: ActorKind
  organization: string | null
  leader_score: number
  platform_reputation_score: number
  actions_count: number
  verified_actions: number
  evidence_count: number
  average_action_score: number
  verification_rate: number
  rank: number
}

interface FeedResponse {
  data: CivicActivity[]
  count: number
}

interface LeaderboardResponse {
  data: LeaderEntry[]
  count: number
}

interface ValidationResponse {
  corroborations: number
  disputes: number
  total: number
  my_stance: ValidationStance | null
  my_note: string | null
}

interface SummaryCard {
  label: string
  value: number
  icon: LucideIcon
}

const ACTOR_LABEL: Record<ActorKind, string> = {
  citizen: 'Ciudadanía',
  social_leader: 'Liderazgo social',
  candidate: 'Candidatura',
  organization_rep: 'Organización',
  public_official: 'Gestión pública',
}

const VERIFICATION_META: Record<VerificationState, { label: string; className: string }> = {
  declared: { label: 'Declarada', className: 'bg-[#F7F9FC] text-[#6D7890]' },
  evidence_backed: { label: 'Con evidencia', className: 'bg-[#FFF4D1] text-[#8A6500]' },
  verified: { label: 'Resultado verificado', className: 'bg-[#EAF6ED] text-[#237D36]' },
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
}

function ScoreBadge({ score }: { score: number }) {
  return (
    <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl border border-[#DCE5EF] bg-[#F7F9FC]">
      <span className="text-lg font-extrabold leading-none text-[#0A2A66]">{score}</span>
      <span className="mt-1 text-[8px] font-extrabold uppercase tracking-[.12em] text-[#7B8799]">score</span>
    </div>
  )
}

export default function CommunityPage() {
  const [feed, setFeed] = useState<CivicActivity[]>([])
  const [leaders, setLeaders] = useState<LeaderEntry[]>([])
  const [filter, setFilter] = useState<FeedFilter>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [validationState, setValidationState] = useState<Record<string, ValidationStance | null>>({})
  const [workingValidation, setWorkingValidation] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const isTypedFilter = filter === 'report' || filter === 'proposal'
      const endpoint = filter === 'following'
        ? '/community/following/feed?limit=40'
        : `/community/feed?limit=40${isTypedFilter ? `&type=${filter}` : ''}`
      const [feedResponse, leaderboardResponse] = await Promise.all([
        apiFetch<FeedResponse>(endpoint, filter === 'following' ? {} : { public: true }),
        apiFetch<LeaderboardResponse>('/community/leaderboard?limit=10', { public: true }),
      ])
      setFeed(feedResponse.data)
      setLeaders(leaderboardResponse.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar la red cívica.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [filter]) // eslint-disable-line react-hooks/exhaustive-deps

  async function setValidation(item: CivicActivity, stance: ValidationStance) {
    const key = `${item.type}:${item.id}`
    setWorkingValidation(key)
    try {
      const current = validationState[key]
      let response: ValidationResponse
      if (current === stance) {
        response = await apiFetch<ValidationResponse>(`/community/activities/${item.type}/${item.id}/validation`, { method: 'DELETE' })
        setValidationState((state) => ({ ...state, [key]: null }))
      } else {
        let note: string | null = null
        if (stance === 'dispute') {
          note = window.prompt('Explica brevemente qué parte de la evidencia requiere revisión:')
          if (!note) return
        }
        response = await apiFetch<ValidationResponse>(`/community/activities/${item.type}/${item.id}/validation`, {
          method: 'PUT',
          body: JSON.stringify({ stance, note }),
        })
        setValidationState((state) => ({ ...state, [key]: response.my_stance }))
      }
      setFeed((items) => items.map((activity) => (
        activity.id === item.id && activity.type === item.type
          ? {
              ...activity,
              community_validation: {
                corroborations: response.corroborations,
                disputes: response.disputes,
                total: response.total,
              },
            }
          : activity
      )))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible registrar la validación comunitaria.')
    } finally {
      setWorkingValidation(null)
    }
  }

  const summaryCards = useMemo<SummaryCard[]>(() => [
    { label: 'Actividad visible', value: feed.length, icon: Activity },
    { label: 'Resultados verificados', value: feed.filter((item) => item.verification_state === 'verified').length, icon: BadgeCheck },
    { label: 'Evidencias', value: feed.reduce((sum, item) => sum + item.evidence_count, 0), icon: ShieldCheck },
    { label: 'Corroboraciones', value: feed.reduce((sum, item) => sum + item.community_validation.corroborations, 0), icon: ThumbsUp },
  ], [feed])

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-8 lg:px-8">
      <section className="overflow-hidden rounded-[24px] bg-[#0A2A66] text-white shadow-[0_20px_55px_rgba(10,42,102,.16)] sm:rounded-[28px]">
        <div className="grid h-1.5 grid-cols-3">
          <span className="bg-[#F5B700]" /><span className="bg-[#4A90E2]" /><span className="bg-[#D72638]" />
        </div>
        <div className="grid gap-5 p-5 sm:p-7 lg:grid-cols-[1fr_auto] lg:items-center lg:p-9">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#F5B700]">Red cívica de gestión</div>
            <h1 className="mt-3 font-display text-2xl font-extrabold tracking-[-.04em] sm:text-4xl">Sigue gestión, no popularidad.</h1>
            <p className="mt-3 max-w-3xl text-xs font-medium leading-6 text-white/75 sm:mt-4 sm:text-sm sm:leading-7">
              Conecta con perfiles públicos, sigue su trabajo y contrasta evidencia. Las corroboraciones y disputas son señales comunitarias: no equivalen a verificación oficial y no alteran el VÉRTICE Score v1.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 lg:max-w-[320px] lg:justify-end">
            <Link href="/dashboard/community/profile" className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-extrabold text-white sm:flex-none">
              <UserRound size={16} /> Mi perfil público
            </Link>
            <Link href="/dashboard/reports/new" className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#F5B700] px-4 py-2.5 text-xs font-extrabold text-[#0A2A66] sm:flex-none">
              <FilePlus2 size={16} /> Registrar gestión
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-4 grid grid-cols-2 gap-2.5 lg:mt-5 lg:grid-cols-4 lg:gap-3">
        {summaryCards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-[#E1E7EF] bg-white p-3.5 shadow-[0_8px_28px_rgba(10,42,102,.04)] sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[9px] font-extrabold uppercase tracking-[.09em] text-[#7B8799] sm:text-[10px]">{label}</span>
              <Icon size={15} className="shrink-0 text-[#4A90E2]" />
            </div>
            <div className="mt-2 text-xl font-extrabold text-[#0A2A66] sm:mt-3 sm:text-2xl">{value}</div>
          </div>
        ))}
      </section>

      <div className="mt-5 grid gap-5 xl:mt-6 xl:grid-cols-[1fr_340px] xl:gap-6">
        <section>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3 sm:mb-4">
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#7B8799]">Actividad comunitaria</div>
              <h2 className="mt-1 text-lg font-extrabold text-[#0A2A66] sm:text-xl">Feed de gestión y evidencia</h2>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {(['all', 'following', 'report', 'proposal'] as const).map((value) => (
                <button
                  key={value}
                  onClick={() => setFilter(value)}
                  className={filter === value
                    ? 'rounded-full bg-[#0A2A66] px-3 py-2 text-[9px] font-extrabold text-white sm:text-[10px]'
                    : 'rounded-full border border-[#DCE5EF] bg-white px-3 py-2 text-[9px] font-extrabold text-[#607087] sm:text-[10px]'}
                >
                  {value === 'all' ? 'Todo' : value === 'following' ? 'Siguiendo' : value === 'report' ? 'Gestiones' : 'Iniciativas'}
                </button>
              ))}
              <button onClick={load} className="flex h-9 w-9 items-center justify-center rounded-full border border-[#DCE5EF] bg-white text-[#607087]" aria-label="Actualizar">
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          {loading && (
            <div className="flex min-h-[220px] items-center justify-center rounded-3xl border border-[#E1E7EF] bg-white">
              <Loader2 size={24} className="animate-spin text-[#4A90E2]" />
            </div>
          )}

          {!loading && error && (
            <div className="mb-4 rounded-3xl border border-[#F1C8CE] bg-[#FCEBED] p-5 text-sm font-semibold text-[#A91D2E]">{error}</div>
          )}

          {!loading && !error && feed.length === 0 && (
            <div className="rounded-3xl border border-[#E1E7EF] bg-white p-8 text-center">
              <Sparkles className="mx-auto text-[#F5B700]" />
              <div className="mt-3 text-lg font-extrabold text-[#0A2A66]">{filter === 'following' ? 'Aún no sigues perfiles con actividad visible.' : 'Aún no hay actividad para este filtro.'}</div>
              <p className="mt-2 text-sm text-[#607087]">{filter === 'following' ? 'Abre un perfil público y selecciona “Seguir gestión”.' : 'La primera gestión documentada aparecerá aquí con su evidencia y score.'}</p>
            </div>
          )}

          <div className="space-y-3 sm:space-y-4">
            {!loading && !error && feed.map((item) => {
              const verification = VERIFICATION_META[item.verification_state]
              const validationKey = `${item.type}:${item.id}`
              const currentValidation = validationState[validationKey]
              const validationBusy = workingValidation === validationKey
              return (
                <article key={validationKey} className="rounded-[22px] border border-[#E1E7EF] bg-white p-4 shadow-[0_10px_35px_rgba(10,42,102,.05)] sm:rounded-[24px] sm:p-6">
                  <div className="flex gap-3 sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        {item.actor.id ? (
                          <Link href={`/dashboard/community/profiles/${item.actor.id}`} className="text-xs font-extrabold text-[#0A2A66] hover:text-[#246CB6]">{item.actor.display_name}</Link>
                        ) : (
                          <span className="text-xs font-extrabold text-[#0A2A66]">{item.actor.display_name}</span>
                        )}
                        <span className="rounded-full bg-[#EDF3FA] px-2 py-1 text-[8px] font-extrabold text-[#246CB6] sm:px-2.5 sm:text-[9px]">{ACTOR_LABEL[item.actor.actor_kind]}</span>
                        <span className={`rounded-full px-2 py-1 text-[8px] font-extrabold sm:px-2.5 sm:text-[9px] ${verification.className}`}>
                          {verification.label}
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[9px] font-semibold text-[#7B8799] sm:text-[10px]">
                        {item.neighborhood && <span className="inline-flex items-center gap-1"><MapPin size={11} /> {item.neighborhood}</span>}
                        {item.actor.organization && <><span>·</span><span>{item.actor.organization}</span></>}
                        <span>·</span><span>{formatDate(item.updated_at)}</span>
                      </div>
                      <Link href={item.href} className="mt-3 block text-base font-extrabold leading-6 text-[#0A2A66] hover:text-[#246CB6] sm:mt-4 sm:text-lg">{item.title}</Link>
                      <p className="mt-2 line-clamp-3 text-[11px] font-medium leading-5 text-[#607087] sm:text-xs sm:leading-6">{item.summary}</p>
                    </div>
                    <ScoreBadge score={item.civic_score} />
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-1.5 border-t border-[#E9EDF3] pt-3 text-center sm:mt-5 sm:gap-2 sm:pt-4">
                    <div className="rounded-xl bg-[#F7F9FC] p-2"><div className="text-sm font-extrabold text-[#0A2A66]">{item.evidence_count}</div><div className="text-[7px] font-bold uppercase tracking-[.08em] text-[#7B8799] sm:text-[8px]">Evidencias</div></div>
                    <div className="rounded-xl bg-[#EAF6ED] p-2"><div className="text-sm font-extrabold text-[#237D36]">{item.community_validation.corroborations}</div><div className="text-[7px] font-bold uppercase tracking-[.08em] text-[#5D8064] sm:text-[8px]">Corroboran</div></div>
                    <div className={item.community_validation.disputes > 0 ? 'rounded-xl bg-[#FCEBED] p-2' : 'rounded-xl bg-[#F7F9FC] p-2'}><div className={item.community_validation.disputes > 0 ? 'text-sm font-extrabold text-[#A91D2E]' : 'text-sm font-extrabold text-[#0A2A66]'}>{item.community_validation.disputes}</div><div className="text-[7px] font-bold uppercase tracking-[.08em] text-[#7B8799] sm:text-[8px]">Disputas</div></div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setValidation(item, 'corroborate')}
                      disabled={validationBusy}
                      className={currentValidation === 'corroborate'
                        ? 'inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[#EAF6ED] px-3 text-[9px] font-extrabold text-[#237D36] disabled:opacity-50'
                        : 'inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[#DCE5EF] bg-white px-3 text-[9px] font-extrabold text-[#526176] disabled:opacity-50'}
                    >
                      {validationBusy ? <Loader2 size={12} className="animate-spin" /> : <ThumbsUp size={12} />} Corroborar
                    </button>
                    <button
                      onClick={() => setValidation(item, 'dispute')}
                      disabled={validationBusy}
                      className={currentValidation === 'dispute'
                        ? 'inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[#FCEBED] px-3 text-[9px] font-extrabold text-[#A91D2E] disabled:opacity-50'
                        : 'inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[#DCE5EF] bg-white px-3 text-[9px] font-extrabold text-[#526176] disabled:opacity-50'}
                    >
                      <MessageSquareWarning size={12} /> Cuestionar evidencia
                    </button>
                    <span className="text-[8px] font-semibold leading-4 text-[#94A0B0]">Señal comunitaria; no cambia el score v1.</span>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <aside className="space-y-4 sm:space-y-5">
          <section className="rounded-[22px] border border-[#E1E7EF] bg-white p-4 shadow-[0_10px_35px_rgba(10,42,102,.05)] sm:rounded-[24px] sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[9px] font-extrabold uppercase tracking-[.13em] text-[#7B8799]">Ranking territorial</div>
                <h2 className="mt-1 text-base font-extrabold text-[#0A2A66] sm:text-lg">Gestión con mayor evidencia</h2>
              </div>
              <Trophy size={20} className="text-[#F5B700]" />
            </div>
            <div className="mt-4 space-y-2.5 sm:mt-5 sm:space-y-3">
              {leaders.map((leader) => (
                <Link href={`/dashboard/community/profiles/${leader.citizen_id}`} key={leader.citizen_id} className="flex items-center gap-3 rounded-2xl bg-[#F7F9FC] p-3 transition hover:bg-[#EDF3FA]">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-sm font-extrabold text-[#0A2A66] shadow-sm">
                    {leader.rank <= 3 ? <Medal size={16} className="text-[#D98B00]" /> : leader.rank}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-extrabold text-[#0A2A66]">{leader.display_name}</div>
                    <div className="mt-1 text-[9px] font-semibold text-[#7B8799]">{leader.verified_actions} verificadas · {leader.evidence_count} evidencias</div>
                  </div>
                  <div className="text-right"><div className="text-lg font-extrabold text-[#0A2A66]">{leader.leader_score}</div><div className="text-[8px] font-bold uppercase text-[#7B8799]">impacto</div></div>
                </Link>
              ))}
            </div>
          </section>

          <section className="rounded-[22px] border border-[#C9D8EA] bg-[#EDF3FA] p-4 sm:rounded-[24px] sm:p-5">
            <div className="flex items-center gap-2 text-[#0A2A66]"><BarChart3 size={17} /><span className="text-[10px] font-extrabold uppercase tracking-[.12em]">Regla de confianza</span></div>
            <div className="mt-4 space-y-2 text-[11px] font-semibold text-[#526176]">
              {([['Evidencia', 25], ['Resultados', 20], ['Impacto', 15], ['Validación estructural', 10], ['Confianza', 15]] as const).map(([label, points]) => (
                <div key={label} className="flex items-center justify-between"><span>{label}</span><strong className="text-[#0A2A66]">{points} pts</strong></div>
              ))}
              <div className="flex items-center justify-between gap-4"><span>Transparencia + colaboración + continuidad</span><strong className="shrink-0 text-[#0A2A66]">15 pts</strong></div>
            </div>
            <div className="mt-4 flex gap-2 rounded-xl bg-white/70 p-3 text-[10px] font-semibold leading-5 text-[#526176]"><CheckCircle2 size={15} className="mt-0.5 shrink-0 text-[#2BA745]" />Seguidores, likes y corroboraciones comunitarias no suman puntos al score v1.</div>
          </section>

          <Link href="/dashboard/community/profile" className="flex items-center justify-between rounded-[22px] border border-[#E1E7EF] bg-white p-4 text-[#0A2A66] shadow-[0_8px_30px_rgba(10,42,102,.04)]">
            <div><div className="text-[9px] font-extrabold uppercase tracking-[.11em] text-[#7B8799]">Identidad pública</div><div className="mt-1 text-sm font-extrabold">Configura tu perfil cívico</div></div>
            <Users size={18} />
          </Link>
        </aside>
      </div>
    </div>
  )
}