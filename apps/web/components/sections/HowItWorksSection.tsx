'use client'

import { motion } from 'framer-motion'
import { ShieldCheck, MessageSquare, Vote } from 'lucide-react'

const STEPS = [
  {
    number: '01',
    icon: ShieldCheck,
    title: 'Verifica tu identidad',
    description:
      'Regístrate con tu cédula colombiana. El sistema genera tu DID descentralizado vinculado a Polygon — sin exponer tus datos personales.',
    detail: 'Nivel 0 → Nivel 2 en minutos',
  },
  {
    number: '02',
    icon: MessageSquare,
    title: 'Participa y reporta',
    description:
      'Crea propuestas, reporta problemas en tu barrio con geolocalización, vota en debate activo o consulta al asistente cívico con IA.',
    detail: 'Todo registrado on-chain',
  },
  {
    number: '03',
    icon: Vote,
    title: 'Acumula reputación',
    description:
      'Cada acción suma a tu score cívico. Más reputación = mayor peso en votaciones. Los logros se acuñan como Soulbound Tokens.',
    detail: 'La democracia que no se compra',
  },
] as const

export function HowItWorksSection() {
  return (
    <section id="como-funciona" className="relative px-6 py-32">
      {/* Subtle separator line */}
      <div className="absolute top-0 left-6 right-6 h-px bg-border" />

      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-20 text-center">
          <span className="section-tag">El proceso</span>
          <motion.h2
            className="font-display text-4xl font-700 tracking-[-0.02em] text-primary md:text-5xl"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            Tres pasos.
            <br />
            <span className="text-gold">Participación real.</span>
          </motion.h2>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Connector line (desktop) */}
          <div
            className="absolute top-10 left-0 right-0 hidden h-px lg:block"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(200,168,75,0.2), transparent)' }}
          />

          <div className="grid gap-12 lg:grid-cols-3 lg:gap-0">
            {STEPS.map((step, idx) => {
              const Icon = step.icon
              return (
                <motion.div
                  key={step.number}
                  className="relative flex flex-col items-center text-center lg:px-10"
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.5, delay: idx * 0.12 }}
                >
                  {/* Icon circle */}
                  <div className="relative mb-8 flex h-20 w-20 items-center justify-center border border-gold/30 bg-surface">
                    <Icon size={28} className="text-gold" strokeWidth={1.25} />
                    {/* Step number badge */}
                    <div className="absolute -top-3 -right-3 flex h-6 w-6 items-center justify-center border border-border bg-bg">
                      <span className="font-mono text-[9px] text-gold">{step.number}</span>
                    </div>
                  </div>

                  <h3 className="mb-4 font-display text-xl font-600 text-primary">
                    {step.title}
                  </h3>

                  <p className="mb-6 font-mono text-[13px] leading-relaxed text-secondary">
                    {step.description}
                  </p>

                  <div className="border border-gold/20 px-4 py-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">
                      {step.detail}
                    </span>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
