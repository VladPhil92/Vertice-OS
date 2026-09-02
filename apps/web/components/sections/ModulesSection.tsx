import Link from 'next/link'
import { ArrowRight, BadgeCheck, Bot, Building2, FileText, MapPinned, UserRound } from 'lucide-react'

const MODULES = [
  {
    icon: MapPinned,
    title: 'Mapa y reportes',
    description: 'Explora reportes territoriales y registra lo que ocurre cerca de ti.',
    path: '/dashboard/reports',
    color: '#246CB6',
    bg: '#EAF1FB',
  },
  {
    icon: FileText,
    title: 'Propuestas ciudadanas',
    description: 'Convierte una idea en una iniciativa estructurada y sigue su evolución.',
    path: '/dashboard/proposals',
    color: '#D98B00',
    bg: '#FFF4D1',
  },
  {
    icon: Building2,
    title: 'Gobernanza',
    description: 'Consulta procesos, decisiones y espacios de participación disponibles.',
    path: '/dashboard/governance',
    color: '#246CB6',
    bg: '#EAF1FB',
  },
  {
    icon: Bot,
    title: 'Asistente cívico con IA',
    description: 'Aclara conceptos, organiza ideas y comprende información antes de participar.',
    path: '/dashboard/ai',
    color: '#6D5CC7',
    bg: '#F0ECFB',
  },
  {
    icon: BadgeCheck,
    title: 'Identidad cívica',
    description: 'Concentra tu historial y los mecanismos de verificación disponibles.',
    path: '/dashboard/identity',
    color: '#2BA745',
    bg: '#EAF6ED',
  },
  {
    icon: UserRound,
    title: 'Perfil y reputación',
    description: 'Consulta actividad, contribuciones y trayectoria dentro de VÉRTICE.',
    path: '/dashboard/reputation',
    color: '#D72638',
    bg: '#FCEBED',
  },
] as const

export function ModulesSection() {
  return (
    <section id="capacidades" className="border-y border-[#E7ECF2] bg-[#FBFCFE] px-5 py-16 sm:px-6 md:py-20">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto mb-10 max-w-3xl text-center">
          <span className="section-tag justify-center">Qué puedes hacer</span>
          <h2 className="font-display text-3xl font-extrabold tracking-[-0.04em] text-[#0A2A66] md:text-4xl">
            Seis herramientas, una sola experiencia ciudadana.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm font-medium leading-7 text-[#607087]">
            Cada módulo responde a una tarea concreta y utiliza el mismo lenguaje visual del dashboard.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {MODULES.map(({ icon: Icon, title, description, path, color, bg }) => (
            <Link
              key={title}
              href={path}
              className="group flex min-h-[245px] flex-col rounded-[18px] border border-[#E1E7EF] bg-white p-5 transition duration-200 hover:-translate-y-1 hover:border-[#C9D6E5] hover:shadow-[0_16px_36px_rgba(10,42,102,.08)]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ color, background: bg }}>
                <Icon size={22} strokeWidth={1.8} />
              </div>
              <h3 className="mt-5 text-[14px] font-extrabold leading-5 text-[#0A2A66]">{title}</h3>
              <p className="mt-3 text-[10px] font-medium leading-5 text-[#607087]">{description}</p>
              <div className="mt-auto pt-5 text-[#0A2A66]">
                <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
