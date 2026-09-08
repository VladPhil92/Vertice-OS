'use client'

import { FileText, Loader2, Plus, AlertTriangle, Map } from 'lucide-react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'

type ReportStatus = 'open' | 'in_progress' | 'resolved' | 'rejected' | 'duplicate'

type Category =
  | 'infraestructura'
  | 'servicios_publicos'
  | 'seguridad'
  | 'medio_ambiente'
  | 'transporte'
  | 'salud'
  | 'educacion'
  | 'cultura'
  | 'otro'

interface Report {
  id: string
  category: Category
  subcategory?: string
  title: string
  description: string
  neighborhood?: string
  locality_id?: string
  status: ReportStatus
  urgency_score?: number
  media_urls: string[]
  created_at: string
  lat: number
  lng: number
}

interface ApiResponse {
  data: Report[]
  count: number
}

const CATEGORY_LABELS: Record<Category, string> = {
  infraestructura: 'Infraestructura',
  servicios_publicos: 'Servicios Públicos',
  seguridad: 'Seguridad',
  medio_ambiente: 'Medio Ambiente',
  transporte: 'Transporte',
  salud: 'Salud',
  educacion: 'Educación',
  cultura: 'Cultura',
  otro: 'Otro',
}

const STATUS_LABELS: Record<ReportStatus, string> = {
  open: 'Abierto',
  in_progress: 'En gestión',
  resolved: 'Resuelto',
  rejected: 'Rechazado',
  duplicate: 'Duplicado',
}

const STATUS_CLASS: Record<ReportStatus, string> = {
  open: 'text-cyan',
  in_progress: 'text-gold',
  resolved: 'text-tertiary',
  rejected: 'text-red-400',
  duplicate: 'text-tertiary',
}

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS_ES[d.getMonth()]} ${d.getFullYear()}`
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}…`
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterCategory, setFilterCategory] = useState<Category | 'all'>('all')
  const [filterStatus, setFilterStatus] = useState<ReportStatus | 'all'>('all')

  useEffect(() => {
    async function fetchReports() {
      setLoading(true)
      setError(null)
      try {
        const data = await apiFetch<ApiResponse>('/territorial/reports?limit=100&offset=0', { public: true })
        setReports(data.data ?? [])
      } catch {
        setError('No se pudieron cargar los reportes. Verifica la conexión e intenta de nuevo.')
      } finally {
        setLoading(false)
      }
    }
    void fetchReports()
  }, [])

  const filtered = reports.filter((report) => {
    if (filterCategory !== 'all' && report.category !== filterCategory) return false
    if (filterStatus !== 'all' && report.status !== filterStatus) return false
    return true
  })

  return (
    <div>
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="section-tag">Módulo Territorial</span>
            <h1 className="font-display text-3xl font-bold text-primary">Reportes ciudadanos</h1>
            <p className="mt-2 font-mono text-sm text-secondary">Situaciones y evidencias reportadas por la comunidad en Cartagena de Indias.</p>
          </div>
          <div className="flex items-center gap-2">
            {!loading && !error && <span className="mr-2 font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>}
            <Link href="/dashboard/reports/map" className="flex items-center gap-1.5 border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-secondary transition-colors hover:border-gold/40 hover:text-gold"><Map size={11} />Ver mapa</Link>
            <Link href="/dashboard/reports/new" className="flex items-center gap-1.5 border border-gold/40 bg-gold/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-gold transition-colors hover:bg-gold/20"><Plus size={11} />Nuevo</Link>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="report-category-filter" className="font-mono text-[9px] uppercase tracking-[0.25em] text-tertiary">Categoría</label>
            <select id="report-category-filter" value={filterCategory} onChange={(event) => setFilterCategory(event.target.value as Category | 'all')} className="border border-border bg-surface px-3 py-2 font-mono text-[11px] text-secondary outline-none transition-colors focus:border-gold/50">
              <option value="all">Todas</option>
              {(Object.entries(CATEGORY_LABELS) as [Category, string][]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="report-status-filter" className="font-mono text-[9px] uppercase tracking-[0.25em] text-tertiary">Estado</label>
            <select id="report-status-filter" value={filterStatus} onChange={(event) => setFilterStatus(event.target.value as ReportStatus | 'all')} className="border border-border bg-surface px-3 py-2 font-mono text-[11px] text-secondary outline-none transition-colors focus:border-gold/50">
              <option value="all">Todos</option>
              {(Object.entries(STATUS_LABELS) as [ReportStatus, string][]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
        </div>

        {loading && <div className="flex flex-col items-center justify-center gap-4 border border-border bg-surface py-24"><Loader2 size={24} strokeWidth={1} className="animate-spin text-gold" /><p className="font-mono text-[11px] uppercase tracking-[0.2em] text-tertiary">Cargando reportes…</p></div>}

        {!loading && error && (
          <div className="flex items-start gap-4 border border-red/30 bg-red/10 px-6 py-5">
            <AlertTriangle size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-red-400" />
            <div><p className="font-mono text-[12px] text-red-400">{error}</p><button onClick={() => window.location.reload()} className="mt-2 font-mono text-[11px] uppercase tracking-[0.15em] text-secondary transition-colors hover:text-primary">Reintentar →</button></div>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-6 border border-border bg-surface py-24">
            <FileText size={28} strokeWidth={1} className="text-tertiary" />
            <div className="text-center">
              <p className="font-mono text-sm text-tertiary">No hay reportes todavía.</p>
              {filterCategory === 'all' && filterStatus === 'all' && <Link href="/dashboard/reports/new" className="mt-3 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.15em] text-gold transition-opacity hover:opacity-75"><Plus size={11} strokeWidth={2} />Crea el primero</Link>}
              {(filterCategory !== 'all' || filterStatus !== 'all') && <button onClick={() => { setFilterCategory('all'); setFilterStatus('all') }} className="mx-auto mt-3 block font-mono text-[11px] uppercase tracking-[0.15em] text-secondary transition-colors hover:text-primary">Limpiar filtros</button>}
            </div>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="flex flex-col gap-px bg-border">
            {filtered.map((report) => <Link key={report.id} href={`/dashboard/reports/${report.id}`} className="block"><ReportCard report={report} /></Link>)}
          </div>
        )}
      </main>
    </div>
  )
}

function ReportCard({ report }: { report: Report }) {
  const thumbnail = report.media_urls?.[0]

  return (
    <article className="group flex flex-col gap-4 bg-bg p-5 transition-colors hover:bg-surface sm:flex-row sm:items-stretch">
      {thumbnail ? (
        <div className="w-full shrink-0 overflow-hidden border border-border bg-surface sm:w-32">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumbnail} alt={`Evidencia de ${report.title}`} className="aspect-[4/3] h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100" />
        </div>
      ) : (
        <div className="hidden w-32 shrink-0 items-center justify-center border border-border bg-surface text-tertiary sm:flex"><FileText size={20} strokeWidth={1} /></div>
      )}

      <div className="flex shrink-0 flex-col gap-2 sm:w-36">
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-gold">{CATEGORY_LABELS[report.category] ?? report.category}</span>
        <span className={`font-mono text-[10px] uppercase tracking-[0.2em] ${STATUS_CLASS[report.status]}`}>{STATUS_LABELS[report.status] ?? report.status}</span>
        <span className="font-mono text-[10px] text-tertiary">{formatDate(report.created_at)}</span>
        {report.media_urls?.length > 0 && <span className="font-mono text-[9px] text-tertiary">{report.media_urls.length} evidencia{report.media_urls.length === 1 ? '' : 's'}</span>}
      </div>

      <div className="flex flex-1 flex-col gap-1.5">
        <h2 className="font-display text-sm font-bold leading-snug text-primary">{report.title}</h2>
        <p className="font-mono text-[11px] leading-relaxed text-secondary">{truncate(report.description ?? '', 100)}</p>
        {report.neighborhood && <p className="font-mono text-[10px] text-tertiary">{report.neighborhood}</p>}
      </div>
    </article>
  )
}
