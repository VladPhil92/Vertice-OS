'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, BadgeCheck, RefreshCw } from 'lucide-react'
import { apiFetch } from '@/lib/api'

interface CivicEvidenceAttentionItem {
  id: string
  title: string
  status: string
  updated_at: string
  reason: 'evidence_required'
  reason_label: string
  href: string
}

interface CivicEvidenceAttentionQueue {
  total: number
  items: CivicEvidenceAttentionItem[]
}

const STATUS_LABEL: Record<string, string> = {
  in_progress: 'En ejecución',
  result_declared: 'Resultado declarado',
  under_verification: 'En verificación',
  no_evidence: 'Sin evidencia suficiente',
  disputed: 'Disputada',
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

export default function DashboardEvidenceAttentionQueue() {
  const [queue, setQueue] = useState<CivicEvidenceAttentionQueue | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setQueue(await apiFetch<CivicEvidenceAttentionQueue>('/dashboard/me/attention'))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible cargar los pendientes de evidencia.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading || (queue?.total ?? 0) === 0) return null

  if (error) {
    return (
      <div className="bg-[#F7F9FC] px-4 pt-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 rounded-2xl border border-[#F1DEA5] bg-[#FFF9E8] p-4 text-sm text-[#705400]">
          <div className="flex items-center gap-3">
            <AlertTriangle size={18} className="flex-shrink-0" />
            <span>No pudimos cargar la bandeja de evidencia. El resto del dashboard sigue disponible.</span>
          </div>
          <button onClick={() => void load()} className="inline-flex flex-shrink-0 items-center gap-1.5 font-extrabold text-[#0A2A66]">
            <RefreshCw size={14} /> Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (!queue || queue.items.length === 0) return null

  const remaining = Math.max(0, queue.total - queue.items.length)

  return (
    <section
      className="bg-[#F7F9FC] px-4 pt-5 sm:px-6 lg:px-8"
      aria-labelledby="evidence-attention-title"
      data-testid="evidence-attention-queue"
    >
      <div className="mx-auto max-w-7xl overflow-hidden rounded-[24px] border border-[#F1DEA5] bg-[#FFFDF6] shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#F1E5BD] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <div className="flex items-center gap-2 text-[#8C6500]">
              <BadgeCheck size={17} />
              <span className="text-[10px] font-extrabold uppercase tracking-[.14em]">Bandeja de evidencia</span>
            </div>
            <h2 id="evidence-attention-title" className="mt-1 text-lg font-extrabold text-[#0A2A66]">
              Resuelve {queue.total} {queue.total === 1 ? 'pendiente' : 'pendientes'} con una acción concreta
            </h2>
          </div>
          <Link href="/dashboard/community/actions" className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[.08em] text-[#0A2A66]">
            Ver todas <ArrowRight size={12} />
          </Link>
        </div>

        <div className="grid gap-3 p-4 sm:p-5 lg:grid-cols-2 xl:grid-cols-3">
          {queue.items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="group rounded-2xl border border-[#E6D9AF] bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#D2B95F] hover:shadow-md"
              aria-label={`Resolver evidencia: ${item.title}`}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="rounded-full bg-[#FFF4D1] px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[.07em] text-[#8C6500]">
                  {STATUS_LABEL[item.status] ?? item.status}
                </span>
                <ArrowRight size={14} className="mt-1 flex-shrink-0 text-[#94A0B0] transition group-hover:translate-x-0.5 group-hover:text-[#0A2A66]" />
              </div>
              <h3 className="mt-3 line-clamp-2 text-sm font-extrabold leading-5 text-[#0A2A66]">{item.title}</h3>
              <p className="mt-2 text-xs leading-5 text-[#607087]">{item.reason_label}</p>
              <div className="mt-3 text-[9px] font-bold uppercase tracking-[.06em] text-[#8C98A8]">
                Actualizada {formatDate(item.updated_at)}
              </div>
            </Link>
          ))}
        </div>

        {remaining > 0 && (
          <div className="border-t border-[#F1E5BD] px-5 py-3 text-center text-[10px] font-semibold text-[#607087]">
            Hay {remaining} {remaining === 1 ? 'pendiente adicional' : 'pendientes adicionales'} en tu lista de acciones cívicas.
          </div>
        )}
      </div>
    </section>
  )
}
