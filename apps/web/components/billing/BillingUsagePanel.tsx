'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, Bot, FolderKanban, HardDrive, RefreshCw, Send } from 'lucide-react'
import { apiFetch } from '@/lib/api'

type UsageMetric = {
  used: number | null
  limit: number
  remaining: number | null
  percent: number | null
  enforced: boolean
  source: string
}

type BillingUsage = {
  planCode: 'free' | 'pro'
  period: {
    start: string
    endExclusive: string
    timezone: string
  }
  metrics: {
    aiRequestsPerMonth: UsageMetric
    activeProjects: UsageMetric
    evidenceStorageMb: UsageMetric
    scheduledPostsPerMonth: UsageMetric
  }
  neutrality: {
    usageChangesReputation: false
    subscriptionChangesReputation: false
  }
}

type MetricKey = keyof BillingUsage['metrics']

const METRIC_META: Record<MetricKey, { label: string; icon: typeof Bot; unit?: string }> = {
  aiRequestsPerMonth: { label: 'Solicitudes de IA', icon: Bot },
  activeProjects: { label: 'Proyectos activos', icon: FolderKanban },
  evidenceStorageMb: { label: 'Almacenamiento de evidencia', icon: HardDrive, unit: 'MB' },
  scheduledPostsPerMonth: { label: 'Publicaciones programadas', icon: Send },
}

function formatPeriod(start: string, endExclusive: string) {
  const startDate = new Date(`${start}T05:00:00.000Z`)
  const endDate = new Date(`${endExclusive}T05:00:00.000Z`)
  endDate.setUTCDate(endDate.getUTCDate() - 1)
  const formatter = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Bogota' })
  return `${formatter.format(startDate)} – ${formatter.format(endDate)}`
}

function UsageCard({ metricKey, metric }: { metricKey: MetricKey; metric: UsageMetric }) {
  const meta = METRIC_META[metricKey]
  const Icon = meta.icon
  const measured = metric.used !== null
  const usageLabel = measured
    ? `${metric.used.toLocaleString('es-CO')} / ${metric.limit.toLocaleString('es-CO')}${meta.unit ? ` ${meta.unit}` : ''}`
    : `Capacidad: ${metric.limit.toLocaleString('es-CO')}${meta.unit ? ` ${meta.unit}` : ''}`

  return (
    <article className="rounded-2xl border border-[#DCE5EF] bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EEF4FC] text-[#0A2A66]"><Icon size={17} /></span>
          <div>
            <h3 className="text-xs font-black text-[#0A2A66]">{meta.label}</h3>
            <p className="mt-1 text-[10px] font-semibold text-[#8A98AA]">{metric.enforced ? 'Límite aplicado por backend' : measured ? 'Consumo observado' : 'Capacidad declarada del plan'}</p>
          </div>
        </div>
        {metric.enforced && <span className="rounded-full bg-[#EAF6ED] px-2.5 py-1 text-[9px] font-black uppercase tracking-[.08em] text-[#237D36]">Enforced</span>}
      </div>

      <div className="mt-5 text-xl font-black text-[#0A2A66]">{usageLabel}</div>
      {measured ? (
        <>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#EDF1F5]">
            <div className="h-full rounded-full bg-[#4A90E2] transition-[width]" style={{ width: `${metric.percent ?? 0}%` }} />
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] font-semibold text-[#7B8799]">
            <span>{metric.percent ?? 0}% utilizado</span>
            <span>{metric.remaining ?? 0} disponibles</span>
          </div>
        </>
      ) : (
        <p className="mt-3 text-[10px] font-semibold leading-5 text-[#7B8799]">VÉRTICE todavía no mide este consumo de forma confiable. Se muestra la capacidad del plan sin inventar un uso de 0.</p>
      )}
    </article>
  )
}

export function BillingUsagePanel() {
  const [usage, setUsage] = useState<BillingUsage | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    setError(null)
    try {
      setUsage(await apiFetch<BillingUsage>('/billing/me/usage'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible consultar el consumo del plan.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const periodLabel = useMemo(() => usage ? formatPeriod(usage.period.start, usage.period.endExclusive) : null, [usage])

  if (loading) {
    return <div className="mt-7 h-44 animate-pulse rounded-[24px] border border-[#E1E7EF] bg-white" />
  }

  return (
    <section data-testid="billing-usage-meter" className="mt-7 rounded-[28px] border border-[#DCE5EF] bg-[#F7F9FC] p-5 sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.13em] text-[#246CB6]"><Activity size={14} /> Consumo operacional</div>
          <h2 className="mt-2 text-xl font-black text-[#0A2A66]">Uso real de tu capacidad {usage?.planCode === 'pro' ? 'Pro' : 'Free'}</h2>
          <p className="mt-2 text-xs font-semibold text-[#607087]">{periodLabel ?? 'Periodo mensual'} · America/Bogota. La suscripción amplía capacidad; nunca compra reputación.</p>
        </div>
        <button type="button" onClick={() => void load(true)} disabled={refreshing} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#C9D6E5] bg-white px-4 text-[10px] font-black uppercase tracking-[.06em] text-[#0A2A66] disabled:opacity-50">
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> Actualizar uso
        </button>
      </div>

      {error ? (
        <div className="mt-5 rounded-2xl border border-[#F0C7CB] bg-[#FFF7F8] p-4 text-xs font-semibold text-[#A51E2D]">La facturación sigue disponible, pero el medidor de uso no respondió: {error}</div>
      ) : usage ? (
        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {(Object.keys(usage.metrics) as MetricKey[]).map((key) => <UsageCard key={key} metricKey={key} metric={usage.metrics[key]} />)}
        </div>
      ) : null}
    </section>
  )
}
