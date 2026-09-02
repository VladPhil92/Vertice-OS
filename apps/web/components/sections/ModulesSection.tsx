import Link from 'next/link'
import { ArrowRight, BadgeCheck, Bot, Building2, FileText, MapPinned, UserRound } from 'lucide-react'
import { PublicSectionHeader } from '@/components/ui/PublicSectionHeader'

const MODULES = [
  {
    icon: MapPinned,
    title: 'Mapa y reportes',
    description: 'Explora reportes territoriales y registra lo que ocurre cerca de ti con ubicación, contexto y evidencia.',
    path: '/dashboard/reports',
    color: '#246CB6',
    bg: '#EAF1FB',
    label: 'Territorio',
  },
  {
    icon: FileText,
    title: 'Propuestas ciudadanas',
    description: 'Convierte una idea en una iniciativa estructurada, reúne argumentos y sigue su evolución.',
    path: '/dashboard/proposals',
    color: '#D98B00',
    bg: '#FFF4D1',
    label: 'Iniciativa',
  },
  {
    icon: Building2,
    title: 'Gobernanza',
    description: 'Consulta procesos, decisiones y espacios de participación disponibles dentro del piloto.',
    path: '/dashboard/governance',
    color: '#0A2A66',
    bg: '#EDF2F8',
    label: 'Decisión',
  },
  {
    icon: Bot,
    title: 'Asistente cívico con IA',
    description: 'Aclara conceptos, organiza ideas y comprende información antes de participar o proponer.',
    path: '/dashboard/ai',
    color: '#6D5CC7',
    bg: '#F0ECFB',
    label: 'Comprensión',
  },
  {
    icon: BadgeCheck,
    title: 'Identidad cívica',
    description: 'Concentra tu historial y los mecanismos de verificación disponibles sin mezclar credenciales entre servicios.',
    path: '/dashboard/identity',
    color: '#2BA745',
    bg: '#EAF6ED',
    label: 'Identidad',
  },
  {
    icon: UserRound,
    title: 'Perfil y reputación',
    description: 'Consulta actividad, contribuciones, evolución temporal y trayectoria dentro de VÉRTICE.',
    path: '/dashboard/reputation',
    color: '#D72638',
    bg: '#FCEBED',
    label: 'Trayectoria',
  },
] as const

export function ModulesSection() {
  return (
    <section id="capacidades" className="border-y border-[#E7ECF2] bg-[#F7F9FC] px-5 py-20 sm:px-6 md:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <PublicSectionHeader
            eyebrow="Qué puedes hacer"
            title="Seis herramientas, una sola experiencia ciudadana."
            description="Cada módulo responde a una tarea concreta, conserva el mismo lenguaje visual y comparte una lógica común de identidad, contexto y seguimiento."
          />
          <div className="max-w-sm rounded-2xl border border-[#DCE5EF] bg-white px-5 py-4 text-xs font-semibold leading-6 text-[#607087] shadow-[0_10px_30px_rgba(10,42,102,.04)]">
            El objetivo no es multiplicar pantallas: es mantener continuidad entre <strong className="text-[#0A2A66]">reportar, proponer, comprender, decidir y seguir</strong>.
          </div>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {MODULES.map(({ icon: Icon, title, description, path, color, bg, label }, index) => (
            <Link
              key={title}
              href={path}
              className="group relative flex min-h-[285px] flex-col overflow-hidden rounded-[24px] border border-[#E1E7EF] bg-white p-6 shadow-[0_14px_40px_rgba(10,42,102,.055)] transition duration-200 hover:-translate-y-1 hover:border-[#C9D6E5] hover:shadow-[0_20px_48px_rgba(10,42,102,.10)]"
            >
              <div className="absolute inset-x-0 top-0 h-1" style={{ background: color }} />
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ color, background: bg }}>
                  <Icon size={23} strokeWidth={1.8} />
                </div>
                <span className="text-[10px] font-extrabold tracking-[.14em] text-[#A8B1BE]">0{index + 1}</span>
              </div>

              <div className="mt-6 text-[9px] font-extrabold uppercase tracking-[.13em]" style={{ color }}>{label}</div>
              <h3 className="mt-2 text-xl font-extrabold leading-7 text-[#0A2A66]">{title}</h3>
              <p className="mt-3 text-xs font-medium leading-6 text-[#607087]">{description}</p>

              <div className="mt-auto flex items-center justify-between border-t border-[#E9EDF3] pt-5">
                <span className="text-[10px] font-extrabold uppercase tracking-[.11em] text-[#0A2A66]">Abrir módulo</span>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F7F9FC] text-[#0A2A66] transition group-hover:bg-[#0A2A66] group-hover:text-white">
                  <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
