'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  FileText,
  GitBranch,
  MapPin,
  PlusCircle,
  RefreshCw,
  Scale,
  Sparkles,
  Vote,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'

interface CivicCase {
  id: string
  stage: string
  stored_stage: string
  created_at: string
  updated_at: string
  report: {
    id: string
    title: string
    category: string
    status: string
    neighborhood: string | null
    created_at: string
  }
  analysis: {
    audit_id: string
    result: unknown
  } | null
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

interface CasesResponse {
  data: CivicCase[]
  count: number
}

const STAGES = [
  { key: 'reported', label: 'Reporte', icon: MapPin },
  { key: 'analysis', label: 'IA', icon: Sparkles },
  { key: 'proposal', label: 'Propuesta', icon: FileText },
  { key: 'deliberation', label: 'Debate', icon: GitBranch },
  { key: 'voting', label: 'Votación', icon: Vote },
  { key: 'decision', label: 'Decisión', icon: CheckCircle2 },
  { key: 'control', label: 'Control', icon: Scale },
] as const

const STAGE_ORDER: Record<string, number> = {
  reported: 0,
  analysis: 1,
  proposal_drafting: 1,
  proposal: 2,
  deliberation: 3,
  voting: 4,
  decision: 5,
  control_drafting: 5,
  control: 6,
}

const CATEGORY_LABEL: Record<string, string> = {
  infraestructura: 'Infraestructura',
  servicios_publicos: 'Servicios públicos',
  seguridad: 'Seguridad',
  salud: 'Salud',
  medio_ambiente: 'Ambiente',
  transporte: 'Movilidad',
  movilidad: 'Movilidad',
  educacion: 'Educación',
  cultura: 'Cultura',
  gobernanza: 'Gobernanza',
  otro: 'Otro',
}

const STAGE_LABEL: Record<string, string> = {
  reported: 'Caso reportado',
  analysis: 'Analizado por IA',
  proposal_drafting: 'Preparando propuesta',
  proposal: 'Propuesta creada',
  deliberation: 'En deliberación',
  voting: 'En votación',
  decision: 'Decisión registrada',
  control_drafting: 'Preparando control público',
  control: 'Control público activo',
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function CaseRoute({ civicCase }: { civicCase: CivicCase }) {
  const currentIndex = STAGE_ORDER[civicCase.stage] ?? 0

  return (
    <div className="mt-5 overflow-x-auto pb-1">
      <div className="flex min-w-[650px] items-center">
        {STAGES.map((stage, index) => {
          const Icon = stage.icon
          const reached = index <= currentIndex
          const current = index === currentIndex
          const isControl = stage.key === 'control'
          const connected = isControl ? Boolean(civicCase.control) : reached

          return (
            <div key={stage.key} className="flex flex-1 items-center last:flex-none">
              <div className="flex min-w-[72px] flex-col items-center gap-2 text-center">
                <div className={[
                  'flex h-9 w-9 items-center justify-center rounded-full border transition',
                  current
                    ? 'border-[#F5B700] bg-[#FFF4D1] text-[#8C6500] shadow-[0_0_0_5px_rgba(245,183,0,.10)]'
                    : connected
                      ? 'border-[#BFD0E8] bg-[#EAF1FB] text-[#0A2A66]'
                      : 'border-[#E1E7EF] bg-[#F7F9FC] text-[#A0AAB8]',
                ].join(' ')}>
                  <Icon size={15} strokeWidth={1.9} />
                </div>
                <span className={current ? 'text-[9px] font-extrabold text-[#0A2A66]' : 'text-[9px] font-semibold text-[#8794A6]'}>
                  {stage.label}
                </span>
              </div>
              {index < STAGES.length - 1 && (
                <div className={[
                  'mb-5 h-px min-w-5 flex-1',
                  index < currentIndex ? 'bg-[#BFD0E8]' : 'bg-[#E1E7EF]',
                ].join(' ')} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function CivicWorkflowsPage() {
  const [cases, setCases] = useState<CivicCase[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const result = await apiFetch<CasesResponse>('/workflows/cases?limit=25')
      setCases(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar tus expedientes cívicos.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const activeCount = useMemo(
    () => cases.filter((item) => item.stage !== 'decision').length,
    [cases],
  )

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-5 px-4 py-8 sm:px-6 lg:px-8">
        <div className="h-44 animate-pulse rounded-[28px] bg-white" />
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-64 animate-pulse rounded-2xl bg-white" />
        ))}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F7F9FC]">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
        <section className="rounded-[28px] bg-[#0A2A66] px-6 py-8 text-white shadow-[0_22px_60px_rgba(10,42,102,.14)] sm:px-8 lg:px-10">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.13em] text-[#CFE0F8]">
                <GitBranch size={13} />
                Expedientes cívicos
              </div>
              <h1 className="mt-4 font-display text-3xl font-extrabold tracking-[-.03em] sm:text-4xl">
                De un problema reportado a una acción pública trazable.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[#CAD8EB]">
                Cada expediente conserva el origen del caso y sus escalaciones a IA, propuesta, decisión democrática y control público.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[.06] px-5 py-3">
                <div className="text-[9px] font-extrabold uppercase tracking-[.12em] text-[#9DB6D8]">Expedientes</div>
                <div className="mt-1 text-2xl font-extrabold">{cases.length}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[.06] px-5 py-3">
                <div className="text-[9px] font-extrabold uppercase tracking-[.12em] text-[#9DB6D8]">Activos</div>
                <div className="mt-1 text-2xl font-extrabold">{activeCount}</div>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-extrabold text-[#0A2A66]">Tus rutas de acción</h2>
            <p className="mt-1 text-xs text-[#7B8799]">La etapa visible se deriva del estado real de cada módulo vinculado.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => void load(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-[#D7E0EB] bg-white px-3.5 py-2.5 text-[11px] font-bold text-[#607087] transition hover:text-[#0A2A66] disabled:opacity-50"
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
              Actualizar
            </button>
            <Link
              href="/dashboard/reports/new"
              className="inline-flex items-center gap-2 rounded-xl bg-[#F5B700] px-3.5 py-2.5 text-[11px] font-extrabold text-[#0A2A66]"
            >
              <PlusCircle size={14} />
              Nuevo reporte
            </Link>
          </div>
        </div>

        {error && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[#F4C9CE] bg-[#FCEBED] p-4 text-sm text-[#A72836]">
            <AlertCircle size={18} className="mt-0.5 flex-none" />
            <div>
              <div className="font-extrabold">No pudimos cargar los expedientes</div>
              <div className="mt-1 text-xs leading-5">{error}</div>
            </div>
          </div>
        )}

        {!error && cases.length === 0 && (
          <section className="mt-5 rounded-[24px] border border-[#E1E7EF] bg-white p-8 text-center shadow-sm sm:p-10">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF1FB] text-[#0A2A66]">
              <GitBranch size={24} />
            </div>
            <h2 className="mt-5 font-display text-2xl font-extrabold text-[#0A2A66]">Todavía no tienes expedientes activos</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#607087]">
              Crea un reporte territorial y, desde su detalle, podrás analizarlo con IA, convertirlo en propuesta o preparar una actuación de control público.
            </p>
            <Link href="/dashboard/reports/new" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#0A2A66] px-5 py-3 text-xs font-extrabold text-white">
              Crear mi primer reporte
              <ArrowUpRight size={14} />
            </Link>
          </section>
        )}

        <div className="mt-5 space-y-4">
          {cases.map((civicCase) => (
            <article key={civicCase.id} className="rounded-[24px] border border-[#E1E7EF] bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-[#D7E0EB] bg-[#F7F9FC] px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[.08em] text-[#607087]">
                      {CATEGORY_LABEL[civicCase.report.category] ?? civicCase.report.category}
                    </span>
                    <span className="rounded-full border border-[#F1DEA5] bg-[#FFF4D1] px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[.08em] text-[#8C6500]">
                      {STAGE_LABEL[civicCase.stage] ?? civicCase.stage}
                    </span>
                  </div>
                  <h2 className="mt-3 max-w-3xl font-display text-xl font-extrabold leading-7 text-[#0A2A66]">
                    {civicCase.report.title}
                  </h2>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold text-[#7B8799]">
                    {civicCase.report.neighborhood && (
                      <span className="inline-flex items-center gap-1.5"><MapPin size={11} />{civicCase.report.neighborhood}</span>
                    )}
                    <span>Actualizado {formatDate(civicCase.updated_at)}</span>
                  </div>
                </div>

                <Link
                  href={`/dashboard/reports/${civicCase.report.id}`}
                  className="inline-flex flex-none items-center gap-2 rounded-xl border border-[#C8D8EE] bg-[#EAF1FB] px-3.5 py-2.5 text-[11px] font-extrabold text-[#245EA7]"
                >
                  Abrir expediente
                  <ArrowUpRight size={13} />
                </Link>
              </div>

              <CaseRoute civicCase={civicCase} />

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <Link href={`/dashboard/reports/${civicCase.report.id}`} className="rounded-2xl border border-[#E1E7EF] bg-[#F9FBFD] p-4 transition hover:border-[#BFD0E8]">
                  <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.1em] text-[#607087]">
                    <MapPin size={13} className="text-[#4A90E2]" />
                    Reporte fuente
                  </div>
                  <div className="mt-2 text-xs font-bold text-[#0A2A66]">{civicCase.report.status}</div>
                </Link>

                {civicCase.proposal ? (
                  <Link href={`/dashboard/proposals/${civicCase.proposal.id}`} className="rounded-2xl border border-[#E1E7EF] bg-[#F9FBFD] p-4 transition hover:border-[#CBE9D1]">
                    <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.1em] text-[#607087]">
                      <Vote size={13} className="text-[#2BA745]" />
                      Propuesta vinculada
                    </div>
                    <div className="mt-2 text-xs font-bold text-[#0A2A66]">{civicCase.proposal.status ?? 'Activa'}</div>
                  </Link>
                ) : (
                  <div className="rounded-2xl border border-dashed border-[#D7E0EB] p-4">
                    <div className="text-[10px] font-extrabold uppercase tracking-[.1em] text-[#9AA6B5]">Propuesta</div>
                    <div className="mt-2 text-xs text-[#8794A6]">Sin escalar</div>
                  </div>
                )}

                {civicCase.control ? (
                  <Link href={`/dashboard/legal/${civicCase.control.id}`} className="rounded-2xl border border-[#E1E7EF] bg-[#F9FBFD] p-4 transition hover:border-[#F4C9CE]">
                    <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.1em] text-[#607087]">
                      <Scale size={13} className="text-[#D72638]" />
                      Control público
                    </div>
                    <div className="mt-2 text-xs font-bold text-[#0A2A66]">{civicCase.control.status ?? 'Borrador'}</div>
                  </Link>
                ) : (
                  <div className="rounded-2xl border border-dashed border-[#D7E0EB] p-4">
                    <div className="text-[10px] font-extrabold uppercase tracking-[.1em] text-[#9AA6B5]">Control público</div>
                    <div className="mt-2 text-xs text-[#8794A6]">Sin escalar</div>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}
