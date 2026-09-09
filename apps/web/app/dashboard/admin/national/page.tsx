'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, MapPinned, PauseCircle, RefreshCw, Rocket } from 'lucide-react'
import { apiFetch } from '@/lib/api'

type LaunchState = 'observing' | 'recruiting' | 'launch_ready' | 'launched' | 'paused'

interface LaunchNode {
  territory_code: string
  external_code: string | null
  name: string
  department_code: string | null
  activation_status: string
  operational_state: LaunchState
  readiness_score: number
  launch_ready: boolean
  blockers: string[]
  metrics: {
    active_citizens_30d: number
    creators_30d: number
    verified_actions_90d: number
    evidence_completion_pct: number
    report_resolution_pct: number
    local_leaders: number
    moderation_capacity: number
    active_cohort_members: number
  }
}

const STATE_LABEL: Record<LaunchState, string> = {
  observing: 'Observando',
  recruiting: 'Reclutando cohorte',
  launch_ready: 'Lista para lanzamiento',
  launched: 'Lanzada',
  paused: 'Pausada',
}

const BLOCKER_LABEL: Record<string, string> = {
  moderation_capacity: 'Capacidad de moderación',
  active_citizens: 'Ciudadanía activa',
  verified_actions: 'Acciones verificadas',
  local_leaders: 'Liderazgo local',
}

export default function NationalLaunchOperationsPage() {
  const [nodes, setNodes] = useState<LaunchNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'ready' | 'blocked' | 'launched'>('all')
  const [acting, setActing] = useState<string | null>(null)
  const [reason, setReason] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch<{ data: LaunchNode[] }>('/territories/admin/operations/board?limit=100')
      setNodes(res.data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible cargar las operaciones nacionales.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const visible = useMemo(() => nodes.filter((node) => {
    if (filter === 'ready') return node.launch_ready && node.operational_state !== 'launched'
    if (filter === 'blocked') return !node.launch_ready
    if (filter === 'launched') return node.operational_state === 'launched'
    return true
  }), [filter, nodes])

  async function transition(node: LaunchNode, next: LaunchState) {
    const transitionReason = reason[node.territory_code]?.trim()
    if (!transitionReason || transitionReason.length < 8) {
      setError('Cada transición operativa requiere una razón de al menos 8 caracteres.')
      return
    }
    setActing(node.territory_code)
    setError(null)
    try {
      await apiFetch(`/territories/admin/operations/${node.territory_code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operational_state: next, reason: transitionReason }),
      })
      setReason((current) => ({ ...current, [node.territory_code]: '' }))
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible actualizar el nodo.')
    } finally {
      setActing(null)
    }
  }

  const launched = nodes.filter((node) => node.operational_state === 'launched').length
  const ready = nodes.filter((node) => node.launch_ready && node.operational_state !== 'launched').length
  const blocked = nodes.filter((node) => !node.launch_ready).length

  return (
    <main className="space-y-6 p-4 md:p-7">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#7B8799]">Phase 7B · Operación nacional</div>
          <h1 className="mt-2 text-2xl font-black text-[#0A2A66]">National Launch Control Plane</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#607087]">
            Decide dónde desplegar capacidad operativa según evidencia cívica, liderazgo local y moderación disponible.
            Este panel no concede autoridad cívica ni elegibilidad electoral.
          </p>
        </div>
        <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-[#D8E1EC] bg-white px-4 py-2 text-xs font-bold text-[#0A2A66]">
          <RefreshCw size={14} /> Actualizar
        </button>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Nodos lanzados" value={launched} icon={<Rocket size={17} />} />
        <MetricCard label="Listos para lanzamiento" value={ready} icon={<CheckCircle2 size={17} />} />
        <MetricCard label="Con bloqueadores" value={blocked} icon={<AlertTriangle size={17} />} />
      </section>

      <div className="flex flex-wrap gap-2">
        {(['all', 'ready', 'blocked', 'launched'] as const).map((value) => (
          <button key={value} onClick={() => setFilter(value)} className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${filter === value ? 'bg-[#0A2A66] text-white' : 'border border-[#D8E1EC] bg-white text-[#607087]'}`}>
            {value === 'all' ? 'Todos' : value === 'ready' ? 'Listos' : value === 'blocked' ? 'Bloqueados' : 'Lanzados'}
          </button>
        ))}
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="grid gap-3 lg:grid-cols-2">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-64 animate-pulse rounded-2xl bg-white" />)}</div>
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {visible.map((node) => (
            <article key={node.territory_code} className="rounded-2xl border border-[#E1E7EF] bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="rounded-xl bg-[#EAF1FB] p-2.5 text-[#0A2A66]"><MapPinned size={18} /></span>
                  <div>
                    <h2 className="font-extrabold text-[#0A2A66]">{node.name}</h2>
                    <div className="mt-1 text-[10px] font-bold uppercase tracking-[.1em] text-[#7B8799]">{node.external_code ?? node.territory_code} · {STATE_LABEL[node.operational_state]}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-[#0A2A66]">{Math.round(node.readiness_score)}</div>
                  <div className="text-[9px] font-bold uppercase text-[#9AA5B4]">readiness</div>
                </div>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#EDF1F6]">
                <div className="h-full rounded-full bg-[#0A2A66]" style={{ width: `${Math.max(0, Math.min(100, node.readiness_score))}%` }} />
              </div>

              <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                <MiniMetric label="Activos" value={node.metrics.active_citizens_30d} />
                <MiniMetric label="Acciones ✓" value={node.metrics.verified_actions_90d} />
                <MiniMetric label="Líderes" value={node.metrics.local_leaders} />
                <MiniMetric label="Moderación" value={node.metrics.moderation_capacity} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-[10px] text-[#607087]">
                <div className="rounded-xl bg-[#F7F9FC] p-2.5">Evidencia: <strong>{node.metrics.evidence_completion_pct}%</strong></div>
                <div className="rounded-xl bg-[#F7F9FC] p-2.5">Resolución: <strong>{node.metrics.report_resolution_pct}%</strong></div>
              </div>

              {node.blockers.length > 0 ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800">
                  <strong>Bloqueadores:</strong> {node.blockers.map((blocker) => BLOCKER_LABEL[blocker] ?? blocker).join(' · ')}
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[11px] font-semibold text-emerald-800">Sin bloqueadores operativos.</div>
              )}

              <div className="mt-4 flex gap-2">
                <input
                  value={reason[node.territory_code] ?? ''}
                  onChange={(event) => setReason((current) => ({ ...current, [node.territory_code]: event.target.value }))}
                  placeholder="Razón auditable de la transición"
                  className="min-w-0 flex-1 rounded-xl border border-[#D8E1EC] px-3 py-2 text-xs outline-none focus:border-[#0A2A66]"
                />
                {node.operational_state !== 'launched' ? (
                  <button disabled={acting === node.territory_code || !node.launch_ready} onClick={() => void transition(node, 'launched')} className="rounded-xl bg-[#0A2A66] px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">
                    Lanzar
                  </button>
                ) : (
                  <button disabled={acting === node.territory_code} onClick={() => void transition(node, 'paused')} className="inline-flex items-center gap-1 rounded-xl border border-[#D8E1EC] px-3 py-2 text-xs font-bold text-[#607087] disabled:opacity-40">
                    <PauseCircle size={13} /> Pausar
                  </button>
                )}
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  )
}

function MetricCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <div className="rounded-2xl border border-[#E1E7EF] bg-white p-4"><div className="flex items-center justify-between text-[#7B8799]">{icon}<span className="text-2xl font-black text-[#0A2A66]">{value}</span></div><div className="mt-2 text-[10px] font-bold uppercase tracking-[.1em] text-[#7B8799]">{label}</div></div>
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl bg-[#F7F9FC] px-2 py-2"><div className="font-black text-[#0A2A66]">{value}</div><div className="mt-0.5 text-[8px] font-bold uppercase text-[#9AA5B4]">{label}</div></div>
}
