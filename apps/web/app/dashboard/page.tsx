import { BarChart3, FileText, Map, Star, Users, Zap } from 'lucide-react'

const STAT_CARDS = [
  { icon: Users,    label: 'Ciudadanos activos',    value: '—',    color: 'text-cyan'  },
  { icon: FileText, label: 'Propuestas en debate',  value: '—',    color: 'text-gold'  },
  { icon: Map,      label: 'Reportes abiertos',     value: '—',    color: 'text-gold'  },
  { icon: Star,     label: 'Tu reputación',         value: '—',    color: 'text-cyan'  },
] as const

const QUICK_ACTIONS = [
  { href: '/dashboard/proposals/new', label: 'Nueva propuesta',   icon: FileText, description: 'Presenta una iniciativa ciudadana' },
  { href: '/dashboard/reports/new',   label: 'Reportar problema', icon: Map,       description: 'Reporta un problema en tu barrio' },
  { href: '/dashboard/legal/new',     label: 'Documento legal',   icon: Zap,       description: 'Genera una petición, tutela u otro recurso' },
  { href: '/dashboard/reputation',    label: 'Mi reputación',     icon: BarChart3, description: 'Historial de participación cívica' },
] as const

export default function DashboardPage() {
  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="border-b border-border bg-surface/60 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <a href="/" className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
                <polygon points="12,2 22,21 2,21" stroke="#C8A84B" strokeWidth="1.5" fill="none" />
              </svg>
              <span className="font-display text-xs font-700 uppercase tracking-widest text-primary">
                VÉRTICE OS
              </span>
            </a>
            <span className="text-tertiary">/</span>
            <span className="font-mono text-[11px] text-secondary uppercase tracking-[0.15em]">
              Dashboard
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="status-dot" />
            <a href="/auth/login" className="btn-ghost text-[10px] py-2 px-4">
              Salir
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
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
        <div className="mb-10 grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
          {STAT_CARDS.map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="flex flex-col gap-4 bg-bg p-6">
              <Icon size={18} strokeWidth={1.5} className={color} />
              <div>
                <div className={`font-display text-3xl font-700 ${color}`}>{value}</div>
                <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.15em] text-tertiary">
                  {label}
                </div>
              </div>
            </div>
          ))}
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
