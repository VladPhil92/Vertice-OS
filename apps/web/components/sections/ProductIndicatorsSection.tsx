import { Bot, Layers3, MapPin, Route } from 'lucide-react'
import { PublicSectionHeader } from '@/components/ui/PublicSectionHeader'

const INDICATORS = [
  {
    icon: Layers3,
    label: 'Módulos conectados',
    value: '6',
    note: 'Reportes, propuestas, gobernanza, IA, identidad y perfil.',
    color: '#246CB6',
    bg: '#EAF1FB',
    progress: 86,
  },
  {
    icon: Route,
    label: 'Etapas del ciclo',
    value: '4',
    note: 'Identidad, registro, deliberación y seguimiento.',
    color: '#D98B00',
    bg: '#FFF4D1',
    progress: 72,
  },
  {
    icon: MapPin,
    label: 'Piloto territorial',
    value: '1',
    note: 'Cartagena de Indias como primera experiencia de validación.',
    color: '#2BA745',
    bg: '#EAF6ED',
    progress: 58,
  },
  {
    icon: Bot,
    label: 'Rol de la IA',
    value: 'APOYO',
    note: 'Explica y sintetiza; no reemplaza la decisión humana.',
    color: '#6D5CC7',
    bg: '#F0ECFB',
    progress: 64,
  },
] as const

export function ProductIndicatorsSection() {
  return (
    <section className="bg-[#F7F9FC] px-5 py-20 sm:px-6 md:py-24" aria-labelledby="pilot-architecture-title">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-7 lg:grid-cols-[.82fr_1.18fr] lg:items-end">
          <PublicSectionHeader
            eyebrow="Sistema de producto"
            title="Una arquitectura visible, medible y comprensible."
            description="Estos indicadores describen la composición actual del piloto; no son métricas de impacto ciudadano ni cifras de adopción. Separar arquitectura de resultados evita presentar datos demostrativos como si fueran evidencia real."
          />

          <div className="rounded-[22px] border border-[#E1E7EF] bg-white p-5 shadow-[0_14px_40px_rgba(10,42,102,.055)] sm:p-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-[9px] font-extrabold uppercase tracking-[.13em] text-[#7B8799]">Piloto · Cartagena</div>
                <div className="mt-1 text-lg font-extrabold text-[#0A2A66]">Composición funcional</div>
              </div>
              <a href="#capacidades" className="text-[10px] font-extrabold uppercase tracking-[.1em] text-[#246CB6] hover:text-[#0A2A66]">
                Ver módulos →
              </a>
            </div>
            <div className="mt-5 flex h-20 items-end gap-2 rounded-2xl bg-[#F7F9FC] px-4 pb-3 pt-4">
              {[42, 68, 56, 84, 64, 92, 73, 88, 76, 96].map((height, index) => (
                <span
                  key={index}
                  className="flex-1 rounded-t-md"
                  style={{ height: `${height}%`, background: index % 3 === 0 ? '#F5B700' : index % 2 === 0 ? '#4A90E2' : '#0A2A66' }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {INDICATORS.map(({ icon: Icon, label, value, note, color, bg, progress }) => (
            <article key={label} className="rounded-[22px] border border-[#E1E7EF] bg-white p-5 shadow-[0_12px_34px_rgba(10,42,102,.05)]">
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ color, background: bg }}>
                  <Icon size={19} strokeWidth={1.8} />
                </div>
                <span className="text-2xl font-extrabold tracking-[-0.04em] text-[#0A2A66]">{value}</span>
              </div>
              <div className="mt-5 text-[9px] font-extrabold uppercase tracking-[.12em] text-[#7B8799]">{label}</div>
              <p className="mt-2 min-h-[48px] text-[10px] font-medium leading-5 text-[#607087]">{note}</p>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#E9EDF3]">
                <div className="h-full rounded-full" style={{ width: `${progress}%`, background: color }} />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
