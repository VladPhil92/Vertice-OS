'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  CircleUserRound,
  FileCheck2,
  FileText,
  MapPin,
  Scale,
  ShieldCheck,
  Sparkles,
  Vote,
  type LucideIcon,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'

type CivicProfileType = 'citizen' | 'social_leader' | 'candidate' | 'organization_rep' | 'public_official'

type DashboardExperienceResponse = {
  profile: {
    neighborhood: string | null
    verification_level: number
    civic_profile_type?: CivicProfileType
    civic_bio?: string | null
    civic_organization?: string | null
    public_civic_profile?: boolean
  }
  attention: {
    pending_votes: Array<{ id: string; title: string }>
    legal_needs_action: number
    reports_in_progress: number
    civic_actions_needing_evidence: number
  }
}

type RoleExperience = {
  label: string
  eyebrow: string
  headline: string
  description: string
  primary: { label: string; href: string }
  secondary: { label: string; href: string }
  icon: LucideIcon
}

type ActionItem = {
  id: string
  label: string
  detail: string
  href: string
  count?: number
  priority: 'urgent' | 'high' | 'normal'
  icon: LucideIcon
}

const ROLE_EXPERIENCE: Record<CivicProfileType, RoleExperience> = {
  citizen: {
    label: 'Ciudadanía',
    eyebrow: 'Participación territorial',
    headline: 'Convierte lo que ocurre en tu comunidad en acción verificable.',
    description: 'Reporta, participa y documenta resultados sin perder el contexto de tu territorio.',
    primary: { label: 'Crear acción cívica', href: '/dashboard/community/actions/new' },
    secondary: { label: 'Ver red cívica', href: '/dashboard/community' },
    icon: CircleUserRound,
  },
  social_leader: {
    label: 'Liderazgo social',
    eyebrow: 'Gestión comunitaria',
    headline: 'Convierte trabajo comunitario en resultados que puedan demostrarse.',
    description: 'Prioriza acciones, completa evidencia y construye una trayectoria pública verificable.',
    primary: { label: 'Gestionar mis acciones', href: '/dashboard/community/actions' },
    secondary: { label: 'Mi perfil público', href: '/dashboard/community/profile' },
    icon: BadgeCheck,
  },
  candidate: {
    label: 'Candidatura',
    eyebrow: 'Trayectoria verificable',
    headline: 'Demuestra gestión antes que promesas.',
    description: 'Organiza acciones, evidencia y resultados para que tu trayectoria pública pueda auditarse.',
    primary: { label: 'Ver mi gestión', href: '/dashboard/community/actions' },
    secondary: { label: 'Configurar perfil público', href: '/dashboard/community/profile' },
    icon: Sparkles,
  },
  organization_rep: {
    label: 'Organización',
    eyebrow: 'Gestión colectiva',
    headline: 'Coordina acciones, evidencia y resultados desde un solo lugar.',
    description: 'Mantén trazabilidad sobre lo que ejecuta tu organización y lo que todavía requiere atención.',
    primary: { label: 'Gestionar acciones', href: '/dashboard/community/actions' },
    secondary: { label: 'Ver expedientes', href: '/dashboard/workflows' },
    icon: Building2,
  },
  public_official: {
    label: 'Gestión pública',
    eyebrow: 'Rendición de cuentas',
    headline: 'Convierte gestión pública en trazabilidad y resultados verificables.',
    description: 'Haz seguimiento de acciones, reportes y expedientes sin mezclar popularidad con evidencia.',
    primary: { label: 'Revisar gestión', href: '/dashboard/workflows' },
    secondary: { label: 'Mapa y reportes', href: '/dashboard/reports' },
    icon: FileCheck2,
  },
}

const PRIORITY_META = {
  urgent: { label: 'Prioridad alta', className: 'border-[#F2C8CE] bg-[#FCEBED] text-[#A91D2E]' },
  high: { label: 'Atención', className: 'border-[#F1DEA5] bg-[#FFF4D1] text-[#7B5A00]' },
  normal: { label: 'Pendiente', className: 'border-[#D6E2F0] bg-[#EDF3FA] text-[#245EA7]' },
} as const

function completion(profile: DashboardExperienceResponse['profile']) {
  const checks = [
    { key: 'identity', label: 'Verificación básica', done: profile.verification_level >= 2, weight: 30 },
    { key: 'territory', label: 'Territorio', done: Boolean(profile.neighborhood), weight: 20 },
    { key: 'type', label: 'Tipo de perfil', done: Boolean(profile.civic_profile_type), weight: 10 },
    { key: 'bio', label: 'Biografía de gestión', done: Boolean(profile.civic_bio?.trim()), weight: 20 },
    { key: 'public', label: 'Perfil público', done: Boolean(profile.public_civic_profile), weight: 20 },
  ]
  return {
    checks,
    percent: checks.reduce((sum, check) => sum + (check.done ? check.weight : 0), 0),
  }
}

function buildActionItems(data: DashboardExperienceResponse): ActionItem[] {
  const items: ActionItem[] = []
  const profile = data.profile

  if (profile.verification_level < 2) {
    items.push({
      id: 'identity',
      label: 'Completar verificación básica',
      detail: 'Confirma el estado de identidad reconocido por VÉRTICE y CTG One.',
      href: '/dashboard/identity',
      priority: 'urgent',
      icon: ShieldCheck,
    })
  }

  if (data.attention.civic_actions_needing_evidence > 0) {
    items.push({
      id: 'evidence',
      label: 'Acciones que necesitan evidencia',
      detail: 'Completa soporte verificable para que tus resultados puedan avanzar.',
      href: '/dashboard/community/actions',
      count: data.attention.civic_actions_needing_evidence,
      priority: 'urgent',
      icon: Activity,
    })
  }

  if (data.attention.pending_votes.length > 0) {
    items.push({
      id: 'votes',
      label: 'Consultas pendientes',
      detail: 'Hay mecanismos de participación abiertos para los que apareces habilitado.',
      href: '/dashboard/governance',
      count: data.attention.pending_votes.length,
      priority: 'high',
      icon: Vote,
    })
  }

  if (data.attention.legal_needs_action > 0) {
    items.push({
      id: 'legal',
      label: 'Control público por completar',
      detail: 'Revisa documentos o actuaciones que todavía requieren una decisión tuya.',
      href: '/dashboard/legal',
      count: data.attention.legal_needs_action,
      priority: 'high',
      icon: Scale,
    })
  }

  if (data.attention.reports_in_progress > 0) {
    items.push({
      id: 'reports',
      label: 'Reportes en seguimiento',
      detail: 'Consulta cambios de estado y próximos pasos de tu gestión territorial.',
      href: '/dashboard/reports',
      count: data.attention.reports_in_progress,
      priority: 'normal',
      icon: MapPin,
    })
  }

  if (!profile.civic_bio?.trim() || !profile.public_civic_profile) {
    items.push({
      id: 'profile',
      label: 'Completar presencia cívica',
      detail: 'Define tu trayectoria y decide si quieres publicar tu perfil en la red.',
      href: '/dashboard/community/profile',
      priority: 'normal',
      icon: CircleUserRound,
    })
  }

  const rank = { urgent: 0, high: 1, normal: 2 }
  return items.sort((a, b) => rank[a.priority] - rank[b.priority]).slice(0, 5)
}

export default function DashboardExperienceLayer() {
  const [data, setData] = useState<DashboardExperienceResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch<DashboardExperienceResponse>('/dashboard/me')
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  const profileType = data?.profile.civic_profile_type ?? 'citizen'
  const experience = ROLE_EXPERIENCE[profileType]
  const progress = useMemo(() => data ? completion(data.profile) : null, [data])
  const tasks = useMemo(() => data ? buildActionItems(data) : [], [data])

  if (loading) {
    return (
      <section className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 lg:px-8" aria-label="Preparando experiencia personalizada">
        <div className="h-48 animate-pulse rounded-[24px] border border-[#E1E7EF] bg-white" />
      </section>
    )
  }

  if (!data || !progress) return null

  const RoleIcon = experience.icon

  return (
    <section
      data-testid="dashboard-experience-layer"
      className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 lg:px-8 lg:pt-6"
      aria-labelledby="today-heading"
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(380px,.95fr)]">
        <article className="overflow-hidden rounded-[24px] border border-[#DCE5EF] bg-white shadow-[0_12px_38px_rgba(10,42,102,.055)]">
          <div className="h-1.5 bg-[linear-gradient(90deg,#F5B700_0_34%,#4A90E2_34%_67%,#D72638_67%)]" />
          <div className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EDF3FA] text-[#0A2A66]">
                  <RoleIcon size={20} />
                </span>
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[.1em] text-[#6B7890]">{experience.eyebrow}</p>
                  <p className="mt-1 text-sm font-extrabold text-[#0A2A66]">{experience.label}</p>
                </div>
              </div>
              {data.profile.civic_organization && (
                <span className="inline-flex min-h-8 items-center gap-2 rounded-full bg-[#F7F9FC] px-3 text-xs font-semibold text-[#607087]">
                  <Building2 size={14} /> {data.profile.civic_organization}
                </span>
              )}
            </div>

            <p className="mt-5 text-xs font-extrabold uppercase tracking-[.13em] text-[#7B8799]">Hoy en VÉRTICE</p>
            <h2 id="today-heading" className="mt-2 max-w-3xl text-xl font-extrabold leading-8 tracking-[-.02em] text-[#0A2A66] sm:text-2xl">
              {experience.headline}
            </h2>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[#607087]">{experience.description}</p>

            <div className="mt-5 flex flex-wrap gap-2.5">
              <Link href={experience.primary.href} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#0A2A66] px-4 text-sm font-extrabold text-white">
                {experience.primary.label} <ArrowRight size={15} />
              </Link>
              <Link href={experience.secondary.href} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#D5DFEB] bg-white px-4 text-sm font-bold text-[#0A2A66]">
                {experience.secondary.label}
              </Link>
            </div>

            <div className="mt-6 border-t border-[#E9EDF3] pt-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-extrabold text-[#0A2A66]">Perfil operativo</p>
                  <p className="mt-1 text-xs font-medium text-[#6B7890]">Completa lo necesario para aprovechar la red cívica sin duplicar trámites.</p>
                </div>
                <span className="text-lg font-extrabold text-[#0A2A66]">{progress.percent}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#E9EDF3]" aria-label={`Perfil ${progress.percent}% completo`}>
                <div className="h-full rounded-full bg-[#F5B700] transition-all" style={{ width: `${progress.percent}%` }} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {progress.checks.map((check) => (
                  <span key={check.key} className={check.done
                    ? 'inline-flex min-h-8 items-center gap-1.5 rounded-full bg-[#EAF6ED] px-3 text-xs font-bold text-[#237D36]'
                    : 'inline-flex min-h-8 items-center gap-1.5 rounded-full bg-[#F7F9FC] px-3 text-xs font-semibold text-[#6B7890]'}>
                    {check.done ? <CheckCircle2 size={13} /> : <span className="h-2 w-2 rounded-full bg-[#B5C0CF]" />}
                    {check.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </article>

        <aside data-testid="unified-action-center" className="rounded-[24px] border border-[#DCE5EF] bg-white p-5 shadow-[0_12px_38px_rgba(10,42,102,.055)] sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[.12em] text-[#7B8799]">Centro de pendientes</p>
              <h2 className="mt-2 text-xl font-extrabold text-[#0A2A66]">Qué requiere tu atención</h2>
            </div>
            <span className="flex h-10 min-w-10 items-center justify-center rounded-xl bg-[#EDF3FA] px-2 text-sm font-extrabold text-[#0A2A66]">{tasks.length}</span>
          </div>

          {tasks.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-[#CBE9D1] bg-[#EAF6ED] p-5">
              <div className="flex items-center gap-2 text-sm font-extrabold text-[#237D36]"><CheckCircle2 size={17} /> Sin pendientes críticos</div>
              <p className="mt-2 text-sm font-medium leading-6 text-[#4D7055]">Tu bandeja está al día. Puedes explorar la red o iniciar una nueva acción.</p>
            </div>
          ) : (
            <div className="mt-4 space-y-2.5">
              {tasks.map((task) => {
                const Icon = task.icon
                const priority = PRIORITY_META[task.priority]
                return (
                  <Link key={task.id} href={task.href} className="group flex min-h-[72px] items-start gap-3 rounded-2xl border border-[#E1E7EF] p-3.5 transition hover:border-[#BFD0E8] hover:bg-[#FBFCFE]">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EDF3FA] text-[#0A2A66]"><Icon size={16} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-extrabold text-[#0A2A66]">{task.label}</span>
                        {typeof task.count === 'number' && <span className="rounded-full bg-[#0A2A66] px-2 py-0.5 text-xs font-extrabold text-white">{task.count}</span>}
                      </span>
                      <span className="mt-1 block text-xs font-medium leading-5 text-[#6B7890]">{task.detail}</span>
                      <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${priority.className}`}>{priority.label}</span>
                    </span>
                    <ArrowRight size={15} className="mt-2 shrink-0 text-[#9AA6B6] transition group-hover:translate-x-0.5 group-hover:text-[#0A2A66]" />
                  </Link>
                )
              })}
            </div>
          )}

          <Link href="/dashboard/community/profile" className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#D5DFEB] text-sm font-extrabold text-[#0A2A66]">
            <FileText size={15} /> Revisar mi perfil cívico
          </Link>
        </aside>
      </div>
    </section>
  )
}
