'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { BadgeCheck, MapPin, MessagesSquare } from 'lucide-react'

const VALUE_CHAIN = [
  {
    icon: MapPin,
    eyebrow: '01 · Información territorial',
    title: 'Los asuntos del territorio entran al sistema con contexto',
    description:
      'Un reporte, una idea o una necesidad puede registrarse con ubicación, evidencia y una estructura común para facilitar su consulta.',
    color: '#0A2A66',
    bg: '#EDF2F8',
  },
  {
    icon: MessagesSquare,
    eyebrow: '02 · Participación',
    title: 'Propuestas, deliberación y consultas conviven en un mismo flujo',
    description:
      'La plataforma organiza distintas formas de participación para reducir la fragmentación entre herramientas y conservar el contexto.',
    color: '#B77C00',
    bg: '#FFF4D1',
  },
  {
    icon: BadgeCheck,
    eyebrow: '03 · Trazabilidad',
    title: 'Cada cambio conserva estado, historia y seguimiento',
    description:
      'Las iniciativas y reportes mantienen información sobre su evolución para que el usuario pueda consultar qué ha ocurrido en cada etapa.',
    color: '#B51D2C',
    bg: '#FCEBED',
  },
] as const

export function PublicValueSection() {
  return (
    <section id="proposito" className="relative overflow-hidden px-5 py-24 sm:px-6 md:py-32">
      <div className="absolute left-6 right-6 top-0 h-px bg-[#E1E7EF]" />
      <div className="pointer-events-none absolute -right-28 top-24 h-72 w-72 rounded-full bg-[#F5B700]/7 blur-3xl" />

      <div className="relative mx-auto max-w-7xl">
        <div className="grid gap-12 lg:grid-cols-[.9fr_1.1fr] lg:items-end">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.55 }}
          >
            <span className="section-tag">Para qué existe VÉRTICE</span>
            <h2 className="max-w-2xl font-display text-4xl font-extrabold tracking-[-0.04em] text-[#0A2A66] md:text-5xl lg:text-[3.7rem]">
              Una plataforma ciudadana,
              <br />
              <span className="text-[#D72638]">no sólo una app.</span>
            </h2>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.55, delay: 0.08 }}
          >
            <p className="max-w-2xl text-sm font-medium leading-7 text-[#4B5870] md:text-base md:leading-8">
              VÉRTICE organiza información, participación y seguimiento en una sola experiencia digital.
              La tecnología sirve como soporte para estructurar datos, facilitar consultas y conservar la
              historia de cada asunto registrado.
            </p>
            <div className="mt-5 inline-flex items-center gap-3 rounded-full border border-[#DCE5EF] bg-white px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-[.11em] text-[#0A2A66] shadow-sm">
              <span className="h-2 w-2 rounded-full bg-[#F5B700]" />
              Información · Participación · Transparencia · Seguimiento
            </div>
          </motion.div>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-[1.04fr_.96fr] lg:items-stretch">
          <motion.div
            className="relative min-h-[520px] overflow-hidden rounded-[30px] bg-[#0A2A66] shadow-[0_28px_70px_rgba(10,42,102,.16)]"
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.65 }}
          >
            <Image
              src="/brand/civic-network.svg"
              alt="Red de inteligencia ciudadana con información, participación, transparencia y seguimiento"
              fill
              sizes="(max-width: 1024px) 100vw, 52vw"
              className="object-cover"
            />
            <div className="absolute bottom-5 left-5 right-5 rounded-2xl border border-white/15 bg-[#061D49]/86 p-4 text-white backdrop-blur-md sm:right-auto sm:max-w-sm sm:p-5">
              <div className="text-[9px] font-extrabold uppercase tracking-[.14em] text-[#F5B700]">Principio de producto</div>
              <p className="mt-2 text-sm font-bold leading-6">Personas, territorio, evidencia y seguimiento dentro de una misma estructura de información.</p>
            </div>
          </motion.div>

          <div className="grid gap-3">
            {VALUE_CHAIN.map((item, index) => {
              const Icon = item.icon
              return (
                <motion.article
                  key={item.eyebrow}
                  className="group civic-card-flat flex min-h-[160px] gap-4 p-5 transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(10,42,102,.07)] sm:gap-5 sm:p-6"
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{ duration: 0.45, delay: index * 0.08 }}
                >
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                    style={{ color: item.color, background: item.bg }}
                  >
                    <Icon size={21} strokeWidth={1.8} />
                  </div>
                  <div>
                    <span className="text-[9px] font-extrabold uppercase tracking-[.13em] text-[#7B8799]">{item.eyebrow}</span>
                    <h3 className="mt-2 max-w-md text-lg font-extrabold leading-6 text-[#0A2A66] sm:text-xl">{item.title}</h3>
                    <p className="mt-2 max-w-lg text-[11px] font-medium leading-5 text-[#607087] sm:text-xs sm:leading-6">{item.description}</p>
                  </div>
                </motion.article>
              )
            })}

            <motion.div
              className="rounded-[22px] bg-[#FFF4D1] p-5 sm:p-6"
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: 0.24 }}
            >
              <div className="text-[9px] font-extrabold uppercase tracking-[.13em] text-[#9A6A00]">Criterio</div>
              <p className="mt-2 text-base font-extrabold leading-6 text-[#0A2A66]">
                La interfaz debe hacer visible qué información existe, de dónde viene y en qué estado se encuentra.
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}
