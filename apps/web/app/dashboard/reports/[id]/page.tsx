'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Loader2, AlertTriangle, MapPin, Calendar,
  Clock, CheckCircle, XCircle, AlertCircle, Activity,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { CategoryTag } from '@/components/ui/CategoryTag'
import { CATEGORY_COLOR, CATEGORY_LABEL, type MapReport } from '@/components/ui/TerritorialMap'

// Mini-mapa solo lectura — carga dinámica
const TerritorialMap = dynamic(
  () => import('@/components/ui/TerritorialMap').then(m => m.TerritorialMap),
  { ssr: false, loading: () => <div className="h-full animate-pulse bg-surface" /> },
)

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface ReportDetail {
  id: string
  title: string
  description: string
  category: string
  subcategory: string | null
  status: string
  urgency_score: number | null
  neighborhood: string | null
  locality_id: number | null
  address_reference: string | null
  media_urls: string[]
  lat: number
  lng: number
  created_at: string
  updated_at: string
  resolved_at: string | null
}

// ── Config ────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, {
  label: string
  icon: typeof CheckCircle
  tagVariant: string
  color: string
}> = {
  open:        { label: 'Abierto',     icon: AlertCircle, tagVariant: 'nuevo',    color: '#4ECDC4' },
  in_progress: { label: 'En gestión',  icon: Activity,    tagVariant: 'pendiente',color: '#C8A84B' },
  resolved:    { label: 'Resuelto',    icon: CheckCircle, tagVariant: 'resuelto', color: '#27AE60' },
  rejected:    { label: 'Rechazado',   icon: XCircle,     tagVariant: 'urgente',  color: '#C0392B' },
  duplicate:   { label: 'Duplicado',   icon: XCircle,     tagVariant: 'pendiente',color: 'rgba(240,237,232,0.22)' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

function urgencyLabel(score: number | null): string {
  if (!score) return 'Sin clasificar'
  if (score >= 0.8) return 'Crítica'
  if (score >= 0.6) return 'Alta'
  if (score >= 0.4) return 'Media'
  return 'Baja'
}

function urgencyColor(score: number | null): string {
  if (!score) return 'rgba(240,237,232,0.22)'
  if (score >= 0.8) return '#C0392B'
  if (score >= 0.6) return '#FFB522'
  if (score >= 0.4) return '#C8A84B'
  return '#27AE60'
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReportDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [report, setReport]   = useState<ReportDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    apiFetch<ReportDetail>(`/territorial/reports/${id}`, { public: true })
      .then(setReport)
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 size={22} className="animate-spin text-gold" />
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <AlertTriangle size={28} strokeWidth={1.5} className="mx-auto mb-4 text-tertiary" />
        <p className="font-mono text-[13px] text-secondary">
          {error ?? 'Reporte no encontrado'}
        </p>
        <button
          onClick={() => router.back()}
          className="mt-4 font-mono text-[11px] uppercase tracking-wider text-gold hover:opacity-70"
        >
          ← Volver
        </button>
      </div>
    )
  }

  const sc        = STATUS_CONFIG[report.status] ?? STATUS_CONFIG.open
  const catColor  = CATEGORY_COLOR[report.category as keyof typeof CATEGORY_COLOR] ?? '#C8A84B'
  const catLabel  = CATEGORY_LABEL[report.category as keyof typeof CATEGORY_LABEL] ?? report.category
  const StatusIcon = sc.icon

  // Prepare single-pin map data
  const mapReport: MapReport = {
    id:           report.id,
    title:        report.title,
    category:     report.category as MapReport['category'],
    status:       report.status as MapReport['status'],
    urgency_score:report.urgency_score,
    neighborhood: report.neighborhood,
    created_at:   report.created_at,
    lat:          report.lat,
    lng:          report.lng,
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 space-y-8">

      {/* ── Back nav ───────────────────────────────────────────────────── */}
      <nav className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-tertiary transition-colors hover:text-gold"
        >
          <ArrowLeft size={11} />
          Reportes
        </button>
        <span className="text-tertiary/40">/</span>
        <span className="font-mono text-[10px] text-tertiary">Detalle</span>
      </nav>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div>
        {/* Category accent */}
        <div className="mb-3 h-0.5 w-12" style={{ backgroundColor: catColor }} />

        <div className="flex items-start justify-between gap-4">
          <h1 className="font-display text-2xl font-bold leading-tight text-primary">
            {report.title}
          </h1>
          <CategoryTag variant={sc.tagVariant} label={sc.label} size="md" />
        </div>

        {/* Meta row */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span
            className="font-mono text-[10px] uppercase tracking-[0.2em]"
            style={{ color: catColor }}
          >
            {catLabel}
          </span>
          {report.subcategory && (
            <span className="font-mono text-[10px] text-tertiary">
              {report.subcategory}
            </span>
          )}
          <span className="flex items-center gap-1 font-mono text-[10px] text-tertiary">
            <Calendar size={9} />
            {formatDate(report.created_at)}
          </span>
        </div>
      </div>

      {/* ── Map + location ─────────────────────────────────────────────── */}
      <div className="overflow-hidden border border-border">
        <div className="h-64">
          <TerritorialMap
            reports={[mapReport]}
            height="100%"
            interactive={false}
            centerLat={report.lat}
            centerLng={report.lng}
            zoom={15}
            singlePin
          />
        </div>
        <div className="flex items-center gap-3 border-t border-border bg-surface px-4 py-3">
          <MapPin size={12} className="flex-shrink-0 text-tertiary" />
          <div className="min-w-0">
            {report.neighborhood && (
              <span className="font-mono text-[11px] text-secondary">{report.neighborhood}</span>
            )}
            {report.address_reference && (
              <span className="ml-2 font-mono text-[10px] text-tertiary">
                {report.address_reference}
              </span>
            )}
            <span className="ml-2 font-mono text-[10px] text-tertiary/60">
              {report.lat.toFixed(5)}, {report.lng.toFixed(5)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Description ────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary">
          Descripción
        </h2>
        <p className="font-mono text-[13px] leading-relaxed text-secondary">
          {report.description}
        </p>
      </div>

      {/* ── Stats row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
        {/* Status */}
        <div className="flex flex-col gap-2 bg-surface p-4">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-tertiary">Estado</span>
          <div className="flex items-center gap-2">
            <StatusIcon size={14} style={{ color: sc.color }} strokeWidth={1.5} />
            <span className="font-mono text-[12px]" style={{ color: sc.color }}>{sc.label}</span>
          </div>
        </div>

        {/* Urgency */}
        <div className="flex flex-col gap-2 bg-surface p-4">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-tertiary">Urgencia</span>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span
                className="font-mono text-[12px]"
                style={{ color: urgencyColor(report.urgency_score) }}
              >
                {urgencyLabel(report.urgency_score)}
              </span>
              {report.urgency_score && (
                <span className="font-mono text-[9px] text-tertiary">
                  {Math.round(report.urgency_score * 100)}%
                </span>
              )}
            </div>
            <div className="h-1 w-full rounded-full bg-white/5">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width:           `${Math.round((report.urgency_score ?? 0) * 100)}%`,
                  backgroundColor: urgencyColor(report.urgency_score),
                }}
              />
            </div>
          </div>
        </div>

        {/* Created */}
        <div className="flex flex-col gap-2 bg-surface p-4">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-tertiary">Creado</span>
          <span className="flex items-center gap-1.5 font-mono text-[11px] text-secondary">
            <Calendar size={10} />
            {new Date(report.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        </div>

        {/* Updated */}
        <div className="flex flex-col gap-2 bg-surface p-4">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-tertiary">
            {report.resolved_at ? 'Resuelto' : 'Actualizado'}
          </span>
          <span className="flex items-center gap-1.5 font-mono text-[11px] text-secondary">
            <Clock size={10} />
            {new Date(report.resolved_at ?? report.updated_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* ── Media ──────────────────────────────────────────────────────── */}
      {report.media_urls && report.media_urls.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary">
            Evidencias ({report.media_urls.length})
          </h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {report.media_urls.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="group aspect-square overflow-hidden border border-border bg-surface"
              >
                <img
                  src={url}
                  alt={`Evidencia ${i + 1}`}
                  className="h-full w-full object-cover opacity-80 transition-opacity group-hover:opacity-100"
                />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ── Actions ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 border-t border-border pt-6">
        <a
          href={`/dashboard/reports/map`}
          className="flex items-center gap-2 border border-border px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-secondary transition-colors hover:border-gold/40 hover:text-gold"
        >
          <MapPin size={12} />
          Ver en mapa
        </a>
        <a
          href="/dashboard/reports"
          className="flex items-center gap-2 border border-border px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-tertiary transition-colors hover:text-secondary"
        >
          <ArrowLeft size={12} />
          Volver a la lista
        </a>
      </div>

    </div>
  )
}
