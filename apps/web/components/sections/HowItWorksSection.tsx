'use client'

import { motion } from 'framer-motion'
import { BadgeCheck, FileSearch, MessagesSquare, Vote } from 'lucide-react'

const STEPS = [
  {
    number: '01',
    icon: BadgeCheck,
    title: 'Entra con una identidad cívica',
    description:
      'Tu cuenta concentra tu participación, tu historial y las acciones que realizas dentro de la plataforma.',
    detail: 'Una identidad · un historial',
  },
  {
    number: '02',
    icon: FileSearch,
    title: 'Registra lo que necesita atención',
    description:
      'Puedes reportar una situación territorial o estructurar una propuesta con categoría, contexto y seguimiento.',
    detail: 'Problema o idea → registro estructurado',
  },
  {
    number: '03',
    icon: MessagesSquare,
    title: 'Entiende y delibera con contexto',
    description:
      'La comunidad puede consultar información, revisar posiciones y usar la IA para sintetizar contenido antes de participar.',
    detail: 'Más contexto antes de decidir',
  },
  {
    number: '04',
    icon: Vote,
    title: 'Decide y sigue el resultado',
    description:
      'Las iniciativas avanzan por estados visibles. Cuando corresponde, la plataforma habilita votación y conserva el resultado para seguimiento.',
    detail: 'Decisión → resultado → trazabilidad',
  },
] as const

export function HowItWorksSection() {
  return (
    <section id="como-funciona" className="relative px-6 py-28 md:py-36">
      <div className="absolute left-6 right-6 top-0 h-px bg-border" />

      <div className="mx-auto max-w-7xl">
        <div className="mb-16 grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
          <div>
            <span className="section-tag">Cómo funciona</span>
            <motion.h2
              className="font-display text-4xl font-700 tracking-[-0.03em] text-primary md:text-5xl"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55 }}
            >
              Un ciclo cívico completo,
              <br />
              <span className="text-gold">no una colección de pantallas.</span>
            </motion.h2>
          </div>
          <p className="max-w-2xl font-mono text-sm leading-7 text-secondary">
            La experiencia está diseñada para que cada módulo tenga una función dentro del mismo recorrido:
            identificar, registrar, entender, decidir y seguir. La tecnología queda detrás del flujo ciudadano.
          </p>
        </div>

        <div className="grid gap-px bg-border md:grid-cols-2 xl:grid-cols-4">
          {STEPS.map((step, idx) => {
            const Icon = step.icon
            return (
              <motion.article
                key={step.number}
                className="relative flex min-h-[330px] flex-col bg-bg p-7 transition-colors hover:bg-surface md:p-8"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.45, delay: idx * 0.07 }}
              >
                <div className="mb-10 flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-tertiary">
                    Paso {step.number}
                  </span>
                  <div className="flex h-10 w-10 items-center justify-center border border-gold/25 text-gold">
                    <Icon size={17} strokeWidth={1.5} />
                  </div>
                </div>

                <h3 className="mb-4 font-display text-xl font-600 leading-tight text-primary">
                  {step.title}
                </h3>
                <p className="font-mono text-[12px] leading-6 text-secondary">{step.description}</p>

                <div className="mt-auto border-t border-border pt-5">
                  <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-gold">
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
