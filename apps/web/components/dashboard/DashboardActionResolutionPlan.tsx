'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileCheck2,
  Loader2,
  PlayCircle,
  RefreshCw,
  Route,
} from 'lucide-react'
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
  const [workingId, setWorkingId] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [resultDrafts, setResultDrafts] = useState<Record<string, string>>({})
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    setError(null)
    try {
      setPlan(await apiFetch<CivicResolutionPlan>('/dashboard/me/resolution'))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible cargar el plan de resolución.')
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function clearActionError(actionId: string) {
    setActionErrors((current) => {
      if (!current[actionId]) return current
      const next = { ...current }
      delete next[actionId]
      return next
    })
  }

  async function reopenExecution(item: CivicResolutionItem) {
    setWorkingId(item.id)
    clearActionError(item.id)
    setNotice(null)
    try {
      await apiFetch(`/civic-actions/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'in_progress' }),
      })
      setConfirmingId(null)
      setNotice(`“${item.title}” volvió a ejecución. El plan fue recalculado.`)
      await load(false)
    } catch (cause) {
      setActionErrors((current) => ({
        ...current,
        [item.id]: cause instanceof Error ? cause.message : 'No fue posible reabrir esta acción.',
      }))
    } finally {
      setWorkingId(null)
    }
  }

  async function declareResult(item: CivicResolutionItem) {
    const resultSummary = (resultDrafts[item.id] ?? '').trim()
    if (resultSummary.length < 10) {
      setActionErrors((current) => ({
        ...current,
        [item.id]: 'Describe el resultado observable con al menos 10 caracteres.',
      }))
      return
    }

    setWorkingId(item.id)
    clearActionError(item.id)
    setNotice(null)
    try {
      await apiFetch(`/civic-actions/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'result_declared',
          result_summary: resultSummary,
        }),
      })
      setConfirmingId(null)
      setResultDrafts((current) => ({ ...current, [item.id]: '' }))
      setNotice(`Resultado declarado para “${item.title}”. El plan fue recalculado.`)
      await load(false)
    } catch (cause) {
      setActionErrors((current) => ({
        ...current,
        [item.id]: cause instanceof Error ? cause.message : 'No fue posible declarar el resultado.',
      }))
    } finally {
      setWorkingId(null)
    }
  }

  if (loading) return null

  if (error) {
    return (
      <div className="bg-[#F7F9FC] px-4 pt-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 rounded-2xl border border-[#D8E1EC] bg-white p-4 text-sm text-[#607087] shadow-sm">
          <div className="flex items-center gap-3">
            <AlertTriangle size={18} className="flex-shrink-0 text-[#D98B00]" />
            <span>No pudimos cargar el plan de resolución. El Centro Ciudadano sigue disponible.</span>
          </div>
          <button type="button" onClick={() => void load()} className="inline-flex flex-shrink-0 items-center gap-1.5 font-extrabold text-[#0A2A66]">
            <RefreshCw size={14} /> Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (!plan || plan.total === 0 || plan.items.length === 0) {
    if (!notice) return null
    return (
      <div className="bg-[#F7F9FC] px-4 pt-5 sm:px-6 lg:px-8" aria-live="polite">
        <div className="mx-auto flex max-w-7xl items-center gap-3 rounded-2xl border border-[#CBE9D1] bg-[#EAF6ED] p-4 text-sm font-semibold text-[#237D36]">
          <CheckCircle2 size={18} className="flex-shrink-0" /> {notice}
        </div>
      </div>
    )
  }

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
              <span className="text-[10px] font-extrabold uppercase tracking-[.14em]">Plan de resolución · ejecución v5</span>
            </div>
            <h2 id="action-resolution-title" className="mt-1 text-lg font-extrabold text-[#0A2A66]">
              Completa el siguiente paso de {plan.total} {plan.total === 1 ? 'acción' : 'acciones'}
            </h2>
            <p className="mt-1 text-xs leading-5 text-[#607087]">
              Reabrir y declarar resultados pueden ejecutarse aquí con confirmación. La evidencia compleja permanece en su workspace trazable.
            </p>
          </div>
          <Link href="/dashboard/community/actions" className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[.08em] text-[#0A2A66]">
            Ver acciones <ArrowRight size={12} />
          </Link>
        </div>

        {notice && (
          <div className="border-b border-[#CBE9D1] bg-[#EAF6ED] px-5 py-3 text-xs font-semibold text-[#237D36]" aria-live="polite">
            {notice}
          </div>
        )}

        <div className="grid gap-3 p-4 sm:p-5 lg:grid-cols-2 xl:grid-cols-3">
          {plan.items.map((item) => {
            const isWorking = workingId === item.id
            const isConfirming = confirmingId === item.id
            const itemError = actionErrors[item.id]

            return (
              <article
                key={item.id}
                className="flex min-h-[250px] flex-col rounded-2xl border border-[#E1E7EF] bg-[#FBFCFE] p-4"
                data-testid={`resolution-item-${item.id}`}
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

                {itemError && (
                  <div className="mt-3 rounded-xl border border-[#F1C8CE] bg-[#FCEBED] px-3 py-2 text-[10px] font-semibold leading-4 text-[#A91D2E]" role="alert">
                    {itemError}
                  </div>
                )}

                {item.next_step === 'reopen_execution' && (
                  <div className="mt-4">
                    {isConfirming ? (
                      <div className="rounded-xl border border-[#F1DEA5] bg-[#FFF9E8] p-3">
                        <p className="text-[10px] font-semibold leading-4 text-[#705400]">
                          Confirma que quieres devolver esta acción a ejecución. No elimina evidencia ni cambia su reputación por sí sola.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={isWorking}
                            onClick={() => void reopenExecution(item)}
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#0A2A66] px-3 text-[9px] font-extrabold text-white disabled:opacity-50"
                          >
                            {isWorking ? <Loader2 size={12} className="animate-spin" /> : <PlayCircle size={12} />}
                            Confirmar reabrir
                          </button>
                          <button
                            type="button"
                            disabled={isWorking}
                            onClick={() => setConfirmingId(null)}
                            className="min-h-9 rounded-lg border border-[#D8E1EC] bg-white px-3 text-[9px] font-extrabold text-[#607087] disabled:opacity-50"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          clearActionError(item.id)
                          setConfirmingId(item.id)
                        }}
                        className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#0A2A66] px-4 text-[10px] font-extrabold text-white"
                      >
                        <PlayCircle size={14} /> Reabrir ahora
                      </button>
                    )}
                  </div>
                )}

                {item.next_step === 'declare_result' && (
                  <div className="mt-4">
                    {isConfirming ? (
                      <div className="rounded-xl border border-[#CBE9D1] bg-[#F3FAF5] p-3">
                        <label htmlFor={`result-${item.id}`} className="text-[9px] font-extrabold uppercase tracking-[.08em] text-[#237D36]">
                          Resultado observable
                        </label>
                        <textarea
                          id={`result-${item.id}`}
                          value={resultDrafts[item.id] ?? ''}
                          onChange={(event) => {
                            clearActionError(item.id)
                            setResultDrafts((current) => ({ ...current, [item.id]: event.target.value }))
                          }}
                          minLength={10}
                          rows={3}
                          placeholder="Describe qué cambió, qué se logró y cómo se relaciona con la evidencia ya adjunta."
                          className="mt-2 w-full rounded-lg border border-[#C8D8EE] bg-white px-3 py-2 text-xs leading-5 text-[#0A2A66] outline-none focus:border-[#4A90E2]"
                        />
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={isWorking}
                            onClick={() => void declareResult(item)}
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#2BA745] px-3 text-[9px] font-extrabold text-white disabled:opacity-50"
                          >
                            {isWorking ? <Loader2 size={12} className="animate-spin" /> : <FileCheck2 size={12} />}
                            Confirmar resultado
                          </button>
                          <button
                            type="button"
                            disabled={isWorking}
                            onClick={() => setConfirmingId(null)}
                            className="min-h-9 rounded-lg border border-[#D8E1EC] bg-white px-3 text-[9px] font-extrabold text-[#607087] disabled:opacity-50"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          clearActionError(item.id)
                          setConfirmingId(item.id)
                        }}
                        className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#2BA745] px-4 text-[10px] font-extrabold text-white"
                      >
                        <FileCheck2 size={14} /> Declarar resultado ahora
                      </button>
                    )}
                  </div>
                )}

                {item.next_step === 'attach_evidence' && (
                  <div className="mt-4">
                    <Link
                      href={item.href}
                      className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#0A2A66] px-4 text-[10px] font-extrabold text-white"
                      aria-label={`Adjuntar evidencia en workspace: ${item.title}`}
                    >
                      Abrir para adjuntar evidencia <ArrowRight size={12} />
                    </Link>
                  </div>
                )}

                <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                  <div className="text-[9px] font-bold uppercase tracking-[.06em] text-[#8C98A8]">
                    {item.evidence_count} {item.evidence_count === 1 ? 'evidencia' : 'evidencias'} · {formatDate(item.updated_at)}
                  </div>
                  <Link
                    href={item.href}
                    className="inline-flex items-center gap-1 text-[10px] font-extrabold text-[#0A2A66] hover:underline"
                    aria-label={`Abrir workspace: ${item.title}`}
                  >
                    Workspace <ArrowRight size={12} />
                  </Link>
                </div>
              </article>
            )
          })}
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
