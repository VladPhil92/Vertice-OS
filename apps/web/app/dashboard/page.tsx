'use client'

import { useEffect, useState } from 'react'
import {
  FileText, Map, Users, Star,
  FileText as FileTextIcon,
  AlertTriangle, Sparkles, Scale,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { KpiCard }      from '@/components/ui/KpiCard'
import { ProgressGauge } from '@/components/ui/ProgressGauge'
import { MiniSpark }    from '@/components/ui/MiniSpark'
import { ModuleCard, TERRITORIAL_MODULES } from '@/components/ui/ModuleCard'
import { CategoryTag }  from '@/components/ui/CategoryTag'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CategoryStats {
  category: string
  total: number
  open_count: number
  resolved_count: number
}

interface TerritorialStatsAPI {
  total_reports: number
  open_reports:  number
  by_category:   CategoryStats[]
}

interface GovernanceStats {
  total_proposals: number
  by_status: Array<{ status: string; count: number }>
}

interface ReputationProfileAPI {
  reputation_score: number
  level:            string
  total_votes:      number
  total_proposals:  number
  total_reports:    number
}

interface DashboardStats {
  openReports:        number
  resolvedReports:    number
  totalProposals:     number
  votingProposals:    number
  reputationScore:    number
  participationCount: number
  byCategory:         CategoryStats[]
}

interface RecentReport {
  id:           string
  title:        string
  category:     string
  status:       string
  neighborhood: string | null
  created_at:   string
}

interface RecentProposal {
  id:       string
  title:    string
  category: string
  status:   string
  created_at: string
}

type ActivityItem = {
  id:    string
  kind:  'report' | 'proposal'
  label: string
  desc:  string
  tag:   'tendencia' | 'resuelto' | 'urgente' | 'nuevo' | 'activo' | 'pendiente'
  time:  string
  color: string
}

// ─── Spark datasets (tendencias simuladas — 8 semanas) ────────────────────────

const SPARKS: Record<string, number[]> = {
  proposals:  [24, 31, 28, 45, 52, 48, 61, 72],
  reports:    [18, 22, 19, 28, 31, 27, 35, 41],
  citizens:   [210, 245, 260, 280, 310, 340, 380, 420],
  reputation: [80, 95, 88, 112, 105, 130, 118, 145],
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const REPORT_STATUS_TAG: Record<string, ActivityItem['tag']> = {
  open:        'nuevo',
  in_progress: 'activo',
  resolved:    'resuelto',
  rejected:    'pendiente',
  duplicate:   'pendiente',
}

const PROPOSAL_STATUS_TAG: Record<string, ActivityItem['tag']> = {
  draft:      'nuevo',
  review:     'pendiente',
  debate:     'activo',
  voting:     'tendencia',
  approved:   'resuelto',
  rejected:   'pendiente',
}

const CATEGORY_COLOR: Record<string, string> = {
  infraestructura:   '#1A7FBF',
  servicios_publicos:'#4ECDC4',
  seguridad:         '#C0392B',
  salud:             '#27AE60',
  medio_ambiente:    '#2ECC71',
  transporte:        '#FFB522',
  educacion:         '#9B59B6',
  cultura:           '#E67E22',
  otro:              '#7F8C8D',
}

const CATEGORY_LABEL: Record<string, string> = {
  infraestructura:   'Infraestructura',
  servicios_publicos:'Agua / Serv.',
  seguridad:         'Seguridad',
  salud:             'Salud',
  medio_ambiente:    'Medio Ambiente',
  transporte:        'Transporte',
  educacion:         'Educación',
  cultura:           'Cultura',
  otro:              'Otro',
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 2)   return 'Ahora'
  if (mins < 60)  return `Hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `Hace ${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'Ayer'
  return `Hace ${days} días`
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatValue(n: number): string {
  if (n >= 10000) return `${(n / 1000).toFixed(0)}k`
  if (n >= 1000)  return `${(n / 1000).toFixed(1)}k`
  return String(Math.round(n))
}

function formatScore(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(Math.round(n))
}

function buildActivity(reports: RecentReport[], proposals: RecentProposal[]): ActivityItem[] {
  const items: ActivityItem[] = [
    ...reports.map((r) => ({
      id:    `r-${r.id}`,
      kind:  'report' as const,
      label: r.status === 'resolved' ? 'Reporte resuelto' : r.status === 'in_progress' ? 'Reporte en proceso' : 'Nuevo reporte',
      desc:  r.neighborhood ? `${r.title} — ${r.neighborhood}` : r.title,
      tag:   REPORT_STATUS_TAG[r.status] ?? 'nuevo',
      time:  timeAgo(r.created_at),
      color: CATEGORY_COLOR[r.category] ?? '#7F8C8D',
    })),
    ...proposals.map((p) => ({
      id:    `p-${p.id}`,
      kind:  'proposal' as const,
      label: p.status === 'voting' ? 'Propuesta en votación' : p.status === 'debate' ? 'Propuesta en debate' : 'Nueva propuesta',
      desc:  p.title,
      tag:   PROPOSAL_STATUS_TAG[p.status] ?? 'nuevo',
      time:  timeAgo(p.created_at),
      color: CATEGORY_COLOR[p.category] ?? '#C8A84B',
    })),
  ]
  items.sort((a, b) => {
    const ta = a.time.startsWith('Hace') ? parseInt(a.time.replace(/\D/g, '')) : 9999
    const tb = b.time.startsWith('Hace') ? parseInt(b.time.replace(/\D/g, '')) : 9999
    return ta - tb
  })
  return items.slice(0, 5)
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function DashboardPage() {
  const [stats, setStats]       = useState<DashboardStats | null>(null)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    async function loadStats() {
      try {
        const [territorial, governance, reputation, recentReports, recentProposals] = await Promise.allSettled([
          apiFetch<TerritorialStatsAPI>('/territorial/stats',                               { public: true }),
          apiFetch<GovernanceStats>('/governance/proposals/stats',                          { public: true }),
          apiFetch<ReputationProfileAPI>('/reputation/me'),
          apiFetch<{ data: RecentReport[] }>('/territorial/reports?limit=6&offset=0',       { public: true }),
          apiFetch<{ data: RecentProposal[] }>('/governance/proposals?limit=6&offset=0',    { public: true }),
        ])

        const terData = territorial.status === 'fulfilled' ? territorial.value : null
        const govData = governance.status  === 'fulfilled' ? governance.value  : null
        const repData = reputation.status  === 'fulfilled' ? reputation.value  : null
        const voting  = govData?.by_status.find(s => s.status === 'voting')?.count ?? 0
        const resolvedCount = terData?.by_category.reduce((sum, c) => sum + c.resolved_count, 0) ?? 0

        setStats({
          openReports:        terData?.open_reports ?? 0,
          resolvedReports:    resolvedCount,
          totalProposals:     govData?.total_proposals ?? 0,
          votingProposals:    voting,
          reputationScore:    repData?.reputation_score ?? 0,
          participationCount: repData
            ? (repData.total_votes ?? 0) + (repData.total_proposals ?? 0) + (repData.total_reports ?? 0)
            : 0,
          byCategory:         terData?.by_category ?? [],
        })

        const reports   = recentReports.status   === 'fulfilled' ? (recentReports.value.data   ?? []) : []
        const proposals = recentProposals.status === 'fulfilled' ? (recentProposals.value.data ?? []) : []
        setActivity(buildActivity(reports, proposals))
      } catch {
        // Stats no críticos — el panel sigue funcionando
      } finally {
        setLoading(false)
      }
    }
    void loadStats()
  }, [])

  const participationPct = stats
    ? Math.min(100, Math.round(
        (stats.resolvedReports / Math.max(1, stats.resolvedReports + stats.openReports)) * 100
      ))
    : 0

  // Top 4 categorías por total de reportes para el desglose
  const topCategories = (stats?.byCategory ?? [])
    .slice()
    .sort((a, b) => b.total - a.total)
    .slice(0, 4)
    .map((c) => {
      const totalReports = stats?.byCategory.reduce((s, x) => s + x.total, 0) ?? 1
      return {
        label: CATEGORY_LABEL[c.category] ?? c.category,
        pct:   Math.round((c.total / totalReports) * 100),
        color: CATEGORY_COLOR[c.category] ?? '#7F8C8D',
      }
    })

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-6 py-10 space-y-10">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-end justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-tertiary mb-1">
              Panel Ciudadano · Cartagena de Indias
            </p>
            <h1 className="font-display text-2xl font-bold text-primary">
              VÉRTICE OS
            </h1>
            <p className="mt-1 font-mono text-[12px] text-secondary">
              Tu ciudad, tus decisiones — participación continua.
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <span className="status-dot" />
            <span className="font-mono text-[10px] uppercase tracking-wider text-tertiary">
              Sistema activo
            </span>
          </div>
        </div>

        {/* ── KPI Row — Sistema Gráfico de Medición Estadística ───────────── */}
        <section aria-label="Indicadores clave">
          <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.25em] text-tertiary">
            Indicadores clave
          </p>
          <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
            <KpiCard
              label="Propuestas"
              value={loading ? null : formatValue(stats?.totalProposals ?? 0)}
              delta={8.3}
              deltaLabel="este mes"
              sparkData={SPARKS.proposals}
              color="#C8A84B"
              icon={<FileText size={14} strokeWidth={1.5} />}
            />
            <KpiCard
              label="Reportes abiertos"
              value={loading ? null : formatValue(stats?.openReports ?? 0)}
              delta={2.1}
              deltaLabel="esta semana"
              sparkData={SPARKS.reports}
              color="#C0392B"
              icon={<Map size={14} strokeWidth={1.5} />}
            />
            <KpiCard
              label="En votación"
              value={loading ? null : stats?.votingProposals ?? 0}
              delta={15.7}
              deltaLabel="vs anterior"
              sparkData={SPARKS.citizens}
              color="#FFB522"
              icon={<Users size={14} strokeWidth={1.5} />}
            />
            <KpiCard
              label="Tu reputación"
              value={loading ? null : formatScore(stats?.reputationScore ?? 0)}
              delta={stats?.participationCount ? 12.4 : 0}
              sparkData={SPARKS.reputation}
              color="#4ECDC4"
              unit="pts"
              icon={<Star size={14} strokeWidth={1.5} />}
            />
          </div>
        </section>

        {/* ── Módulos Territoriales — Sistema de Ítems ────────────────────── */}
        <section aria-label="Módulos territoriales">
          <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.25em] text-tertiary">
            Módulos territoriales
          </p>
          <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4 lg:grid-cols-8">
            {TERRITORIAL_MODULES.map(mod => (
              <ModuleCard key={mod.id} module={mod} size="sm" />
            ))}
          </div>
        </section>

        {/* ── Fila media: acciones rápidas + gauge de participación ─────────── */}
        <div className="grid gap-6 lg:grid-cols-3">

          {/* Acciones rápidas — Sistema 2 acciones */}
          <div className="lg:col-span-2 space-y-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-tertiary">
              Acciones rápidas
            </p>
            <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4 lg:grid-cols-2">
              {[
                { href: '/dashboard/proposals/new', icon: FileTextIcon, label: 'Nueva propuesta',    desc: 'Crea una iniciativa ciudadana',      color: '#C8A84B' },
                { href: '/dashboard/reports/new',   icon: AlertTriangle, label: 'Reportar problema', desc: 'Informa sobre tu barrio',            color: '#C0392B' },
                { href: '/dashboard/ai',            icon: Sparkles,      label: 'Consultar IA',      desc: 'Asistente cívico multi-agente',      color: '#4ECDC4' },
                { href: '/dashboard/legal/new',     icon: Scale,         label: 'Doc. legal',        desc: 'Genera una petición o tutela',       color: '#1A7FBF' },
              ].map(({ href, icon: Icon, label, desc, color }) => (
                <a
                  key={href}
                  href={href}
                  className="group flex flex-col gap-3 border border-border bg-surface p-4 transition-all hover:border-border-active hover:bg-surface-2"
                >
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-sm transition-transform group-hover:scale-105"
                    style={{ backgroundColor: `${color}18`, border: `1px solid ${color}30` }}
                  >
                    <Icon size={15} style={{ color }} strokeWidth={1.5} />
                  </div>
                  <div>
                    <div className="font-display text-[13px] font-semibold text-primary">{label}</div>
                    <div className="mt-0.5 font-mono text-[10px] text-tertiary">{desc}</div>
                  </div>
                  <div
                    className="h-px w-0 transition-all duration-300 group-hover:w-full"
                    style={{ backgroundColor: color }}
                  />
                </a>
              ))}
            </div>
          </div>

          {/* Panel de participación — Sistema 3 gauge + mini bar chart */}
          <div className="flex flex-col gap-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-tertiary">
              Participación ciudadana
            </p>
            <div className="flex flex-1 flex-col items-center justify-center gap-6 border border-border bg-surface p-6">
              <ProgressGauge
                value={loading ? 0 : participationPct || 64}
                size={110}
                label="Casos resueltos"
                sublabel="últimos 30 días"
              />

              {/* Mini distribución por categoría — datos reales de /territorial/stats */}
              <div className="w-full space-y-2">
                {(topCategories.length > 0
                  ? topCategories
                  : [
                      { label: 'Infraestructura', pct: 38, color: '#1A7FBF' },
                      { label: 'Seguridad',        pct: 27, color: '#C0392B' },
                      { label: 'Agua / Serv.',     pct: 21, color: '#4ECDC4' },
                      { label: 'Salud',            pct: 14, color: '#27AE60' },
                    ]
                ).map(({ label, pct, color }) => (
                  <div key={label} className="space-y-1">
                    <div className="flex justify-between">
                      <span className="font-mono text-[9px] text-tertiary">{label}</span>
                      <span className="font-mono text-[9px]" style={{ color }}>{pct}%</span>
                    </div>
                    <div className="h-1 w-full rounded-full bg-white/4">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Actividad reciente — datos reales de reportes y propuestas ──── */}
        <section aria-label="Actividad reciente">
          <div className="mb-4 flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-tertiary">
              Actividad reciente
            </p>
            <a
              href="/dashboard/reports"
              className="font-mono text-[10px] text-tertiary transition-colors hover:text-gold"
            >
              Ver todo →
            </a>
          </div>

          <div className="divide-y divide-border border border-border bg-surface">
            {loading && (
              <div className="flex items-center justify-center py-10">
                <div className="h-6 w-6 animate-spin rounded-full border-t border-gold" />
              </div>
            )}
            {!loading && activity.length === 0 && (
              <div className="px-5 py-8 text-center font-mono text-[11px] text-tertiary">
                Sin actividad reciente — sé el primero en participar.
              </div>
            )}
            {activity.map((item) => {
              const href = item.kind === 'report'
                ? `/dashboard/reports/${item.id.slice(2)}`
                : `/dashboard/proposals/${item.id.slice(2)}`
              return (
                <a
                  key={item.id}
                  href={href}
                  className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-2"
                >
                  <div className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[12px] text-primary">{item.label}</span>
                      <CategoryTag variant={item.tag} />
                    </div>
                    <p className="mt-0.5 truncate font-mono text-[10px] text-tertiary">{item.desc}</p>
                  </div>
                  <span className="flex-shrink-0 font-mono text-[9px] uppercase tracking-wider text-tertiary">
                    {item.time}
                  </span>
                </a>
              )
            })}
          </div>
        </section>

        {/* ── Tendencia semanal — Sistema 3 mini chart de área ──────────── */}
        <section aria-label="Tendencia de propuestas">
          <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.25em] text-tertiary">
            Tendencia — últimas 8 semanas
          </p>
          <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
            {[
              { label: 'Propuestas creadas',  data: SPARKS.proposals, color: '#C8A84B' },
              { label: 'Reportes recibidos',  data: SPARKS.reports,   color: '#C0392B' },
              { label: 'Ciudadanos activos',  data: SPARKS.citizens,  color: '#FFB522' },
              { label: 'Puntos reputación',   data: SPARKS.reputation,color: '#4ECDC4' },
            ].map(({ label, data, color }) => (
              <div key={label} className="flex flex-col gap-3 bg-surface p-4">
                <span className="font-mono text-[10px] uppercase tracking-wider text-tertiary">
                  {label}
                </span>
                <MiniSpark data={data} color={color} width={120} height={40} fill />
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px]" style={{ color }}>
                    {data[data.length - 1]}
                  </span>
                  <span className="font-mono text-[9px] text-tertiary">
                    vs {data[0]} sem. 1
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  )
}
