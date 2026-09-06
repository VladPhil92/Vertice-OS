'use client'

import { useEffect, useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'
import {
  Activity,
  BadgeCheck,
  ClipboardCheck,
  FilePlus2,
  Loader2,
  MapPin,
  ShieldCheck,
  Target,
  Trophy,
  Users,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'

type CivicActionStatus =
  | 'proposed'
  | 'preparing'
  | 'in_progress'
  | 'result_declared'
  | 'under_verification'
  | 'verified'
  | 'not_completed'
  | 'no_evidence'
  | 'disputed'
  | 'cancelled'

type ConfidenceLevel = 'low' | 'medium' | 'high'

interface CivicAction {
  id: string
  actor: { id: string; display_name: string; neighborhood: string | null; actor_kind: string; organization: string | null }
  title: string
  problem: string
  objective: string
  category: string
  neighborhood: string | null
  beneficiaries_estimate: number | null
  status: CivicActionStatus
  result_summary: string | null
  target_date: string | null
  updated_at: string
  evidence_count: number
  collaborators_count: number
  community_validation: { corroborations: number; disputes: number; total: number }
  score_version: string
  civic_score: number
  confidence_score: number
  confidence_level: ConfidenceLevel
  evidence_level: number
}

interface LeaderEntry {
  actor_id: string
  display_name: string
  neighborhood: string | null
  actor_kind: string
  organization: string | null
  actions_count: number
  verified_actions: number
  evidence_count: number
  average_action_score: number
  average_confidence_score: number
  verification_rate: number
  leader_score: number
  rank: number
}

interface ListResponse<T> { data: T[]; count: number }
interface MetricCard { label: string; value: number; icon: LucideIcon }

const STATUS_META: Record<CivicActionStatus, { label: string; className: string }> = {
  proposed: { label: 'Propuesta', className: 'bg-[#EDF3FA] text-[#246CB6]' },
  preparing: { label: 'En preparación', className: 'bg-[#FFF4D1] text-[#8A6500]' },
  in_progress: { label: 'En ejecución', className: 'bg-[#E8F5FF] text-[#17699D]' },
  result_declared: { label: 'Resultado declarado', className: 'bg-[#F0ECFB] text-[#6650AA]' },
  under_verification: { label: 'En verificación', className: 'bg-[#FFF4D1] text-[#8A6500]' },
  verified: { label: 'Verificada', className: 'bg-[#EAF6ED] text-[#237D36]' },
  not_completed: { label: 'No completada', className: 'bg-[#F7F9FC] text-[#6D7890]' },
  no_evidence: { label: 'Sin evidencia', className: 'bg-[#FCEBED] text-[#A91D2E]' },
  disputed: { label: 'Disputada', className: 'bg-[#FCEBED] text-[#A91D2E]' },
  cancelled: { label: 'Cancelada', className: 'bg-[#F7F9FC] text-[#7B8799]' },
}

const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

export default function CivicActionsPage() {
  const [actions, setActions] = useState<CivicAction[]>([])
  const [leaders, setLeaders] = useState<LeaderEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      apiFetch<ListResponse<CivicAction>>('/civic-actions/mine?limit=50'),
      apiFetch<ListResponse<LeaderEntry>>('/civic-actions/leaderboard?limit=8', { public: true }),
    ])
      .then(([mine, ranking]) => {
        setActions(mine.data)
        setLeaders(ranking.data)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'No fue posible cargar las acciones cívicas.'))
      .finally(() => setLoading(false))
  }, [])

  const metricCards = useMemo<MetricCard[]>(() => {
    const active = actions.filter((action) => ['preparing', 'in_progress', 'result_declared', 'under_verification'].includes(action.status)).length
    const verified = actions.filter((action) => action.status === 'verified').length
    const evidence = actions.reduce((sum, action) => sum + action.evidence_count, 0)
    const avgScore = actions.length
      ? Math.round(actions.reduce((sum, action) => sum + action.civic_score, 0) / actions.length)
      : 0
    return [
      { label: 'En gestión', value: active, icon: Activity },
      { label: 'Verificadas', value: verified, icon: BadgeCheck },
      { label: 'Evidencias', value: evidence, icon: ShieldCheck },
      { label: 'Score medio', value: avgScore, icon: Target },
    ]
  }, [actions])

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      <section className="overflow-hidden rounded-[28px] bg-[#0A2A66] text-white shadow-[0_20px_55px_rgba(10,42,102,.16)]">
        <div className="grid h-1.5 grid-cols-3"><span className="bg-[#F5B700]" /><span className="bg-[#4A90E2]" /><span className="bg-[#D72638]" /></div>
        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center lg:p-9">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#F5B700]">Unidad central de VÉRTICE</div>
            <h1 className="mt-3 font-display text-3xl font-extrabold tracking-[-.04em] sm:text-4xl">Acciones cívicas con evidencia.</h1>
            <p className="mt-4 max-w-3xl text-sm font-medium leading-7 text-white/75">
              Registra un problema, define un objetivo, documenta la ejecución y demuestra el resultado. El score se calcula con una fórmula auditable; la confianza de la evidencia se muestra por separado.
            </p>
          </div>
          <Link href="/dashboard/community/actions/new" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#F5B700] px-5 text-xs font-extrabold text-[#0A2A66]">
            <FilePlus2 size={17} /> Nueva acción cívica
          </Link>
        </div>
      </section>

      <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metricCards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-[#E1E7EF] bg-white p-4 shadow-[0_8px_28px_rgba(10,42,102,.04)]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[9px] font-extrabold uppercase tracking-[.1em] text-[#7B8799]">{label}</span>
              <Icon size={15} className="text-[#4A90E2]" />
            </div>
            <div className="mt-3 text-2xl font-extrabold text-[#0A2A66]">{value}</div>
          </div>
        ))}
      </section>

      {loading && <div className="mt-6 flex min-h-[260px] items-center justify-center rounded-3xl border border-[#E1E7EF] bg-white"><Loader2 className="animate-spin text-[#4A90E2]" /></div>}
      {!loading && error && <div className="mt-6 rounded-3xl border border-[#F1C8CE] bg-[#FCEBED] p-5 text-sm font-semibold text-[#A91D2E]">{error}</div>}

      {!loading && !error && (
        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_330px]">
          <section>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-[.13em] text-[#7B8799]">Mi gestión</div>
                <h2 className="mt-1 text-xl font-extrabold text-[#0A2A66]">Trayectoria de acciones</h2>
              </div>
              <span className="text-[10px] font-semibold text-[#7B8799]">{actions.length} acciones</span>
            </div>

            {actions.length === 0 && (
              <div className="rounded-3xl border border-[#E1E7EF] bg-white p-8 text-center">
                <ClipboardCheck className="mx-auto text-[#4A90E2]" />
                <div className="mt-3 text-lg font-extrabold text-[#0A2A66]">Aún no has registrado una acción cívica.</div>
                <p className="mt-2 text-sm text-[#607087]">Empieza por un problema concreto del territorio y documenta cada paso.</p>
              </div>
            )}

            <div className="space-y-3">
              {actions.map((action) => {
                const status = STATUS_META[action.status]
                return (
                  <Link key={action.id} href={`/dashboard/community/actions/${action.id}`} className="block rounded-[24px] border border-[#E1E7EF] bg-white p-5 shadow-[0_10px_35px_rgba(10,42,102,.05)] transition hover:-translate-y-0.5 hover:border-[#C9D8EA] sm:p-6">
                    <div className="flex gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2.5 py-1 text-[9px] font-extrabold ${status.className}`}>{status.label}</span>
                          <span className="text-[9px] font-bold uppercase tracking-[.08em] text-[#7B8799]">{action.category}</span>
                        </div>
                        <h3 className="mt-3 text-lg font-extrabold leading-6 text-[#0A2A66]">{action.title}</h3>
                        <p className="mt-2 line-clamp-2 text-xs font-medium leading-6 text-[#607087]">{action.objective}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-3 text-[9px] font-semibold text-[#7B8799]">
                          {action.neighborhood && <span className="inline-flex items-center gap-1"><MapPin size={11} /> {action.neighborhood}</span>}
                          <span>{action.evidence_count} evidencias</span>
                          <span>{action.community_validation.corroborations} corroboraciones</span>
                          <span>Actualizada {formatDate(action.updated_at)}</span>
                        </div>
                      </div>
                      <div className="grid shrink-0 gap-2 text-center">
                        <div className="flex h-14 w-16 flex-col items-center justify-center rounded-2xl bg-[#EDF3FA]">
                          <span className="text-lg font-extrabold text-[#0A2A66]">{action.civic_score}</span>
                          <span className="text-[7px] font-extrabold uppercase text-[#7B8799]">score</span>
                        </div>
                        <div className="rounded-xl bg-[#F7F9FC] px-2 py-1.5 text-[8px] font-extrabold text-[#607087]">Conf. {CONFIDENCE_LABEL[action.confidence_level]} · {action.confidence_score}</div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-[24px] border border-[#E1E7EF] bg-white p-5 shadow-[0_10px_35px_rgba(10,42,102,.05)]">
              <div className="flex items-center justify-between gap-3"><div><div className="text-[9px] font-extrabold uppercase tracking-[.13em] text-[#7B8799]">Ranking territorial</div><h2 className="mt-1 text-lg font-extrabold text-[#0A2A66]">Impacto documentado</h2></div><Trophy size={20} className="text-[#F5B700]" /></div>
              <div className="mt-4 space-y-2.5">
                {leaders.map((leader) => (
                  <div key={leader.actor_id} className="flex items-center gap-3 rounded-2xl bg-[#F7F9FC] p-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-sm font-extrabold text-[#0A2A66]">{leader.rank}</div>
                    <div className="min-w-0 flex-1"><div className="truncate text-xs font-extrabold text-[#0A2A66]">{leader.display_name}</div><div className="mt-1 text-[9px] font-semibold text-[#7B8799]">{leader.verified_actions} verificadas · {leader.evidence_count} evidencias</div></div>
                    <div className="text-lg font-extrabold text-[#0A2A66]">{leader.leader_score}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[24px] border border-[#C9D8EA] bg-[#EDF3FA] p-5">
              <div className="flex items-center gap-2 text-[#0A2A66]"><Users size={16} /><span className="text-[10px] font-extrabold uppercase tracking-[.12em]">Regla del ranking</span></div>
              <p className="mt-3 text-[11px] font-semibold leading-6 text-[#526176]">Seguidores, likes e impresiones no suman reputación. El ranking usa acciones, evidencia, resultados y confianza verificable.</p>
            </section>
          </aside>
        </div>
      )}
    </div>
  )
}
