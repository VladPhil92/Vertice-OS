'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, CheckCircle2, RefreshCw, Route } from 'lucide-react'
import { apiFetch } from '@/lib/api'

type ResolutionStep = 'reopen_execution' | 'attach_evidence' | 'declare_result'
type ResolutionPriority = 'urgent' | 'high' | 'normal'

interface CivicResolutionItem {
  id: string
  title: string
  status: string
  updated_at: string
  evidence_count: number
  next_step: ResolutionStep
  next_step_label: string
  detail: string
  follow_up_label: string
  priority: ResolutionPriority
  href: string
}

interface CivicResolutionPlan {
  total: number
  items: CivicResolutionItem[]
}

const STATUS_LABEL: Record<string, string> = {
  in_progress: 'En ejecución',
  result_declared: 'Resultado declarado',
  no_evidence: 'Sin evidencia suficiente',
  disputed: 'Disputada',
}

const PRIORITY_LABEL: Record<ResolutionPriority, string> = {
  urgent: 'Prioridad alta',
  high: 'Prioridad media',
  normal: 'Siguiente paso',
}

const PRIORITY_CLASS: Record<ResolutionPriority, string> = {
  urgent: 'border-[#F1C8CE] bg-[#FCEBED] text-[#A91D2E]',
  high: 'border-[#F1DEA5] bg-[#FFF4D1] text-[#8A6500]',
  normal: 'border-[#C8D8EE] bg-[#EDF3FA] text-[#246CB6]',
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Actualización pendiente'
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export default function DashboardActionResolutionPlan() {
  const [plan, setPlan] = useState<CivicResolutionPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setPlan(await apiFetch<CivicResolutionPlan>('/dashboard/me/resolution'))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible cargar el plan de resolución.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) return null

  if (error) {
    return (
      <div className="bg-[#F7F9FC] px-4 pt-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 rounded-2xl border border-[#D8E1EC] bg-white p-4 text-sm text-[#607087] shadow-sm">
          <div className="flex items-center gap-3">
            <AlertTriangle size={18} className="flex-shrink-0 text-[#D98B00]" />
            <span>No pudimos cargar el plan de resolución. El Centro Ciudadano sigue disponible.</span>
          </div>
          <button onClick={() => void load()} className="inline-flex flex-shrink-0 items-center gap-1.5 font-extrabold text-[#0A2A66]">
            <RefreshCw size={14} /> Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (!plan || plan.total === 0 || plan.items.length === 0) return null

  const remaining = Math.max(0, plan.total - plan.items.length)

  return (
    <section
      className="bg-[#F7F9FC] px-4 pt-5 sm:px-6 lg:px-8"
      aria-labelledby="action-resolution-title"
      data-testid="action-resolution-plan"
    >
      <div className="mx-auto max-w-7xl overflow-hidden rounded-[24px] border border-[#D8E1EC] bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#E5EAF0] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <div className="flex items-center gap-2 text-[#246CB6]">
              <Route size={17} />
              <span className="text-[10px] font-extrabold uppercase tracking-[.14em]">Plan de resolución</span>
            </div>
            <h2 id="action-resolution-title" className="mt-1 text-lg font-extrabold text-[#0A2A66]">
              Completa el siguiente paso de {plan.total} {plan.total === 1 ? 'acción' : 'acciones'}
            </h2>
            <p className="mt-1 text-xs leading-5 text-[#607087]">
              VÉRTICE prioriza el siguiente paso operativo sin modificar automáticamente estados, evidencia o reputación.
            </p>
          </div>
          <Link href="/dashboard/community/actions" className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[.08em] text-[#0A2A66]">
            Ver acciones <ArrowRight size={12} />
          </Link>
        </div>

        <div className="grid gap-3 p-4 sm:p-5 lg:grid-cols-2 xl:grid-cols-3">
          {plan.items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="group flex min-h-[220px] flex-col rounded-2xl border border-[#E1E7EF] bg-[#FBFCFE] p-4 transition hover:-translate-y-0.5 hover:border-[#BFD0E8] hover:bg-white hover:shadow-md"
              aria-label={`${item.next_step_label}: ${item.title}`}
            >
              <div className="flex items-start justify-between gap-3">
                <span className={`rounded-full border px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[.07em] ${PRIORITY_CLASS[item.priority]}`}>
                  {PRIORITY_LABEL[item.priority]}
                </span>
                <span className="text-[9px] font-bold uppercase tracking-[.06em] text-[#8C98A8]">
                  {STATUS_LABEL[item.status] ?? item.status}
                </span>
              </div>

              <h3 className="mt-3 line-clamp-2 text-sm font-extrabold leading-5 text-[#0A2A66]">{item.title}</h3>
              <div className="mt-3 rounded-xl bg-white p-3 ring-1 ring-[#E5EAF0]">
                <div className="text-[9px] font-extrabold uppercase tracking-[.09em] text-[#7B8799]">Haz ahora</div>
                <div className="mt-1 text-xs font-extrabold text-[#0A2A66]">{item.next_step_label}</div>
                <p className="mt-1 text-[11px] leading-5 text-[#607087]">{item.detail}</p>
              </div>

              <div className="mt-3 flex items-start gap-2 text-[10px] font-semibold leading-4 text-[#526176]">
                <CheckCircle2 size={13} className="mt-0.5 flex-shrink-0 text-[#2BA745]" />
                <span>{item.follow_up_label}</span>
              </div>

              <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                <div className="text-[9px] font-bold uppercase tracking-[.06em] text-[#8C98A8]">
                  {item.evidence_count} {item.evidence_count === 1 ? 'evidencia' : 'evidencias'} · {formatDate(item.updated_at)}
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-[#0A2A66]">
                  Abrir <ArrowRight size={12} className="transition group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>

        {remaining > 0 && (
          <div className="border-t border-[#E5EAF0] px-5 py-3 text-center text-[10px] font-semibold text-[#607087]">
            Hay {remaining} {remaining === 1 ? 'acción adicional' : 'acciones adicionales'} con un siguiente paso pendiente.
          </div>
        )}
      </div>
    </section>
  )
}
