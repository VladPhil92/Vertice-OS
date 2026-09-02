'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  BadgeCheck,
  FileText,
  MapPin,
  Sparkles,
  Vote,
} from 'lucide-react'

const FADE_UP = {
  hidden: { opacity: 0, y: 24 },
  show: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94], delay },
  }),
}

const ACTIONS = [
  { icon: MapPin, label: 'Reportar', detail: 'Ubica un problema de ciudad', tone: 'text-[#C0392B]' },
  { icon: FileText, label: 'Proponer', detail: 'Convierte una idea en iniciativa', tone: 'text-gold' },
  { icon: Vote, label: 'Decidir', detail: 'Participa en debate y votación', tone: 'text-[#1A7FBF]' },
] as const

export function HeroSection() {
  return (
    <section className="relative min-h-screen overflow-hidden px-6 pb-24 pt-28 md:pt-36">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 78% 28%, rgba(200,168,75,0.10), transparent 30%), radial-gradient(circle at 18% 75%, rgba(26,127,191,0.08), transparent 28%)',
        }}
      />

      <div className="relative mx-auto grid min-h-[78vh] max-w-7xl gap-16 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
        <div className="max-w-3xl">
          <motion.div
            className="mb-7 flex flex-wrap items-center gap-3"
            custom={0}
            initial="hidden"
            animate="show"
            variants={FADE_UP}
          >
            <span className="section-tag !mb-0">Sistema operativo cívico</span>
            <span className="border border-border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-tertiary">
              Cartagena de Indias
            </span>
          </motion.div>

          <motion.h1
            className="mb-7 font-display text-5xl font-800 leading-[0.98] tracking-[-0.045em] text-primary md:text-7xl lg:text-[5.65rem]"
            custom={0.08}
            initial="hidden"
            animate="show"
            variants={FADE_UP}
          >
            Lo que pasa en tu barrio
            <span className="block text-gold">puede convertirse en acción pública.</span>
          </motion.h1>

          <motion.p
            className="mb-9 max-w-2xl font-mono text-sm leading-7 text-secondary md:text-base"
            custom={0.16}
            initial="hidden"
            animate="show"
            variants={FADE_UP}
          >
            VÉRTICE conecta reportes territoriales, propuestas ciudadanas, deliberación,
            votación, seguimiento e inteligencia cívica en una sola experiencia. Menos ruido,
            más contexto y una ruta clara desde el problema hasta el resultado.
          </motion.p>

          <motion.div
            className="flex flex-wrap gap-3"
            custom={0.24}
            initial="hidden"
            animate="show"
            variants={FADE_UP}
          >
            <Link href="/auth/register" className="btn-primary group flex items-center gap-2">
              Crear mi identidad cívica
              <ArrowRight
                size={14}
                className="transition-transform duration-200 group-hover:translate-x-1"
              />
            </Link>
            <a href="#capacidades" className="btn-ghost">
              Explorar la plataforma
            </a>
          </motion.div>

          <motion.div
            className="mt-10 flex flex-wrap gap-x-7 gap-y-3 border-t border-border pt-6"
            custom={0.32}
            initial="hidden"
            animate="show"
            variants={FADE_UP}
          >
            {[
              'Participación organizada por asuntos',
              'Seguimiento de estados y resultados',
              'IA como apoyo, no como sustituto de la decisión',
            ].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <BadgeCheck size={13} className="text-gold" />
                <span className="font-mono text-[10px] uppercase tracking-[0.11em] text-tertiary">
                  {item}
                </span>
              </div>
            ))}
          </motion.div>
        </div>

        <motion.div
          className="relative mx-auto w-full max-w-xl"
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <div className="absolute -inset-10 -z-10 bg-gold/[0.035] blur-3xl" />
          <div className="border border-border bg-surface/90 shadow-[0_30px_90px_rgba(0,0,0,0.35)] backdrop-blur">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <div className="font-display text-sm font-700 uppercase tracking-[0.12em] text-primary">
                  Centro cívico
                </div>
                <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-tertiary">
                  Una vista · múltiples formas de participar
                </div>
              </div>
              <div className="flex items-center gap-2 border border-[#27AE60]/25 px-2.5 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#27AE60]" />
                <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#27AE60]">
                  Plataforma activa
                </span>
              </div>
            </div>

            <div className="grid gap-px bg-border sm:grid-cols-3">
              {ACTIONS.map(({ icon: Icon, label, detail, tone }) => (
                <div key={label} className="bg-bg p-5">
                  <Icon size={17} className={tone} strokeWidth={1.5} />
                  <div className="mt-5 font-display text-lg font-600 text-primary">{label}</div>
                  <div className="mt-2 font-mono text-[10px] leading-5 text-tertiary">{detail}</div>
                </div>
              ))}
            </div>

            <div className="p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-tertiary">
                  Flujo de una iniciativa
                </span>
                <Sparkles size={13} className="text-cyan" />
              </div>

              <div className="space-y-3">
                {[
                  { label: 'Señal o propuesta registrada', detail: 'Contexto territorial y categoría', state: '01' },
                  { label: 'Comunidad informada', detail: 'Debate, evidencia y síntesis', state: '02' },
                  { label: 'Decisión y seguimiento', detail: 'Resultado visible y trazable', state: '03' },
                ].map((item) => (
                  <div key={item.state} className="grid grid-cols-[34px_1fr] gap-3 border border-border bg-surface-2/60 p-3.5">
                    <div className="flex h-8 w-8 items-center justify-center border border-gold/20 font-mono text-[9px] text-gold">
                      {item.state}
                    </div>
                    <div>
                      <div className="font-display text-sm font-600 text-primary">{item.label}</div>
                      <div className="mt-1 font-mono text-[10px] text-tertiary">{item.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border px-5 py-3">
              <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-tertiary">
                Identidad · Territorio · Gobernanza · IA
              </span>
              <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-gold">
                VÉRTICE OS
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
