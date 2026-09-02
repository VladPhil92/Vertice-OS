import { BarChart3, Megaphone, SearchCheck, UsersRound } from 'lucide-react'

const PILLARS = [
  {
    icon: SearchCheck,
    title: 'Informa',
    description: 'Centraliza datos públicos y señales del territorio para convertirlos en información clara y útil.',
    color: '#246CB6',
    bg: '#EAF1FB',
  },
  {
    icon: UsersRound,
    title: 'Participa',
    description: 'Abre espacios para opinar, proponer y decidir sobre asuntos que importan a la comunidad.',
    color: '#D98B00',
    bg: '#FFF4D1',
  },
  {
    icon: SearchCheck,
    title: 'Vigila',
    description: 'Conserva estados, evidencia e historial para facilitar el seguimiento a los asuntos públicos.',
    color: '#0A2A66',
    bg: '#EDF2F8',
  },
  {
    icon: Megaphone,
    title: 'Actúa',
    description: 'Conecta información y participación con acciones colectivas y rutas de seguimiento visibles.',
    color: '#D72638',
    bg: '#FCEBED',
  },
] as const

export function PublicValueSection() {
  return (
    <section id="proposito" className="border-y border-[#E7ECF2] bg-[#FBFCFE] px-5 py-16 sm:px-6 md:py-20">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto mb-10 max-w-3xl text-center">
          <span className="section-tag justify-center">Qué es VÉRTICE</span>
          <h2 className="font-display text-3xl font-extrabold tracking-[-0.04em] text-[#0A2A66] md:text-4xl">
            Infraestructura ciudadana para comprender, participar y hacer seguimiento.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm font-medium leading-7 text-[#607087] md:text-[15px]">
            Una sola experiencia reúne información territorial, participación cívica y trazabilidad para que cada
            asunto mantenga contexto desde su registro hasta su evolución.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PILLARS.map(({ icon: Icon, title, description, color, bg }) => (
            <article
              key={title}
              className="rounded-[20px] border border-[#E1E7EF] bg-white p-6 shadow-[0_12px_34px_rgba(10,42,102,.055)]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ color, background: bg }}>
                <Icon size={22} strokeWidth={1.8} />
              </div>
              <h3 className="mt-5 text-xl font-extrabold text-[#0A2A66]">{title}</h3>
              <div className="mt-3 h-0.5 w-9 rounded-full" style={{ background: color }} />
              <p className="mt-4 text-xs font-medium leading-6 text-[#607087]">{description}</p>
            </article>
          ))}
        </div>

        <div className="mt-7 grid gap-3 rounded-[20px] border border-[#E1E7EF] bg-white p-5 sm:grid-cols-3 sm:p-6">
          <div className="flex items-center gap-3">
            <BarChart3 size={18} className="text-[#246CB6]" />
            <span className="text-xs font-extrabold text-[#0A2A66]">Información estructurada</span>
          </div>
          <div className="flex items-center gap-3">
            <UsersRound size={18} className="text-[#D98B00]" />
            <span className="text-xs font-extrabold text-[#0A2A66]">Ciudadanía al centro</span>
          </div>
          <div className="flex items-center gap-3">
            <SearchCheck size={18} className="text-[#2BA745]" />
            <span className="text-xs font-extrabold text-[#0A2A66]">Seguimiento verificable</span>
          </div>
        </div>
      </div>
    </section>
  )
}
