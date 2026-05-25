'use client'

import { useEffect, useState } from 'react'
import { BarChart3, FileText, Map, Star, Zap, Loader2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TerritorialStats {
  total_reports: number
  open_reports: number
}

interface GovernanceStats {
  total_proposals: number
  by_status: Array<{ status: string; count: number }>
}

interface ReputationProfile {
  score: number
  level: string
}

interface DashboardStats {
  openReports: number
  totalProposals: number
  reputationScore: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  {
    href: '/dashboard/proposals/new',
    label: 'Nueva propuesta',
    icon: FileText,
    description: 'Presenta una iniciativa ciudadana',
  },
  {
    href: '/dashboard/reports/new',
    label: 'Reportar problema',
    icon: Map,
    description: 'Reporta un problema en tu barrio',
  },
  {
    href: '/dashboard/legal/new',
    label: 'Documento legal',
    icon: Zap,
    description: 'Genera una petición, tutela u otro recurso',
  },
  {
    href: '/dashboard/reputation',
    label: 'Mi reputación',
    icon: BarChart3,
    description: 'Historial de participación cívica',
  },
] as const

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatScore(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(Math.round(n))
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [stats, setStats]     = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadStats() {
      try {
        const [territorial, governance, reputation] = await Promise.allSettled([
          apiFetch<TerritorialStats>('/territorial/stats', { public: true }),
          apiFetch<GovernanceStats>('/governance/proposals/stats', { public: true }),
          apiFetch<ReputationProfile>('/reputation/me'),
        ])

        setStats({
          openReports:    territorial.status === 'fulfilled' ? territorial.value.open_reports    : 0,
          totalProposals: governance.status  === 'fulfilled' ? governance.value.total_proposals  : 0,
          reputationScore: reputation.status === 'fulfilled' ? reputation.value.score            : 0,
        })
      } catch {
        // Stats are non-critical — page renders fine with nulls
      } finally {
        setLoading(false)
      }
    }

    void loadStats()
  }, [])

  const STAT_CARDS = [
    {
      icon: FileText,
      label: 'Propuestas totales',
      value: loading ? null : (stats?.totalProposals ?? 0),
      color: 'text-gold',
    },
    {
      icon: Map,
      label: 'Reportes abiertos',
      value: loading ? null : (stats?.openReports ?? 0),
      color: 'text-gold',
    },
    {
      icon: Star,
      label: 'Tu reputación',
      value: loading ? null : (stats?.reputationScore ?? 0),
      color: 'text-cyan',
      format: (n: number) => formatScore(n),
    },
  ] as const

  return (
    <div>
      <main className="mx-auto max-w-5xl px-6 py-10">
        {/* Welcome */}
        <div className="mb-10">
          <span className="section-tag">Panel ciudadano</span>
          <h1 className="font-display text-3xl font-700 text-primary">
            Bienvenido a VÉRTICE OS
          </h1>
          <p className="mt-2 font-mono text-sm text-secondary">
            Participa en las decisiones de tu ciudad. Tu voz tiene peso.
          </p>
        </div>

        {/* Stats */}
        <div className="mb-10 grid gap-px bg-border sm:grid-cols-3">
          {STAT_CARDS.map(({ icon: Icon, label, value, color, ...rest }) => {
            const fmt = 'format' in rest ? rest.format : undefined
            return (
              <div key={label} className="flex flex-col gap-4 bg-bg p-6">
                <Icon size={18} strokeWidth={1.5} className={color} />
                <div>
                  <div className={`font-display text-3xl font-700 ${color}`}>
                    {value === null ? (
                      <Loader2 size={22} className="animate-spin text-tertiary" />
                    ) : (
                      fmt ? fmt(value as number) : value
                    )}
                  </div>
                  <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.15em] text-tertiary">
                    {label}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Quick actions */}
        <div className="mb-10">
          <h2 className="mb-5 font-mono text-[11px] uppercase tracking-[0.2em] text-tertiary">
            Acciones rápidas
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {QUICK_ACTIONS.map(({ href, label, icon: Icon, description }) => (
              <a
                key={href}
                href={href}
                className="group flex flex-col gap-4 border border-border p-6 transition-all hover:border-border-active hover:bg-surface"
              >
                <div className="flex h-10 w-10 items-center justify-center border border-border text-gold transition-colors group-hover:border-border-active">
                  <Icon size={16} strokeWidth={1.5} />
                </div>
                <div>
                  <div className="font-display text-sm font-600 text-primary">{label}</div>
                  <div className="mt-1 font-mono text-[12px] text-secondary">{description}</div>
                </div>
                <div className="mt-auto h-px w-0 bg-gold transition-all duration-300 group-hover:w-full" />
              </a>
            ))}
          </div>
        </div>

        {/* Activity placeholder */}
        <div>
          <h2 className="mb-5 font-mono text-[11px] uppercase tracking-[0.2em] text-tertiary">
            Actividad reciente
          </h2>
          <div className="border border-border bg-surface p-12 text-center">
            <p className="font-mono text-sm text-tertiary">
              Todavía no hay actividad registrada.
              <br />
              <a href="/dashboard/proposals/new" className="mt-2 inline-block text-gold hover:underline">
                Crea tu primera propuesta →
              </a>
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
