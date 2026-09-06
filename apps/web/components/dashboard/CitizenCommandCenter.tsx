'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  BadgeCheck,
  CheckCircle2,
  FilePlus2,
  FileText,
  GitBranch,
  MapPinned,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sparkles,
  Vote,
  type LucideIcon,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'

interface PendingVote {
  id: string
  title: string
  voting_ends_at: string | null
}

interface RecentReport {
  id: string
  title: string
  status: string
  neighborhood: string | null
  updated_at: string
}

interface RecentProposal {
  id: string
  title: string
  status: string
  endorsement_count: number
  total_votes: number
  created_at: string
}

interface RecentCivicAction {
  id: string
  title: string
  category: string
  neighborhood: string | null
  status: string
  civic_score: number
  confidence_score: number
  evidence_count: number
  updated_at: string
}

interface DashboardResponse {
  profile: {
    neighborhood: string | null
    verification_level: number
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
    pending_votes: PendingVote[]
    legal_needs_action: number
    reports_in_progress: number
    civic_actions_needing_evidence: number
    total_items: number
  }
  mine: {
    civic_actions: {
      total: number
      active: number
      verified: number
      needs_evidence: number
      awaiting_verification: number
      recent: RecentCivicAction[]
    }
    reports: {
      total: number
      recent: RecentReport[]
    }
    proposals: {
      total: number
      recent: RecentProposal[]
    }
    workflows: {
      total: number
      active: number
    }
  }
  city: {
    reports: {
      total_reports: number
      by_category: Array<{ resolved_count: number }>
    }
    governance: {
      by_status: Array<{ status: string; count: number }>
    }
  }
  generated_at: string
}

const ACTION_STATUS: Record<string, string> = {
  proposed: 'Propuesta',
  preparing: 'Preparando',
  in_progress: 'En ejecución',
  result_declared: 'Resultado declarado',
  under_verification: 'En verificación',
  verified: 'Verificada',
  not_completed: 'No completada',
  no_evidence: 'Sin evidencia',
  disputed: 'Disputada',
  cancelled: 'Cancelada',
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
  executed: 'Ejecutada',
}

const QUICK_ACTIONS: Array<{
  href: string
  label: string
  description: string
  icon: LucideIcon
}> = [
  {
    href: '/dashboard/community/actions/new',
    label: 'Crear acción cívica',
    description: 'Define una gestión, documenta evidencia y construye reputación verificable.',
    icon: Activity,
  },
  {
    href: '/dashboard/reports/new',
    label: 'Reportar situación',
    description: 'Registra un problema territorial para seguimiento ciudadano.',
    icon: MapPinned,
  },
  {
    href: '/dashboard/proposals/new',
    label: 'Crear propuesta',
    description: 'Convierte una idea en una iniciativa ciudadana estructurada.',
    icon: FileText,
  },
  {
    href: '/dashboard/governance',
    label: 'Participar en consultas',
    description: 'Revisa las decisiones y votaciones para las que eres elegible.',
    icon: Vote,
  },
  {
    href: '/dashboard/ai',
    label: 'Consultar IA cívica',
    description: 'Analiza problemas, derechos, propuestas y datos públicos.',
    icon: Sparkles,
  },
  {
    href: '/dashboard/legal/new',
    label: 'Control público',
    description: 'Prepara peticiones, quejas y otros instrumentos ciudadanos.',
    icon: Scale,
  },
]

function number(value: number): string {
  return new Intl.NumberFormat('es-CO').format(value)
}

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

function statusTone(status: string): string {
  if (['verified', 'resolved', 'approved', 'executed'].includes(status)) {
    return 'border-[#CBE9D1] bg-[#EAF6ED] text-[#22883A]'
  }
  if (['disputed', 'no_evidence', 'rejected'].includes(status)) {
    return 'border-[#F4C9CE] bg-[#FCEBED] text-[#B72232]'
  }
  if (['result_declared', 'under_verification', 'in_progress', 'voting'].includes(status)) {
    return 'border-[#F1DEA5] bg-[#FFF4D1] text-[#8C6500]'
  }
  return 'border-[#C8D8EE] bg-[#EAF1FB] text-[#245EA7]'
}

function StatusPill({ status, label }: { status: string; label: string }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[.08em] ${statusTone(status)}`}>
      {label}
    </span>
  )
}

function MetricCard({
  label,
  value,
  detail,
  href,
  icon: Icon,
}: {
  label: string
  value: number
  detail: string
  href: string
  icon: LucideIcon
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-[#E1E7EF] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#BFD0E8] hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF1FB] text-[#0A2A66]">
          <Icon size={18} />
        </span>
        <ArrowUpRight size={14} className="text-[#94A0B0] transition group-hover:text-[#0A2A66]" />
      </div>
      <div className="mt-3 text-2xl font-extrabold text-[#0A2A66]">{number(value)}</div>
      <div className="mt-1 text-xs font-bold text-[#0A2A66]">{label}</div>
      <div className="mt-1 text-[10px] leading-4 text-[#7B8799]">{detail}</div>
    </Link>
  )
}

function EmptyState({ text, href, cta }: { text: string; href: string; cta: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#D6DEE8] bg-[#FAFBFC] p-6 text-center">
      <Activity size={25} className="mx-auto text-[#94A0B0]" />
      <p className="mx-auto mt-3 max-w-md text-xs leading-5 text-[#607087]">{text}</p>
      <Link
        href={href}
        className="mt-4 inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[.08em] text-[#0A2A66] hover:underline"
      >
        {cta}
        <ArrowUpRight size={11} />
      </Link>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8" aria-label="Cargando dashboard">
      <div className="h-64 animate-pulse rounded-[28px] bg-white" />
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-2xl bg-white" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-2xl bg-white" />
    </div>
  )
}

export default function CitizenCommandCenter() {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true)
    setError(null)
    try {
      setDashboard(await apiFetch<DashboardResponse>('/dashboard/me'))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible cargar tu centro ciudadano.')
    } finally {
      refresh ? setRefreshing(false) : setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const cityVoting = useMemo(
    () => dashboard?.city.governance.by_status.find((item) => item.status === 'voting')?.count ?? 0,
    [dashboard],
  )

  const cityResolved = useMemo(
    () => dashboard?.city.reports.by_category.reduce((sum, category) => sum + category.resolved_count, 0) ?? 0,
    [dashboard],
  )

  if (loading) return <LoadingState />

  if (!dashboard || error) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center px-6 py-16">
        <div className="w-full rounded-[24px] border border-[#F4C9CE] bg-white p-8 text-center shadow-sm" role="alert">
          <AlertCircle className="mx-auto text-[#D72638]" size={32} />
          <h1 className="mt-4 font-display text-2xl font-extrabold text-[#0A2A66]">
            No pudimos abrir tu centro ciudadano
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#607087]">
            {error ?? 'El servicio no devolvió datos del dashboard.'}
          </p>
          <button
            onClick={() => void load()}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#0A2A66] px-4 py-3 text-xs font-extrabold text-white"
          >
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
  const participationTotal =
    dashboard.reputation.total_votes +
    dashboard.reputation.total_proposals +
    dashboard.reputation.total_reports +
    dashboard.reputation.endorsements_given

  return (
    <div className="min-h-screen bg-[#F7F9FC]">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <section className="overflow-hidden rounded-[28px] bg-[#0A2A66] text-white shadow-[0_22px_60px_rgba(10,42,102,.16)]">
          <div className="grid lg:grid-cols-[1.2fr_.8fr]">
            <div className="relative px-6 py-9 sm:px-9 lg:px-11 lg:py-11">
              <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-[#4A90E2]/15 blur-3xl" />
              <div className="relative z-10">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.14em] text-[#CFE0F8]">
                    Mi VÉRTICE
                  </span>
                  <span className={`rounded-full border px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.1em] ${dashboard.profile.verification_level >= 1 ? 'border-[#6DDB83]/30 bg-[#2BA745]/20 text-[#CFF4D7]' : 'border-[#F5D46E]/30 bg-[#F5B700]/15 text-[#FFE59A]'}`}>
                    {dashboard.profile.verification_level >= 1 ? 'Identidad verificada' : 'Verificación pendiente'}
                  </span>
                </div>
                <h1 className="mt-5 max-w-3xl font-display text-3xl font-extrabold leading-tight tracking-[-.03em] sm:text-4xl lg:text-5xl">
                  Convierte gestión en evidencia pública.
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-[#CAD8EB] sm:text-base">
                  Crea acciones cívicas, documenta resultados y gestiona reportes, propuestas y control público desde un solo centro ciudadano.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href="/dashboard/community/actions/new"
                    className="inline-flex items-center gap-2 rounded-xl bg-[#F5B700] px-4 py-3 text-xs font-extrabold text-[#0A2A66]"
                  >
                    <FilePlus2 size={15} />
                    Crear acción cívica
                  </Link>
                  <Link
                    href="/dashboard/reports/new"
                    className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-xs font-bold text-white"
                  >
                    <MapPinned size={15} />
                    Reportar situación
                  </Link>
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 bg-white/[.055] p-6 lg:border-l lg:border-t-0 lg:p-8">
              <div className="grid h-full gap-4 sm:grid-cols-2">
                {[
                  ['Territorio', territory],
                  ['Acciones activas', number(dashboard.mine.civic_actions.active)],
                  ['Acciones verificadas', number(dashboard.mine.civic_actions.verified)],
                  ['Participaciones', number(participationTotal)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-white/[.06] p-4">
                    <div className="text-[9px] font-extrabold uppercase tracking-[.14em] text-[#9DB6D8]">{label}</div>
                    <div className="mt-2 text-lg font-extrabold">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[24px] border border-[#E1E7EF] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[#D72638]">
                <Activity size={16} />
                <span className="text-[10px] font-extrabold uppercase tracking-[.14em]">Requiere tu atención</span>
              </div>
              <h2 className="mt-1 font-display text-xl font-extrabold text-[#0A2A66]">
                {dashboard.attention.total_items === 0
                  ? 'No tienes pendientes inmediatos'
                  : `${dashboard.attention.total_items} ${dashboard.attention.total_items === 1 ? 'pendiente' : 'pendientes'} por revisar`}
              </h2>
            </div>
            <button
              onClick={() => void load(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 self-start rounded-xl border border-[#E1E7EF] px-3 py-2 text-[10px] font-bold uppercase tracking-[.08em] text-[#607087] disabled:opacity-50 sm:self-auto"
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
              Actualizar
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {dashboard.profile.verification_level < 1 && (
              <Link href="/dashboard/identity" className="rounded-2xl border border-[#F1DEA5] bg-[#FFF9E8] p-4">
                <ShieldCheck size={19} className="text-[#9A6A00]" />
                <div className="mt-3 text-sm font-extrabold text-[#0A2A66]">Verifica tu identidad</div>
                <p className="mt-1 text-xs leading-5 text-[#607087]">Activa los flujos cívicos protegidos de tu cuenta.</p>
              </Link>
            )}

            {dashboard.attention.civic_actions_needing_evidence > 0 && (
              <Link href="/dashboard/community/actions" className="rounded-2xl border border-[#F1DEA5] bg-[#FFF9E8] p-4">
                <BadgeCheck size={19} className="text-[#9A6A00]" />
                <div className="mt-3 text-sm font-extrabold text-[#0A2A66]">Acciones sin evidencia suficiente</div>
                <p className="mt-1 text-xs leading-5 text-[#607087]">
                  {dashboard.attention.civic_actions_needing_evidence} {dashboard.attention.civic_actions_needing_evidence === 1 ? 'acción necesita' : 'acciones necesitan'} documentación.
                </p>
              </Link>
            )}

            {dashboard.attention.pending_votes.slice(0, 1).map((proposal) => (
              <Link key={proposal.id} href="/dashboard/governance" className="rounded-2xl border border-[#F1DEA5] bg-[#FFF9E8] p-4">
                <Vote size={19} className="text-[#9A6A00]" />
                <div className="mt-3 line-clamp-2 text-sm font-extrabold text-[#0A2A66]">{proposal.title}</div>
                <p className="mt-1 text-xs leading-5 text-[#607087]">Votación pendiente · {formatDate(proposal.voting_ends_at)}</p>
              </Link>
            ))}

            {dashboard.attention.reports_in_progress > 0 && (
              <Link href="/dashboard/reports" className="rounded-2xl border border-[#C8D8EE] bg-[#F4F8FD] p-4">
                <MapPinned size={19} className="text-[#245EA7]" />
                <div className="mt-3 text-sm font-extrabold text-[#0A2A66]">Reportes en gestión</div>
                <p className="mt-1 text-xs leading-5 text-[#607087]">{dashboard.attention.reports_in_progress} casos continúan en proceso.</p>
              </Link>
            )}

            {dashboard.attention.legal_needs_action > 0 && (
              <Link href="/dashboard/legal" className="rounded-2xl border border-[#F4C9CE] bg-[#FFF7F8] p-4">
                <Scale size={19} className="text-[#D72638]" />
                <div className="mt-3 text-sm font-extrabold text-[#0A2A66]">Control público pendiente</div>
                <p className="mt-1 text-xs leading-5 text-[#607087]">{dashboard.attention.legal_needs_action} documentos requieren revisión.</p>
              </Link>
            )}

            {dashboard.attention.total_items === 0 && (
              <div className="col-span-full flex items-center gap-4 rounded-2xl border border-[#CBE9D1] bg-[#F4FBF5] p-5">
                <CheckCircle2 size={23} className="flex-shrink-0 text-[#2BA745]" />
                <div>
                  <div className="text-sm font-extrabold text-[#0A2A66]">Todo al día</div>
                  <p className="mt-1 text-xs leading-5 text-[#607087]">Puedes iniciar una nueva acción cívica o explorar la red de gestión.</p>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            label="Acciones cívicas"
            value={dashboard.mine.civic_actions.total}
            detail={`${dashboard.mine.civic_actions.active} activas · ${dashboard.mine.civic_actions.verified} verificadas`}
            href="/dashboard/community/actions"
            icon={Activity}
          />
          <MetricCard
            label="Reportes territoriales"
            value={dashboard.mine.reports.total}
            detail={`${dashboard.attention.reports_in_progress} en gestión`}
            href="/dashboard/reports"
            icon={MapPinned}
          />
          <MetricCard
            label="Propuestas"
            value={dashboard.mine.proposals.total}
            detail={`${dashboard.reputation.endorsements_given} avales otorgados`}
            href="/dashboard/proposals"
            icon={FileText}
          />
          <MetricCard
            label="Flujos de gestión"
            value={dashboard.mine.workflows.total}
            detail={`${dashboard.mine.workflows.active} activos`}
            href="/dashboard/workflows"
            icon={GitBranch}
          />
          <MetricCard
            label="Participación cívica"
            value={dashboard.reputation.score}
            detail={`${dashboard.reputation.badges_count} reconocimientos · ${dashboard.reputation.level}`}
            href="/dashboard/reputation"
            icon={BadgeCheck}
          />
        </section>

        <section
          className="mt-8 rounded-[26px] border border-[#D8E2EF] bg-white p-5 shadow-sm sm:p-7"
          data-testid="civic-action-hub"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#4A90E2]">Gestión basada en evidencia</span>
              <h2 className="mt-1 font-display text-2xl font-extrabold text-[#0A2A66]">Mis acciones cívicas</h2>
              <p className="mt-2 max-w-2xl text-xs leading-5 text-[#607087]">
                El score refleja evidencia, resultados e impacto. Seguidores, likes e impresiones no suman reputación.
              </p>
            </div>
            <div className="flex gap-2">
              <Link href="/dashboard/community/actions" className="rounded-xl border border-[#D8E2EF] px-3 py-2 text-[10px] font-extrabold uppercase tracking-[.08em] text-[#0A2A66]">Ver todas</Link>
              <Link href="/dashboard/community/actions/new" className="rounded-xl bg-[#0A2A66] px-3 py-2 text-[10px] font-extrabold uppercase tracking-[.08em] text-white">Nueva acción</Link>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {dashboard.mine.civic_actions.recent.length === 0 ? (
              <div className="lg:col-span-2 xl:col-span-3">
                <EmptyState
                  text="Aún no has creado acciones cívicas. Crea la primera para documentar una gestión con evidencia y resultados trazables."
                  href="/dashboard/community/actions/new"
                  cta="Crear primera acción"
                />
              </div>
            ) : (
              dashboard.mine.civic_actions.recent.map((action) => (
                <Link
                  key={action.id}
                  href={`/dashboard/community/actions/${action.id}`}
                  className="group rounded-2xl border border-[#E1E7EF] p-5 transition hover:-translate-y-0.5 hover:border-[#BFD0E8] hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[9px] font-extrabold uppercase tracking-[.1em] text-[#4A90E2]">{action.category}</div>
                      <h3 className="mt-1 line-clamp-2 text-sm font-extrabold text-[#0A2A66]">{action.title}</h3>
                    </div>
                    <StatusPill status={action.status} label={ACTION_STATUS[action.status] ?? action.status} />
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-[#F7F9FC] px-2 py-3">
                      <div className="text-lg font-extrabold text-[#0A2A66]">{action.civic_score}</div>
                      <div className="text-[8px] font-bold uppercase tracking-[.07em] text-[#7B8799]">Score</div>
                    </div>
                    <div className="rounded-xl bg-[#F7F9FC] px-2 py-3">
                      <div className="text-lg font-extrabold text-[#0A2A66]">{action.evidence_count}</div>
                      <div className="text-[8px] font-bold uppercase tracking-[.07em] text-[#7B8799]">Evidencias</div>
                    </div>
                    <div className="rounded-xl bg-[#F7F9FC] px-2 py-3">
                      <div className="text-lg font-extrabold text-[#0A2A66]">{action.confidence_score}</div>
                      <div className="text-[8px] font-bold uppercase tracking-[.07em] text-[#7B8799]">Confianza</div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[10px] text-[#7B8799]">
                    <span>{action.neighborhood ?? 'Cartagena'}</span>
                    <span>{formatDate(action.updated_at)}</span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>

        <section className="mt-8">
          <span className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#4A90E2]">Operar VÉRTICE</span>
          <h2 className="mt-1 font-display text-2xl font-extrabold text-[#0A2A66]">¿Qué quieres hacer?</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {QUICK_ACTIONS.map(({ href, label, description, icon: Icon }) => (
              <Link key={href} href={href} className="group rounded-[22px] border border-[#E1E7EF] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-start justify-between gap-4">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF1FB] text-[#0A2A66]"><Icon size={19} /></span>
                  <ArrowUpRight size={15} className="text-[#94A0B0]" />
                </div>
                <h3 className="mt-4 text-sm font-extrabold text-[#0A2A66]">{label}</h3>
                <p className="mt-1 text-xs leading-5 text-[#607087]">{description}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-2">
          <div className="rounded-[24px] border border-[#E1E7EF] bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-extrabold text-[#0A2A66]">Mis reportes recientes</h2>
              <Link href="/dashboard/reports" aria-label="Ver todos los reportes"><ArrowUpRight size={16} /></Link>
            </div>
            <div className="mt-5 space-y-3">
              {dashboard.mine.reports.recent.length === 0 ? (
                <EmptyState text="Aún no has creado reportes territoriales." href="/dashboard/reports/new" cta="Crear reporte" />
              ) : (
                dashboard.mine.reports.recent.slice(0, 3).map((report) => (
                  <Link key={report.id} href={`/dashboard/reports/${report.id}`} className="block rounded-2xl border border-[#EDF0F4] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="line-clamp-2 text-sm font-extrabold text-[#0A2A66]">{report.title}</div>
                      <StatusPill status={report.status} label={REPORT_STATUS[report.status] ?? report.status} />
                    </div>
                    <div className="mt-2 text-[10px] text-[#7B8799]">{report.neighborhood ?? 'Cartagena'} · {formatDate(report.updated_at)}</div>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[24px] border border-[#E1E7EF] bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-extrabold text-[#0A2A66]">Mis propuestas recientes</h2>
              <Link href="/dashboard/proposals" aria-label="Ver todas las propuestas"><ArrowUpRight size={16} /></Link>
            </div>
            <div className="mt-5 space-y-3">
              {dashboard.mine.proposals.recent.length === 0 ? (
                <EmptyState text="Aún no has presentado propuestas ciudadanas." href="/dashboard/proposals/new" cta="Crear propuesta" />
              ) : (
                dashboard.mine.proposals.recent.slice(0, 3).map((proposal) => (
                  <Link key={proposal.id} href={`/dashboard/proposals/${proposal.id}`} className="block rounded-2xl border border-[#EDF0F4] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="line-clamp-2 text-sm font-extrabold text-[#0A2A66]">{proposal.title}</div>
                      <StatusPill status={proposal.status} label={PROPOSAL_STATUS[proposal.status] ?? proposal.status} />
                    </div>
                    <div className="mt-2 text-[10px] text-[#7B8799]">{proposal.endorsement_count} avales · {proposal.total_votes} votos · {formatDate(proposal.created_at)}</div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-[#E1E7EF] bg-white p-5">
            <MapPinned size={17} className="text-[#4A90E2]" />
            <div className="mt-4 text-2xl font-extrabold text-[#0A2A66]">{number(dashboard.city.reports.total_reports)}</div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-[.08em] text-[#7B8799]">Reportes en Cartagena</div>
          </div>
          <div className="rounded-2xl border border-[#E1E7EF] bg-white p-5">
            <CheckCircle2 size={17} className="text-[#2BA745]" />
            <div className="mt-4 text-2xl font-extrabold text-[#0A2A66]">{number(cityResolved)}</div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-[.08em] text-[#7B8799]">Reportes resueltos</div>
          </div>
          <div className="rounded-2xl border border-[#E1E7EF] bg-white p-5">
            <Vote size={17} className="text-[#F5B700]" />
            <div className="mt-4 text-2xl font-extrabold text-[#0A2A66]">{number(cityVoting)}</div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-[.08em] text-[#7B8799]">Consultas en votación</div>
          </div>
          <div className="rounded-2xl border border-[#E1E7EF] bg-[#0A2A66] p-5 text-white">
            <ShieldCheck size={17} className="text-[#F5B700]" />
            <div className="mt-4 text-sm font-extrabold">Evidencia antes que popularidad.</div>
            <div className="mt-1 text-[10px] leading-4 text-white/65">La reputación cívica no aumenta por seguidores, likes o impresiones.</div>
          </div>
        </section>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 px-1 text-[9px] uppercase tracking-[.08em] text-[#94A0B0]">
          <span>Centro ciudadano · datos de tu cuenta</span>
          <span>Actualizado {formatDate(dashboard.generated_at)}</span>
        </div>
      </div>
    </div>
  )
}
