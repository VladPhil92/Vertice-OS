'use client'

import { useEffect, useState } from 'react'
import {
  Bell, Flag, Map, Sparkles, MessageCircle, Vote, ShieldCheck,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'

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
  category: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

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
  infraestructura:    '#1A7FBF',
  servicios_publicos: '#4ECDC4',
  seguridad:          '#C0392B',
  salud:              '#27AE60',
  medio_ambiente:     '#2ECC71',
  transporte:         '#FFB522',
  educacion:          '#9B59B6',
  cultura:            '#E67E22',
  otro:               '#7F8C8D',
}

const CATEGORY_LABEL: Record<string, string> = {
  infraestructura:    'Infraestructura',
  servicios_publicos: 'Agua / Serv.',
  seguridad:          'Seguridad',
  salud:              'Salud',
  medio_ambiente:     'Medio Ambiente',
  transporte:         'Transporte',
  educacion:          'Educación',
  cultura:            'Cultura',
  otro:               'Otro',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
      id:       `r-${r.id}`,
      kind:     'report' as const,
      label:    r.status === 'resolved' ? 'Reporte resuelto' : r.status === 'in_progress' ? 'Reporte en proceso' : 'Nuevo reporte',
      desc:     r.neighborhood ? `${r.title} — ${r.neighborhood}` : r.title,
      tag:      REPORT_STATUS_TAG[r.status] ?? 'nuevo',
      time:     timeAgo(r.created_at),
      color:    CATEGORY_COLOR[r.category] ?? '#7F8C8D',
      category: r.category,
    })),
    ...proposals.map((p) => ({
      id:       `p-${p.id}`,
      kind:     'proposal' as const,
      label:    p.status === 'voting' ? 'Propuesta en votación' : p.status === 'debate' ? 'Propuesta en debate' : 'Nueva propuesta',
      desc:     p.title,
      tag:      PROPOSAL_STATUS_TAG[p.status] ?? 'nuevo',
      time:     timeAgo(p.created_at),
      color:    CATEGORY_COLOR[p.category] ?? '#C8A84B',
      category: p.category,
    })),
  ]
  items.sort((a, b) => {
    const ta = a.time.startsWith('Hace') ? parseInt(a.time.replace(/\D/g, '')) : 9999
    const tb = b.time.startsWith('Hace') ? parseInt(b.time.replace(/\D/g, '')) : 9999
    return ta - tb
  })
  return items.slice(0, 5)
}

// ─── Quick actions config ─────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { icon: Flag,          label: 'Reportar',       href: '/dashboard/reports/new',  color: '#C0392B' },
  { icon: Vote,          label: 'Votar',           href: '/dashboard/governance',   color: '#1A7FBF' },
  { icon: Sparkles,      label: 'Generar con IA',  href: '/dashboard/ai',           color: '#4ECDC4' },
  { icon: MessageCircle, label: 'Debatir con IA',  href: '/dashboard/ai',           color: '#9B59B6' },
  { icon: Map,           label: 'Ver Mapa',        href: '/dashboard/reports',      color: '#27AE60' },
  { icon: ShieldCheck,   label: 'Mi Identidad',    href: '/dashboard/identity',     color: '#C8A84B' },
] as const

// ─── Sub-components ───────────────────────────────────────────────────────────

function TagBadge({ tag }: { tag: ActivityItem['tag'] }) {
  const styles: Record<ActivityItem['tag'], string> = {
    urgente:   'bg-[#C0392B]/15 text-[#C0392B] border border-[#C0392B]/30',
    activo:    'bg-[#1A7FBF]/15 text-[#1A7FBF] border border-[#1A7FBF]/30',
    resuelto:  'bg-[#27AE60]/15 text-[#27AE60] border border-[#27AE60]/30',
    tendencia: 'bg-[#C8A84B]/15 text-[#C8A84B] border border-[#C8A84B]/30',
    nuevo:     'bg-[rgba(255,255,255,0.06)] text-[rgba(240,237,232,0.45)] border border-[rgba(255,255,255,0.08)]',
    pendiente: 'bg-[rgba(255,255,255,0.06)] text-[rgba(240,237,232,0.45)] border border-[rgba(255,255,255,0.08)]',
  }
  const labels: Record<ActivityItem['tag'], string> = {
    urgente:   'URGENTE',
    activo:    'EN PROCESO',
    resuelto:  'RESUELTO',
    tendencia: 'VOTANDO',
    nuevo:     'NUEVO',
    pendiente: 'PENDIENTE',
  }
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.1em] ${styles[tag]}`}>
      {labels[tag]}
    </span>
  )
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

  // ── Panorama stats ────────────────────────────────────────────────────────
  const panoramaStats = [
    { label: 'Reportes activos',    value: stats ? formatValue(stats.openReports)     : null },
    { label: 'Propuestas abiertas', value: stats ? formatValue(stats.totalProposals)  : null },
    { label: 'En votación',         value: stats ? String(stats.votingProposals)       : null },
    { label: 'Resueltos',           value: stats ? formatValue(stats.resolvedReports) : null },
    { label: 'Mi puntuación',       value: stats ? formatScore(stats.reputationScore) : null },
  ]

  return (
    <div className="min-h-screen bg-[#050508]">
      <div className="max-w-2xl mx-auto pb-24">

        {/* ── 1. Header ────────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-30 flex items-center justify-between px-4 pt-safe pb-3 bg-[#050508]/95 backdrop-blur border-b border-[rgba(255,255,255,0.08)]">
          {/* Left: logo */}
          <div className="flex items-center gap-2">
            {/* VÉRTICE triangle SVG */}
            <svg width="18" height="16" viewBox="0 0 18 16" fill="none" aria-hidden="true">
              <path d="M9 1L17 15H1L9 1Z" fill="none" stroke="#C8A84B" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M9 6L13 13H5L9 6Z" fill="#C8A84B" fillOpacity="0.25" />
            </svg>
            <span className="font-display text-xs font-bold uppercase tracking-widest text-[#C8A84B]">
              VÉRTICE OS
            </span>
          </div>

          {/* Right: bell + avatar */}
          <div className="flex items-center gap-3">
            <button
              aria-label="Notificaciones"
              className="flex h-8 w-8 items-center justify-center text-[rgba(240,237,232,0.45)] hover:text-[#F0EDE8] transition-colors"
            >
              <Bell size={16} strokeWidth={1.5} />
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1A2744] border border-[rgba(255,255,255,0.08)]">
              <span className="font-mono text-[10px] font-600 text-[#F0EDE8]">MA</span>
            </div>
          </div>
        </header>

        {/* ── 2. Hero banner ───────────────────────────────────────────────── */}
        <div className="relative overflow-hidden min-h-[160px] bg-[#1A2744]">
          {/* Subtle grid overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
              backgroundSize: '60px 60px',
            }}
          />

          {/* Decorative gold triangle */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <svg width="140" height="126" viewBox="0 0 140 126" fill="none" aria-hidden="true" opacity="0.15">
              <path d="M70 4L136 122H4L70 4Z" fill="none" stroke="#C8A84B" strokeWidth="2" strokeLinejoin="round" />
              <path d="M70 40L104 100H36L70 40Z" fill="#C8A84B" />
            </svg>
          </div>

          {/* Content overlay */}
          <div className="absolute inset-0 flex flex-col justify-end p-5">
            <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#C8A84B]/80">
              CARTAGENA · CIUDAD PILOTO
            </span>
            <h2 className="font-display text-2xl font-extrabold text-[#F0EDE8] leading-tight mt-1">
              Cartagena la construimos juntos
            </h2>
            <p className="font-mono text-[11px] text-[rgba(240,237,232,0.45)] mt-1">
              Reporta. Decide. Vigila. Transforma tu ciudad.
            </p>
            <a
              href="/dashboard/proposals"
              className="mt-3 self-start inline-flex items-center px-3 py-1.5 bg-[#C8A84B] text-[#050508] font-mono text-[10px] font-bold uppercase tracking-[0.1em] transition-opacity hover:opacity-90"
            >
              Ir al poder ciudadano
            </a>
          </div>
        </div>

        {/* ── 3. Quick actions — 3×2 grid ──────────────────────────────────── */}
        <div className="px-4 mt-4 grid grid-cols-3 gap-3">
          {QUICK_ACTIONS.map(({ icon: Icon, label, href, color }) => (
            <a
              key={href + label}
              href={href}
              className="border border-[rgba(255,255,255,0.08)] bg-[#0c0c14] hover:border-[rgba(255,255,255,0.15)] hover:bg-[rgba(255,255,255,0.04)] transition-colors p-4 flex flex-col items-start gap-3"
            >
              <div
                className="h-9 w-9 flex items-center justify-center"
                style={{
                  backgroundColor: `${color}18`,
                  border: `1px solid ${color}30`,
                }}
              >
                <Icon size={15} strokeWidth={1.5} style={{ color }} />
              </div>
              <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[rgba(240,237,232,0.45)] leading-tight">
                {label}
              </span>
            </a>
          ))}
        </div>

        {/* ── 4. City panorama ─────────────────────────────────────────────── */}
        <div className="px-4 mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-sm font-semibold text-[#F0EDE8]">
              Panorama de Cartagena
            </h3>
            <a
              href="/dashboard/reports"
              className="font-mono text-[10px] text-[#C8A84B] hover:opacity-80 transition-opacity"
            >
              Ver indicadores →
            </a>
          </div>

          {/* Horizontally scrollable stats row */}
          <div className="flex overflow-x-auto gap-3 pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {panoramaStats.map(({ label, value }) => (
              <div
                key={label}
                className="flex-shrink-0 border border-[rgba(255,255,255,0.08)] bg-[#0c0c14] px-4 py-3 min-w-[100px]"
              >
                {loading || value === null ? (
                  <div className="animate-pulse bg-[#0c0c14] h-4 w-12 rounded border border-[rgba(255,255,255,0.06)]" />
                ) : (
                  <div className="font-display text-xl font-bold text-[#C8A84B]">{value}</div>
                )}
                <div className="font-mono text-[9px] text-[rgba(240,237,232,0.22)] mt-1 leading-tight">
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 5. Featured reports ───────────────────────────────────────────── */}
        <div className="px-4 mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-sm font-semibold text-[#F0EDE8]">
              Reportes destacados
            </h3>
            <a
              href="/dashboard/reports"
              className="font-mono text-[10px] text-[#C8A84B] hover:opacity-80 transition-opacity"
            >
              Ver todos →
            </a>
          </div>

          <div className="flex flex-col gap-3">
            {/* Loading skeletons */}
            {loading && (
              <>
                {[0, 1].map((i) => (
                  <div
                    key={i}
                    className="border border-[rgba(255,255,255,0.08)] bg-[#0c0c14] p-4 flex flex-col gap-2 animate-pulse"
                  >
                    <div className="flex items-center justify-between">
                      <div className="h-3 w-16 rounded bg-[rgba(255,255,255,0.06)]" />
                      <div className="h-3 w-10 rounded bg-[rgba(255,255,255,0.04)]" />
                    </div>
                    <div className="h-4 w-3/4 rounded bg-[rgba(255,255,255,0.06)]" />
                    <div className="h-3 w-1/2 rounded bg-[rgba(255,255,255,0.04)]" />
                    <div className="h-3 w-1/3 rounded bg-[rgba(255,255,255,0.04)]" />
                  </div>
                ))}
              </>
            )}

            {/* Empty state */}
            {!loading && activity.length === 0 && (
              <div className="py-8 text-center font-mono text-[11px] text-[rgba(240,237,232,0.22)]">
                Sin reportes recientes
              </div>
            )}

            {/* Activity cards — first 3 */}
            {!loading && activity.slice(0, 3).map((item) => (
              <a
                key={item.id}
                href={
                  item.kind === 'report'
                    ? `/dashboard/reports/${item.id.slice(2)}`
                    : `/dashboard/proposals/${item.id.slice(2)}`
                }
                className="border border-[rgba(255,255,255,0.08)] bg-[#0c0c14] p-4 flex flex-col gap-2 hover:border-[rgba(255,255,255,0.15)] transition-colors"
              >
                {/* Top row: tag + time */}
                <div className="flex items-center justify-between gap-2">
                  <TagBadge tag={item.tag} />
                  <span className="font-mono text-[9px] uppercase tracking-wider text-[rgba(240,237,232,0.22)] flex-shrink-0">
                    {item.time}
                  </span>
                </div>

                {/* Title */}
                <p className="font-mono text-[13px] text-[#F0EDE8] font-medium line-clamp-2 leading-snug">
                  {item.label}
                </p>

                {/* Description / neighborhood */}
                <p className="font-mono text-[11px] text-[rgba(240,237,232,0.22)] line-clamp-1">
                  {item.desc}
                </p>

                {/* Bottom: category dot + label */}
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className="h-2 w-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="font-mono text-[10px] text-[rgba(240,237,232,0.22)]">
                    {CATEGORY_LABEL[item.category] ?? item.category}
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* ── 6. Active voting (conditional) ───────────────────────────────── */}
        {!loading && stats && stats.votingProposals > 0 && (
          <div className="px-4 mt-6">
            <div className="border border-[#C8A84B]/30 bg-[#0c0c14] p-5">
              {/* Tag with pulsing dot */}
              <div className="flex items-center gap-2 mb-3">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#C8A84B] opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#C8A84B]" />
                </span>
                <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#C8A84B] font-bold">
                  VOTACIÓN ACTIVA
                </span>
              </div>

              <h3 className="font-display text-base font-semibold text-[#F0EDE8] leading-snug">
                ¿Cuál debe ser la prioridad para mejorar Cartagena?
              </h3>
              <p className="font-mono text-[11px] text-[rgba(240,237,232,0.45)] mt-1">
                Tu voto tiene peso en las decisiones del distrito
              </p>
              <a
                href="/dashboard/governance"
                className="inline-block mt-3 font-mono text-[11px] text-[#C8A84B] hover:opacity-80 transition-opacity"
              >
                Ver propuestas activas →
              </a>
            </div>
          </div>
        )}

        {/* ── 7. Bottom spacer ─────────────────────────────────────────────── */}
        <div className="h-4" />

      </div>
    </div>
  )
}
