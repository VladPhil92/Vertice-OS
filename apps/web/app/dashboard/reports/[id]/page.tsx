'use client'

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useParams, useRouter } from 'next/navigation'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Calendar,
  CheckCircle,
  Clock,
  FileText,
  GitBranch,
  Loader2,
  MapPin,
  Scale,
  Sparkles,
  XCircle,
} from 'lucide-react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'
import { CategoryTag } from '@/components/ui/CategoryTag'
import { CATEGORY_COLOR, CATEGORY_LABEL, type MapReport } from '@/components/ui/TerritorialMap'

const TerritorialMap = dynamic(
  () => import('@/components/ui/TerritorialMap').then(m => m.TerritorialMap),
  { ssr: false, loading: () => <div className="h-full animate-pulse bg-surface" /> },
)

interface ReportDetail {
  id: string
  citizen_id: string | null
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

interface CivicCase {
  id: string
  stage: string
  analysis: { audit_id: string; result: unknown } | null
  proposal: {
    id: string
    title: string | null
    status: string | null
    scope: string | null
    voting_ends_at: string | null
    policy_draft_audit_id: string | null
  } | null
  control: {
    id: string
    legal_type: string | null
    status: string | null
    urgency: string | null
    submitted_at: string | null
  } | null
}

interface WorkflowResponse {
  case: CivicCase | null
}

const STATUS_CONFIG: Record<string, {
  label: string
  icon: typeof CheckCircle
  tagVariant: string
  color: string
}> = {
  open:        { label: 'Abierto',     icon: AlertCircle, tagVariant: 'nuevo',     color: '#4ECDC4' },
  in_progress: { label: 'En gestión',  icon: Activity,    tagVariant: 'pendiente', color: '#C8A84B' },
  resolved:    { label: 'Resuelto',    icon: CheckCircle, tagVariant: 'resuelto',  color: '#27AE60' },
  rejected:    { label: 'Rechazado',   icon: XCircle,     tagVariant: 'urgente',   color: '#C0392B' },
  duplicate:   { label: 'Duplicado',   icon: XCircle,     tagVariant: 'pendiente', color: 'rgba(240,237,232,0.22)' },
}

const WORKFLOW_STAGE_LABEL: Record<string, string> = {
  reported: 'Reporte incorporado',
  analysis: 'Analizado con IA',
  proposal_drafting: 'Preparando propuesta',
  proposal: 'Propuesta vinculada',
  deliberation: 'En deliberación',
  voting: 'En votación',
  decision: 'Decisión registrada',
  control_drafting: 'Preparando control público',
  control: 'Control público vinculado',
}

const SCOPE_OPTIONS = [
  { value: 'neighborhood', label: 'Barrio' },
  { value: 'locality', label: 'Localidad' },
  { value: 'city', label: 'Cartagena' },
] as const

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

export default function ReportDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [report, setReport] = useState<ReportDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [civicCase, setCivicCase] = useState<CivicCase | null>(null)
  const [workflowAccess, setWorkflowAccess] = useState(false)
  const [actionLoading, setActionLoading] = useState<'analysis' | 'proposal' | 'control' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [proposalScope, setProposalScope] = useState<'neighborhood' | 'locality' | 'city'>('city')

  const loadWorkflow = useCallback(async () => {
    if (!id) return
    try {
      const result = await apiFetch<WorkflowResponse>(`/workflows/reports/${id}`)
      setWorkflowAccess(true)
      setCivicCase(result.case)
    } catch {
      // The report detail remains public, but escalation is only available to
      // the authenticated owner. A 403 here therefore hides owner actions.
      setWorkflowAccess(false)
      setCivicCase(null)
    }
  }, [id])

  useEffect(() => {
    if (!id) return

    apiFetch<ReportDetail>(`/territorial/reports/${id}`, { public: true })
      .then((data) => {
        setReport(data)
        if (data.neighborhood) setProposalScope('neighborhood')
        else if (data.locality_id) setProposalScope('locality')
      })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false))

    void loadWorkflow()
  }, [id, loadWorkflow])

  async function runWorkflow(action: 'analysis' | 'proposal' | 'control') {
    setActionLoading(action)
    setActionError(null)

    try {
      const path = `/workflows/reports/${id}/${action === 'analysis' ? 'analyze' : action}`
      const options = action === 'proposal'
        ? { method: 'POST', body: JSON.stringify({ scope: proposalScope }) }
        : { method: 'POST', body: JSON.stringify({}) }

      const result = await apiFetch<{ case: CivicCase }>(path, options)
      setCivicCase(result.case)
      setWorkflowAccess(true)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No fue posible completar la acción.')
    } finally {
      setActionLoading(null)
    }
  }

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

  const sc = STATUS_CONFIG[report.status] ?? STATUS_CONFIG.open
  const catColor = CATEGORY_COLOR[report.category as keyof typeof CATEGORY_COLOR] ?? '#C8A84B'
  const catLabel = CATEGORY_LABEL[report.category as keyof typeof CATEGORY_LABEL] ?? report.category
  const StatusIcon = sc.icon
  const mapReport: MapReport = {
    id: report.id,
    title: report.title,
    category: report.category as MapReport['category'],
    status: report.status as MapReport['status'],
    urgency_score: report.urgency_score,
    neighborhood: report.neighborhood,
    created_at: report.created_at,
    lat: report.lat,
    lng: report.lng,
  }

  const availableScopes = SCOPE_OPTIONS.filter((option) => {
    if (option.value === 'neighborhood') return Boolean(report.neighborhood)
    if (option.value === 'locality') return Boolean(report.locality_id)
    return true
  })

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-6 py-8">
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

      <div>
        <div className="mb-3 h-0.5 w-12" style={{ backgroundColor: catColor }} />
        <div className="flex items-start justify-between gap-4">
          <h1 className="font-display text-2xl font-bold leading-tight text-primary">
            {report.title}
          </h1>
          <CategoryTag variant={sc.tagVariant} label={sc.label} size="md" />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: catColor }}>
            {catLabel}
          </span>
          {report.subcategory && <span className="font-mono text-[10px] text-tertiary">{report.subcategory}</span>}
          <span className="flex items-center gap-1 font-mono text-[10px] text-tertiary">
            <Calendar size={9} />
            {formatDate(report.created_at)}
          </span>
        </div>
      </div>

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
            {report.neighborhood && <span className="font-mono text-[11px] text-secondary">{report.neighborhood}</span>}
            {report.address_reference && (
              <span className="ml-2 font-mono text-[10px] text-tertiary">{report.address_reference}</span>
            )}
            <span className="ml-2 font-mono text-[10px] text-tertiary/60">
              {report.lat.toFixed(5)}, {report.lng.toFixed(5)}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary">Descripción</h2>
        <p className="font-mono text-[13px] leading-relaxed text-secondary">{report.description}</p>
      </div>

      <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
        <div className="flex flex-col gap-2 bg-surface p-4">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-tertiary">Estado</span>
          <div className="flex items-center gap-2">
            <StatusIcon size={14} style={{ color: sc.color }} strokeWidth={1.5} />
            <span className="font-mono text-[12px]" style={{ color: sc.color }}>{sc.label}</span>
          </div>
        </div>
        <div className="flex flex-col gap-2 bg-surface p-4">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-tertiary">Urgencia</span>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[12px]" style={{ color: urgencyColor(report.urgency_score) }}>
                {urgencyLabel(report.urgency_score)}
              </span>
              {report.urgency_score !== null && (
                <span className="font-mono text-[9px] text-tertiary">{Math.round(report.urgency_score * 100)}%</span>
              )}
            </div>
            <div className="h-1 w-full rounded-full bg-white/5">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.round((report.urgency_score ?? 0) * 100)}%`,
                  backgroundColor: urgencyColor(report.urgency_score),
                }}
              />
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 bg-surface p-4">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-tertiary">Creado</span>
          <span className="flex items-center gap-1.5 font-mono text-[11px] text-secondary">
            <Calendar size={10} />
            {new Date(report.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        </div>
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

      {report.media_urls.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary">
            Evidencias ({report.media_urls.length})
          </h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {report.media_urls.map((url, i) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="group aspect-square overflow-hidden border border-border bg-surface"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Evidencia ${i + 1}`} className="h-full w-full object-cover opacity-80 transition-opacity group-hover:opacity-100" />
              </a>
            ))}
          </div>
        </div>
      )}

      {workflowAccess && (
        <section className="overflow-hidden rounded-[24px] border border-[#D7E0EB] bg-white shadow-sm">
          <div className="bg-[#0A2A66] px-5 py-5 text-white sm:px-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.13em] text-[#B6CBEC]">
                  <GitBranch size={13} />
                  Expediente cívico
                </div>
                <h2 className="mt-2 font-display text-xl font-extrabold">
                  Convierte este reporte en una ruta de acción pública.
                </h2>
              </div>
              {civicCase && (
                <Link href="/dashboard/workflows" className="inline-flex items-center gap-2 text-[11px] font-extrabold text-[#F5B700]">
                  Ver expedientes
                  <ArrowUpRight size={13} />
                </Link>
              )}
            </div>
          </div>

          <div className="p-5 sm:p-6">
            {civicCase && (
              <div className="mb-5 rounded-2xl border border-[#C8D8EE] bg-[#EAF1FB] p-4">
                <div className="text-[9px] font-extrabold uppercase tracking-[.12em] text-[#607087]">Etapa actual</div>
                <div className="mt-1 text-sm font-extrabold text-[#0A2A66]">
                  {WORKFLOW_STAGE_LABEL[civicCase.stage] ?? civicCase.stage}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {civicCase.proposal && (
                    <Link href={`/dashboard/proposals/${civicCase.proposal.id}`} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-[10px] font-extrabold text-[#245EA7]">
                      <FileText size={12} />
                      Abrir propuesta
                    </Link>
                  )}
                  {civicCase.control && (
                    <Link href={`/dashboard/legal/${civicCase.control.id}`} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-[10px] font-extrabold text-[#B72232]">
                      <Scale size={12} />
                      Abrir control público
                    </Link>
                  )}
                </div>
              </div>
            )}

            {actionError && (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-[#F4C9CE] bg-[#FCEBED] p-3 text-xs text-[#A72836]">
                <AlertCircle size={15} className="mt-0.5 flex-none" />
                {actionError}
              </div>
            )}

            <div className="grid gap-3 lg:grid-cols-3">
              <button
                onClick={() => void runWorkflow('analysis')}
                disabled={actionLoading !== null}
                className="rounded-2xl border border-[#D7E0EB] bg-[#F9FBFD] p-4 text-left transition hover:border-[#B8AEEA] hover:bg-[#F7F4FF] disabled:opacity-50"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EEEAFB] text-[#6D5CC7]">
                  {actionLoading === 'analysis' ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                </div>
                <div className="mt-3 text-xs font-extrabold text-[#0A2A66]">Analizar con IA</div>
                <p className="mt-1.5 text-[11px] leading-5 text-[#7B8799]">Identifica patrón, urgencia y contexto conservando el audit ID.</p>
              </button>

              <div className="rounded-2xl border border-[#D7E0EB] bg-[#F9FBFD] p-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EAF6ED] text-[#2BA745]">
                  <FileText size={16} />
                </div>
                <div className="mt-3 text-xs font-extrabold text-[#0A2A66]">Convertir en propuesta</div>
                <p className="mt-1.5 text-[11px] leading-5 text-[#7B8799]">Genera un borrador de política y crea la propuesta vinculada.</p>
                {!civicCase?.proposal ? (
                  <div className="mt-3 flex gap-2">
                    <select
                      value={proposalScope}
                      onChange={(event) => setProposalScope(event.target.value as typeof proposalScope)}
                      className="min-w-0 flex-1 rounded-lg border border-[#D7E0EB] bg-white px-2 py-2 text-[10px] font-bold text-[#607087]"
                    >
                      {availableScopes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                    <button
                      onClick={() => void runWorkflow('proposal')}
                      disabled={actionLoading !== null}
                      className="rounded-lg bg-[#2BA745] px-3 py-2 text-[10px] font-extrabold text-white disabled:opacity-50"
                    >
                      {actionLoading === 'proposal' ? <Loader2 size={13} className="animate-spin" /> : 'Crear'}
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 text-[10px] font-extrabold text-[#2BA745]">Propuesta ya vinculada ✓</div>
                )}
              </div>

              <button
                onClick={() => void runWorkflow('control')}
                disabled={actionLoading !== null || Boolean(civicCase?.control)}
                className="rounded-2xl border border-[#D7E0EB] bg-[#F9FBFD] p-4 text-left transition hover:border-[#F4C9CE] hover:bg-[#FFF8F8] disabled:opacity-50"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FCEBED] text-[#D72638]">
                  {actionLoading === 'control' ? <Loader2 size={16} className="animate-spin" /> : <Scale size={16} />}
                </div>
                <div className="mt-3 text-xs font-extrabold text-[#0A2A66]">Preparar control público</div>
                <p className="mt-1.5 text-[11px] leading-5 text-[#7B8799]">Traslada situación y evidencias al pipeline jurídico asistido por IA.</p>
                {civicCase?.control && <div className="mt-3 text-[10px] font-extrabold text-[#D72638]">Actuación ya vinculada ✓</div>}
              </button>
            </div>
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-3 border-t border-border pt-6">
        <Link
          href="/dashboard/reports/map"
          className="flex items-center gap-2 border border-border px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-secondary transition-colors hover:border-gold/40 hover:text-gold"
        >
          <MapPin size={12} />
          Ver en mapa
        </Link>
        {workflowAccess && (
          <Link
            href="/dashboard/workflows"
            className="flex items-center gap-2 border border-border px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-secondary transition-colors hover:border-gold/40 hover:text-gold"
          >
            <GitBranch size={12} />
            Expedientes
          </Link>
        )}
        <Link
          href="/dashboard/reports"
          className="flex items-center gap-2 border border-border px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-tertiary transition-colors hover:text-secondary"
        >
          <ArrowLeft size={12} />
          Volver a la lista
        </Link>
      </div>
    </div>
  )
}
