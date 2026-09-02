'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { AlertTriangle, ArrowRight, FileText, MapPin, Scale, Users, Vote } from 'lucide-react'

const FADE_UP = {
  hidden: { opacity: 0, y: 22 },
  show: (delay: number) => ({ opacity: 1, y: 0, transition: { duration: 0.65, delay } }),
}

const ACTIONS = [
  { icon: FileText, label: 'Reportar un caso', tone: '#0A2A66' },
  { icon: Vote, label: 'Votar y participar', tone: '#F5B700' },
  { icon: Users, label: 'Generar petición', tone: '#2BA745' },
  { icon: Scale, label: 'Control público', tone: '#D72638' },
] as const

const METRICS = [
  { value: '568', label: 'Reportes activos', accent: '#4A90E2' },
  { value: '23', label: 'Votaciones abiertas', accent: '#F5B700' },
  { value: '41', label: 'Acciones en curso', accent: '#2BA745' },
  { value: '128', label: 'Casos con avance', accent: '#6F4CC3' },
] as const

export function HeroSection() {
  return (
    <section className="relative overflow-hidden px-5 pb-24 pt-28 md:px-6 md:pt-36">
      <div className="absolute inset-x-0 top-0 -z-10 h-[560px] bg-[linear-gradient(180deg,#F8FAFD_0%,#FFFFFF_92%)]" />
      <div className="absolute right-[-10%] top-24 -z-10 h-72 w-72 rounded-full bg-[#F5B700]/10 blur-3xl" />

      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="max-w-2xl">
            <motion.div custom={0} initial="hidden" animate="show" variants={FADE_UP}
              className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#F5B700]/40 bg-[#FFF8DE] px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-[#F5B700]" />
              <span className="text-[10px] font-700 uppercase tracking-[0.16em] text-primary">Inteligencia ciudadana · Cartagena</span>
            </motion.div>

            <motion.h1 custom={0.06} initial="hidden" animate="show" variants={FADE_UP}
              className="mb-6 font-display text-5xl font-800 leading-[1.02] tracking-[-0.045em] text-primary md:text-6xl lg:text-[4.8rem]">
              Cartagena la construimos <span className="text-[#D72638]">juntos.</span>
            </motion.h1>

            <motion.p custom={0.12} initial="hidden" animate="show" variants={FADE_UP}
              className="mb-8 max-w-xl text-base leading-7 text-secondary md:text-lg">
              Reporta. Propone. Decide. Vigila. VÉRTICE organiza información, participación y seguimiento para convertir la voz ciudadana en acción visible.
            </motion.p>

            <motion.div custom={0.18} initial="hidden" animate="show" variants={FADE_UP} className="flex flex-wrap gap-3">
              <Link href="/auth/register" className="btn-primary group flex items-center gap-2">
                Tu voz tiene poder <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
              </Link>
              <a href="#capacidades" className="btn-ghost">Explorar VÉRTICE</a>
            </motion.div>

            <motion.div custom={0.24} initial="hidden" animate="show" variants={FADE_UP}
              className="mt-8 flex flex-wrap items-center gap-5 text-[10px] font-700 uppercase tracking-[0.12em] text-tertiary">
              <span className="flex items-center gap-2"><MapPin size={14} className="text-[#4A90E2]" /> Cartagena de Indias</span>
              <span className="flex items-center gap-2"><Users size={14} className="text-[#F5B700]" /> Ciudadanos al centro</span>
              <span className="flex items-center gap-2"><AlertTriangle size={14} className="text-[#D72638]" /> Transparencia y control</span>
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.75, delay: 0.15 }}
            className="civic-card overflow-hidden">
            <div className="bg-[#0A2A66] px-6 py-5 text-white">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-700 uppercase tracking-[0.16em] text-white/60">Panorama de Cartagena</p>
                  <h2 className="mt-1 text-2xl font-700 text-white">Lo público, en una sola vista.</h2>
                </div>
                <span className="rounded-full bg-white/10 px-3 py-1 text-[9px] uppercase tracking-[0.12em]">Piloto</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-px bg-border md:grid-cols-4">
              {METRICS.map((metric) => (
                <div key={metric.label} className="bg-white p-5">
                  <span className="mb-4 block h-1.5 w-10 rounded-full" style={{ backgroundColor: metric.accent }} />
                  <div className="font-display text-3xl font-800 text-primary">{metric.value}</div>
                  <div className="mt-1 text-[10px] font-700 uppercase tracking-[0.08em] text-secondary">{metric.label}</div>
                </div>
              ))}
            </div>

            <div className="p-5 md:p-6">
              <div className="mb-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border bg-[#F8FAFD] p-5">
                  <span className="text-[9px] font-700 uppercase tracking-[0.14em] text-[#D72638]">Urgente</span>
                  <h3 className="mt-2 text-lg font-700 text-primary">Hueco en Av. Pedro de Heredia</h3>
                  <p className="mt-2 text-xs leading-5 text-secondary">Pie de la Popa · reporte ciudadano con evidencia y seguimiento.</p>
                </div>
                <div className="rounded-2xl border border-border bg-[#F8FAFD] p-5">
                  <span className="text-[9px] font-700 uppercase tracking-[0.14em] text-[#F5B700]">Votación activa</span>
                  <h3 className="mt-2 text-lg font-700 text-primary">¿Qué debe priorizar Cartagena?</h3>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#E9EDF3]"><div className="h-full w-[68%] bg-[#4A90E2]" /></div>
                  <p className="mt-2 text-[10px] text-tertiary">Participación abierta · resultados trazables</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                {ACTIONS.map(({ icon: Icon, label, tone }) => (
                  <div key={label} className="rounded-xl border border-border bg-white p-4 text-center shadow-civic-sm">
                    <Icon className="mx-auto" size={22} style={{ color: tone }} strokeWidth={1.8} />
                    <span className="mt-3 block text-[10px] font-700 leading-4 text-primary">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {[
            ['INFORMA', 'Centraliza datos públicos y los convierte en información clara.', '#4A90E2'],
            ['CONECTA', 'Une ciudadanos, comunidades y organizaciones alrededor de asuntos concretos.', '#F5B700'],
            ['ACTÚA', 'Convierte participación en seguimiento, control y acción colectiva.', '#D72638'],
          ].map(([title, copy, color]) => (
            <article key={title} className="civic-card p-6">
              <span className="mb-4 block h-1.5 w-12 rounded-full" style={{ backgroundColor: color }} />
              <h3 className="text-xl font-700 text-primary">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-secondary">{copy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
