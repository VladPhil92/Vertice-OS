import Link from 'next/link'
import { ArrowRight, Bot, FileText, GitBranch, MapPinned, Network, UserRound, Vote } from 'lucide-react'
import { PublicSectionHeader } from '@/components/ui/PublicSectionHeader'

const MODULES = [
  {
    icon: Network,
    title: 'Red cívica',
    description: 'Sigue acciones, resultados y liderazgos del territorio en un feed ordenado por evidencia e impacto, no por popularidad.',
    path: '/dashboard/community',
    color: '#246CB6',
    bg: '#EAF1FB',
    label: 'Comunidad',
  },
  {
    icon: MapPinned,
    title: 'Gestión territorial',
    description: 'Documenta problemas, acciones y avances con ubicación, contexto y evidencia para construir una trayectoria pública verificable.',
    path: '/dashboard/reports',
    color: '#D98B00',
    bg: '#FFF4D1',
    label: 'Territorio',
  },
  {
    icon: GitBranch,
    title: 'Seguimiento de gestión',
    description: 'Conecta reportes, análisis, iniciativas y control público dentro de expedientes con memoria de principio a fin.',
    path: '/dashboard/workflows',
    color: '#178C8C',
    bg: '#E7F6F5',
    label: 'Gestión',
  },
  {
    icon: FileText,
    title: 'Iniciativas comunitarias',
    description: 'Convierte una idea en una iniciativa estructurada, reúne apoyos y documenta su evolución hasta el resultado.',
    path: '/dashboard/proposals',
    color: '#2BA745',
    bg: '#EAF6ED',
    label: 'Iniciativa',
  },
  {
    icon: UserRound,
    title: 'Perfil y reputación',
    description: 'Muestra trayectoria, acciones, evidencia, resultados y evolución reputacional de ciudadanos y liderazgos.',
    path: '/dashboard/reputation',
    color: '#D72638',
    bg: '#FCEBED',
    label: 'Trayectoria',
  },
  {
    icon: Bot,
    title: 'IA cívica y consultas',
    description: 'Comprende información, estructura propuestas y participa en consultas simbólicas o procesos deliberativos cuando aporten valor al territorio.',
    path: '/dashboard/ai',
    color: '#6D5CC7',
    bg: '#F0ECFB',
    label: 'Comprensión',
  },
] as const

export function ModulesSection() {
  return (
    <section id="capacidades" className="border-y border-[#E7ECF2] bg-[#F7F9FC] px-5 py-20 sm:px-6 md:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <PublicSectionHeader
            eyebrow="Qué puedes hacer"
            title="Gestionar, demostrar, colaborar y construir reputación."
            description="VÉRTICE conecta actividad social, evidencia y seguimiento en una sola experiencia para ciudadanía, líderes, organizaciones y candidatos."
          />
          <div className="max-w-sm rounded-2xl border border-[#DCE5EF] bg-white px-5 py-4 text-xs font-semibold leading-6 text-[#607087] shadow-[0_10px_30px_rgba(10,42,102,.04)]">
            El principio es simple: <strong className="text-[#0A2A66]">seguidores y likes no equivalen a impacto</strong>. La reputación crece con acciones, evidencia, resultados y colaboración.
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

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#DCE5EF] bg-white px-5 py-4 text-xs font-semibold text-[#607087]">
          <span>Las votaciones permanecen disponibles como herramienta complementaria de consulta y deliberación.</span>
          <Link href="/dashboard/governance" className="inline-flex items-center gap-2 font-extrabold text-[#0A2A66]">Abrir consultas <Vote size={14} /></Link>
        </div>
      </div>
    </section>
  )
}
