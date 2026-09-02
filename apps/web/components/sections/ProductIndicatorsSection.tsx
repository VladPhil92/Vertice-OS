import { Bot, Layers3, MapPin, Route } from 'lucide-react'

const INDICATORS = [
  {
    icon: Layers3,
    label: 'Módulos conectados',
    value: '6',
    note: 'Reportes, propuestas, gobernanza, IA, identidad y perfil.',
    color: '#246CB6',
    bg: '#EAF1FB',
  },
  {
    icon: Route,
    label: 'Etapas del ciclo',
    value: '4',
    note: 'Identidad, registro, deliberación y seguimiento.',
    color: '#D98B00',
    bg: '#FFF4D1',
  },
  {
    icon: MapPin,
    label: 'Piloto territorial',
    value: '1',
    note: 'Cartagena de Indias como primera experiencia de validación.',
    color: '#2BA745',
    bg: '#EAF6ED',
  },
  {
    icon: Bot,
    label: 'Rol de la IA',
    value: 'APOYO',
    note: 'Explica y sintetiza; no reemplaza la decisión humana.',
    color: '#6D5CC7',
    bg: '#F0ECFB',
  },
] as const

export function ProductIndicatorsSection() {
  return (
    <section className="bg-[#F7F9FC] px-5 py-10 sm:px-6 md:py-12" aria-labelledby="pilot-architecture-title">
      <div className="mx-auto max-w-7xl rounded-[22px] border border-[#E1E7EF] bg-white p-5 shadow-[0_14px_40px_rgba(10,42,102,.055)] sm:p-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[#7B8799]">Arquitectura del piloto · Cartagena</div>
            <h2 id="pilot-architecture-title" className="mt-1.5 text-lg font-extrabold text-[#0A2A66] sm:text-xl">
              Lo que ya articula la experiencia pública
            </h2>
          </div>
          <a href="#capacidades" className="text-[11px] font-extrabold text-[#246CB6] hover:text-[#0A2A66]">
            Ver capacidades →
          </a>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {INDICATORS.map(({ icon: Icon, label, value, note, color, bg }) => (
            <article key={label} className="flex min-h-[128px] items-start gap-4 rounded-2xl border border-[#E7ECF2] bg-[#FBFCFE] p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ color, background: bg }}>
                <Icon size={18} strokeWidth={1.8} />
              </div>
              <div>
                <div className="text-[9px] font-extrabold uppercase tracking-[.1em] text-[#7B8799]">{label}</div>
                <div className="mt-1 text-2xl font-extrabold tracking-[-0.035em] text-[#0A2A66]">{value}</div>
                <p className="mt-1.5 text-[10px] font-medium leading-4 text-[#607087]">{note}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
