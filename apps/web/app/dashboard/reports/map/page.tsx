'use client'

import { useEffect, useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { List, Loader2, AlertTriangle, Plus, SlidersHorizontal, X } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import {
  type MapReport,
  type ReportCategory,
  CATEGORY_COLOR,
  CATEGORY_LABEL,
} from '@/components/ui/TerritorialMap'

// Carga dinámica — mapbox-gl requiere el entorno del navegador
const TerritorialMap = dynamic(
  () => import('@/components/ui/TerritorialMap').then(m => m.TerritorialMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-surface">
        <Loader2 size={20} className="animate-spin text-gold" />
      </div>
    ),
  },
)

// ── Constantes ────────────────────────────────────────────────────────────────

const ALL_CATEGORIES = Object.keys(CATEGORY_LABEL) as ReportCategory[]

const STATUS_COLORS: Record<string, string> = {
  open:        '#4ECDC4',
  in_progress: '#C8A84B',
  resolved:    'rgba(240,237,232,0.22)',
  rejected:    '#C0392B',
  duplicate:   'rgba(240,237,232,0.22)',
}

const STATUS_LABEL: Record<string, string> = {
  open:        'Abierto',
  in_progress: 'En gestión',
  resolved:    'Resuelto',
  rejected:    'Rechazado',
  duplicate:   'Duplicado',
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReportsMapPage() {
  const [reports, setReports]         = useState<MapReport[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [activeCategories, setActive] = useState<Set<ReportCategory>>(new Set(ALL_CATEGORIES))
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    apiFetch<{ data: MapReport[] }>('/territorial/reports?limit=200&offset=0', { public: true })
      .then(res => setReports(res.data ?? []))
      .catch(e  => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [])

  function toggleCategory(cat: ReportCategory) {
    setActive(prev => {
      const next = new Set(prev)
      if (next.has(cat)) { next.delete(cat) } else { next.add(cat) }
      return next
    })
  }

  function toggleAll() {
    setActive(prev =>
      prev.size === ALL_CATEGORIES.length
        ? new Set()
        : new Set(ALL_CATEGORIES),
    )
  }

  const filtered = useMemo(
    () => reports.filter(r => activeCategories.has(r.category)),
    [reports, activeCategories],
  )

  // Conteos por categoría
  const countByCategory = useMemo(() => {
    const acc: Partial<Record<ReportCategory, number>> = {}
    for (const r of reports) acc[r.category] = (acc[r.category] ?? 0) + 1
    return acc
  }, [reports])

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col lg:h-screen">

      {/* ── Top bar ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-border bg-surface px-5 py-3">
        <div className="flex items-center gap-4">
          <h1 className="font-display text-[14px] font-semibold text-primary">
            Mapa Territorial
          </h1>
          {!loading && (
            <span className="font-mono text-[10px] text-tertiary">
              {filtered.length}/{reports.length} reportes
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle filters (mobile) */}
          <button
            onClick={() => setShowFilters(v => !v)}
            className="flex items-center gap-1.5 rounded border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-secondary transition-colors hover:border-gold/40 hover:text-gold lg:hidden"
          >
            {showFilters ? <X size={11} /> : <SlidersHorizontal size={11} />}
            Filtros
          </button>

          <a
            href="/dashboard/reports"
            className="flex items-center gap-1.5 rounded border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-secondary transition-colors hover:border-gold/40 hover:text-gold"
          >
            <List size={11} />
            Ver lista
          </a>
          <a
            href="/dashboard/reports/new"
            className="flex items-center gap-1.5 rounded border border-gold/40 bg-gold/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-gold transition-colors hover:bg-gold/20"
          >
            <Plus size={11} />
            Nuevo
          </a>
        </div>
      </div>

      {/* ── Cuerpo principal ────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar filtros — desktop siempre visible, mobile toggle */}
        <aside
          className={[
            'flex flex-col border-r border-border bg-surface overflow-y-auto',
            'absolute inset-0 z-20 lg:relative lg:block lg:w-56 lg:flex-shrink-0',
            showFilters ? 'block w-64' : 'hidden lg:flex',
          ].join(' ')}
        >
          {/* Mobile close */}
          <button
            onClick={() => setShowFilters(false)}
            className="flex items-center justify-between border-b border-border px-4 py-3 lg:hidden"
          >
            <span className="font-mono text-[10px] uppercase tracking-wider text-secondary">
              Categorías
            </span>
            <X size={13} className="text-tertiary" />
          </button>

          {/* Header desktop */}
          <div className="hidden items-center justify-between border-b border-border px-4 py-3 lg:flex">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary">
              Categorías
            </span>
            <button
              onClick={toggleAll}
              className="font-mono text-[9px] uppercase tracking-wider text-tertiary transition-colors hover:text-gold"
            >
              {activeCategories.size === ALL_CATEGORIES.length ? 'Ninguna' : 'Todas'}
            </button>
          </div>

          {/* Category toggles */}
          <div className="flex flex-col divide-y divide-border px-1 py-1">
            {ALL_CATEGORIES.map(cat => {
              const active = activeCategories.has(cat)
              const color  = CATEGORY_COLOR[cat]
              const count  = countByCategory[cat] ?? 0

              return (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={[
                    'flex items-center gap-3 px-3 py-2.5 text-left transition-colors',
                    active ? 'bg-white/3' : 'opacity-40',
                  ].join(' ')}
                >
                  {/* Color dot */}
                  <span
                    className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: active ? color : 'rgba(255,255,255,0.2)' }}
                  />
                  <span className="flex-1 font-mono text-[11px] text-secondary">
                    {CATEGORY_LABEL[cat]}
                  </span>
                  {count > 0 && (
                    <span
                      className="font-mono text-[9px]"
                      style={{ color: active ? color : 'rgba(240,237,232,0.22)' }}
                    >
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Estado leyenda */}
          <div className="mt-auto border-t border-border px-4 py-4">
            <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.2em] text-tertiary">
              Estado
            </p>
            <div className="space-y-2">
              {Object.entries(STATUS_LABEL).slice(0, 4).map(([key, label]) => (
                <div key={key} className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: STATUS_COLORS[key] }}
                  />
                  <span className="font-mono text-[10px] text-tertiary">{label}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 font-mono text-[9px] text-tertiary/60 leading-relaxed">
              El tamaño del punto refleja la urgencia del reporte.
            </p>
          </div>
        </aside>

        {/* Map container */}
        <div className="relative flex-1">
          {loading ? (
            <div className="flex h-full items-center justify-center bg-bg">
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={24} className="animate-spin text-gold" />
                <p className="font-mono text-[11px] uppercase tracking-wider text-tertiary">
                  Cargando reportes…
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 bg-bg">
              <AlertTriangle size={24} strokeWidth={1.5} className="text-red" />
              <p className="font-mono text-[12px] text-secondary">{error}</p>
            </div>
          ) : (
            <TerritorialMap reports={filtered} height="100%" />
          )}
        </div>
      </div>
    </div>
  )
}
