'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  FilePlus2,
  MapPinned,
  MessageCircleMore,
  ShieldCheck,
  Vote,
} from 'lucide-react'

const FADE_UP = {
  hidden: { opacity: 0, y: 22 },
  show: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, ease: [0.25, 0.46, 0.45, 0.94], delay },
  }),
}

const QUICK_ACTIONS = [
  {
    icon: FilePlus2,
    label: 'Reportar',
    detail: 'Convierte un problema del territorio en un caso trazable.',
    color: '#0A2A66',
    bg: '#EDF2F8',
  },
  {
    icon: Vote,
    label: 'Participar',
    detail: 'Consulta, prioriza y vota dentro de procesos ciudadanos.',
    color: '#B77C00',
    bg: '#FFF4D1',
  },
  {
    icon: MessageCircleMore,
    label: 'Proponer',
    detail: 'Estructura ideas para que puedan debatirse y evolucionar.',
    color: '#B51D2C',
    bg: '#FCEBED',
  },
  {
    icon: MapPinned,
    label: 'Vigilar',
    detail: 'Explora información territorial y sigue lo que ocurre.',
    color: '#246CB6',
    bg: '#EAF1FB',
  },
] as const

export function HeroSection() {
  return (
    <section className="relative overflow-hidden px-5 pb-20 pt-28 sm:px-6 md:pb-28 md:pt-36">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[720px] bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_58%,rgba(247,249,252,0)_100%)]" />
      <div className="pointer-events-none absolute right-[-8rem] top-24 h-72 w-72 rounded-full bg-[#F5B700]/10 blur-3xl" />
      <div className="pointer-events-none absolute left-[-7rem] top-72 h-72 w-72 rounded-full bg-[#4A90E2]/10 blur-3xl" />

      <div className="relative mx-auto max-w-7xl">
        <div className="grid gap-12 lg:grid-cols-[0.86fr_1.14fr] lg:items-center xl:gap-16">
          <div className="max-w-3xl">
            <motion.div
              className="mb-6 flex flex-wrap items-center gap-3"
              custom={0}
              initial="hidden"
              animate="show"
              variants={FADE_UP}
            >
              <span className="section-tag !mb-0">Inteligencia ciudadana</span>
              <span className="civic-pill">
                <span className="h-2 w-2 rounded-full bg-[#2BA745]" />
                Piloto · Cartagena de Indias
              </span>
            </motion.div>

            <motion.h1
              className="mb-6 max-w-3xl font-display text-[2.9rem] font-extrabold leading-[1.01] tracking-[-0.05em] text-[#0A2A66] sm:text-6xl lg:text-[4.65rem]"
              custom={0.08}
              initial="hidden"
              animate="show"
              variants={FADE_UP}
            >
              Cartagena la construimos{' '}
              <span className="relative inline-block text-[#D72638]">
                juntos.
                <span className="absolute -bottom-2 left-0 h-1 w-20 rounded-full bg-[#F5B700]" />
              </span>
            </motion.h1>

            <motion.p
              className="mb-8 max-w-2xl text-[15px] font-medium leading-7 text-[#4B5870] sm:text-lg sm:leading-8"
              custom={0.16}
              initial="hidden"
              animate="show"
              variants={FADE_UP}
            >
              VÉRTICE conecta ciudadanía, información y seguimiento público para que una señal del
              territorio pueda convertirse en evidencia, propuesta, deliberación y acción colectiva.
            </motion.p>

            <motion.div
              className="flex flex-wrap gap-3"
              custom={0.24}
              initial="hidden"
              animate="show"
              variants={FADE_UP}
            >
              <Link href="/auth/register" className="btn-citizen group gap-2">
                Tu voz tiene poder
                <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
              </Link>
              <a href="#como-funciona" className="btn-ghost">
                Conoce cómo funciona
              </a>
            </motion.div>

            <motion.div
              className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-3 text-[11px] font-bold text-[#607087]"
              custom={0.32}
              initial="hidden"
              animate="show"
              variants={FADE_UP}
            >
              <span className="inline-flex items-center gap-2">
                <ShieldCheck size={15} className="text-[#0A2A66]" />
                Identidad cívica y trazabilidad
              </span>
              <span className="h-1 w-1 rounded-full bg-[#F5B700]" />
              <span>Información antes que ruido</span>
            </motion.div>
          </div>

          <motion.div
            className="relative mx-auto w-full max-w-[760px]"
            initial={{ opacity: 0, x: 30, scale: 0.985 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.16 }}
          >
            <div className="absolute -inset-8 -z-10 rounded-[48px] bg-[#0A2A66]/7 blur-3xl" />
            <div className="relative overflow-hidden rounded-[30px] border border-[#DCE5EF] bg-white p-2.5 shadow-[0_28px_80px_rgba(10,42,102,.14)] sm:p-3">
              <div className="relative aspect-[8/5] overflow-hidden rounded-[22px] bg-[#EAF3FB]">
                <Image
                  src="/brand/cartagena-civic-panorama.svg"
                  alt="Ilustración de Cartagena conectada por una red de participación ciudadana"
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 58vw"
                  className="object-cover"
                />

                <div className="absolute left-4 top-4 rounded-full border border-white/80 bg-white/92 px-3 py-2 text-[9px] font-extrabold uppercase tracking-[.11em] text-[#0A2A66] shadow-sm backdrop-blur sm:left-5 sm:top-5 sm:text-[10px]">
                  Territorio + ciudadanía + datos
                </div>

                <div className="absolute bottom-4 left-4 right-4 grid gap-2 sm:bottom-5 sm:left-5 sm:right-auto sm:w-[360px] sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/70 bg-white/94 p-3 shadow-lg backdrop-blur-md">
                    <div className="text-[9px] font-extrabold uppercase tracking-[.12em] text-[#7B8799]">Señal ciudadana</div>
                    <div className="mt-1.5 text-xs font-extrabold text-[#0A2A66]">Ubica · documenta · comparte</div>
                  </div>
                  <div className="rounded-2xl bg-[#0A2A66]/94 p-3 text-white shadow-lg backdrop-blur-md">
                    <div className="text-[9px] font-extrabold uppercase tracking-[.12em] text-[#AFC7EC]">Seguimiento</div>
                    <div className="mt-1.5 text-xs font-extrabold">Estado visible y memoria cívica</div>
                  </div>
                </div>
              </div>

              <div className="grid gap-2 px-1 pb-1 pt-3 sm:grid-cols-3 sm:px-2 sm:pt-3.5">
                <div className="rounded-xl bg-[#FFF4D1] px-3 py-2.5">
                  <span className="text-[9px] font-extrabold uppercase tracking-[.11em] text-[#9A6A00]">Informa</span>
                  <p className="mt-1 text-[10px] font-semibold leading-4 text-[#71520A]">Datos claros para entender el territorio.</p>
                </div>
                <div className="rounded-xl bg-[#EAF1FB] px-3 py-2.5">
                  <span className="text-[9px] font-extrabold uppercase tracking-[.11em] text-[#246CB6]">Participa</span>
                  <p className="mt-1 text-[10px] font-semibold leading-4 text-[#345D8E]">Propuestas y decisiones con contexto.</p>
                </div>
                <div className="rounded-xl bg-[#FCEBED] px-3 py-2.5">
                  <span className="text-[9px] font-extrabold uppercase tracking-[.11em] text-[#B51D2C]">Vigila</span>
                  <p className="mt-1 text-[10px] font-semibold leading-4 text-[#8E3440]">Seguimiento público y trazabilidad.</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        <motion.div
          className="mt-12 grid gap-3 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.38 }}
        >
          {QUICK_ACTIONS.map(({ icon: Icon, label, detail, color, bg }) => (
            <div key={label} className="group civic-card-flat flex min-h-[142px] gap-4 p-5 transition duration-300 hover:-translate-y-1 hover:shadow-[0_16px_36px_rgba(10,42,102,.08)]">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ color, background: bg }}>
                <Icon size={20} strokeWidth={1.9} />
              </div>
              <div>
                <div className="text-sm font-extrabold text-[#0A2A66]">{label}</div>
                <p className="mt-2 text-[11px] font-medium leading-5 text-[#6A768A]">{detail}</p>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
