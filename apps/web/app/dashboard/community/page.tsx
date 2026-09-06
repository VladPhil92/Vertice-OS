'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
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
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'

type ActivityType = 'report' | 'proposal'
type VerificationState = 'declared' | 'evidence_backed' | 'verified'

interface CivicActivity {
  id: string
  type: ActivityType
  actor: {
    id: string
    display_name: string
    neighborhood: string | null
    actor_kind: 'citizen' | 'social_leader' | 'candidate' | 'public_official'
    platform_reputation_score: number
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
  created_at: string
  updated_at: string
  href: string
}

interface LeaderEntry {
  citizen_id: string
  display_name: string
  neighborhood: string | null
  actor_kind: CivicActivity['actor']['actor_kind']
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
  scoring: {
    version: string
    max_score: number
    dimensions: Record<string, number>
    note: string
  }
}

interface LeaderboardResponse {
  data: LeaderEntry[]
  count: number
  ranking_basis: string
  excludes: string[]
  scoring_version: string
}

const ACTOR_LABEL: Record<CivicActivity['actor']['actor_kind'], string> = {
  citizen: 'Ciudadanía',
  social_leader: 'Liderazgo social',
  candidate: 'Candidatura',
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
    <div className="flex h-14 w-14 flex-col items-center justify-center rounded-2xl border border-[#DCE5EF] bg-[#F7F9FC]">
      <span className="text-lg font-extrabold leading-none text-[#0A2A66]">{score}</span>
      <span className="mt-1 text-[8px] font-extrabold uppercase tracking-[.12em] text-[#7B8799]">score</span>
    </div>
  )
}

export default function CommunityPage() {
  const [feed, setFeed] = useState<CivicActivity[]>([])
  const [leaders, setLeaders] = useState<LeaderEntry[]>([])
  const [filter, setFilter] = useState<'all' | ActivityType>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const suffix = filter === 'all' ? '' : `&type=${filter}`
      const [feedResponse, leaderboardResponse] = await Promise.all([
        apiFetch<FeedResponse>(`/community/feed?limit=40${suffix}`, { public: true }),
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

  const summary = useMemo(() => ({
    actions: feed.length,
    verified: feed.filter((item) => item.verification_state === 'verified').length,
    evidence: feed.reduce((sum, item) => sum + item.evidence_count, 0),
    leaders: leaders.length,
  }), [feed, leaders])

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      <section className="overflow-hidden rounded-[28px] bg-[#0A2A66] text-white shadow-[0_20px_55px_rgba(10,42,102,.16)]">
        <div className="grid h-1.5 grid-cols-3"><span className="bg-[#F5B700]" /><span className="bg-[#4A90E2]" /><span className="bg-[#D72638]" /></div>
        <div className="grid gap-7 p-5 sm:p-7 lg:grid-cols-[1fr_auto] lg:items-center lg:p-9">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#F5B700]">Red cívica de gestión</div>
            <h1 className="mt-3 font-display text-3xl font-extrabold tracking-[-.04em] sm:text-4xl">Lo que haces pesa más que lo que publicas.</h1>
            <p className="mt-4 max-w-3xl text-sm font-medium leading-7 text-white/72">
              Sigue acciones comunitarias, evidencia, resultados y trayectorias. VÉRTICE ordena la gestión por evidencia verificable; seguidores, likes e impresiones no elevan el ranking.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 lg:max-w-[290px] lg:justify-end">
            <Link href="/dashboard/reports/new" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#F5B700] px-4 py-2.5 text-xs font-extrabold text-[#0A2A66]">
              <FilePlus2 size={16} /> Registrar gestión
            </Link>
            <Link href="/dashboard/proposals/new" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-extrabold text-white">
              <FileText size={16} /> Crear iniciativa
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Actividad visible', summary.actions, Activity],
          ['Resultados verificados', summary.verified, BadgeCheck],
          ['Evidencias', summary.evidence, ShieldCheck],
          ['Liderazgos activos', summary.leaders, Users],
        ].map(([label, value, Icon]) => (
          <div key={String(label)} className="rounded-2xl border border-[#E1E7EF] bg-white p-4 shadow-[0_8px_28px_rgba(10,42,102,.04)]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] font-extrabold uppercase tracking-[.11em] text-[#7B8799]">{String(label)}</span>
              <Icon size={16} className="text-[#4A90E2]" />
            </div>
            <div className="mt-3 text-2xl font-extrabold text-[#0A2A66]">{String(value)}</div>
          </div>
        ))}
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_340px]">
        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#7B8799]">Actividad comunitaria</div>
              <h2 className="mt-1 text-xl font-extrabold text-[#0A2A66]">Feed de acciones y resultados</h2>
            </div>
            <div className="flex items-center gap-2">
              {(['all', 'report', 'proposal'] as const).map((value) => (
                <button
                  key={value}
                  onClick={() => setFilter(value)}
                  className={filter === value
                    ? 'rounded-full bg-[#0A2A66] px-3 py-2 text-[10px] font-extrabold text-white'
                    : 'rounded-full border border-[#DCE5EF] bg-white px-3 py-2 text-[10px] font-extrabold text-[#607087]'}
                >
                  {value === 'all' ? 'Todo' : value === 'report' ? 'Gestiones' : 'Iniciativas'}
                </button>
              ))}
              <button onClick={load} className="flex h-9 w-9 items-center justify-center rounded-full border border-[#DCE5EF] bg-white text-[#607087]" aria-label="Actualizar">
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          {loading && (
            <div className="flex min-h-[240px] items-center justify-center rounded-3xl border border-[#E1E7EF] bg-white">
              <Loader2 size={24} className="animate-spin text-[#4A90E2]" />
            </div>
          )}

          {!loading && error && (
            <div className="rounded-3xl border border-[#F1C8CE] bg-[#FCEBED] p-6 text-sm font-semibold text-[#A91D2E]">{error}</div>
          )}

          {!loading && !error && feed.length === 0 && (
            <div className="rounded-3xl border border-[#E1E7EF] bg-white p-8 text-center">
              <Sparkles className="mx-auto text-[#F5B700]" />
              <div className="mt-3 text-lg font-extrabold text-[#0A2A66]">Aún no hay actividad para este filtro.</div>
              <p className="mt-2 text-sm text-[#607087]">La primera gestión documentada aparecerá aquí con su evidencia y score.</p>
            </div>
          )}

          <div className="space-y-4">
            {!loading && !error && feed.map((item) => {
              const verification = VERIFICATION_META[item.verification_state]
              return (
                <article key={`${item.type}-${item.id}`} className="rounded-[24px] border border-[#E1E7EF] bg-white p-5 shadow-[0_10px_35px_rgba(10,42,102,.05)] sm:p-6">
                  <div className="flex gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-extrabold text-[#0A2A66]">{item.actor.display_name}</span>
                        <span className="rounded-full bg-[#EDF3FA] px-2.5 py-1 text-[9px] font-extrabold text-[#246CB6]">{ACTOR_LABEL[item.actor.actor_kind]}</span>
                        <span className={`rounded-full px-2.5 py-1 text-[9px] font-extrabold ${verification.className}`}>
                          {verification.label}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-semibold text-[#7B8799]">
                        {item.neighborhood && <span className="inline-flex items-center gap-1"><MapPin size={11} /> {item.neighborhood}</span>}
                        <span>·</span><span>{formatDate(item.updated_at)}</span>
                      </div>
                      <Link href={item.href} className="mt-4 block text-lg font-extrabold leading-6 text-[#0A2A66] hover:text-[#246CB6]">{item.title}</Link>
                      <p className="mt-2 line-clamp-3 text-xs font-medium leading-6 text-[#607087]">{item.summary}</p>
                    </div>
                    <ScoreBadge score={item.civic_score} />
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-2 border-t border-[#E9EDF3] pt-4 text-center">
                    <div className="rounded-xl bg-[#F7F9FC] p-2.5"><div className="text-sm font-extrabold text-[#0A2A66]">{item.evidence_count}</div><div className="text-[8px] font-bold uppercase tracking-[.1em] text-[#7B8799]">Evidencias</div></div>
                    <div className="rounded-xl bg-[#F7F9FC] p-2.5"><div className="text-sm font-extrabold text-[#0A2A66]">{item.score_dimensions.results}/20</div><div className="text-[8px] font-bold uppercase tracking-[.1em] text-[#7B8799]">Resultado</div></div>
                    <div className="rounded-xl bg-[#F7F9FC] p-2.5"><div className="text-sm font-extrabold text-[#0A2A66]">{item.score_dimensions.confidence}/15</div><div className="text-[8px] font-bold uppercase tracking-[.1em] text-[#7B8799]">Confianza</div></div>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <aside className="space-y-5">
          <section className="rounded-[24px] border border-[#E1E7EF] bg-white p-5 shadow-[0_10px_35px_rgba(10,42,102,.05)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[9px] font-extrabold uppercase tracking-[.13em] text-[#7B8799]">Ranking territorial</div>
                <h2 className="mt-1 text-lg font-extrabold text-[#0A2A66]">Gestión con mayor evidencia</h2>
              </div>
              <Trophy size={20} className="text-[#F5B700]" />
            </div>
            <div className="mt-5 space-y-3">
              {leaders.map((leader) => (
                <div key={leader.citizen_id} className="flex items-center gap-3 rounded-2xl bg-[#F7F9FC] p-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-sm font-extrabold text-[#0A2A66] shadow-sm">
                    {leader.rank <= 3 ? <Medal size={16} className="text-[#D98B00]" /> : leader.rank}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-extrabold text-[#0A2A66]">{leader.display_name}</div>
                    <div className="mt-1 text-[9px] font-semibold text-[#7B8799]">{leader.verified_actions} verificadas · {leader.evidence_count} evidencias</div>
                  </div>
                  <div className="text-right"><div className="text-lg font-extrabold text-[#0A2A66]">{leader.leader_score}</div><div className="text-[8px] font-bold uppercase text-[#7B8799]">impacto</div></div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[24px] border border-[#C9D8EA] bg-[#EDF3FA] p-5">
            <div className="flex items-center gap-2 text-[#0A2A66]"><BarChart3 size={17} /><span className="text-[10px] font-extrabold uppercase tracking-[.12em]">Cómo se calcula</span></div>
            <div className="mt-4 space-y-2 text-[11px] font-semibold text-[#526176]">
              {[['Evidencia', 25], ['Resultados', 20], ['Impacto', 15], ['Validación', 10], ['Confianza', 15]].map(([label, points]) => (
                <div key={String(label)} className="flex items-center justify-between"><span>{String(label)}</span><strong className="text-[#0A2A66]">{String(points)} pts</strong></div>
              ))}
              <div className="flex items-center justify-between"><span>Transparencia + colaboración + continuidad</span><strong className="text-[#0A2A66]">15 pts</strong></div>
            </div>
            <div className="mt-4 flex gap-2 rounded-xl bg-white/70 p-3 text-[10px] font-semibold leading-5 text-[#526176]"><CheckCircle2 size={15} className="mt-0.5 shrink-0 text-[#2BA745]" />Popularidad y seguidores no suman puntos.</div>
          </section>
        </aside>
      </div>
    </div>
  )
}
