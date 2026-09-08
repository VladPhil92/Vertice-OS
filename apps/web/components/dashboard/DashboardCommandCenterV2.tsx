'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import {
  Activity,
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  Building2,
  CheckCircle2,
  CircleUserRound,
  Clock3,
  CreditCard,
  FilePlus2,
  FileText,
  MapPin,
  MapPinned,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sparkles,
  Vote,
  type LucideIcon,
} from 'lucide-react'
import { CivicAvatar } from '@/components/community/CivicAvatar'
import DashboardActionResolutionPlan from '@/components/dashboard/DashboardActionResolutionPlan'
import {
  useDashboardRuntime,
  type CivicProfileType,
  type DashboardResolutionPlan,
  type DashboardRuntimeSnapshot,
} from '@/components/dashboard/DashboardIdentityProvider'

const PROFILE_TYPE_LABEL: Record<CivicProfileType, string> = {
  citizen: 'Ciudadanía',
  social_leader: 'Liderazgo social',
  candidate: 'Candidatura',
  organization_rep: 'Organización',
  public_official: 'Gestión pública',
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Propuesta',
  preparing: 'Preparando',
  in_progress: 'En gestión',
  result_declared: 'Resultado declarado',
  under_verification: 'En verificación',
  verified: 'Verificada',
  no_evidence: 'Sin evidencia',
  disputed: 'Disputada',
  open: 'Abierto',
  resolved: 'Resuelto',
  rejected: 'Rechazado',
  duplicate: 'Duplicado',
  idea: 'Idea',
  draft: 'Borrador',
  debate: 'En debate',
  voting: 'En votación',
  approved: 'Aprobada',
  executed: 'Ejecutada',
}

type Priority = 'urgent' | 'high' | 'normal'

type ActionDescriptor = {
  id: string
  label: string
  detail: string
  href: string
  priority: Priority
  count?: number
  icon: LucideIcon
}

type ActivityItem = {
  id: string
  title: string
  kind: string
  status: string
  date: string
  href: string
}

const PRIORITY_STYLE: Record<Priority, string> = {
  urgent: 'border-[#F1C8CE] bg-[#FCEBED] text-[#A91D2E]',
  high: 'border-[#F1DEA5] bg-[#FFF4D1] text-[#7B5A00]',
  normal: 'border-[#D6E2F0] bg-[#EDF3FA] text-[#245EA7]',
}

const PRIORITY_LABEL: Record<Priority, string> = {
  urgent: 'Prioridad alta',
  high: 'Atención',
  normal: 'Seguimiento',
}

const QUICK_ACTIONS: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: '/dashboard/community/actions/new', label: 'Crear acción cívica', icon: Activity },
  { href: '/dashboard/reports/new', label: 'Reportar situación', icon: MapPinned },
  { href: '/dashboard/proposals/new', label: 'Crear propuesta', icon: FileText },
  { href: '/dashboard/governance', label: 'Participar', icon: Vote },
  { href: '/dashboard/ai', label: 'IA cívica', icon: Sparkles },
]

function number(value: number): string {
  return new Intl.NumberFormat('es-CO').format(value)
}

function formatDate(value: string | null): string {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short' }).format(date)
}

function buildAttentionItems(
  dashboard: DashboardRuntimeSnapshot,
  resolutionPlan: DashboardResolutionPlan | null,
  profileIncomplete: boolean,
): ActionDescriptor[] {
  const items: ActionDescriptor[] = []

  if (dashboard.profile.verification_level < 2) {
    items.push({
      id: 'identity',
      label: 'Completar verificación básica',
      detail: 'Confirma tu identidad para usar flujos cívicos protegidos.',
      href: '/dashboard/identity',
      priority: 'urgent',
      icon: ShieldCheck,
    })
  }

  if ((resolutionPlan?.total ?? 0) > 0) {
    items.push({
      id: 'resolution',
      label: 'Resolver acciones abiertas',
      detail: 'Hay acciones con un siguiente paso concreto listo para ejecutar.',
      href: '#resolution-plan',
      count: resolutionPlan?.total,
      priority: 'urgent',
      icon: BadgeCheck,
    })
  }

  if (dashboard.attention.civic_actions_needing_evidence > 0) {
    items.push({
      id: 'evidence',
      label: 'Acciones sin evidencia suficiente',
      detail: 'Adjunta soporte verificable para que la gestión pueda avanzar.',
      href: '/dashboard/community/actions',
      count: dashboard.attention.civic_actions_needing_evidence,
      priority: 'urgent',
      icon: Activity,
    })
  }

  if (dashboard.attention.pending_votes.length > 0) {
    items.push({
      id: 'votes',
      label: 'Consultas pendientes',
      detail: 'Tienes mecanismos de participación abiertos.',
      href: '/dashboard/governance',
      count: dashboard.attention.pending_votes.length,
      priority: 'high',
      icon: Vote,
    })
  }

  if (dashboard.attention.legal_needs_action > 0) {
    items.push({
      id: 'legal',
      label: 'Control público por completar',
      detail: 'Hay actuaciones o documentos que necesitan una decisión tuya.',
      href: '/dashboard/legal',
      count: dashboard.attention.legal_needs_action,
      priority: 'high',
      icon: Scale,
    })
  }

  if (dashboard.attention.reports_in_progress > 0) {
    items.push({
      id: 'reports',
      label: 'Reportes en seguimiento',
      detail: 'Revisa cambios de estado y próximos pasos territoriales.',
      href: '/dashboard/reports',
      count: dashboard.attention.reports_in_progress,
      priority: 'normal',
      icon: MapPin,
    })
  }

  if (profileIncomplete) {
    items.push({
      id: 'profile',
      label: 'Completar presencia cívica',
      detail: 'Añade trayectoria y visibilidad para fortalecer tu perfil público.',
      href: '/dashboard/community/profile',
      priority: 'normal',
      icon: CircleUserRound,
    })
  }

  const rank: Record<Priority, number> = { urgent: 0, high: 1, normal: 2 }
  return items.sort((a, b) => rank[a.priority] - rank[b.priority]).slice(0, 5)
}

function buildActivity(dashboard: DashboardRuntimeSnapshot): ActivityItem[] {
  const actions: ActivityItem[] = dashboard.mine.civic_actions.recent.map((item) => ({
    id: `action-${item.id}`,
    title: item.title,
    kind: 'Acción cívica',
    status: item.status,
    date: item.updated_at,
    href: `/dashboard/community/actions/${item.id}`,
  }))
  const reports: ActivityItem[] = dashboard.mine.reports.recent.map((item) => ({
    id: `report-${item.id}`,
    title: item.title,
    kind: 'Reporte territorial',
    status: item.status,
    date: item.updated_at,
    href: '/dashboard/reports',
  }))
  const proposals: ActivityItem[] = dashboard.mine.proposals.recent.map((item) => ({
    id: `proposal-${item.id}`,
    title: item.title,
    kind: 'Propuesta',
    status: item.status,
    date: item.created_at,
    href: `/dashboard/proposals/${item.id}`,
  }))

  return [...actions, ...reports, ...proposals]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6)
}

function LoadingState() {
  return (
    <main className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-6 lg:px-8" aria-label="Cargando centro ciudadano">
      <div className="h-44 animate-pulse rounded-[28px] bg-white" />
      <div className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
        <div className="h-72 animate-pulse rounded-[24px] bg-white" />
        <div className="h-72 animate-pulse rounded-[24px] bg-white" />
      </div>
    </main>
  )
}

export default function DashboardCommandCenterV2() {
  const {
    profile,
    avatar,
    dashboard,
    resolutionPlan,
    displayName,
    territory,
    identityVerified,
    loading,
    refreshing,
    error,
    refresh,
  } = useDashboardRuntime()

  const profileIncomplete = Boolean(profile && (!profile.bio?.trim() || !profile.public_profile))
  const attentionItems = useMemo(
    () => dashboard ? buildAttentionItems(dashboard, resolutionPlan, profileIncomplete) : [],
    [dashboard, profileIncomplete, resolutionPlan],
  )
  const activity = useMemo(() => dashboard ? buildActivity(dashboard) : [], [dashboard])

  if (loading && !dashboard) return <LoadingState />

  if (!dashboard) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center px-6 py-16">
        <div className="w-full rounded-[24px] border border-[#F4C9CE] bg-white p-8 text-center shadow-sm" role="alert">
          <AlertCircle className="mx-auto text-[#D72638]" size={32} />
          <h1 className="mt-4 font-display text-2xl font-extrabold text-[#0A2A66]">No pudimos abrir tu centro ciudadano</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#607087]">
            {error ?? 'El servicio no devolvió datos del dashboard.'}
          </p>
          <button
            type="button"
            onClick={() => void refresh('all')}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#0A2A66] px-4 py-3 text-xs font-extrabold text-white"
          >
            <RefreshCw size={15} /> Reintentar
          </button>
        </div>
      </main>
    )
  }

  const nextAction = attentionItems[0] ?? {
    id: 'start',
    label: 'Crear una nueva acción cívica',
    detail: 'Tu bandeja está al día. Convierte una necesidad comunitaria en gestión trazable.',
    href: '/dashboard/community/actions/new',
    priority: 'normal' as Priority,
    icon: FilePlus2,
  }
  const NextIcon = nextAction.icon
  const profileType = profile?.profile_type ?? 'citizen'
  const cityVoting = dashboard.city.governance.by_status.find((item) => item.status === 'voting')?.count ?? 0
  const cityResolved = dashboard.city.reports.by_category.reduce((sum, item) => sum + item.resolved_count, 0)
  const participationTotal = dashboard.reputation.total_votes
    + dashboard.reputation.total_proposals
    + dashboard.reputation.total_reports
    + dashboard.reputation.endorsements_given

  return (
    <main data-testid="dashboard-command-center-v2" className="min-h-screen bg-[#F7F9FC] pb-10">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <section className="overflow-hidden rounded-[28px] bg-[#0A2A66] text-white shadow-[0_22px_60px_rgba(10,42,102,.16)]">
          <div className="grid lg:grid-cols-[1.15fr_.85fr]">
            <div className="relative p-6 sm:p-8 lg:p-10">
              <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-[#4A90E2]/15 blur-3xl" />
              <div className="relative z-10">
                <div className="flex flex-wrap items-center gap-3">
                  <CivicAvatar
                    src={avatar?.status === 'approved' ? avatar.avatar_url : null}
                    name={displayName}
                    identityVerified={identityVerified}
                    size="md"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-base font-extrabold">{displayName}</h2>
                      <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[.08em] text-[#D9E5F5]">
                        {PROFILE_TYPE_LABEL[profileType]}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-semibold text-[#AFC4DF]">
                      <span className="inline-flex items-center gap-1"><MapPin size={11} /> {territory}</span>
                      {profile?.organization && <span className="inline-flex items-center gap-1"><Building2 size={11} /> {profile.organization}</span>}
                    </div>
                  </div>
                </div>

                <p className="mt-6 text-[10px] font-extrabold uppercase tracking-[.15em] text-[#9DB6D8]">Mi VÉRTICE</p>
                <h1 className="mt-2 max-w-3xl font-display text-3xl font-extrabold leading-tight tracking-[-.03em] sm:text-4xl">
                  Convierte gestión en evidencia pública.
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#CAD8EB]">
                  Una sola vista para decidir qué hacer ahora, seguir tus gestiones y entender lo que ocurre en tu territorio.
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  <Link href="/dashboard/community/profile" className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 text-[10px] font-extrabold text-white">
                    <CircleUserRound size={13} /> Perfil cívico
                  </Link>
                  <Link href="/dashboard/billing" className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 text-[10px] font-extrabold text-white">
                    <CreditCard size={13} /> Plan y suscripción
                  </Link>
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 bg-white/[.055] p-6 lg:border-l lg:border-t-0 lg:p-8">
              <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#9DB6D8]">Siguiente mejor acción</p>
              <div className="mt-4 rounded-[22px] border border-white/10 bg-white/[.07] p-5">
                <div className="flex items-start justify-between gap-4">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F5B700] text-[#0A2A66]"><NextIcon size={20} /></span>
                  {nextAction.count !== undefined && (
                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-extrabold">{nextAction.count}</span>
                  )}
                </div>
                <h2 className="mt-4 text-xl font-extrabold leading-7">{nextAction.label}</h2>
                <p className="mt-2 text-sm leading-6 text-[#CAD8EB]">{nextAction.detail}</p>
                <a href={nextAction.href} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#F5B700] px-4 text-xs font-extrabold text-[#0A2A66]">
                  Resolver ahora <ArrowRight size={14} />
                </a>
              </div>
            </div>
          </div>
        </section>

        <nav className="mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="Acciones rápidas">
          {QUICK_ACTIONS.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="inline-flex min-h-10 flex-none items-center gap-2 rounded-xl border border-[#DCE4EE] bg-white px-3 text-[10px] font-extrabold text-[#0A2A66] shadow-sm">
              <Icon size={13} /> {label}
            </Link>
          ))}
        </nav>

        <section className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_.85fr]" aria-labelledby="attention-title">
          <article className="rounded-[24px] border border-[#DCE4EE] bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[.13em] text-[#D72638]">Qué tengo que hacer ahora</p>
                <h2 id="attention-title" className="mt-1 text-xl font-extrabold text-[#0A2A66]">Centro de pendientes</h2>
              </div>
              <button
                type="button"
                onClick={() => void refresh('all')}
                disabled={refreshing}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[#DCE4EE] px-3 text-[9px] font-extrabold uppercase tracking-[.07em] text-[#607087] disabled:opacity-50"
              >
                <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} /> Actualizar
              </button>
            </div>

            {attentionItems.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-[#CBE9D1] bg-[#F3FAF5] p-5">
                <div className="flex items-center gap-2 text-sm font-extrabold text-[#237D36]"><CheckCircle2 size={16} /> Sin pendientes críticos</div>
                <p className="mt-2 text-xs leading-5 text-[#55715C]">Tu bandeja está al día. Puedes iniciar una nueva gestión o explorar tu territorio.</p>
              </div>
            ) : (
              <div className="mt-4 space-y-2.5">
                {attentionItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <a key={item.id} href={item.href} className="group flex items-start gap-3 rounded-2xl border border-[#E1E7EF] p-3.5 transition hover:border-[#BFD0E8]">
                      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[#F4F7FB] text-[#0A2A66]"><Icon size={16} /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-extrabold text-[#0A2A66]">{item.label}</span>
                          {item.count !== undefined && <span className="rounded-full bg-[#EDF3FA] px-2 py-0.5 text-[9px] font-extrabold text-[#245EA7]">{item.count}</span>}
                        </div>
                        <p className="mt-1 text-xs leading-5 text-[#607087]">{item.detail}</p>
                      </div>
                      <span className={`rounded-full border px-2 py-1 text-[8px] font-extrabold uppercase tracking-[.06em] ${PRIORITY_STYLE[item.priority]}`}>{PRIORITY_LABEL[item.priority]}</span>
                    </a>
                  )
                })}
              </div>
            )}
          </article>

          <aside className="rounded-[24px] border border-[#DCE4EE] bg-white p-5 shadow-sm sm:p-6">
            <p className="text-[10px] font-extrabold uppercase tracking-[.13em] text-[#7B8799]">Tu trayectoria</p>
            <h2 className="mt-1 text-xl font-extrabold text-[#0A2A66]">Señales de gestión</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                ['Reputación', dashboard.reputation.score],
                ['Acciones activas', dashboard.mine.civic_actions.active],
                ['Verificadas', dashboard.mine.civic_actions.verified],
                ['Participaciones', participationTotal],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-[#F7F9FC] p-4">
                  <div className="text-2xl font-extrabold text-[#0A2A66]">{number(Number(value))}</div>
                  <div className="mt-1 text-[10px] font-bold text-[#607087]">{label}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-[#DCE4EE] p-4">
              <div className="flex items-center gap-2 text-xs font-extrabold text-[#0A2A66]"><BarChart3 size={15} /> Reputación verificable</div>
              <p className="mt-2 text-[11px] leading-5 text-[#607087]">Seguidores, likes e impresiones no suman reputación. VÉRTICE prioriza evidencia, participación y resultados verificables.</p>
            </div>
          </aside>
        </section>
      </div>

      <div id="resolution-plan">
        <DashboardActionResolutionPlan />
      </div>

      <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 lg:px-8">
        <section className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
          <article data-testid="civic-action-hub" className="rounded-[24px] border border-[#DCE4EE] bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[.13em] text-[#245EA7]">Qué está ocurriendo con mis gestiones</p>
                <h2 className="mt-1 text-xl font-extrabold text-[#0A2A66]">Gestión en seguimiento</h2>
              </div>
              <Link href="/dashboard/community/actions" className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-[.07em] text-[#0A2A66]">Ver todas <ArrowUpRight size={11} /></Link>
            </div>

            {dashboard.mine.civic_actions.recent.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-[#D6DEE8] bg-[#FAFBFC] p-6 text-center">
                <Activity size={24} className="mx-auto text-[#94A0B0]" />
                <p className="mt-3 text-sm font-extrabold text-[#0A2A66]">Aún no has creado acciones cívicas</p>
                <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-[#607087]">Inicia una gestión y documenta su evidencia para construir una trayectoria verificable.</p>
                <Link href="/dashboard/community/actions/new" className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#0A2A66] px-4 text-[10px] font-extrabold text-white">Crear primera acción <ArrowRight size={12} /></Link>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {dashboard.mine.civic_actions.recent.slice(0, 3).map((item) => (
                  <Link key={item.id} href={`/dashboard/community/actions/${item.id}`} className="group flex items-center gap-3 rounded-2xl border border-[#E1E7EF] p-4 transition hover:border-[#BFD0E8]">
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#EDF3FA] text-[#0A2A66]"><Activity size={17} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-extrabold text-[#0A2A66]">{item.title}</div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-semibold text-[#7B8799]">
                        <span>{STATUS_LABEL[item.status] ?? item.status}</span>
                        <span>{item.evidence_count} evidencias</span>
                        <span>Score {item.civic_score}</span>
                      </div>
                    </div>
                    <ArrowUpRight size={14} className="text-[#94A0B0] group-hover:text-[#0A2A66]" />
                  </Link>
                ))}
              </div>
            )}
          </article>

          <aside className="rounded-[24px] border border-[#DCE4EE] bg-white p-5 shadow-sm sm:p-6">
            <p className="text-[10px] font-extrabold uppercase tracking-[.13em] text-[#2B7A3E]">Qué está ocurriendo a mi alrededor</p>
            <h2 className="mt-1 text-xl font-extrabold text-[#0A2A66]">Tu territorio</h2>
            <div className="mt-3 flex items-center gap-2 text-xs font-bold text-[#607087]"><MapPin size={14} /> {territory}</div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Link href="/dashboard/reports" className="rounded-2xl bg-[#F7F9FC] p-4">
                <div className="text-2xl font-extrabold text-[#0A2A66]">{number(dashboard.city.reports.total_reports)}</div>
                <div className="mt-1 text-[10px] font-bold text-[#607087]">Reportes territoriales</div>
              </Link>
              <Link href="/dashboard/reports" className="rounded-2xl bg-[#F7F9FC] p-4">
                <div className="text-2xl font-extrabold text-[#0A2A66]">{number(cityResolved)}</div>
                <div className="mt-1 text-[10px] font-bold text-[#607087]">Reportes resueltos</div>
              </Link>
              <Link href="/dashboard/governance" className="rounded-2xl bg-[#F7F9FC] p-4">
                <div className="text-2xl font-extrabold text-[#0A2A66]">{number(cityVoting)}</div>
                <div className="mt-1 text-[10px] font-bold text-[#607087]">Consultas en votación</div>
              </Link>
              <Link href="/dashboard/reports" className="rounded-2xl bg-[#F7F9FC] p-4">
                <div className="text-2xl font-extrabold text-[#0A2A66]">{number(dashboard.attention.reports_in_progress)}</div>
                <div className="mt-1 text-[10px] font-bold text-[#607087]">Tus reportes en gestión</div>
              </Link>
            </div>
          </aside>
        </section>

        <section className="mt-4 rounded-[24px] border border-[#DCE4EE] bg-white p-5 shadow-sm sm:p-6" aria-labelledby="activity-title">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[.13em] text-[#7B8799]">Actividad unificada</p>
              <h2 id="activity-title" className="mt-1 text-xl font-extrabold text-[#0A2A66]">Tu historial reciente</h2>
            </div>
            <Clock3 size={18} className="text-[#7B8799]" />
          </div>

          {activity.length === 0 ? (
            <p className="mt-4 rounded-2xl bg-[#F7F9FC] p-5 text-xs leading-5 text-[#607087]">Tu actividad aparecerá aquí a medida que reportes, propongas, participes o documentes acciones.</p>
          ) : (
            <div className="mt-4 divide-y divide-[#E9EDF3]">
              {activity.map((item) => (
                <Link key={item.id} href={item.href} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[#F4F7FB] text-[#0A2A66]">
                    {item.kind === 'Acción cívica' ? <Activity size={15} /> : item.kind === 'Reporte territorial' ? <MapPinned size={15} /> : <FileText size={15} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-extrabold text-[#0A2A66]">{item.title}</div>
                    <div className="mt-1 text-[10px] font-semibold text-[#7B8799]">{item.kind} · {STATUS_LABEL[item.status] ?? item.status} · {formatDate(item.date)}</div>
                  </div>
                  <ArrowUpRight size={13} className="text-[#94A0B0]" />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
