'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarClock, Download, Gauge, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import { apiFetch, BASE_URL } from '@/lib/api'

type BillingAccess = {
  plan: {
    code: 'free' | 'pro'
    name: string
    limits: {
      evidenceStorageMb: number
      aiRequestsPerMonth: number
      scheduledPostsPerMonth: number
    }
  }
}

type Metric = {
  used: number | null
  limit: number
  remaining: number | null
  percent: number | null
  enforced: boolean
  source: string
}

type UsageSnapshot = {
  planCode: 'free' | 'pro'
  period: { start: string; endExclusive: string; timezone: string }
  metrics: {
    aiRequestsPerMonth: Metric
    activeProjects: Metric
    evidenceStorageMb: Metric
    scheduledPostsPerMonth: Metric
  }
}

type Publication = {
  id: string
  title: string
  body: string
  neighborhood: string | null
  status: 'scheduled' | 'published' | 'cancelled' | 'failed'
  scheduled_for: string
  published_at: string | null
  created_at: string
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('es-CO').format(value)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function MetricCard({ title, description, metric, formatter = formatNumber }: {
  title: string
  description: string
  metric: Metric
  formatter?: (value: number) => string
}) {
  const measured = metric.used !== null
  return (
    <article className="rounded-2xl border border-[#DCE5EF] bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-black text-[#0A2A66]">{title}</h3>
          <p className="mt-1 text-xs font-medium leading-5 text-[#607087]">{description}</p>
        </div>
        <div className="text-right text-xs font-black text-[#0A2A66]">
          {metric.used !== null ? `${formatter(metric.used)} / ${formatter(metric.limit)}` : `Capacidad: ${formatter(metric.limit)}`}
        </div>
      </div>
      {measured && (
        <>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#EAF1FB]">
            <div className="h-full rounded-full bg-[#0A2A66] transition-all" style={{ width: `${metric.percent}%` }} />
          </div>
          <div className="mt-2 text-[10px] font-bold uppercase tracking-[.08em] text-[#7B8799]">
            {metric.percent}% usado · {formatter(metric.remaining ?? 0)} disponible
          </div>
        </>
      )}
    </article>
  )
}

export default function OperationsPage() {
  const [access, setAccess] = useState<BillingAccess | null>(null)
  const [usage, setUsage] = useState<UsageSnapshot | null>(null)
  const [publications, setPublications] = useState<Publication[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [action, setAction] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [scheduledFor, setScheduledFor] = useState('')

  const isPro = access?.plan.code === 'pro'

  const load = useCallback(async () => {
    setError(null)
    const [nextAccess, nextUsage] = await Promise.all([
      apiFetch<BillingAccess>('/billing/me'),
      apiFetch<UsageSnapshot>('/billing/me/usage'),
    ])
    setAccess(nextAccess)
    setUsage(nextUsage)

    if (nextAccess.plan.code === 'pro') {
      const result = await apiFetch<{ publications: Publication[] }>('/publishing/scheduled')
      setPublications(result.publications)
    } else {
      setPublications([])
    }
  }, [])

  useEffect(() => {
    load()
      .catch((err) => setError(err instanceof Error ? err.message : 'No fue posible cargar la capacidad operativa.'))
      .finally(() => setLoading(false))
  }, [load])

  const activeScheduled = useMemo(
    () => publications.filter((publication) => publication.status === 'scheduled'),
    [publications],
  )

  async function schedulePublication() {
    if (!title.trim() || body.trim().length < 20 || !scheduledFor) return
    setAction('schedule')
    setError(null)
    try {
      const scheduled = new Date(scheduledFor)
      if (Number.isNaN(scheduled.getTime())) throw new Error('Selecciona una fecha válida.')
      await apiFetch('/publishing/scheduled', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          neighborhood: neighborhood.trim() || null,
          scheduled_for: scheduled.toISOString(),
        }),
      })
      setTitle('')
      setBody('')
      setNeighborhood('')
      setScheduledFor('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible programar la publicación.')
    } finally {
      setAction(null)
    }
  }

  async function cancelPublication(id: string) {
    setAction(id)
    setError(null)
    try {
      await apiFetch(`/publishing/scheduled/${id}`, { method: 'DELETE' })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cancelar la publicación.')
    } finally {
      setAction(null)
    }
  }

  async function downloadExport() {
    setAction('export')
    setError(null)
    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch(`${BASE_URL}/dashboard/me/export.csv`, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (!response.ok) throw new Error(response.status === 403 ? 'La exportación requiere VÉRTICE Pro.' : 'No fue posible generar la exportación.')
      const blob = await response.blob()
      const disposition = response.headers.get('content-disposition') ?? ''
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? 'vertice-operacion.csv'
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible exportar la información.')
    } finally {
      setAction(null)
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8"><div className="h-72 animate-pulse rounded-3xl bg-white" /></div>
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-10" data-testid="operational-capacity-center">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.15em] text-[#7B8799]"><Gauge size={14} /> Operación · Capacidad</div>
          <h1 className="mt-2 text-3xl font-black tracking-[-.035em] text-[#0A2A66]">Capacidad operativa</h1>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#607087]">Uso real del plan, exportaciones y automatizaciones. Ninguna de estas métricas modifica reputación, voto o ranking.</p>
        </div>
        <button type="button" onClick={() => void load()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#DCE5EF] bg-white px-4 text-xs font-black text-[#0A2A66]">
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>

      {error && <div className="mt-6 rounded-2xl border border-[#F0C7CB] bg-[#FFF7F8] p-4 text-sm font-semibold text-[#A51E2D]">{error}</div>}

      {usage && (
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          <MetricCard title="IA cívica" description="Solicitudes de IA completadas durante el mes actual." metric={usage.metrics.aiRequestsPerMonth} />
          <MetricCard
            title="Almacenamiento de evidencia"
            description="Capacidad contratada. El consumo por bytes se habilitará cuando el proveedor exponga tamaño verificable del activo."
            metric={usage.metrics.evidenceStorageMb}
            formatter={(mb) => `${formatNumber(mb)} MB`}
          />
          <MetricCard title="Automatizaciones" description="Publicaciones programadas creadas durante el mes." metric={usage.metrics.scheduledPostsPerMonth} />
        </div>
      )}

      {!isPro ? (
        <section className="mt-8 rounded-[28px] border border-[#DCE5EF] bg-white p-7">
          <h2 className="text-xl font-black text-[#0A2A66]">Capacidad Free activa</h2>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#607087]">Puedes usar las capacidades cívicas esenciales sin costo. Exportaciones operativas y automatización son herramientas Pro y no alteran tu reputación.</p>
          <Link href="/dashboard/billing" className="mt-5 inline-flex rounded-xl bg-[#0A2A66] px-5 py-3 text-xs font-black text-white">Ver opciones de capacidad</Link>
        </section>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
          <section className="rounded-[28px] border border-[#DCE5EF] bg-white p-6">
            <h2 className="text-lg font-black text-[#0A2A66]">Exportación operativa</h2>
            <p className="mt-2 text-xs font-medium leading-5 text-[#607087]">Descarga un CSV con tu operación cívica actual: atención, acciones, expedientes, reportes e iniciativas.</p>
            <button type="button" disabled={action === 'export'} onClick={() => void downloadExport()} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0A2A66] px-4 text-xs font-black text-white disabled:opacity-60">
              {action === 'export' ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Exportar CSV
            </button>
          </section>

          <section className="rounded-[28px] border border-[#DCE5EF] bg-white p-6">
            <div className="flex items-center gap-2"><CalendarClock size={18} className="text-[#0A2A66]" /><h2 className="text-lg font-black text-[#0A2A66]">Programar actualización cívica</h2></div>
            <p className="mt-2 text-xs font-medium leading-5 text-[#607087]">La publicación aparecerá automáticamente en Red Cívica. Publicar no suma reputación ni entra al ranking de liderazgo.</p>
            <div className="mt-5 grid gap-3">
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Título" className="min-h-11 rounded-xl border border-[#DCE5EF] px-3 text-sm outline-none focus:border-[#0A2A66]" />
              <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Actualización, contexto o avance verificable…" rows={5} className="rounded-xl border border-[#DCE5EF] px-3 py-3 text-sm outline-none focus:border-[#0A2A66]" />
              <div className="grid gap-3 sm:grid-cols-2">
                <input value={neighborhood} onChange={(event) => setNeighborhood(event.target.value)} placeholder="Barrio (opcional)" className="min-h-11 rounded-xl border border-[#DCE5EF] px-3 text-sm outline-none focus:border-[#0A2A66]" />
                <input type="datetime-local" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} className="min-h-11 rounded-xl border border-[#DCE5EF] px-3 text-sm outline-none focus:border-[#0A2A66]" />
              </div>
              <button type="button" disabled={action === 'schedule' || !title.trim() || body.trim().length < 20 || !scheduledFor} onClick={() => void schedulePublication()} className="min-h-11 rounded-xl bg-[#F5B700] px-4 text-xs font-black text-[#0A2A66] disabled:cursor-not-allowed disabled:opacity-50">
                {action === 'schedule' ? 'Programando…' : 'Programar publicación'}
              </button>
            </div>
          </section>
        </div>
      )}

      {isPro && (
        <section className="mt-8 rounded-[28px] border border-[#DCE5EF] bg-white p-6">
          <div className="flex items-center justify-between gap-3">
            <div><h2 className="text-lg font-black text-[#0A2A66]">Cola programada</h2><p className="mt-1 text-xs font-medium text-[#607087]">{activeScheduled.length} pendientes · {publications.length} registros recientes</p></div>
          </div>
          <div className="mt-5 space-y-3">
            {publications.length === 0 ? <p className="rounded-xl bg-[#F7F9FC] p-5 text-sm font-medium text-[#607087]">Aún no tienes publicaciones programadas.</p> : publications.map((publication) => (
              <article key={publication.id} className="flex flex-col gap-3 rounded-2xl border border-[#E1E7EF] p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-black text-[#0A2A66]">{publication.title}</div>
                  <div className="mt-1 text-xs font-medium text-[#607087]">{publication.status === 'published' ? `Publicada ${publication.published_at ? formatDate(publication.published_at) : ''}` : `Programada para ${formatDate(publication.scheduled_for)}`}</div>
                </div>
                <span className="rounded-full bg-[#F7F9FC] px-3 py-1 text-[10px] font-black uppercase tracking-[.08em] text-[#607087]">{publication.status}</span>
                {publication.status === 'scheduled' && <button type="button" disabled={action === publication.id} onClick={() => void cancelPublication(publication.id)} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#F0C7CB] text-[#A51E2D] disabled:opacity-50" aria-label={`Cancelar ${publication.title}`}><Trash2 size={15} /></button>}
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
