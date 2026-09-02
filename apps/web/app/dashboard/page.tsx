'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  CheckCircle2,
  FilePlus2,
  FileText,
  Gavel,
  Loader2,
  MapPinned,
  MessageCircleMore,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sparkles,
  Star,
  Vote,
} from 'lucide-react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'

interface PendingVote {
  id: string
  title: string
  category: string
  scope: string
  voting_ends_at: string | null
  created_at: string
}

interface RecentReport {
  id: string
  title: string
  category: string
  status: string
  neighborhood: string | null
  created_at: string
  updated_at: string
}

interface RecentProposal {
  id: string
  title: string
  category: string
  scope: string
  status: string
  endorsement_count: number
  total_votes: number
  voting_ends_at: string | null
  created_at: string
}

interface RecentLegal {
  id: string
  legal_type: string
  status: string
  urgency: string
  created_at: string
  submitted_at: string | null
}

interface DashboardResponse {
  profile: {
    id: string
    email: string | null
    neighborhood: string | null
    locality_id: number | null
    verification_level: number
    created_at: string
  }
  reputation: {
    score: number
    level: string
    total_votes: number
    total_proposals: number
    total_reports: number
    badges_count: number
    endorsements_given: number
  }
  attention: {
    verification_required: boolean
    pending_votes: PendingVote[]
    legal_needs_action: number
    reports_in_progress: number
    total_items: number
  }
  mine: {
    reports: {
      total: number
      by_status: Record<string, number>
      recent: RecentReport[]
    }
    proposals: {
      total: number
      by_status: Record<string, number>
      recent: RecentProposal[]
    }
    legal: {
      total: number
      by_status: Record<string, number>
      recent: RecentLegal[]
    }
  }
  city: {
    reports: {
      total_reports: number
      open_reports: number
      by_category: Array<{
        category: string
        total: number
        open_count: number
        resolved_count: number
      }>
    }
    governance: {
      total_proposals: number
      by_status: Array<{ status: string; count: number }>
    }
  }
  generated_at: string
}

const REPORT_STATUS: Record<string, string> = {
  open: 'Abierto',
  in_progress: 'En gestión',
  resolved: 'Resuelto',
  rejected: 'Rechazado',
  duplicate: 'Duplicado',
}

const PROPOSAL_STATUS: Record<string, string> = {
  idea: 'Idea',
  draft: 'Borrador',
  debate: 'En debate',
  voting: 'En votación',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  quorum_failed: 'Sin quórum',
  executed: 'Ejecutada',
}

const LEGAL_STATUS: Record<string, string> = {
  draft: 'Borrador',
  ready: 'Listo para enviar',
  submitted: 'Enviado',
  responded: 'Respondido',
  escalated: 'Escalado',
  closed: 'Cerrado',
}

const LEGAL_TYPE: Record<string, string> = {
  derecho_de_peticion: 'Derecho de petición',
  tutela: 'Acción de tutela',
  accion_popular: 'Acción popular',
  accion_de_cumplimiento: 'Acción de cumplimiento',
  denuncia_penal: 'Denuncia penal',
  queja: 'Queja / PQRS',
}

const SCOPE_LABEL: Record<string, string> = {
  neighborhood: 'Barrio',
  locality: 'Localidad',
  city: 'Cartagena',
  regional: 'Regional',
  national: 'Nacional',
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

const QUICK_ACTIONS = [
  {
    href: '/dashboard/reports/new',
    label: 'Reportar un caso',
    description: 'Registra una situación del territorio y haz seguimiento.',
    icon: FilePlus2,
    accent: '#4A90E2',
  },
  {
    href: '/dashboard/proposals/new',
    label: 'Crear propuesta',
    description: 'Convierte una idea en una iniciativa ciudadana estructurada.',
    icon: FileText,
    accent: '#2BA745',
  },
  {
    href: '/dashboard/governance',
    label: 'Decidir',
    description: 'Consulta las votaciones para las que eres elegible.',
    icon: Vote,
    accent: '#F5B700',
  },
  {
    href: '/dashboard/ai',
    label: 'Consultar IA cívica',
    description: 'Analiza problemas, derechos, propuestas y datos públicos.',
    icon: Sparkles,
    accent: '#6D5CC7',
  },
  {
    href: '/dashboard/legal/new',
    label: 'Ejercer control público',
    description: 'Prepara peticiones, quejas y otros instrumentos ciudadanos.',
    icon: Scale,
    accent: '#D72638',
  },
  {
    href: '/dashboard/reports/map',
    label: 'Explorar el territorio',
    description: 'Observa reportes y patrones ciudadanos sobre el mapa.',
    icon: MapPinned,
    accent: '#178C8C',
  },
] as const

function formatDate(iso: string | null): string {
  if (!iso) return 'Sin fecha'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function hoursUntil(iso: string | null): number | null {
  if (!iso) return null
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 3_600_000)
}

function number(value: number): string {
  return new Intl.NumberFormat('es-CO').format(value)
}

function statusPill(label: string, tone: 'blue' | 'gold' | 'green' | 'red' | 'neutral' = 'neutral') {
  const tones = {
    blue: 'border-[#C8D8EE] bg-[#EAF1FB] text-[#245EA7]',
    gold: 'border-[#F1DEA5] bg-[#FFF4D1] text-[#8C6500]',
    green: 'border-[#CBE9D1] bg-[#EAF6ED] text-[#22883A]',
    red: 'border-[#F4C9CE] bg-[#FCEBED] text-[#B72232]',
    neutral: 'border-[#E1E7EF] bg-[#F7F9FC] text-[#607087]',
  }

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[.08em] ${tones[tone]}`}>
      {label}
    </span>
  )
}

function Skeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="h-64 animate-pulse rounded-[28px] bg-white" />
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-2xl bg-white" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-80 animate-pulse rounded-2xl bg-white" />
        <div className="h-80 animate-pulse rounded-2xl bg-white" />
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const data = await apiFetch<DashboardResponse>('/dashboard/me')
      setDashboard(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar tu espacio ciudadano.')
    } finally {
      if (isRefresh) setRefreshing(false)
      else setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const cityVoting = useMemo(() => {
    return dashboard?.city.governance.by_status.find((item) => item.status === 'voting')?.count ?? 0
  }, [dashboard])

  const cityResolved = useMemo(() => {
    return dashboard?.city.reports.by_category.reduce((sum, category) => sum + category.resolved_count, 0) ?? 0
  }, [dashboard])

  if (loading) return <Skeleton />

  if (!dashboard || error) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center px-6 py-16">
        <div className="w-full rounded-[24px] border border-[#F4C9CE] bg-white p-8 text-center shadow-sm">
          <AlertCircle className="mx-auto text-[#D72638]" size={32} />
          <h1 className="mt-4 font-display text-2xl font-extrabold text-[#0A2A66]">No pudimos abrir tu centro ciudadano</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#607087]">
            {error ?? 'El servicio no devolvió datos del dashboard.'}
          </p>
          <button onClick={() => void load()} className="btn-primary mt-6 inline-flex items-center gap-2">
            <RefreshCw size={15} />
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  const territory = dashboard.profile.neighborhood
    ? `${dashboard.profile.neighborhood} · Cartagena`
    : 'Cartagena de Indias'

  const pendingVoteCount = dashboard.attention.pending_votes.length
  const reportOpen = dashboard.mine.reports.by_status.open ?? 0
  const reportResolved = dashboard.mine.reports.by_status.resolved ?? 0
  const proposalActive =
    (dashboard.mine.proposals.by_status.idea ?? 0) +
    (dashboard.mine.proposals.by_status.draft ?? 0) +
    (dashboard.mine.proposals.by_status.debate ?? 0) +
    (dashboard.mine.proposals.by_status.voting ?? 0)

  const participationTotal =
    dashboard.reputation.total_votes +
    dashboard.reputation.total_proposals +
    dashboard.reputation.total_reports +
    dashboard.reputation.endorsements_given

  return (
    <div className="min-h-screen bg-[#F7F9FC]">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <section className="overflow-hidden rounded-[28px] bg-[#0A2A66] text-white shadow-[0_22px_60px_rgba(10,42,102,.16)]">
          <div className="grid gap-0 lg:grid-cols-[1.15fr_.85fr]">
            <div className="relative px-6 py-9 sm:px-9 lg:px-11 lg:py-11">
              <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-[#4A90E2]/15 blur-3xl" />
              <div className="relative z-10">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.14em] text-[#CFE0F8]">
                    Mi VÉRTICE
                  </span>
                  {dashboard.profile.verification_level >= 1
                    ? statusPill('Identidad verificada', 'green')
                    : statusPill('Verificación pendiente', 'gold')}
                </div>

                <h1 className="mt-5 max-w-2xl font-display text-3xl font-extrabold leading-tight tracking-[-.03em] sm:text-4xl lg:text-5xl">
                  Tu centro de acción ciudadana.
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-[#CAD8EB] sm:text-base">
                  Reporta, propone, decide, ejerce control público y sigue el impacto de tu participación desde un solo lugar.
                </p>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Link href="/dashboard/reports/new" className="inline-flex items-center gap-2 rounded-xl bg-[#F5B700] px-4 py-3 text-xs font-extrabold text-[#0A2A66] transition hover:brightness-105">
                    <FilePlus2 size={15} />
                    Nueva acción
                  </Link>
                  <Link href="/dashboard/ai" className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/8 px-4 py-3 text-xs font-bold text-white transition hover:bg-white/12">
                    <MessageCircleMore size={15} />
                    Preguntar a la IA
                  </Link>
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 bg-white/[.055] p-6 lg:border-l lg:border-t-0 lg:p-8">
              <div className="grid h-full gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/[.06] p-4">
                  <div className="text-[9px] font-extrabold uppercase tracking-[.14em] text-[#9DB6D8]">Territorio</div>
                  <div className="mt-2 text-sm font-bold">{territory}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[.06] p-4">
                  <div className="text-[9px] font-extrabold uppercase tracking-[.14em] text-[#9DB6D8]">Nivel cívico</div>
                  <div className="mt-2 flex items-center gap-2 text-sm font-bold">
                    <Star size={15} className="text-[#F5B700]" />
                    {dashboard.reputation.level}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[.06] p-4">
                  <div className="text-[9px] font-extrabold uppercase tracking-[.14em] text-[#9DB6D8]">Participaciones</div>
                  <div className="mt-2 text-2xl font-extrabold">{number(participationTotal)}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[.06] p-4">
                  <div className="text-[9px] font-extrabold uppercase tracking-[.14em] text-[#9DB6D8]">Reputación</div>
                  <div className="mt-2 text-2xl font-extrabold">{number(dashboard.reputation.score)}</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[24px] border border-[#E1E7EF] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-[#D72638]" />
                <span className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#D72638]">Requiere tu atención</span>
              </div>
              <h2 className="mt-1 font-display text-xl font-extrabold text-[#0A2A66]">
                {dashboard.attention.total_items === 0
                  ? 'No tienes acciones urgentes pendientes'
                  : `${dashboard.attention.total_items} ${dashboard.attention.total_items === 1 ? 'acción pendiente' : 'acciones pendientes'}`}
              </h2>
            </div>
            <button
              onClick={() => void load(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 self-start rounded-xl border border-[#E1E7EF] px-3 py-2 text-[10px] font-bold uppercase tracking-[.08em] text-[#607087] transition hover:border-[#BFD0E8] hover:text-[#0A2A66] disabled:opacity-50 sm:self-auto"
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
              Actualizar
            </button>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
            {dashboard.attention.verification_required && (
              <Link href="/dashboard/identity" className="group rounded-2xl border border-[#F1DEA5] bg-[#FFF9E8] p-4 transition hover:-translate-y-0.5 hover:shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <ShieldCheck size={19} className="text-[#9A6A00]" />
                  <ArrowUpRight size={14} className="text-[#9A6A00] opacity-50 transition group-hover:opacity-100" />
                </div>
                <div className="mt-3 text-sm font-extrabold text-[#0A2A66]">Verifica tu identidad</div>
                <p className="mt-1 text-xs leading-5 text-[#607087]">Activa reportes, propuestas, voto y control público.</p>
              </Link>
            )}

            {dashboard.attention.pending_votes.slice(0, 2).map((proposal) => {
              const hours = hoursUntil(proposal.voting_ends_at)
              return (
                <Link key={proposal.id} href="/dashboard/governance" className="group rounded-2xl border border-[#F1DEA5] bg-[#FFF9E8] p-4 transition hover:-translate-y-0.5 hover:shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <Vote size={19} className="text-[#9A6A00]" />
                    <ArrowUpRight size={14} className="text-[#9A6A00] opacity-50 transition group-hover:opacity-100" />
                  </div>
                  <div className="mt-3 line-clamp-2 text-sm font-extrabold text-[#0A2A66]">{proposal.title}</div>
                  <p className="mt-1 text-xs leading-5 text-[#607087]">
                    Votación pendiente{hours !== null && hours > 0 ? ` · ${hours}h restantes` : ''}
                  </p>
                </Link>
              )
            })}

            {dashboard.attention.reports_in_progress > 0 && (
              <Link href="/dashboard/reports" className="group rounded-2xl border border-[#C8D8EE] bg-[#F4F8FD] p-4 transition hover:-translate-y-0.5 hover:shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <MapPinned size={19} className="text-[#245EA7]" />
                  <ArrowUpRight size={14} className="text-[#245EA7] opacity-50 transition group-hover:opacity-100" />
                </div>
                <div className="mt-3 text-sm font-extrabold text-[#0A2A66]">Reportes en gestión</div>
                <p className="mt-1 text-xs leading-5 text-[#607087]">{dashboard.attention.reports_in_progress} de tus casos siguen en proceso.</p>
              </Link>
            )}

            {dashboard.attention.legal_needs_action > 0 && (
              <Link href="/dashboard/legal" className="group rounded-2xl border border-[#F4C9CE] bg-[#FFF7F8] p-4 transition hover:-translate-y-0.5 hover:shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <Scale size={19} className="text-[#D72638]" />
                  <ArrowUpRight size={14} className="text-[#D72638] opacity-50 transition group-hover:opacity-100" />
                </div>
                <div className="mt-3 text-sm font-extrabold text-[#0A2A66]">Control público pendiente</div>
                <p className="mt-1 text-xs leading-5 text-[#607087]">{dashboard.attention.legal_needs_action} documentos requieren revisión o envío.</p>
              </Link>
            )}

            {dashboard.attention.total_items === 0 && (
              <div className="col-span-full flex items-center gap-4 rounded-2xl border border-[#CBE9D1] bg-[#F4FBF5] p-5">
                <CheckCircle2 size={23} className="flex-shrink-0 text-[#2BA745]" />
                <div>
                  <div className="text-sm font-extrabold text-[#0A2A66]">Todo al día</div>
                  <p className="mt-1 text-xs leading-5 text-[#607087]">Puedes explorar nuevas propuestas, reportar situaciones o iniciar una actuación de control público.</p>
                </div>
              </div>
            )}
          </div>

          {pendingVoteCount > 2 && (
            <Link href="/dashboard/governance" className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-[#0A2A66] hover:underline">
              Ver las {pendingVoteCount} votaciones pendientes
              <ArrowUpRight size={13} />
            </Link>
          )}
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: 'Mis reportes', value: dashboard.mine.reports.total, sub: `${reportOpen} abiertos · ${reportResolved} resueltos`, icon: MapPinned, href: '/dashboard/reports', color: '#4A90E2' },
            { label: 'Mis propuestas', value: dashboard.mine.proposals.total, sub: `${proposalActive} activas`, icon: FileText, href: '/dashboard/proposals', color: '#2BA745' },
            { label: 'Mis votos', value: dashboard.reputation.total_votes, sub: `${dashboard.reputation.endorsements_given} avales otorgados`, icon: Vote, href: '/dashboard/governance', color: '#F5B700' },
            { label: 'Control público', value: dashboard.mine.legal.total, sub: `${dashboard.attention.legal_needs_action} por completar`, icon: Scale, href: '/dashboard/legal', color: '#D72638' },
            { label: 'Puntuación cívica', value: dashboard.reputation.score, sub: `${dashboard.reputation.badges_count} reconocimientos`, icon: BadgeCheck, href: '/dashboard/reputation', color: '#0A2A66' },
          ].map(({ label, value, sub, icon: Icon, href, color }) => (
            <Link key={label} href={href} className="group rounded-2xl border border-[#E1E7EF] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#BFD0E8] hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}12`, color }}>
                  <Icon size={18} strokeWidth={1.9} />
                </div>
                <ArrowUpRight size={14} className="text-[#94A0B0] transition group-hover:text-[#0A2A66]" />
              </div>
              <div className="mt-3 text-2xl font-extrabold text-[#0A2A66]">{number(value)}</div>
              <div className="mt-1 text-xs font-bold text-[#0A2A66]">{label}</div>
              <div className="mt-1 text-[10px] leading-4 text-[#7B8799]">{sub}</div>
            </Link>
          ))}
        </section>

        <section className="mt-8">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#4A90E2]">Operar VÉRTICE</span>
              <h2 className="mt-1 font-display text-2xl font-extrabold text-[#0A2A66]">¿Qué quieres hacer?</h2>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {QUICK_ACTIONS.map(({ href, label, description, icon: Icon, accent }) => (
              <Link key={href} href={href} className="group rounded-[22px] border border-[#E1E7EF] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: `${accent}12`, color: accent }}>
                    <Icon size={19} />
                  </div>
                  <ArrowUpRight size={15} className="text-[#94A0B0] transition group-hover:text-[#0A2A66]" />
                </div>
                <h3 className="mt-4 text-sm font-extrabold text-[#0A2A66]">{label}</h3>
                <p className="mt-1 text-xs leading-5 text-[#607087]">{description}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-3">
          <div className="rounded-[24px] border border-[#E1E7EF] bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#4A90E2]">Mis reportes</span>
                <h2 className="mt-1 font-display text-xl font-extrabold text-[#0A2A66]">Seguimiento territorial</h2>
              </div>
              <Link href="/dashboard/reports" className="text-[#607087] hover:text-[#0A2A66]" aria-label="Ver todos los reportes">
                <ArrowUpRight size={16} />
              </Link>
            </div>

            <div className="mt-5 space-y-3">
              {dashboard.mine.reports.recent.length === 0 ? (
                <EmptyState icon={MapPinned} text="Aún no has creado reportes." href="/dashboard/reports/new" cta="Crear reporte" />
              ) : (
                dashboard.mine.reports.recent.map((report) => (
                  <Link key={report.id} href={`/dashboard/reports/${report.id}`} className="block rounded-2xl border border-[#EDF0F4] p-4 transition hover:border-[#C8D8EE] hover:bg-[#FAFCFF]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[9px] font-extrabold uppercase tracking-[.1em] text-[#4A90E2]">{CATEGORY_LABEL[report.category] ?? report.category}</div>
                        <div className="mt-1 line-clamp-2 text-sm font-extrabold text-[#0A2A66]">{report.title}</div>
                      </div>
                      {statusPill(REPORT_STATUS[report.status] ?? report.status, report.status === 'resolved' ? 'green' : report.status === 'in_progress' ? 'gold' : 'blue')}
                    </div>
                    <div className="mt-2 text-[10px] text-[#7B8799]">{report.neighborhood ?? 'Cartagena'} · actualizado {formatDate(report.updated_at)}</div>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[24px] border border-[#E1E7EF] bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#2BA745]">Mis propuestas</span>
                <h2 className="mt-1 font-display text-xl font-extrabold text-[#0A2A66]">Iniciativas ciudadanas</h2>
              </div>
              <Link href="/dashboard/proposals" className="text-[#607087] hover:text-[#0A2A66]" aria-label="Ver todas las propuestas">
                <ArrowUpRight size={16} />
              </Link>
            </div>

            <div className="mt-5 space-y-3">
              {dashboard.mine.proposals.recent.length === 0 ? (
                <EmptyState icon={FileText} text="Aún no has presentado propuestas." href="/dashboard/proposals/new" cta="Crear propuesta" />
              ) : (
                dashboard.mine.proposals.recent.map((proposal) => (
                  <Link key={proposal.id} href={`/dashboard/proposals/${proposal.id}`} className="block rounded-2xl border border-[#EDF0F4] p-4 transition hover:border-[#CBE9D1] hover:bg-[#FBFDFB]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[9px] font-extrabold uppercase tracking-[.1em] text-[#2BA745]">{SCOPE_LABEL[proposal.scope] ?? proposal.scope}</div>
                        <div className="mt-1 line-clamp-2 text-sm font-extrabold text-[#0A2A66]">{proposal.title}</div>
                      </div>
                      {statusPill(PROPOSAL_STATUS[proposal.status] ?? proposal.status, proposal.status === 'approved' || proposal.status === 'executed' ? 'green' : proposal.status === 'voting' ? 'gold' : 'neutral')}
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-[10px] text-[#7B8799]">
                      <span>{proposal.endorsement_count} avales</span>
                      <span>{proposal.total_votes} votos</span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[24px] border border-[#E1E7EF] bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#D72638]">Control público</span>
                <h2 className="mt-1 font-display text-xl font-extrabold text-[#0A2A66]">Mis actuaciones</h2>
              </div>
              <Link href="/dashboard/legal" className="text-[#607087] hover:text-[#0A2A66]" aria-label="Ver actuaciones de control público">
                <ArrowUpRight size={16} />
              </Link>
            </div>

            <div className="mt-5 space-y-3">
              {dashboard.mine.legal.recent.length === 0 ? (
                <EmptyState icon={Gavel} text="Aún no has iniciado actuaciones de control público." href="/dashboard/legal/new" cta="Iniciar actuación" />
              ) : (
                dashboard.mine.legal.recent.map((document) => (
                  <Link key={document.id} href={`/dashboard/legal/${document.id}`} className="block rounded-2xl border border-[#EDF0F4] p-4 transition hover:border-[#F4C9CE] hover:bg-[#FFFDFD]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[9px] font-extrabold uppercase tracking-[.1em] text-[#D72638]">{LEGAL_TYPE[document.legal_type] ?? document.legal_type}</div>
                        <div className="mt-1 text-sm font-extrabold text-[#0A2A66]">{LEGAL_STATUS[document.status] ?? document.status}</div>
                      </div>
                      {statusPill(document.urgency, document.urgency === 'critica' || document.urgency === 'alta' ? 'red' : 'neutral')}
                    </div>
                    <div className="mt-2 text-[10px] text-[#7B8799]">Creado {formatDate(document.created_at)}</div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="mt-8 overflow-hidden rounded-[24px] border border-[#DCE5F0] bg-white shadow-sm">
          <div className="grid lg:grid-cols-[1fr_1.2fr]">
            <div className="bg-[#F1F6FC] p-6 sm:p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0A2A66] text-white">
                <BarChart3 size={21} />
              </div>
              <span className="mt-5 block text-[10px] font-extrabold uppercase tracking-[.14em] text-[#4A90E2]">Panorama de Cartagena</span>
              <h2 className="mt-2 font-display text-2xl font-extrabold text-[#0A2A66]">Tu actividad dentro del contexto de la ciudad.</h2>
              <p className="mt-3 max-w-lg text-sm leading-6 text-[#607087]">
                Estos datos son agregados públicos del territorio. Tu panel personal permanece separado para que puedas distinguir claramente tu gestión del panorama colectivo.
              </p>
              <Link href="/dashboard/reports/map" className="mt-5 inline-flex items-center gap-2 text-xs font-extrabold text-[#0A2A66] hover:underline">
                Explorar mapa ciudadano
                <ArrowUpRight size={13} />
              </Link>
            </div>

            <div className="grid gap-px bg-[#E1E7EF] sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: 'Reportes registrados', value: dashboard.city.reports.total_reports, icon: MapPinned },
                { label: 'Reportes activos', value: dashboard.city.reports.open_reports, icon: Activity },
                { label: 'Casos resueltos', value: cityResolved, icon: CheckCircle2 },
                { label: 'Votaciones abiertas', value: cityVoting, icon: Vote },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="bg-white p-5 sm:p-6">
                  <Icon size={17} className="text-[#4A90E2]" />
                  <div className="mt-5 text-2xl font-extrabold text-[#0A2A66]">{number(value)}</div>
                  <div className="mt-1 text-[10px] font-bold uppercase tracking-[.08em] text-[#7B8799]">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="mt-5 flex items-center justify-between gap-4 px-1 text-[9px] uppercase tracking-[.08em] text-[#94A0B0]">
          <span>Centro ciudadano · datos reales de tu cuenta</span>
          <span>Actualizado {formatDate(dashboard.generated_at)}</span>
        </div>
      </div>
    </div>
  )
}

function EmptyState({
  icon: Icon,
  text,
  href,
  cta,
}: {
  icon: typeof FileText
  text: string
  href: string
  cta: string
}) {
  return (
    <div className="rounded-2xl border border-dashed border-[#D6DEE8] bg-[#FAFBFC] p-5 text-center">
      <Icon size={24} className="mx-auto text-[#94A0B0]" />
      <p className="mx-auto mt-3 max-w-xs text-xs leading-5 text-[#607087]">{text}</p>
      <Link href={href} className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[.08em] text-[#0A2A66] hover:underline">
        {cta}
        <ArrowUpRight size={11} />
      </Link>
    </div>
  )
}
