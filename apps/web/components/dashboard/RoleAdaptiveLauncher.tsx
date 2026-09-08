'use client'

import Link from 'next/link'
import { Activity, FileText, GitBranch, HandCoins, Landmark, MapPinned, Network, Scale, Vote } from 'lucide-react'
import { useDashboardRuntime, type CivicProfileType } from '@/components/dashboard/DashboardIdentityProvider'

const ACTIONS: Record<CivicProfileType, Array<{ href: string; label: string; detail: string; icon: typeof Activity }>> = {
  citizen: [
    { href: '/dashboard/reports/new', label: 'Reportar una situación', detail: 'Documenta un problema de tu territorio.', icon: MapPinned },
    { href: '/dashboard/governance', label: 'Participar', detail: 'Consulta mecanismos abiertos de decisión.', icon: Vote },
    { href: '/dashboard/community', label: 'Seguir gestión', detail: 'Explora acciones verificables de tu comunidad.', icon: Network },
  ],
  social_leader: [
    { href: '/dashboard/community/actions/new', label: 'Registrar gestión', detail: 'Convierte trabajo comunitario en evidencia pública.', icon: Activity },
    { href: '/dashboard/workflows', label: 'Gestionar expedientes', detail: 'Continúa casos y rutas de acción abiertas.', icon: GitBranch },
    { href: '/dashboard/crowdfunding', label: 'Financiar una causa', detail: 'Gestiona campañas comunitarias verificables.', icon: HandCoins },
  ],
  candidate: [
    { href: '/dashboard/community/actions/new', label: 'Registrar gestión social', detail: 'Separa resultados demostrables de comunicación política.', icon: Activity },
    { href: '/dashboard/proposals/new', label: 'Crear iniciativa', detail: 'Formula una propuesta trazable y deliberable.', icon: FileText },
    { href: '/dashboard/community', label: 'Contrastar evidencia', detail: 'Revisa gestión y validación comunitaria.', icon: Network },
  ],
  organization_rep: [
    { href: '/dashboard/community/actions/new', label: 'Registrar proyecto', detail: 'Documenta actividad y resultados de la organización.', icon: Activity },
    { href: '/dashboard/crowdfunding', label: 'Gestionar financiación', detail: 'Opera campañas con reglas transparentes.', icon: HandCoins },
    { href: '/dashboard/workflows', label: 'Abrir expedientes', detail: 'Sigue rutas de gestión asociadas al territorio.', icon: GitBranch },
  ],
  public_official: [
    { href: '/dashboard/reports', label: 'Revisar territorio', detail: 'Identifica reportes y cambios que requieren respuesta.', icon: Landmark },
    { href: '/dashboard/workflows', label: 'Gestionar casos', detail: 'Continúa expedientes hasta decisión y control.', icon: GitBranch },
    { href: '/dashboard/legal', label: 'Control y respuesta', detail: 'Gestiona actuaciones y documentos de control público.', icon: Scale },
  ],
}

export function RoleAdaptiveLauncher() {
  const { profile } = useDashboardRuntime()
  if (!profile) return null
  const actions = ACTIONS[profile.profile_type]

  return (
    <section data-testid="role-adaptive-launcher" className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
      <div className="rounded-[22px] border border-[#DCE5EF] bg-white p-4 sm:p-5">
        <div className="text-[9px] font-extrabold uppercase tracking-[.14em] text-[#7B8799]">Acciones para tu rol cívico</div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {actions.map(({ href, label, detail, icon: Icon }) => (
            <Link key={href} href={href} className="group flex gap-3 rounded-2xl bg-[#F7F9FC] p-4 transition hover:bg-[#EDF3FA]">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#0A2A66] shadow-sm"><Icon size={17} /></span>
              <div><div className="text-xs font-extrabold text-[#0A2A66]">{label}</div><p className="mt-1 text-[10px] font-medium leading-5 text-[#607087]">{detail}</p></div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
