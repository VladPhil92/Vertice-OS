'use client'

import { motion } from 'framer-motion'
import { BadgeCheck, Brain, FileText, Map, Star, Vote } from 'lucide-react'

const MODULES = [
  {
    number: '01',
    icon: Map,
    title: 'Mapa y reportes',
    action: 'Reporta lo que ocurre',
    description:
      'Registra situaciones por categoría y ubicación, consulta el contexto territorial y sigue el estado de cada reporte.',
    path: '/dashboard/reports',
    color: 'text-[#C0392B]',
  },
  {
    number: '02',
    icon: FileText,
    title: 'Propuestas ciudadanas',
    action: 'Convierte una idea en iniciativa',
    description:
      'Estructura propuestas, consulta su estado y conserva en un solo lugar el contexto de cada iniciativa ciudadana.',
    path: '/dashboard/proposals',
    color: 'text-gold',
  },
  {
    number: '03',
    icon: Vote,
    title: 'Gobernanza',
    action: 'Participa en decisiones',
    description:
      'Accede a las iniciativas que avanzan a debate o votación y consulta resultados dentro del mismo flujo de participación.',
    path: '/dashboard/governance',
    color: 'text-[#1A7FBF]',
  },
  {
    number: '04',
    icon: Brain,
    title: 'Asistente cívico con IA',
    action: 'Entiende antes de actuar',
    description:
      'Consulta temas cívicos, resume información y recibe apoyo para organizar una idea o interpretar el contexto de una discusión.',
    path: '/dashboard/ai',
    color: 'text-cyan',
  },
  {
    number: '05',
    icon: BadgeCheck,
    title: 'Identidad cívica',
    action: 'Concentra tu participación',
    description:
      'Tu identidad dentro de VÉRTICE conecta tu cuenta con el historial de acciones y los mecanismos de verificación disponibles.',
    path: '/dashboard/identity',
    color: 'text-[#27AE60]',
  },
  {
    number: '06',
    icon: Star,
    title: 'Reputación y actividad',
    action: 'Consulta tu trayectoria',
    description:
      'Visualiza tu actividad acumulada, participación y perfil cívico sin perder la relación entre las distintas acciones realizadas.',
    path: '/dashboard/reputation',
    color: 'text-[#9B59B6]',
  },
] as const

export function ModulesSection() {
  return (
    <section id="capacidades" className="relative px-6 py-28 md:py-36">
      <div className="mx-auto max-w-7xl">
        <div className="mb-16 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <span className="section-tag">Qué puedes hacer</span>
            <motion.h2
              className="font-display text-4xl font-700 tracking-[-0.03em] text-primary md:text-5xl"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55 }}
            >
              Seis capacidades conectadas.
              <br />
              <span className="text-gold">Un solo espacio ciudadano.</span>
            </motion.h2>
          </div>
          <p className="max-w-2xl font-mono text-sm leading-7 text-secondary">
            Los módulos del dashboard dejan de presentarse como piezas técnicas aisladas. Cada uno responde a una tarea concreta dentro del ciclo de participación.
          </p>
        </div>

        <div className="grid gap-px bg-border md:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((mod, idx) => {
            const Icon = mod.icon
            return (
              <motion.article
                key={mod.number}
                className="group relative flex min-h-[320px] flex-col bg-bg p-8 transition-colors duration-300 hover:bg-surface"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.45, delay: (idx % 3) * 0.07 }}
              >
                <div className="mb-9 flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-tertiary">
                    Módulo {mod.number}
                  </span>
                  <div className={`flex h-10 w-10 items-center justify-center border border-border ${mod.color}`}>
                    <Icon size={18} strokeWidth={1.5} />
                  </div>
                </div>

                <span className="mb-3 font-mono text-[9px] uppercase tracking-[0.18em] text-gold">
                  {mod.action}
                </span>
                <h3 className="mb-4 font-display text-2xl font-600 leading-tight text-primary">
                  {mod.title}
                </h3>
                <p className="font-mono text-[12px] leading-6 text-secondary">{mod.description}</p>

                <div className="mt-auto flex items-center justify-between border-t border-border pt-5">
                  <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-tertiary">
                    Disponible en el dashboard
                  </span>
                  <span className="font-mono text-[9px] text-tertiary">{mod.path}</span>
                </div>

                <div className="absolute bottom-0 left-0 h-px w-0 bg-gold transition-all duration-300 group-hover:w-full" />
              </motion.article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
