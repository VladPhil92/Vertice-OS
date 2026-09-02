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
            <div className="mt-5 grid grid-cols-6 gap-2 rounded-2xl bg-[#F7F9FC] p-4" aria-label="Seis módulos conectados">
              {['#4A90E2', '#F5B700', '#0A2A66', '#6D5CC7', '#2BA745', '#D72638'].map((color, index) => (
                <span key={index} className="h-12 rounded-xl" style={{ background: color }} />
              ))}
            </div>
            <div className="mt-3 text-[9px] font-semibold leading-5 text-[#7B8799]">
              El gráfico representa categorías del sistema; no expresa rendimiento ni avance porcentual.
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {INDICATORS.map(({ icon: Icon, label, value, note, color, bg }) => (
            <article key={label} className="rounded-[22px] border border-[#E1E7EF] bg-white p-5 shadow-[0_12px_34px_rgba(10,42,102,.05)]">
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ color, background: bg }}>
                  <Icon size={19} strokeWidth={1.8} />
                </div>
                <span className="text-2xl font-extrabold tracking-[-0.04em] text-[#0A2A66]">{value}</span>
              </div>
              <div className="mt-5 text-[9px] font-extrabold uppercase tracking-[.12em] text-[#7B8799]">{label}</div>
              <p className="mt-2 min-h-[48px] text-[10px] font-medium leading-5 text-[#607087]">{note}</p>
              <div className="mt-4 flex gap-1.5">
                {[0, 1, 2].map((segment) => (
                  <span key={segment} className="h-1.5 flex-1 rounded-full" style={{ background: segment === 0 ? color : '#E9EDF3' }} />
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
