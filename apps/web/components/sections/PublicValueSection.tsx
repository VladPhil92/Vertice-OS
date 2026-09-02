import Image from 'next/image'
import { BarChart3, Megaphone, SearchCheck, UsersRound } from 'lucide-react'
import { PublicSectionHeader } from '@/components/ui/PublicSectionHeader'

const PILLARS = [
  {
    icon: SearchCheck,
    title: 'Informa',
    description: 'Centraliza datos públicos y señales del territorio para convertirlos en información clara y útil.',
    color: '#246CB6',
    bg: '#EAF1FB',
    index: '01',
  },
  {
    icon: UsersRound,
    title: 'Participa',
    description: 'Abre espacios para opinar, proponer y decidir sobre asuntos que importan a la comunidad.',
    color: '#D98B00',
    bg: '#FFF4D1',
    index: '02',
  },
  {
    icon: SearchCheck,
    title: 'Vigila',
    description: 'Conserva estados, evidencia e historial para facilitar el seguimiento a los asuntos públicos.',
    color: '#0A2A66',
    bg: '#EDF2F8',
    index: '03',
  },
  {
    icon: Megaphone,
    title: 'Actúa',
    description: 'Conecta información y participación con acciones colectivas y rutas de seguimiento visibles.',
    color: '#D72638',
    bg: '#FCEBED',
    index: '04',
  },
] as const

export function PublicValueSection() {
  return (
    <section id="proposito" className="border-y border-[#E7ECF2] bg-[#F7F9FC] px-5 py-20 sm:px-6 md:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 lg:grid-cols-[.9fr_1.1fr] lg:items-center lg:gap-14">
          <div>
            <PublicSectionHeader
              eyebrow="Qué es VÉRTICE"
              title="Una plataforma ciudadana, no sólo una app."
              description="VÉRTICE organiza información territorial, participación y seguimiento dentro de una experiencia común para que cada asunto conserve contexto desde su registro hasta su evolución."
            />

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                ['Información', 'Datos y señales con contexto'],
                ['Participación', 'Propuestas y deliberación'],
                ['Trazabilidad', 'Estados e historial visible'],
              ].map(([label, text], index) => (
                <div key={label} className="rounded-2xl border border-[#E1E7EF] bg-white p-4 shadow-[0_10px_30px_rgba(10,42,102,.04)]">
                  <div className="text-[9px] font-extrabold uppercase tracking-[.13em] text-[#7B8799]">0{index + 1}</div>
                  <div className="mt-2 text-xs font-extrabold text-[#0A2A66]">{label}</div>
                  <div className="mt-1 text-[10px] font-medium leading-5 text-[#607087]">{text}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[28px] border border-[#DCE5EF] bg-white p-4 shadow-[0_24px_70px_rgba(10,42,102,.10)] sm:p-6">
            <div className="absolute inset-x-0 top-0 grid h-1.5 grid-cols-3">
              <span className="bg-[#F5B700]" />
              <span className="bg-[#0A2A66]" />
              <span className="bg-[#D72638]" />
            </div>
            <div className="rounded-[22px] bg-[linear-gradient(145deg,#F8FBFF,#EDF4FD_62%,#FFF8E4)] p-3 sm:p-5">
              <Image
                src="/brand/civic-network.svg"
                alt="Red cívica de VÉRTICE: información, participación, transparencia y acción"
                width={980}
                height={650}
                className="h-auto w-full object-contain"
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 px-1">
              <div>
                <div className="text-[9px] font-extrabold uppercase tracking-[.14em] text-[#7B8799]">Sistema cívico conectado</div>
                <div className="mt-1 text-sm font-extrabold text-[#0A2A66]">Ciudadanía al centro de la información y la acción.</div>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#EAF6ED] px-3 py-2 text-[10px] font-extrabold text-[#237D36]">
                <span className="h-2 w-2 rounded-full bg-[#2BA745]" />
                Seguimiento visible
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PILLARS.map(({ icon: Icon, title, description, color, bg, index }) => (
            <article
              key={title}
              className="group relative overflow-hidden rounded-[22px] border border-[#E1E7EF] bg-white p-6 shadow-[0_12px_34px_rgba(10,42,102,.055)] transition hover:-translate-y-1 hover:shadow-[0_18px_46px_rgba(10,42,102,.09)]"
            >
              <div className="absolute inset-x-0 top-0 h-1" style={{ background: color }} />
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ color, background: bg }}>
                  <Icon size={22} strokeWidth={1.8} />
                </div>
                <span className="text-[10px] font-extrabold tracking-[.14em] text-[#A8B1BE]">{index}</span>
              </div>
              <h3 className="mt-5 text-xl font-extrabold text-[#0A2A66]">{title}</h3>
              <p className="mt-3 text-xs font-medium leading-6 text-[#607087]">{description}</p>
            </article>
          ))}
        </div>

        <div className="mt-6 grid gap-3 rounded-[20px] border border-[#DCE5EF] bg-[#0A2A66] p-5 text-white sm:grid-cols-3 sm:p-6">
          <div className="flex items-center gap-3">
            <BarChart3 size={18} className="text-[#4A90E2]" />
            <span className="text-xs font-extrabold">Información estructurada</span>
          </div>
          <div className="flex items-center gap-3">
            <UsersRound size={18} className="text-[#F5B700]" />
            <span className="text-xs font-extrabold">Ciudadanía al centro</span>
          </div>
          <div className="flex items-center gap-3">
            <SearchCheck size={18} className="text-[#62C875]" />
            <span className="text-xs font-extrabold">Seguimiento verificable</span>
          </div>
        </div>
      </div>
    </section>
  )
}
