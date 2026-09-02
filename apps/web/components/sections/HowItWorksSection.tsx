import { BadgeCheck, FilePenLine, MessageSquareText, CheckCircle2 } from 'lucide-react'

const STEPS = [
  {
    number: '1',
    icon: BadgeCheck,
    title: 'Crea tu identidad cívica',
    description: 'Regístrate y construye un historial de participación dentro de la plataforma.',
    color: '#246CB6',
    bg: '#EAF1FB',
  },
  {
    number: '2',
    icon: FilePenLine,
    title: 'Registra un asunto',
    description: 'Reporta, propone o consulta un tema con ubicación, contexto y evidencia.',
    color: '#D98B00',
    bg: '#FFF4D1',
  },
  {
    number: '3',
    icon: MessageSquareText,
    title: 'Delibera con contexto',
    description: 'Consulta información y participa en conversaciones organizadas alrededor del asunto.',
    color: '#6D5CC7',
    bg: '#F0ECFB',
  },
  {
    number: '4',
    icon: CheckCircle2,
    title: 'Sigue el resultado',
    description: 'Revisa estados, acciones y cambios para conservar una memoria cívica visible.',
    color: '#2BA745',
    bg: '#EAF6ED',
  },
] as const

export function HowItWorksSection() {
  return (
    <section id="como-funciona" className="bg-white px-5 py-16 sm:px-6 md:py-20">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <span className="section-tag justify-center">Cómo funciona</span>
          <h2 className="font-display text-3xl font-extrabold tracking-[-0.04em] text-[#0A2A66] md:text-4xl">
            De una señal del territorio a un resultado que se puede seguir.
          </h2>
        </div>

        <div className="relative grid gap-8 md:grid-cols-2 xl:grid-cols-4 xl:gap-6">
          <div className="pointer-events-none absolute left-[12%] right-[12%] top-8 hidden border-t border-dashed border-[#B8C6D8] xl:block" />

          {STEPS.map(({ number, icon: Icon, title, description, color, bg }) => (
            <article key={number} className="relative z-10 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-8 border-white shadow-[0_8px_24px_rgba(10,42,102,.08)]" style={{ color, background: bg }}>
                <Icon size={25} strokeWidth={1.8} />
              </div>
              <div className="mt-4 text-[10px] font-extrabold uppercase tracking-[.12em] text-[#7B8799]">Paso {number}</div>
              <h3 className="mt-2 text-base font-extrabold text-[#0A2A66]">{title}</h3>
              <p className="mx-auto mt-2 max-w-[250px] text-[11px] font-medium leading-5 text-[#607087]">{description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
