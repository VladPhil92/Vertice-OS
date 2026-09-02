'use client'

import { useEffect, useState } from 'react'
import {
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  FilePlus2,
  FileText,
  MapPinned,
  MessageCircleMore,
  Scale,
  ShieldCheck,
  Sparkles,
  Users,
  Vote,
} from 'lucide-react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'

interface CategoryStats {
  category: string
  total: number
  open_count: number
  resolved_count: number
}

interface TerritorialStatsAPI {
  total_reports: number
  open_reports: number
  by_category: CategoryStats[]
}

interface GovernanceStats {
  total_proposals: number
  by_status: Array<{ status: string; count: number }>
}

interface ReputationProfileAPI {
  reputation_score: number
  level: string
  total_votes: number
  total_proposals: number
  total_reports: number
}

interface DashboardStats {
  openReports: number
  resolvedReports: number
  totalProposals: number
  votingProposals: number
  reputationScore: number
  participationCount: number
  byCategory: CategoryStats[]
}

interface RecentReport {
  id: string
  title: string
  category: string
  status: string
  neighborhood: string | null
  created_at: string
}

interface RecentProposal {
  id: string
  title: string
  category: string
  status: string
  created_at: string
}

type ActivityItem = {
  id: string
  kind: 'report' | 'proposal'
  label: string
  desc: string
  tag: 'tendencia' | 'resuelto' | 'urgente' | 'nuevo' | 'activo' | 'pendiente'
  time: string
  color: string
  category: string
}

const REPORT_STATUS_TAG: Record<string, ActivityItem['tag']> = {
  open: 'nuevo',
  in_progress: 'activo',
  resolved: 'resuelto',
  rejected: 'pendiente',
  duplicate: 'pendiente',
}

const PROPOSAL_STATUS_TAG: Record<string, ActivityItem['tag']> = {
  draft: 'nuevo',
  review: 'pendiente',
  debate: 'activo',
  voting: 'tendencia',
  approved: 'resuelto',
  rejected: 'pendiente',
}

const CATEGORY_COLOR: Record<string, string> = {
  infraestructura: '#4A90E2',
  servicios_publicos: '#178C8C',
  seguridad: '#D72638',
  salud: '#D72638',
  medio_ambiente: '#2BA745',
  transporte: '#4A90E2',
  educacion: '#F5B700',
  cultura: '#6D5CC7',
  otro: '#7B8799',
}

const CATEGORY_LABEL: Record<string, string> = {
  infraestructura: 'Infraestructura',
  servicios_publicos: 'Servicios públicos',
  seguridad: 'Seguridad',
  salud: 'Salud',
  medio_ambiente: 'Ambiente',
  transporte: 'Movilidad',
  educacion: 'Educación',
  cultura: 'Cultura',
  otro: 'Otro',
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 2) return 'Ahora'
  if (mins < 60) return `Hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `Hace ${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'Ayer'
  return `Hace ${days} días`
}

function formatValue(n: number): string {
  if (n >= 10000) return `${(n / 1000).toFixed(0)}k`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(Math.round(n))
}

function buildActivity(reports: RecentReport[], proposals: RecentProposal[]): ActivityItem[] {
  const items: ActivityItem[] = [
    ...reports.map((r) => ({
      id: `r-${r.id}`,
      kind: 'report' as const,
      label: r.status === 'resolved' ? 'Reporte resuelto' : r.status === 'in_progress' ? 'Reporte en proceso' : 'Nuevo reporte',
      desc: r.neighborhood ? `${r.title} — ${r.neighborhood}` : r.title,
      tag: REPORT_STATUS_TAG[r.status] ?? 'nuevo',
      time: timeAgo(r.created_at),
      color: CATEGORY_COLOR[r.category] ?? '#7B8799',
      category: r.category,
    })),
    ...proposals.map((p) => ({
      id: `p-${p.id}`,
      kind: 'proposal' as const,
      label: p.status === 'voting' ? 'Propuesta en votación' : p.status === 'debate' ? 'Propuesta en deliberación' : 'Nueva propuesta',
      desc: p.title,
      tag: PROPOSAL_STATUS_TAG[p.status] ?? 'nuevo',
      time: timeAgo(p.created_at),
      color: CATEGORY_COLOR[p.category] ?? '#F5B700',
      category: p.category,
    })),
  ]
  return items.slice(0, 6)
}

const QUICK_ACTIONS = [
  { icon: FilePlus2, label: 'Reportar un caso', href: '/dashboard/reports/new', color: '#0A2A66', bg: '#EAF1FB' },
  { icon: Vote, label: 'Votar y participar', href: '/dashboard/governance', color: '#A66F00', bg: '#FFF4D1' },
  { icon: FileText, label: 'Generar propuesta', href: '/dashboard/proposals', color: '#2BA745', bg: '#EAF6ED' },
  { icon: MessageCircleMore, label: 'Debatir con IA', href: '/dashboard/ai', color: '#6D5CC7', bg: '#F0EDFC' },
  { icon: MapPinned, label: 'Ver mapa de la ciudad', href: '/dashboard/reports', color: '#178C8C', bg: '#E7F6F5' },
  { icon: Scale, label: 'Control público', href: '/dashboard/legal', color: '#D72638', bg: '#FCEBED' },
] as const

function TagBadge({ tag }: { tag: ActivityItem['tag'] }) {
  const styles: Record<ActivityItem['tag'], string> = {
    urgente: 'bg-[#FCEBED] text-[#D72638] border-[#F4C9CE]',
    activo: 'bg-[#EAF1FB] text-[#245EA7] border-[#C8D8EE]',
    resuelto: 'bg-[#EAF6ED] text-[#22883A] border-[#CBE9D1]',
    tendencia: 'bg-[#FFF4D1] text-[#9A6A00] border-[#F7DEA0]',
    nuevo: 'bg-[#F3F6FA] text-[#607087] border-[#E1E7EF]',
    pendiente: 'bg-[#F7F1E8] text-[#8C6A34] border-[#EADFCB]',
  }
  const labels: Record<ActivityItem['tag'], string> = {
    urgente: 'URGENTE',
    activo: 'EN PROCESO',
    resuelto: 'RESUELTO',
    tendencia: 'VOTANDO',
    nuevo: 'NUEVO',
    pendiente: 'PENDIENTE',
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[.08em] ${styles[tag]}`}>
      {labels[tag]}
    </span>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  loading,
}: {
  label: string
  value: string | null
  icon: typeof FilePlus2
  color: string
  loading: boolean
}) {
  return (
    <div className="civic-card-flat min-w-[150px] flex-1 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}12`, color }}>
          <Icon size={18} strokeWidth={1.9} />
        </div>
        {loading || value === null ? (
          <div className="mt-1 h-7 w-14 animate-pulse rounded-lg bg-[#E9EDF3]" />
        ) : (
          <div className="font-display text-2xl font-extrabold text-[#0A2A66]">{value}</div>
        )}
      </div>
      <div className="mt-3 text-[11px] font-semibold text-[#607087]">{label}</div>
    </div>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadStats() {
      try {
        const [territorial, governance, reputation, recentReports, recentProposals] = await Promise.allSettled([
          apiFetch<TerritorialStatsAPI>('/territorial/stats', { public: true }),
          apiFetch<GovernanceStats>('/governance/proposals/stats', { public: true }),
          apiFetch<ReputationProfileAPI>('/reputation/me'),
          apiFetch<{ data: RecentReport[] }>('/territorial/reports?limit=6&offset=0', { public: true }),
          apiFetch<{ data: RecentProposal[] }>('/governance/proposals?limit=6&offset=0', { public: true }),
        ])

        const terData = territorial.status === 'fulfilled' ? territorial.value : null
        const govData = governance.status === 'fulfilled' ? governance.value : null
        const repData = reputation.status === 'fulfilled' ? reputation.value : null
        const voting = govData?.by_status.find((s) => s.status === 'voting')?.count ?? 0
        const resolvedCount = terData?.by_category.reduce((sum, c) => sum + c.resolved_count, 0) ?? 0

        setStats({
          openReports: terData?.open_reports ?? 0,
          resolvedReports: resolvedCount,
          totalProposals: govData?.total_proposals ?? 0,
          votingProposals: voting,
          reputationScore: repData?.reputation_score ?? 0,
          participationCount: repData
            ? (repData.total_votes ?? 0) + (repData.total_proposals ?? 0) + (repData.total_reports ?? 0)
            : 0,
          byCategory: terData?.by_category ?? [],
        })

        const reports = recentReports.status === 'fulfilled' ? (recentReports.value.data ?? []) : []
        const proposals = recentProposals.status === 'fulfilled' ? (recentProposals.value.data ?? []) : []
        setActivity(buildActivity(reports, proposals))
      } catch {
        // Stats are non-critical; the dashboard remains usable.
      } finally {
        setLoading(false)
      }
    }
    void loadStats()
  }, [])

  const panoramaStats = [
    { label: 'Reportes activos', value: stats ? formatValue(stats.openReports) : null, icon: FilePlus2, color: '#4A90E2' },
    { label: 'Propuestas abiertas', value: stats ? formatValue(stats.totalProposals) : null, icon: FileText, color: '#F5B700' },
    { label: 'Votaciones abiertas', value: stats ? String(stats.votingProposals) : null, icon: Vote, color: '#D72638' },
    { label: 'Casos solucionados', value: stats ? formatValue(stats.resolvedReports) : null, icon: CheckCircle2, color: '#2BA745' },
    { label: 'Mi puntuación cívica', value: stats ? formatValue(stats.reputationScore) : null, icon: ShieldCheck, color: '#0A2A66' },
  ]

  return (
    <div className="min-h-screen bg-[#F7F9FC]">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <section className="relative overflow-hidden rounded-[28px] bg-white shadow-[0_18px_55px_rgba(10,42,102,.07)]">
          <div className="grid lg:grid-cols-[1.05fr_.95fr]">
            <div className="relative z-10 flex min-h-[320px] flex-col justify-center px-6 py-10 sm:px-10 lg:min-h-[390px] lg:px-12">
              <span className="mb-3 text-[11px] font-extrabold uppercase tracking-[.16em] text-[#4A90E2]">Cartagena · inteligencia ciudadana</span>
              <h1 className="max-w-2xl font-display text-4xl font-extrabold leading-[1.04] tracking-[-.04em] text-[#0A2A66] sm:text-5xl lg:text-6xl">
                Cartagena la construimos{' '}
                <span className="text-[#D72638]">juntos.</span>
              </h1>
              <p className="mt-5 max-w-xl text-sm leading-7 text-[#607087] sm:text-base">
                Reporta. Participa. Propón. Vigila. Sigue resultados desde un solo espacio ciudadano.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/dashboard/reports/new" className="btn-primary gap-2">
                  Reportar ahora
                  <ArrowUpRight size={15} />
                </Link>
                <Link href="/dashboard/governance" className="btn-citizen gap-2">
                  Participar
                  <Vote size={15} />
                </Link>
              </div>
            </div>

            <div className="relative min-h-[320px] overflow-hidden bg-[linear-gradient(145deg,#eaf2fb_0%,#f8fbff_60%,#fff7dc_100%)] lg:min-h-[390px]">
              <div className="absolute inset-0 opacity-75" style={{
                backgroundImage:
                  'linear-gradient(25deg, transparent 0 43%, rgba(10,42,102,.11) 44% 45%, transparent 46%), linear-gradient(112deg, transparent 0 51%, rgba(74,144,226,.13) 52% 53%, transparent 54%)',
                backgroundSize: '84px 84px, 112px 112px',
              }} />
              <div className="absolute left-[13%] top-[22%] flex h-12 w-12 items-center justify-center rounded-full bg-[#D72638] text-sm font-extrabold text-white shadow-lg">15</div>
              <div className="absolute right-[18%] top-[30%] flex h-11 w-11 items-center justify-center rounded-full bg-[#178C8C] text-sm font-extrabold text-white shadow-lg">8</div>
              <div className="absolute bottom-[22%] left-[39%] flex h-11 w-11 items-center justify-center rounded-full bg-[#F5B700] text-sm font-extrabold text-[#0A2A66] shadow-lg">6</div>
              <div className="absolute bottom-[28%] right-[24%] flex h-11 w-11 items-center justify-center rounded-full bg-[#4A90E2] text-sm font-extrabold text-white shadow-lg">12</div>
              <div className="absolute bottom-6 left-6 right-6 rounded-2xl border border-white/70 bg-white/92 p-4 shadow-[0_12px_30px_rgba(10,42,102,.08)] backdrop-blur">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[9px] font-extrabold uppercase tracking-[.13em] text-[#7B8799]">Mapa ciudadano</div>
                    <div className="mt-1 text-sm font-extrabold text-[#0A2A66]">Reportes, propuestas y actividad territorial</div>
                  </div>
                  <MapPinned size={20} className="text-[#4A90E2]" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative z-10 -mt-5 mx-3 rounded-[24px] border border-[#E1E7EF] bg-white px-3 py-3 shadow-[0_14px_40px_rgba(10,42,102,.08)] sm:mx-7 sm:px-4">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
            {QUICK_ACTIONS.map(({ icon: Icon, label, href, color, bg }) => (
              <Link key={href + label} href={href} className="group flex items-center gap-3 rounded-2xl px-3 py-3 transition hover:bg-[#F7F9FC]">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl" style={{ color, background: bg }}>
                  <Icon size={18} strokeWidth={1.8} />
                </span>
                <span className="text-[11px] font-bold leading-4 text-[#0A2A66] group-hover:text-[#163F86]">{label}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#7B8799]">Panorama de Cartagena</div>
              <h2 className="mt-1 text-2xl font-extrabold text-[#0A2A66]">Indicadores para comprender la ciudad</h2>
            </div>
            <Link href="/dashboard/reports" className="hidden text-xs font-bold text-[#245EA7] hover:underline sm:inline">Ver indicadores completos →</Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {panoramaStats.map((item) => (
              <StatCard key={item.label} {...item} loading={loading} />
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[1.3fr_.7fr]">
          <div className="civic-card p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#7B8799]">Seguimiento ciudadano</div>
                <h2 className="mt-1 text-xl font-extrabold text-[#0A2A66]">Reportes y propuestas recientes</h2>
              </div>
              <Link href="/dashboard/reports" className="text-xs font-bold text-[#245EA7] hover:underline">Ver todos</Link>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {loading && [0, 1, 2, 3].map((i) => (
                <div key={i} className="h-36 animate-pulse rounded-2xl border border-[#E1E7EF] bg-[#F4F7FA]" />
              ))}

              {!loading && activity.length === 0 && (
                <div className="md:col-span-2 rounded-2xl border border-dashed border-[#CBD5E1] bg-[#F9FBFD] p-10 text-center">
                  <FileText className="mx-auto text-[#9AA7B8]" size={26} />
                  <div className="mt-3 text-sm font-bold text-[#0A2A66]">Aún no hay actividad reciente</div>
                  <p className="mt-1 text-xs text-[#7B8799]">Cuando la comunidad registre acciones aparecerán aquí.</p>
                </div>
              )}

              {!loading && activity.slice(0, 4).map((item) => (
                <Link
                  key={item.id}
                  href={item.kind === 'report' ? `/dashboard/reports/${item.id.slice(2)}` : `/dashboard/proposals/${item.id.slice(2)}`}
                  className="group rounded-2xl border border-[#E1E7EF] bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#BDD0E8] hover:shadow-[0_12px_28px_rgba(10,42,102,.07)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <TagBadge tag={item.tag} />
                    <span className="text-[10px] font-semibold text-[#97A3B2]">{item.time}</span>
                  </div>
                  <div className="mt-4 text-sm font-extrabold text-[#0A2A66]">{item.label}</div>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#607087]">{item.desc}</p>
                  <div className="mt-4 flex items-center justify-between border-t border-[#EEF2F6] pt-3">
                    <div className="flex items-center gap-2 text-[10px] font-semibold text-[#7B8799]">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                      {CATEGORY_LABEL[item.category] ?? item.category}
                    </div>
                    <ArrowUpRight size={14} className="text-[#9AA7B8] transition group-hover:text-[#0A2A66]" />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="civic-card p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#7B8799]">Participación</div>
                  <h2 className="mt-1 text-xl font-extrabold text-[#0A2A66]">Tu actividad cívica</h2>
                </div>
                <Users size={22} className="text-[#F5B700]" />
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-[#F7F9FC] p-4">
                  <div className="text-2xl font-extrabold text-[#0A2A66]">{loading ? '—' : formatValue(stats?.participationCount ?? 0)}</div>
                  <div className="mt-1 text-[10px] font-semibold text-[#7B8799]">Acciones registradas</div>
                </div>
                <div className="rounded-2xl bg-[#FFF5D9] p-4">
                  <div className="text-2xl font-extrabold text-[#0A2A66]">{loading ? '—' : formatValue(stats?.reputationScore ?? 0)}</div>
                  <div className="mt-1 text-[10px] font-semibold text-[#8B7335]">Puntuación cívica</div>
                </div>
              </div>
              <Link href="/dashboard/reputation" className="mt-4 flex items-center justify-between rounded-2xl border border-[#E1E7EF] px-4 py-3 text-xs font-bold text-[#0A2A66] hover:bg-[#F7F9FC]">
                Ver mi perfil e impacto
                <ArrowUpRight size={15} />
              </Link>
            </div>

            <div className="civic-panel-navy p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#B8CCEB]">IA cívica</div>
                  <h2 className="mt-1 text-xl font-extrabold text-white">Comprende antes de actuar</h2>
                </div>
                <Sparkles size={22} className="text-[#F5B700]" />
              </div>
              <p className="mt-3 text-xs leading-6 text-white/72">Pregunta, resume propuestas, organiza argumentos y contextualiza información. La decisión sigue siendo humana.</p>
              <Link href="/dashboard/ai" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-extrabold text-[#0A2A66]">
                Abrir asistente
                <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>
        </section>

        {!loading && stats && stats.votingProposals > 0 && (
          <section className="mt-6 overflow-hidden rounded-[24px] border border-[#F0D99C] bg-[#FFF9E7] p-5 sm:p-6">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="max-w-2xl">
                <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.14em] text-[#9A6A00]">
                  <span className="h-2 w-2 rounded-full bg-[#F5B700]" />
                  Participación abierta
                </div>
                <h2 className="mt-2 text-xl font-extrabold text-[#0A2A66]">Hay iniciativas disponibles para deliberación o votación.</h2>
                <p className="mt-2 text-xs leading-5 text-[#6A768A]">Consulta el contexto, revisa argumentos y registra tu participación dentro del piloto VÉRTICE.</p>
              </div>
              <Link href="/dashboard/governance" className="btn-citizen whitespace-nowrap">Ver procesos activos</Link>
            </div>
          </section>
        )}

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-[#E1E7EF] bg-white p-5">
            <ShieldCheck size={20} className="text-[#0A2A66]" />
            <div className="mt-3 text-sm font-extrabold text-[#0A2A66]">Transparencia total</div>
            <p className="mt-2 text-xs leading-5 text-[#6A768A]">Estados, evidencia y trazabilidad visibles para comprender qué ocurre con cada proceso.</p>
          </div>
          <div className="rounded-2xl border border-[#E1E7EF] bg-white p-5">
            <Users size={20} className="text-[#F5B700]" />
            <div className="mt-3 text-sm font-extrabold text-[#0A2A66]">Participación real</div>
            <p className="mt-2 text-xs leading-5 text-[#6A768A]">Una sola cuenta para informar, proponer, deliberar, votar y construir historial ciudadano.</p>
          </div>
          <div className="rounded-2xl border border-[#E1E7EF] bg-white p-5">
            <BarChart3 size={20} className="text-[#D72638]" />
            <div className="mt-3 text-sm font-extrabold text-[#0A2A66]">Impacto medible</div>
            <p className="mt-2 text-xs leading-5 text-[#6A768A]">Indicadores para seguir actividad, respuesta y resultados sin convertir la participación en ruido.</p>
          </div>
        </section>
      </div>
    </div>
  )
}
