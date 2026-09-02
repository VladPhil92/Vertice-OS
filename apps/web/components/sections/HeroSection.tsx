'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  FilePlus2,
  MapPinned,
  MessageCircleMore,
  ShieldCheck,
  Users,
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
  { icon: FilePlus2, label: 'Reportar', detail: 'Registra un caso', color: '#0A2A66' },
  { icon: Vote, label: 'Votar', detail: 'Participa y decide', color: '#F5B700' },
  { icon: MessageCircleMore, label: 'Proponer', detail: 'Impulsa una iniciativa', color: '#D72638' },
  { icon: MapPinned, label: 'Explorar', detail: 'Mira tu ciudad', color: '#4A90E2' },
] as const

const KPIS = [
  { label: 'Reportes activos', value: '568', icon: FilePlus2, color: '#4A90E2' },
  { label: 'Votaciones abiertas', value: '23', icon: Vote, color: '#F5B700' },
  { label: 'Casos solucionados', value: '128', icon: CheckCircle2, color: '#2BA745' },
  { label: 'Ciudadanos activos', value: '15.7K', icon: Users, color: '#0A2A66' },
] as const

export function HeroSection() {
  return (
    <section className="relative overflow-hidden px-6 pb-24 pt-28 md:pb-32 md:pt-36">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_58%,#edf4fc_100%)]" />
      <div className="pointer-events-none absolute right-[-8rem] top-16 h-72 w-72 rounded-full bg-[#F5B700]/10 blur-3xl" />
      <div className="pointer-events-none absolute left-[-6rem] top-64 h-64 w-64 rounded-full bg-[#4A90E2]/10 blur-3xl" />

      <div className="relative mx-auto grid max-w-7xl gap-14 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
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
              Piloto Cartagena de Indias
            </span>
          </motion.div>

          <motion.h1
            className="mb-6 max-w-3xl font-display text-5xl font-extrabold leading-[1.02] tracking-[-0.045em] text-[#0A2A66] md:text-6xl lg:text-[4.85rem]"
            custom={0.08}
            initial="hidden"
            animate="show"
            variants={FADE_UP}
          >
            Cartagena la construimos{' '}
            <span className="relative whitespace-nowrap text-[#D72638]">
              juntos.
              <span className="absolute -bottom-2 left-0 h-1 w-20 rounded-full bg-[#F5B700]" />
            </span>
          </motion.h1>

          <motion.p
            className="mb-8 max-w-2xl text-base leading-7 text-[#4B5870] md:text-lg"
            custom={0.16}
            initial="hidden"
            animate="show"
            variants={FADE_UP}
          >
            VÉRTICE conecta información, participación y control ciudadano para convertir
            problemas reales en decisiones visibles, seguimiento público y resultados que se puedan medir.
          </motion.p>

          <motion.div
            className="flex flex-wrap gap-3"
            custom={0.24}
            initial="hidden"
            animate="show"
            variants={FADE_UP}
          >
            <Link href="/auth/register" className="btn-primary group gap-2">
              Tu voz tiene poder
              <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
            </Link>
            <a href="#como-funciona" className="btn-ghost">
              Conoce cómo funciona
            </a>
          </motion.div>

          <motion.div
            className="mt-8 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4"
            custom={0.32}
            initial="hidden"
            animate="show"
            variants={FADE_UP}
          >
            {QUICK_ACTIONS.map(({ icon: Icon, label, detail, color }) => (
              <div key={label} className="civic-card-flat p-3.5">
                <div
                  className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${color}12`, color }}
                >
                  <Icon size={17} strokeWidth={1.8} />
                </div>
                <div className="text-xs font-extrabold text-[#0A2A66]">{label}</div>
                <div className="mt-1 text-[10px] leading-4 text-[#7B8799]">{detail}</div>
              </div>
            ))}
          </motion.div>
        </div>

        <motion.div
          className="relative mx-auto w-full max-w-2xl"
          initial={{ opacity: 0, x: 28 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.75, delay: 0.2 }}
        >
          <div className="absolute -inset-8 -z-10 rounded-[42px] bg-[#0A2A66]/5 blur-3xl" />
          <div className="civic-card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E1E7EF] bg-white px-5 py-4 sm:px-6">
              <div>
                <div className="text-sm font-extrabold text-[#0A2A66]">Panorama de Cartagena</div>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7B8799]">
                  Información útil para actuar mejor
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-[#EAF6ED] px-3 py-1.5 text-[10px] font-bold text-[#2BA745]">
                <span className="h-2 w-2 rounded-full bg-[#2BA745]" />
                Plataforma activa
              </div>
            </div>

            <div className="grid gap-0 bg-[#F7F9FC] sm:grid-cols-[1.05fr_.95fr]">
              <div className="border-b border-[#E1E7EF] p-5 sm:border-b-0 sm:border-r sm:p-6">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-xs font-bold text-[#0A2A66]">Mapa ciudadano</span>
                  <span className="text-[10px] text-[#7B8799]">Vista demostrativa</span>
                </div>

                <div className="relative h-64 overflow-hidden rounded-2xl bg-[linear-gradient(145deg,#eaf2fb,#dce9f8)]">
                  <div className="absolute inset-0 opacity-80" style={{
                    backgroundImage:
                      'linear-gradient(28deg, transparent 0 42%, rgba(10,42,102,.12) 43% 44%, transparent 45%), linear-gradient(115deg, transparent 0 52%, rgba(74,144,226,.16) 53% 54%, transparent 55%)',
                    backgroundSize: '68px 68px, 92px 92px',
                  }} />
                  <div className="absolute left-[18%] top-[24%] flex h-10 w-10 items-center justify-center rounded-full bg-[#D72638] text-xs font-extrabold text-white shadow-lg">15</div>
                  <div className="absolute right-[18%] top-[32%] flex h-9 w-9 items-center justify-center rounded-full bg-[#178C8C] text-xs font-extrabold text-white shadow-lg">8</div>
                  <div className="absolute bottom-[18%] left-[42%] flex h-9 w-9 items-center justify-center rounded-full bg-[#F5B700] text-xs font-extrabold text-[#0A2A66] shadow-lg">6</div>
                  <div className="absolute bottom-[25%] right-[24%] flex h-9 w-9 items-center justify-center rounded-full bg-[#4A90E2] text-xs font-extrabold text-white shadow-lg">12</div>
                  <div className="absolute bottom-4 left-4 rounded-xl bg-white/95 px-3 py-2 shadow-sm">
                    <div className="text-[9px] font-bold uppercase tracking-[.12em] text-[#7B8799]">Sector visible</div>
                    <div className="mt-1 text-xs font-extrabold text-[#0A2A66]">Centro · Manga · Crespo</div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  {KPIS.map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="rounded-2xl border border-[#E1E7EF] bg-white p-3.5">
                      <div className="flex items-center justify-between gap-3">
                        <Icon size={16} style={{ color }} />
                        <span className="font-display text-xl font-extrabold text-[#0A2A66]">{value}</span>
                      </div>
                      <div className="mt-2 text-[10px] font-semibold text-[#6A768A]">{label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-5 sm:p-6">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-xs font-bold text-[#0A2A66]">Participación activa</span>
                  <BarChart3 size={16} className="text-[#4A90E2]" />
                </div>

                <div className="space-y-3">
                  <div className="rounded-2xl border border-[#E1E7EF] bg-white p-4">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <span className="rounded-full bg-[#FFF4D1] px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[.08em] text-[#9A6A00]">Votación</span>
                      <Vote size={17} className="text-[#F5B700]" />
                    </div>
                    <div className="text-sm font-extrabold leading-5 text-[#0A2A66]">¿Cuál debe ser la prioridad para mejorar la movilidad?</div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#E9EDF3]">
                      <div className="h-full w-[62%] rounded-full bg-[#F5B700]" />
                    </div>
                    <div className="mt-2 text-[10px] text-[#7B8799]">8.124 participaciones registradas</div>
                  </div>

                  <div className="rounded-2xl border border-[#E1E7EF] bg-white p-4">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <span className="rounded-full bg-[#FCE9EB] px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[.08em] text-[#B51D2C]">Seguimiento</span>
                      <ShieldCheck size={17} className="text-[#D72638]" />
                    </div>
                    <div className="text-sm font-extrabold leading-5 text-[#0A2A66]">Obras inconclusas · Parque Lineal</div>
                    <div className="mt-2 text-[11px] leading-5 text-[#6A768A]">Caso ciudadano con evidencia, estado y trazabilidad pública.</div>
                  </div>

                  <div className="rounded-2xl bg-[#0A2A66] p-4 text-white">
                    <div className="text-[10px] font-bold uppercase tracking-[.13em] text-[#AFC7EC]">Principio VÉRTICE</div>
                    <div className="mt-2 text-lg font-extrabold leading-6">La ciudadanía es el vértice del cambio.</div>
                    <div className="mt-3 flex items-center gap-2 text-[10px] font-semibold text-white/75">
                      <span className="h-1.5 w-7 rounded-full bg-[#F5B700]" />
                      Diferentes en cada región, unidos en un solo país.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
