'use client'

import { FileText, Loader2, Plus, AlertTriangle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ReportStatus = 'open' | 'in_progress' | 'resolved' | 'rejected'

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
  created_at: string
}

interface ApiResponse {
  reports: Report[]
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<Category, string> = {
  infraestructura:    'Infraestructura',
  servicios_publicos: 'Servicios Públicos',
  seguridad:          'Seguridad',
  medio_ambiente:     'Medio Ambiente',
  transporte:         'Transporte',
  salud:              'Salud',
  educacion:          'Educación',
  cultura:            'Cultura',
  otro:               'Otro',
}

const STATUS_LABELS: Record<ReportStatus, string> = {
  open:        'Abierto',
  in_progress: 'En gestión',
  resolved:    'Resuelto',
  rejected:    'Rechazado',
}

const STATUS_CLASS: Record<ReportStatus, string> = {
  open:        'text-cyan',
  in_progress: 'text-gold',
  resolved:    'text-tertiary',
  rejected:    'text-red-400',
}

const MONTHS_ES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  const dd = String(d.getDate()).padStart(2, '0')
  const mmm = MONTHS_ES[d.getMonth()]
  const yyyy = d.getFullYear()
  return `${dd} ${mmm} ${yyyy}`
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}…`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ReportsPage() {
  const [reports, setReports]           = useState<Report[]>([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState<string | null>(null)
  const [filterCategory, setFilterCategory] = useState<Category | 'all'>('all')
  const [filterStatus, setFilterStatus]     = useState<ReportStatus | 'all'>('all')

  useEffect(() => {
    async function fetchReports() {
      setLoading(true)
      setError(null)
      try {
        const data = await apiFetch<ApiResponse>('/territorial/reports')
        setReports(data.reports ?? [])
      } catch {
        setError('No se pudieron cargar los reportes. Verifica la conexión e intenta de nuevo.')
      } finally {
        setLoading(false)
      }
    }

    void fetchReports()
  }, [])

  const filtered = reports.filter((r) => {
    if (filterCategory !== 'all' && r.category !== filterCategory) return false
    if (filterStatus !== 'all' && r.status !== filterStatus) return false
    return true
  })

  return (
    <div>
      <main className="mx-auto max-w-5xl px-6 py-10">
        {/* Page header */}
        <div className="mb-8 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="section-tag">Módulo Territorial</span>
            <h1 className="font-display text-3xl font-bold text-primary">Reportes ciudadanos</h1>
            <p className="mt-2 font-mono text-sm text-secondary">
              Situaciones reportadas por la comunidad en Cartagena de Indias.
            </p>
          </div>
          {!loading && !error && (
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary">
              {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-3">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-tertiary">Categoría</span>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as Category | 'all')}
              className="bg-surface border border-border focus:border-gold/50 px-3 py-2 font-mono text-[11px] text-secondary outline-none transition-colors"
            >
              <option value="all">Todas</option>
              {(Object.entries(CATEGORY_LABELS) as [Category, string][]).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-tertiary">Estado</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as ReportStatus | 'all')}
              className="bg-surface border border-border focus:border-gold/50 px-3 py-2 font-mono text-[11px] text-secondary outline-none transition-colors"
            >
              <option value="all">Todos</option>
              {(Object.entries(STATUS_LABELS) as [ReportStatus, string][]).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* States: loading / error / empty / list                           */}
        {/* ---------------------------------------------------------------- */}

        {loading && (
          <div className="flex flex-col items-center justify-center gap-4 border border-border bg-surface py-24">
            <Loader2 size={24} strokeWidth={1} className="animate-spin text-gold" />
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-tertiary">
              Cargando reportes…
            </p>
          </div>
        )}

        {!loading && error && (
          <div className="flex items-start gap-4 border border-red/30 bg-red/10 px-6 py-5">
            <AlertTriangle size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-red-400" />
            <div>
              <p className="font-mono text-[12px] text-red-400">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-2 font-mono text-[11px] uppercase tracking-[0.15em] text-secondary hover:text-primary transition-colors"
              >
                Reintentar →
              </button>
            </div>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-6 border border-border bg-surface py-24">
            <FileText size={28} strokeWidth={1} className="text-tertiary" />
            <div className="text-center">
              <p className="font-mono text-sm text-tertiary">No hay reportes todavía.</p>
              {filterCategory === 'all' && filterStatus === 'all' && (
                <a
                  href="/dashboard/reports/new"
                  className="mt-3 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.15em] text-gold hover:opacity-75 transition-opacity"
                >
                  <Plus size={11} strokeWidth={2} />
                  Crea el primero
                </a>
              )}
              {(filterCategory !== 'all' || filterStatus !== 'all') && (
                <button
                  onClick={() => { setFilterCategory('all'); setFilterStatus('all') }}
                  className="mt-3 block font-mono text-[11px] uppercase tracking-[0.15em] text-secondary hover:text-primary transition-colors mx-auto"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="flex flex-col gap-px bg-border">
            {filtered.map((report) => (
              <ReportCard key={report.id} report={report} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Report card sub-component
// ---------------------------------------------------------------------------

function ReportCard({ report }: { report: Report }) {
  const {
    id,
    category,
    title,
    description,
    neighborhood,
    status,
    created_at,
  } = report

  return (
    <article className="group flex flex-col gap-3 bg-bg p-6 transition-colors hover:bg-surface sm:flex-row sm:items-start sm:gap-6">
      {/* Left: category + meta */}
      <div className="flex shrink-0 flex-col gap-2 sm:w-36">
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-gold">
          {CATEGORY_LABELS[category] ?? category}
        </span>
        <span className={`font-mono text-[10px] uppercase tracking-[0.2em] ${STATUS_CLASS[status]}`}>
          {STATUS_LABELS[status] ?? status}
        </span>
        <span className="font-mono text-[10px] text-tertiary">
          {formatDate(created_at)}
        </span>
      </div>

      {/* Right: content */}
      <div className="flex flex-1 flex-col gap-1.5">
        <h2 className="font-display text-sm font-bold text-primary leading-snug">
          {title}
        </h2>
        <p className="font-mono text-[11px] text-secondary leading-relaxed">
          {truncate(description, 100)}
        </p>
        {neighborhood && (
          <p className="font-mono text-[10px] text-tertiary">{neighborhood}</p>
        )}
      </div>

      {/* Hover accent line */}
      <div className="h-px w-0 bg-gold transition-all duration-300 group-hover:w-full sm:hidden" />
    </article>
  )
}
