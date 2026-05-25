'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import {
  LayoutDashboard,
  ShieldCheck,
  Map,
  FileText,
  Vote,
  Star,
  Scale,
  Menu,
  Shield,
  Sparkles,
  LogOut,
} from 'lucide-react'
import { useServerEvents, type RealtimeEvent } from '@/lib/useServerEvents'
import { LiveToast, useToasts } from '@/components/ui/LiveToast'

// ─── Nav items ───────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { href: '/dashboard',            label: 'Panel',          icon: LayoutDashboard, exact: true,  adminOnly: false },
  { href: '/dashboard/identity',   label: 'Identidad',      icon: ShieldCheck,     exact: false, adminOnly: false },
  { href: '/dashboard/reports',    label: 'Reportes',       icon: Map,             exact: false, adminOnly: false },
  { href: '/dashboard/proposals',  label: 'Propuestas',     icon: FileText,        exact: false, adminOnly: false },
  { href: '/dashboard/governance', label: 'Gobernanza',     icon: Vote,            exact: false, adminOnly: false },
  { href: '/dashboard/reputation', label: 'Reputación',     icon: Star,            exact: false, adminOnly: false },
  { href: '/dashboard/legal',      label: 'Doc. Legales',   icon: Scale,           exact: false, adminOnly: false },
  { href: '/dashboard/ai',         label: 'Asistente IA',   icon: Sparkles,        exact: false, adminOnly: false },
  { href: '/dashboard/admin',      label: 'Moderación',     icon: Shield,          exact: false, adminOnly: true  },
] as const

function getTokenRole(): string {
  if (typeof window === 'undefined') return 'citizen'
  try {
    const token = localStorage.getItem('access_token')
    if (!token) return 'citizen'
    const payload = JSON.parse(atob(token.split('.')[1]))
    return (payload.role as string) ?? 'citizen'
  } catch {
    return 'citizen'
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [role, setRole] = useState<string>('citizen')
  const { toasts, addToast, dismiss } = useToasts()

  useEffect(() => {
    setRole(getTokenRole())
  }, [])

  const handleRealtimeEvent = useCallback((event: RealtimeEvent) => {
    if (event.type === 'report:created') {
      addToast('Nuevo reporte ciudadano registrado', '#4ECDC4')
    } else if (event.type === 'report:status_changed') {
      addToast(`Reporte actualizado a: ${event.payload.status as string}`, '#C8A84B')
    } else if (event.type === 'proposal:vote_cast') {
      addToast('Nuevo voto registrado en una propuesta', '#FFB522')
    } else if (event.type === 'proposal:endorsed') {
      addToast('Una propuesta recibió un nuevo aval', '#27AE60')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useServerEvents(['territorial', 'governance'], handleRealtimeEvent)

  function isActive(href: string, exact: boolean) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  async function handleSignOut() {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      })
    } catch {
      // Ignore network errors — still clear local state
    }
    localStorage.removeItem('access_token')
    localStorage.removeItem('citizen_id')
    // Clear the middleware auth cookie
    document.cookie = 'vertice_auth=; path=/; max-age=0; SameSite=Strict'
    router.push('/auth/login')
  }

  const Sidebar = () => (
    <aside
      className="flex h-full w-60 flex-shrink-0 flex-col border-r border-border bg-surface"
      style={{ minHeight: '100vh' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-border px-5 py-5">
        <svg viewBox="0 0 32 32" className="h-7 w-7 flex-shrink-0" fill="none">
          <polygon points="16,2 30,30 2,30" stroke="#C8A84B" strokeWidth="1.5" fill="none" />
          <polygon points="16,9 26,29 6,29" stroke="#C8A84B" strokeWidth="0.75" fill="none" opacity="0.4" />
        </svg>
        <div>
          <span className="block font-display text-[11px] font-700 uppercase tracking-widest text-gold">
            VÉRTICE OS
          </span>
          <span className="block font-mono text-[9px] uppercase tracking-[0.12em] text-tertiary">
            Cartagena · v0.1
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.filter(item => !item.adminOnly || ['moderator', 'admin'].includes(role)).map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact)
          return (
            <a
              key={href}
              href={href}
              onClick={() => setSidebarOpen(false)}
              className={[
                'flex items-center gap-3 px-3 py-2.5 text-[12px] font-mono uppercase tracking-[0.1em] transition-colors',
                active
                  ? 'border-l-2 border-gold bg-gold/8 pl-[10px] text-gold'
                  : 'border-l-2 border-transparent text-secondary hover:bg-white/4 hover:text-primary',
              ].join(' ')}
            >
              <Icon size={14} className="flex-shrink-0" />
              {label}
            </a>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border px-3 py-4">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 px-3 py-2.5 text-[12px] font-mono uppercase tracking-[0.1em] text-tertiary transition-colors hover:text-red"
        >
          <LogOut size={14} className="flex-shrink-0" />
          Salir
        </button>
      </div>
    </aside>
  )

  return (
    <div className="flex min-h-screen">
      <LiveToast messages={toasts} onDismiss={dismiss} />
      {/* Desktop sidebar — always visible on lg+ */}
      <div className="hidden lg:flex">
        <Sidebar />
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative z-50 h-full w-60">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main area */}
      <div className="flex flex-1 flex-col">
        {/* Mobile top bar */}
        <div className="flex items-center justify-between border-b border-border bg-surface/60 px-4 py-3 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-secondary hover:text-primary"
            aria-label="Abrir menú"
          >
            <Menu size={20} />
          </button>
          <a href="/" className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
              <polygon points="12,2 22,21 2,21" stroke="#C8A84B" strokeWidth="1.5" fill="none" />
            </svg>
            <span className="font-display text-[10px] font-700 uppercase tracking-widest text-gold">
              VÉRTICE OS
            </span>
          </a>
          <button
            onClick={handleSignOut}
            className="text-tertiary hover:text-red"
            aria-label="Salir"
          >
            <LogOut size={16} />
          </button>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
