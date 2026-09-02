import { BadgeCheck, CheckCircle2, FilePenLine, MessageSquareText } from 'lucide-react'
import { PublicSectionHeader } from '@/components/ui/PublicSectionHeader'

const STEPS = [
  {
    number: '01',
    icon: BadgeCheck,
    title: 'Crea tu identidad cívica',
    description: 'Regístrate y construye un historial de participación dentro de la plataforma.',
    color: '#246CB6',
    bg: '#EAF1FB',
    tag: 'Identidad',
  },
  {
    number: '02',
    icon: FilePenLine,
    title: 'Registra un asunto',
    description: 'Reporta, propone o consulta un tema con ubicación, contexto y evidencia.',
    color: '#D98B00',
    bg: '#FFF4D1',
    tag: 'Territorio',
  },
  {
    number: '03',
    icon: MessageSquareText,
    title: 'Delibera con contexto',
    description: 'Consulta información y participa en conversaciones organizadas alrededor del asunto.',
    color: '#6D5CC7',
    bg: '#F0ECFB',
    tag: 'Participación',
  },
  {
    number: '04',
    icon: CheckCircle2,
    title: 'Sigue el resultado',
    description: 'Revisa estados, acciones y cambios para conservar una memoria cívica visible.',
    color: '#2BA745',
    bg: '#EAF6ED',
    tag: 'Seguimiento',
  },
] as const

export function HowItWorksSection() {
  return (
    <section id="como-funciona" className="bg-white px-5 py-20 sm:px-6 md:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-[.72fr_1.28fr] lg:items-end lg:gap-12">
          <PublicSectionHeader
            eyebrow="Cómo funciona"
            title="De una señal del territorio a un resultado que se puede seguir."
            description="El recorrido mantiene una lógica única: identidad, registro, deliberación y seguimiento. Cada etapa conserva contexto para que la participación no se pierda entre pantallas o trámites aislados."
          />

          <div className="grid gap-3 sm:grid-cols-2">
            {STEPS.map(({ number, tag, color }) => (
              <div key={number} className="flex items-center gap-3 rounded-2xl border border-[#E1E7EF] bg-[#FBFCFE] px-4 py-3">
                <span className="text-[10px] font-extrabold tracking-[.14em]" style={{ color }}>{number}</span>
                <div className="h-px flex-1 bg-[#DCE5EF]" />
                <span className="text-[9px] font-extrabold uppercase tracking-[.12em] text-[#7B8799]">{tag}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative mt-12 overflow-hidden rounded-[28px] border border-[#DCE5EF] bg-[#F7F9FC] p-5 shadow-[0_20px_60px_rgba(10,42,102,.06)] sm:p-7 lg:p-9">
          <div className="absolute inset-x-0 top-0 grid h-1.5 grid-cols-4">
            <span className="bg-[#4A90E2]" />
            <span className="bg-[#F5B700]" />
            <span className="bg-[#6D5CC7]" />
            <span className="bg-[#2BA745]" />
          </div>

          <div className="pointer-events-none absolute left-[10%] right-[10%] top-[86px] hidden border-t-2 border-dashed border-[#C8D4E3] lg:block" />

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ number, icon: Icon, title, description, color, bg, tag }) => (
              <article
                key={number}
                className="relative z-10 rounded-[22px] border border-[#E1E7EF] bg-white p-5 shadow-[0_10px_32px_rgba(10,42,102,.05)] sm:p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl ring-8 ring-[#F7F9FC]" style={{ color, background: bg }}>
                    <Icon size={24} strokeWidth={1.8} />
                  </div>
                  <span className="font-display text-3xl font-extrabold tracking-[-.05em] text-[#E5EAF1]">{number}</span>
                </div>
                <div className="mt-6 text-[9px] font-extrabold uppercase tracking-[.13em]" style={{ color }}>{tag}</div>
                <h3 className="mt-2 text-base font-extrabold leading-6 text-[#0A2A66]">{title}</h3>
                <p className="mt-3 text-[11px] font-medium leading-6 text-[#607087]">{description}</p>
              </article>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#0A2A66] px-5 py-4 text-white">
            <span className="text-xs font-extrabold">Un solo flujo ciudadano, con memoria de principio a fin.</span>
            <span className="text-[9px] font-extrabold uppercase tracking-[.14em] text-[#F5B700]">Identificar · participar · seguir</span>
          </div>
        </div>
      </div>
    </section>
  )
}
