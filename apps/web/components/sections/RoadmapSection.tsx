'use client'

import { motion } from 'framer-motion'
import { Check, Clock } from 'lucide-react'

const PHASES = [
  {
    phase: 'FASE I',
    title: 'Fundación',
    period: 'Sprint 1–4 · 2025',
    status: 'active',
    items: [
      { done: true,  text: 'Identidad cívica digital (DID W3C + Polygon)' },
      { done: true,  text: 'Motor territorial con PostGIS' },
      { done: true,  text: 'Gobernanza: democracia líquida' },
      { done: true,  text: 'Orquestador IA multi-agente (LangGraph)' },
      { done: true,  text: 'Contratos blockchain (VotingRegistry + CivicSBT)' },
      { done: true,  text: 'Sistema de reputación (Neo4j + PostgreSQL)' },
      { done: false, text: 'Frontend: dashboard ciudadano' },
      { done: false, text: 'CI/CD y despliegue en producción' },
    ],
  },
  {
    phase: 'FASE II',
    title: 'Gobernanza Avanzada',
    period: 'Sprint 5–8 · 2025–2026',
    status: 'upcoming',
    items: [
      { done: false, text: 'ZKP para privacidad de votos (Semaphore)' },
      { done: false, text: 'Multisig admin con Gnosis Safe' },
      { done: false, text: 'The Graph para indexación on-chain' },
      { done: false, text: 'App móvil React Native' },
      { done: false, text: 'Panel de funcionarios y concejales' },
      { done: false, text: 'Sistema de alertas territoriales en tiempo real' },
    ],
  },
  {
    phase: 'FASE III',
    title: 'Expansión Regional',
    period: 'Sprint 9–12 · 2026',
    status: 'planned',
    items: [
      { done: false, text: 'Despliegue en otras ciudades colombianas' },
      { done: false, text: 'API pública para integraciones institucionales' },
      { done: false, text: 'DAO de gobernanza del protocolo' },
      { done: false, text: 'Bridge a otras redes blockchain' },
    ],
  },
] as const

type PhaseStatus = 'active' | 'upcoming' | 'planned'

const PHASE_STYLES: Record<PhaseStatus, { border: string; tag: string; dot: string }> = {
  active:   { border: 'border-gold/30',   tag: 'text-gold',      dot: 'bg-gold' },
  upcoming: { border: 'border-cyan/20',   tag: 'text-cyan',      dot: 'bg-cyan' },
  planned:  { border: 'border-border',    tag: 'text-tertiary',  dot: 'bg-tertiary' },
}

export function RoadmapSection() {
  return (
    <section id="roadmap" className="relative px-6 py-32 pb-40">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-20 text-center">
          <span className="section-tag">Hoja de Ruta</span>
          <motion.h2
            className="font-display text-4xl font-700 tracking-[-0.02em] text-primary md:text-5xl"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            Del prototipo a la
            <br />
            <span className="text-gold">infraestructura nacional</span>
          </motion.h2>
        </div>

        {/* Phases */}
        <div className="grid gap-6 md:grid-cols-3">
          {PHASES.map((phase, idx) => {
            const styles = PHASE_STYLES[phase.status as PhaseStatus]
            const doneCount = phase.items.filter((i) => i.done).length

            return (
              <motion.div
                key={phase.phase}
                className={`border ${styles.border} p-8 flex flex-col gap-6`}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
              >
                {/* Phase header */}
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <span className={`font-mono text-[10px] uppercase tracking-[0.3em] ${styles.tag}`}>
                      {phase.phase}
                    </span>
                    {phase.status === 'active' && (
                      <div className="flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${styles.dot} animate-blink`} />
                        <span className="font-mono text-[9px] text-tertiary uppercase tracking-[0.2em]">
                          En progreso
                        </span>
                      </div>
                    )}
                  </div>
                  <h3 className="font-display text-xl font-600 text-primary">{phase.title}</h3>
                  <p className="mt-1 font-mono text-[11px] text-tertiary">{phase.period}</p>
                </div>

                {/* Progress bar */}
                {phase.status === 'active' && (
                  <div>
                    <div className="mb-1.5 flex justify-between">
                      <span className="font-mono text-[10px] text-tertiary">Progreso</span>
                      <span className="font-mono text-[10px] text-gold">
                        {doneCount}/{phase.items.length}
                      </span>
                    </div>
                    <div className="h-px w-full bg-border">
                      <div
                        className="h-px bg-gold transition-all duration-1000"
                        style={{ width: `${(doneCount / phase.items.length) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Items */}
                <ul className="flex flex-col gap-3">
                  {phase.items.map((item) => (
                    <li key={item.text} className="flex items-start gap-3">
                      <div className="mt-0.5 flex-shrink-0">
                        {item.done ? (
                          <Check size={12} className="text-gold" strokeWidth={2.5} />
                        ) : (
                          <Clock size={12} className="text-tertiary" strokeWidth={1.5} />
                        )}
                      </div>
                      <span
                        className={`font-mono text-[12px] leading-relaxed ${
                          item.done ? 'text-secondary' : 'text-tertiary'
                        }`}
                      >
                        {item.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )
          })}
        </div>

        {/* Bottom CTA */}
        <motion.div
          className="mt-20 border border-border p-12 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <span className="section-tag">¿Eres ciudadano de Cartagena?</span>
          <h3 className="mb-4 font-display text-3xl font-700 text-primary">
            Sé parte del primer sistema
            <br />
            <span className="text-gold">operativo cívico de Colombia</span>
          </h3>
          <p className="mx-auto mb-8 max-w-lg font-mono text-sm text-secondary">
            Regístrate con tu cédula, verifica tu identidad y empieza a participar
            en las decisiones de tu barrio y localidad.
          </p>
          <a href="/auth/register" className="btn-primary">
            Registrarme ahora
          </a>
        </motion.div>
      </div>
    </section>
  )
}
