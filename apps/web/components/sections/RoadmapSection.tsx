'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Check, Circle } from 'lucide-react'

const PHASES = [
  {
    phase: 'AHORA',
    title: 'Base operativa',
    status: 'built',
    items: [
      'Dashboard ciudadano con navegación por módulos',
      'Reportes territoriales y seguimiento por estado',
      'Propuestas y flujo de gobernanza',
      'Identidad, reputación y actividad cívica',
      'Asistente de IA integrado a la experiencia',
      'Contratos de CI/CD y runtime para producción',
    ],
  },
  {
    phase: 'SIGUIENTE',
    title: 'Piloto y aprendizaje',
    status: 'next',
    items: [
      'Validación con usuarios reales en Cartagena',
      'Mejoras de accesibilidad y comprensión de flujos',
      'Herramientas para operadores y moderación institucional',
      'Indicadores de respuesta, participación y seguimiento',
      'Pruebas de confianza, seguridad y continuidad operativa',
    ],
  },
  {
    phase: 'DESPUÉS',
    title: 'Escala cívica',
    status: 'future',
    items: [
      'Configuración reutilizable para otros territorios',
      'Integraciones institucionales mediante API',
      'Experiencia móvil complementaria',
      'Interoperabilidad y datos públicos donde aplique',
      'Nuevos mecanismos de participación verificable',
    ],
  },
] as const

type PhaseStatus = 'built' | 'next' | 'future'

const PHASE_STYLES: Record<PhaseStatus, { border: string; tag: string; dot: string }> = {
  built: { border: 'border-gold/30', tag: 'text-gold', dot: 'bg-gold' },
  next: { border: 'border-cyan/20', tag: 'text-cyan', dot: 'bg-cyan' },
  future: { border: 'border-border', tag: 'text-tertiary', dot: 'bg-tertiary' },
}

export function RoadmapSection() {
  return (
    <section id="roadmap" className="relative px-6 pb-40 pt-28 md:pt-36">
      <div className="absolute left-6 right-6 top-0 h-px bg-border" />

      <div className="mx-auto max-w-7xl">
        <div className="mb-16 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <span className="section-tag">Dirección de producto</span>
            <motion.h2
              className="font-display text-4xl font-700 tracking-[-0.03em] text-primary md:text-5xl"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55 }}
            >
              Primero una experiencia útil.
              <br />
              <span className="text-gold">Después, escala.</span>
            </motion.h2>
          </div>
          <p className="max-w-2xl font-mono text-sm leading-7 text-secondary">
            VÉRTICE no necesita prometer una infraestructura nacional antes de validar su uso cotidiano.
            La prioridad de producto es consolidar el ciclo ciudadano, aprender del piloto y escalar sólo
            aquello que demuestre valor público y sostenibilidad técnica.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {PHASES.map((phase, idx) => {
            const styles = PHASE_STYLES[phase.status as PhaseStatus]
            const completed = phase.status === 'built'

            return (
              <motion.article
                key={phase.phase}
                className={`flex min-h-[420px] flex-col border ${styles.border} bg-bg p-8`}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: idx * 0.08 }}
              >
                <div className="mb-9 flex items-center justify-between">
                  <span className={`font-mono text-[10px] uppercase tracking-[0.28em] ${styles.tag}`}>
                    {phase.phase}
                  </span>
                  <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
                </div>

                <h3 className="mb-8 font-display text-2xl font-600 text-primary">{phase.title}</h3>

                <ul className="flex flex-col gap-4">
                  {phase.items.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      {completed ? (
                        <Check size={13} className="mt-0.5 flex-shrink-0 text-gold" strokeWidth={2.2} />
                      ) : (
                        <Circle size={11} className={`mt-1 flex-shrink-0 ${styles.tag}`} strokeWidth={1.5} />
                      )}
                      <span className={`font-mono text-[12px] leading-5 ${completed ? 'text-secondary' : 'text-tertiary'}`}>
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </motion.article>
            )
          })}
        </div>

        <motion.div
          className="mt-16 grid gap-8 border border-gold/20 bg-gold/[0.025] p-8 md:p-10 lg:grid-cols-[1fr_auto] lg:items-center"
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div>
            <span className="section-tag">Empieza por una acción concreta</span>
            <h3 className="font-display text-3xl font-700 text-primary md:text-4xl">
              Entra, conoce el dashboard y decide cómo participar.
            </h3>
            <p className="mt-4 max-w-2xl font-mono text-sm leading-6 text-secondary">
              Puedes comenzar explorando los módulos y construir tu historial cívico desde una sola cuenta.
            </p>
          </div>
          <Link href="/auth/register" className="btn-primary group flex items-center gap-2 whitespace-nowrap">
            Crear cuenta
            <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
