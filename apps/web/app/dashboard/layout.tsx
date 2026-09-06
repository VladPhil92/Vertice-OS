'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useState, useCallback } from 'react'
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
  Home,
  Plus,
  User,
  X,
  GitBranch,
  Network,
} from 'lucide-react'
import Link from 'next/link'
import { useServerEvents, type RealtimeEvent } from '@/lib/useServerEvents'
import { requireApiBaseUrl } from '@/lib/api'
import { LiveToast, useToasts } from '@/components/ui/LiveToast'
import { NotificationBell } from '@/components/ui/NotificationBell'
import { PwaRegister } from '@/components/pwa/PwaRegister'
import { BrandLogo } from '@/components/ui/BrandLogo'
import { RoleSwitcher } from '@/components/auth/RoleSwitcher'

const NAV_ITEMS = [
  { href: '/dashboard',            label: 'Inicio',          icon: LayoutDashboard, exact: true,  adminOnly: false },
  { href: '/dashboard/community',  label: 'Red cívica',      icon: Network,         exact: false, adminOnly: false },
  { href: '/dashboard/reports',    label: 'Mapa y reportes', icon: Map,             exact: false, adminOnly: false },
  { href: '/dashboard/workflows',  label: 'Gestión social',  icon: GitBranch,       exact: false, adminOnly: false },
  { href: '/dashboard/proposals',  label: 'Iniciativas',     icon: FileText,        exact: false, adminOnly: false },
  { href: '/dashboard/governance', label: 'Consultas',       icon: Vote,            exact: false, adminOnly: false },
  { href: '/dashboard/ai',         label: 'IA cívica',       icon: Sparkles,        exact: false, adminOnly: false },
  { href: '/dashboard/identity',   label: 'Identidad',       icon: ShieldCheck,     exact: false, adminOnly: false },
  { href: '/dashboard/reputation', label: 'Perfil cívico',   icon: Star,            exact: false, adminOnly: false },
  { href: '/dashboard/legal',      label: 'Control público', icon: Scale,           exact: false, adminOnly: false },
  { href: '/dashboard/admin',      label: 'Moderación',      icon: Shield,          exact: false, adminOnly: true  },
] as const

const BOTTOM_NAV = [
  { href: '/dashboard',             label: 'Inicio',    icon: Home,      exact: true },
  { href: '/dashboard/community',   label: 'Red',       icon: Network,   exact: false },
  { href: '/dashboard/reports/new', label: 'Gestionar', icon: Plus,      exact: false, fab: true },
  { href: '/dashboard/workflows',   label: 'Gestión',   icon: GitBranch, exact: false },
  { href: '/dashboard/reputation',  label: 'Perfil',    icon: User,      exact: false },
] as const

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [role, setRole] = useState<string>('citizen')
  const { toasts, addToast, dismiss } = useToasts()

  const handleRealtimeEvent = useCallback((event: RealtimeEvent) => {
    if (event.type === 'report:created') {
      addToast('Nueva gestión territorial registrada', '#4A90E2')
    } else if (event.type === 'report:status_changed') {
      addToast(`Gestión actualizada a: ${event.payload.status as string}`, '#0A2A66')
    } else if (event.type === 'proposal:vote_cast') {
      addToast('Nueva participación registrada en una consulta', '#F5B700')
    } else if (event.type === 'proposal:endorsed') {
      addToast('Una iniciativa recibió un nuevo apoyo', '#2BA745')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useServerEvents(['territorial', 'governance'], handleRealtimeEvent)

  function isActive(href: string, exact: boolean) {
    return exact ? pathname === href : (pathname?.startsWith(href) ?? false)
  }

  async function handleSignOut() {
    try {
      const apiUrl = requireApiBaseUrl()
      await fetch(`${apiUrl}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      })
    } catch {
      // Ignore unavailable API/network errors — local sign-out must still complete.
    }
    localStorage.removeItem('access_token')
    localStorage.removeItem('citizen_id')
    document.cookie = 'vertice_auth=; path=/; max-age=0; SameSite=Strict'
    router.push('/auth/login')
  }

  const Sidebar = () => (
    <aside className="flex h-full w-72 flex-shrink-0 flex-col border-r border-[#E1E7EF] bg-white shadow-[12px_0_35px_rgba(10,42,102,.035)]" style={{ minHeight: '100vh' }}>
      <div className="border-b border-[#E1E7EF] px-5 py-5">
        <div className="flex items-center justify-between gap-3">
          <Link href="/dashboard" onClick={() => setSidebarOpen(false)} className="min-w-0 flex-1">
            <BrandLogo compact />
          </Link>
          <NotificationBell />
        </div>
        <div className="mt-4 flex items-center justify-between rounded-2xl bg-[#F7F9FC] px-3 py-2.5">
          <div>
            <div className="text-[9px] font-extrabold uppercase tracking-[.13em] text-[#7B8799]">Territorio activo</div>
            <div className="mt-1 text-xs font-bold text-[#0A2A66]">Cartagena de Indias</div>
          </div>
          <span className="h-2.5 w-2.5 rounded-full bg-[#2BA745] shadow-[0_0_0_5px_rgba(43,167,69,.1)]" />
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.filter(item => !item.adminOnly || ['moderator', 'admin', 'superadmin'].includes(role)).map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact)
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setSidebarOpen(false)}
              className={[
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[12px] font-semibold transition-all',
                active
                  ? 'bg-[#EAF1FB] text-[#0A2A66] shadow-sm'
                  : 'text-[#607087] hover:bg-[#F7F9FC] hover:text-[#0A2A66]',
              ].join(' ')}
            >
              <span className={[
                'flex h-8 w-8 items-center justify-center rounded-lg border',
                active
                  ? 'border-[#BFD0E8] bg-white text-[#0A2A66]'
                  : 'border-transparent bg-[#F7F9FC] text-[#7B8799]',
              ].join(' ')}>
                <Icon size={15} className="flex-shrink-0" strokeWidth={1.8} />
              </span>
              {label}
              {active && <span className="ml-auto h-5 w-1 rounded-full bg-[#F5B700]" />}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-[#E1E7EF] pt-3">
        <RoleSwitcher onRoleChange={setRole} />
        <div className="px-3 pb-3">
          <div className="mb-3 rounded-2xl bg-[#0A2A66] p-4 text-white">
            <div className="text-[9px] font-bold uppercase tracking-[.14em] text-[#B6CBEC]">Principio VÉRTICE</div>
            <div className="mt-2 text-sm font-extrabold leading-5">La gestión se demuestra con evidencia.</div>
            <div className="mt-2 text-[10px] font-medium leading-5 text-white/65">Popularidad no equivale a impacto comunitario.</div>
            <div className="mt-3 flex gap-1">
              <span className="h-1 w-7 rounded-full bg-[#F5B700]" />
              <span className="h-1 w-7 rounded-full bg-white" />
              <span className="h-1 w-7 rounded-full bg-[#D72638]" />
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[12px] font-semibold text-[#7B8799] transition hover:bg-[#FCEBED] hover:text-[#D72638]"
          >
            <LogOut size={15} />
            Cerrar sesión
          </button>
        </div>
      </div>
    </aside>
  )

  return (
    <div className="flex min-h-screen bg-[#F7F9FC] text-[#0A2A66]">
      <PwaRegister />
      <LiveToast messages={toasts} onDismiss={dismiss} />

      <div className="hidden lg:flex">
        <Sidebar />
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-[#0A2A66]/30 backdrop-blur-[2px]"
            onClick={() => setSidebarOpen(false)}
            aria-label="Cerrar menú"
          />
          <div className="relative z-10 h-full w-72 max-w-[88vw]">
            <Sidebar />
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#0A2A66] shadow-lg"
            aria-label="Cerrar menú"
          >
            <X size={18} />
          </button>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-40 flex items-center justify-between border-b border-[#E1E7EF] bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E1E7EF] text-[#0A2A66]"
            aria-label="Abrir menú"
          >
            <Menu size={19} />
          </button>
          <Link href="/dashboard/community" className="flex items-center">
            <BrandLogo compact className="scale-[.88]" />
          </Link>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button onClick={handleSignOut} className="text-[#7B8799] hover:text-[#D72638]" aria-label="Salir">
              <LogOut size={17} />
            </button>
          </div>
        </div>

        <main className="flex-1 overflow-y-auto pb-24 lg:pb-0">
          {children}
        </main>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#E1E7EF] bg-white/96 shadow-[0_-8px_30px_rgba(10,42,102,.06)] backdrop-blur-md lg:hidden">
        <div className="flex items-end justify-around px-2 pb-safe pt-2">
          {BOTTOM_NAV.map(({ href, label, icon: Icon, exact, ...rest }) => {
            const isFab = 'fab' in rest && rest.fab
            const active = isActive(href, exact)

            if (isFab) {
              return (
                <Link key={href} href={href} className="flex flex-col items-center pb-1" aria-label={label}>
                  <div className="flex h-14 w-14 -translate-y-4 items-center justify-center rounded-full bg-[#F5B700] text-[#0A2A66] shadow-[0_8px_24px_rgba(245,183,0,.28)] transition-transform active:scale-95">
                    <Icon size={23} strokeWidth={2.4} />
                  </div>
                  <span className="-mt-3 text-[9px] font-extrabold text-[#0A2A66]">{label}</span>
                </Link>
              )
            }

            return (
              <Link key={href} href={href} className="flex flex-col items-center gap-1 px-3 pb-2 pt-1" aria-label={label}>
                <Icon size={20} strokeWidth={active ? 2.2 : 1.7} className={active ? 'text-[#0A2A66]' : 'text-[#94A0B0]'} />
                <span className={active ? 'text-[9px] font-extrabold text-[#0A2A66]' : 'text-[9px] font-semibold text-[#94A0B0]'}>
                  {label}
                </span>
                {active && <span className="h-1 w-5 rounded-full bg-[#F5B700]" />}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
