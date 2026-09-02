'use client'

import { motion } from 'framer-motion'
import { BadgeCheck, FileSearch, MessagesSquare, Vote } from 'lucide-react'

const STEPS = [
  {
    number: '01',
    icon: BadgeCheck,
    title: 'Crea tu identidad cívica',
    description:
      'Tu cuenta concentra el historial y las acciones que realizas dentro de la plataforma.',
    detail: 'Una identidad · un historial',
    color: '#0A2A66',
    bg: '#EDF2F8',
  },
  {
    number: '02',
    icon: FileSearch,
    title: 'Registra un asunto o una propuesta',
    description:
      'Añade ubicación, contexto y evidencia para convertir una señal inicial en información estructurada.',
    detail: 'Territorio → registro',
    color: '#D72638',
    bg: '#FCEBED',
  },
  {
    number: '03',
    icon: MessagesSquare,
    title: 'Consulta y delibera con contexto',
    description:
      'Revisa información disponible, posiciones y síntesis antes de participar en una discusión o consulta.',
    detail: 'Contexto → deliberación',
    color: '#246CB6',
    bg: '#EAF1FB',
  },
  {
    number: '04',
    icon: Vote,
    title: 'Participa y sigue el resultado',
    description:
      'Los procesos avanzan por estados visibles y conservan los resultados para su consulta posterior.',
    detail: 'Participación → seguimiento',
    color: '#B77C00',
    bg: '#FFF4D1',
  },
] as const

export function HowItWorksSection() {
  return (
    <section id="como-funciona" className="relative px-5 py-24 sm:px-6 md:py-32">
      <div className="absolute left-6 right-6 top-0 h-px bg-[#E1E7EF]" />

      <div className="mx-auto max-w-7xl">
        <div className="mb-12 grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-end md:mb-16">
          <div>
            <span className="section-tag">Cómo funciona</span>
            <motion.h2
              className="font-display text-4xl font-extrabold tracking-[-0.04em] text-[#0A2A66] md:text-5xl"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55 }}
            >
              Un recorrido claro,
              <br />
              <span className="text-[#D72638]">de la señal al seguimiento.</span>
            </motion.h2>
          </div>
          <p className="max-w-2xl text-sm font-medium leading-7 text-[#607087] md:text-base">
            La interfaz organiza cada función dentro del mismo ciclo. El usuario puede comprender qué paso está
            realizando, qué información necesita y qué ocurre después.
          </p>
        </div>

        <div className="relative grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="pointer-events-none absolute left-[10%] right-[10%] top-10 hidden h-px bg-[linear-gradient(90deg,#F5B700,#4A90E2,#D72638)] opacity-40 xl:block" />

          {STEPS.map((step, idx) => {
            const Icon = step.icon
            return (
              <motion.article
                key={step.number}
                className="relative z-10 civic-card-flat flex min-h-[300px] flex-col p-6 transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(10,42,102,.08)] sm:p-7"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.45, delay: idx * 0.07 }}
              >
                <div className="mb-7 flex items-center justify-between">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-2xl"
                    style={{ color: step.color, background: step.bg }}
                  >
                    <Icon size={21} strokeWidth={1.8} />
                  </div>
                  <span className="text-[10px] font-extrabold uppercase tracking-[.13em] text-[#7B8799]">Paso {step.number}</span>
                </div>

                <h3 className="text-xl font-extrabold leading-6 text-[#0A2A66]">{step.title}</h3>
                <p className="mt-3 text-xs font-medium leading-6 text-[#607087]">{step.description}</p>

                <div className="mt-auto border-t border-[#E8EDF3] pt-5">
                  <span className="text-[9px] font-extrabold uppercase tracking-[.12em]" style={{ color: step.color }}>
                    {step.detail}
                  </span>
                </div>
              </motion.article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
