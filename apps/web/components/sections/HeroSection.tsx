'use client'

import { motion } from 'framer-motion'
import { ArrowRight, Shield, Zap } from 'lucide-react'

const FADE_UP = {
  hidden: { opacity: 0, y: 24 },
  show: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94], delay },
  }),
}

export function HeroSection() {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center px-6 pb-20 pt-32 overflow-hidden">
      {/* Background accent */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 40%, rgba(200,168,75,0.06) 0%, transparent 70%)',
        }}
      />

      {/* Triangle backdrop */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <svg
          viewBox="0 0 800 700"
          className="w-full max-w-3xl opacity-[0.035] animate-slow-pulse"
          fill="none"
        >
          <polygon points="400,40 760,660 40,660" stroke="#C8A84B" strokeWidth="1" />
          <polygon points="400,120 680,620 120,620" stroke="#C8A84B" strokeWidth="0.5" />
          <polygon points="400,200 600,580 200,580" stroke="#C8A84B" strokeWidth="0.3" />
        </svg>
      </div>

      <div className="relative z-10 mx-auto max-w-4xl text-center">
        {/* Section tag */}
        <motion.span
          className="section-tag"
          custom={0}
          initial="hidden"
          animate="show"
          variants={FADE_UP}
        >
          Sistema Operativo Cívico — Cartagena de Indias
        </motion.span>

        {/* Headline */}
        <motion.h1
          className="mb-6 font-display text-5xl font-800 leading-[1.02] tracking-[-0.03em] text-primary md:text-7xl lg:text-8xl"
          custom={0.1}
          initial="hidden"
          animate="show"
          variants={FADE_UP}
        >
          La ciudad que
          <br />
          <span className="text-gold">gobierna en tiempo</span>
          <br />
          real
        </motion.h1>

        {/* Subline */}
        <motion.p
          className="mx-auto mb-10 max-w-2xl font-mono text-sm leading-relaxed text-secondary md:text-base"
          custom={0.2}
          initial="hidden"
          animate="show"
          variants={FADE_UP}
        >
          VÉRTICE OS conecta a los ciudadanos de Cartagena con sus instituciones
          mediante participación continua, inteligencia territorial y gobernanza
          transparente en blockchain. La política no ocurre solo cada cuatro años.
        </motion.p>

        {/* Stats strip */}
        <motion.div
          className="mx-auto mb-12 flex flex-wrap justify-center gap-8"
          custom={0.3}
          initial="hidden"
          animate="show"
          variants={FADE_UP}
        >
          {[
            { value: '1.3M', label: 'ciudadanos potenciales' },
            { value: '15', label: 'localidades cubiertas' },
            { value: '100%', label: 'on-chain transparency' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="font-display text-3xl font-700 text-gold">{stat.value}</div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary">
                {stat.label}
              </div>
            </div>
          ))}
        </motion.div>

        {/* CTAs */}
        <motion.div
          className="flex flex-wrap items-center justify-center gap-4"
          custom={0.4}
          initial="hidden"
          animate="show"
          variants={FADE_UP}
        >
          <a href="/auth/register" className="btn-primary group flex items-center gap-2">
            Comenzar ahora
            <ArrowRight
              size={14}
              className="transition-transform duration-200 group-hover:translate-x-1"
            />
          </a>
          <a href="#modulos" className="btn-ghost flex items-center gap-2">
            Ver la plataforma
          </a>
        </motion.div>

        {/* Trust badges */}
        <motion.div
          className="mt-16 flex flex-wrap justify-center gap-6"
          custom={0.55}
          initial="hidden"
          animate="show"
          variants={FADE_UP}
        >
          {[
            { icon: Shield, label: 'Identidad verificada con DID W3C' },
            { icon: Zap, label: 'Votos en Polygon PoS' },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2 rounded border border-border px-4 py-2"
            >
              <Icon size={12} className="text-gold" />
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-tertiary">
                {label}
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
