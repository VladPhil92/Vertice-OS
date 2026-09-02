'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowUpRight, BadgeCheck, Brain, FileText, Map, Star, Vote } from 'lucide-react'

const MODULES = [
  {
    number: '01',
    icon: Map,
    title: 'Mapa y reportes',
    action: 'Reporta lo que ocurre',
    description:
      'Registra situaciones por categoría y ubicación, consulta el contexto territorial y sigue el estado de cada reporte.',
    path: '/dashboard/reports',
    color: '#D72638',
    bg: '#FCEBED',
  },
  {
    number: '02',
    icon: FileText,
    title: 'Propuestas ciudadanas',
    action: 'Convierte una idea en iniciativa',
    description:
      'Estructura propuestas, consulta su estado y conserva en un solo lugar el contexto de cada iniciativa.',
    path: '/dashboard/proposals',
    color: '#B77C00',
    bg: '#FFF4D1',
  },
  {
    number: '03',
    icon: Vote,
    title: 'Gobernanza',
    action: 'Consulta y participa',
    description:
      'Accede a iniciativas que avanzan a debate o consulta y revisa resultados dentro del mismo flujo.',
    path: '/dashboard/governance',
    color: '#0A2A66',
    bg: '#EDF2F8',
  },
  {
    number: '04',
    icon: Brain,
    title: 'Asistente cívico con IA',
    action: 'Comprende antes de participar',
    description:
      'Consulta temas, resume información y recibe apoyo para organizar una idea o interpretar una discusión.',
    path: '/dashboard/ai',
    color: '#246CB6',
    bg: '#EAF1FB',
  },
  {
    number: '05',
    icon: BadgeCheck,
    title: 'Identidad cívica',
    action: 'Concentra tu actividad',
    description:
      'Tu cuenta conecta el historial de participación con los mecanismos de verificación disponibles en VÉRTICE.',
    path: '/dashboard/identity',
    color: '#178C8C',
    bg: '#E7F6F5',
  },
  {
    number: '06',
    icon: Star,
    title: 'Perfil y reputación',
    action: 'Consulta tu trayectoria',
    description:
      'Visualiza actividad, contribuciones e historial sin perder la relación entre las distintas acciones realizadas.',
    path: '/dashboard/reputation',
    color: '#2BA745',
    bg: '#EAF6ED',
  },
] as const

export function ModulesSection() {
  return (
    <section id="capacidades" className="relative bg-[#F7F9FC] px-5 py-24 sm:px-6 md:py-32">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end md:mb-16">
          <div>
            <span className="section-tag">Qué puedes hacer</span>
            <motion.h2
              className="font-display text-4xl font-extrabold tracking-[-0.04em] text-[#0A2A66] md:text-5xl"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55 }}
            >
              Herramientas conectadas.
              <br />
              <span className="text-[#D72638]">Una sola experiencia.</span>
            </motion.h2>
          </div>
          <p className="max-w-2xl text-sm font-medium leading-7 text-[#607087] md:text-base">
            Cada módulo responde a una tarea concreta. El diseño utiliza la misma iconografía, jerarquía y
            sistema cromático del dashboard para que la transición entre la home y la plataforma sea natural.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((mod, idx) => {
            const Icon = mod.icon
            return (
              <motion.article
                key={mod.number}
                className="group"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.45, delay: (idx % 3) * 0.07 }}
              >
                <Link
                  href={mod.path}
                  className="civic-card-flat flex min-h-[290px] h-full flex-col p-6 transition duration-300 hover:-translate-y-1 hover:border-[#C9D6E5] hover:shadow-[0_20px_50px_rgba(10,42,102,.08)] sm:p-7"
                >
                  <div className="mb-6 flex items-start justify-between gap-4">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-2xl"
                      style={{ color: mod.color, background: mod.bg }}
                    >
                      <Icon size={21} strokeWidth={1.8} />
                    </div>
                    <span className="rounded-full border border-[#E1E7EF] bg-[#FAFBFD] px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[.12em] text-[#7B8799]">
                      {mod.number}
                    </span>
                  </div>

                  <span className="text-[9px] font-extrabold uppercase tracking-[.13em]" style={{ color: mod.color }}>
                    {mod.action}
                  </span>
                  <h3 className="mt-2 text-xl font-extrabold leading-6 text-[#0A2A66] sm:text-2xl">{mod.title}</h3>
                  <p className="mt-3 text-xs font-medium leading-6 text-[#607087]">{mod.description}</p>

                  <div className="mt-auto flex items-center justify-between border-t border-[#E8EDF3] pt-5">
                    <span className="text-[10px] font-extrabold uppercase tracking-[.11em] text-[#607087]">Abrir módulo</span>
                    <ArrowUpRight size={16} className="text-[#0A2A66] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>
                </Link>
              </motion.article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
