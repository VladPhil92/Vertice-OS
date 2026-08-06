'use client'

import { motion } from 'framer-motion'
import { Users, Map, Vote, Brain, Link2, Star } from 'lucide-react'

const MODULES = [
  {
    number: '01',
    icon: Users,
    title: 'Identidad Cívica Digital',
    description:
      'DID descentralizado vinculado a cédula colombiana. Verificación de nivel sin exponer datos personales. Wallet ciudadana en Polygon.',
    status: 'live',
    color: 'cyan',
  },
  {
    number: '02',
    icon: Map,
    title: 'Motor Territorial',
    description:
      'Reportes geoespaciales con PostGIS. Análisis de patrones por barrio. Seguimiento de resolución con IA territorial.',
    status: 'live',
    color: 'gold',
  },
  {
    number: '03',
    icon: Vote,
    title: 'Gobernanza y Decisión',
    description:
      'Democracia líquida con delegación de voto. Propuestas con ciclo completo. Quórum dinámico por alcance territorial.',
    status: 'live',
    color: 'gold',
  },
  {
    number: '04',
    icon: Brain,
    title: 'Capa IA Multi-Agente',
    description:
      'Orquestador LangGraph con 6 agentes especializados. RAG sobre documentos de Cartagena. Síntesis de debate y borradores de política.',
    status: 'live',
    color: 'cyan',
  },
  {
    number: '05',
    icon: Link2,
    title: 'Blockchain Cívico',
    description:
      'VotingRegistry inmutable en Polygon. Soulbound Tokens de logros cívicos (ERC-5192). Transparencia radical on-chain.',
    status: 'live',
    color: 'gold',
  },
  {
    number: '06',
    icon: Star,
    title: 'Sistema de Reputación',
    description:
      'Score basado en eventos de participación. Grafo de relaciones en Neo4j. Detección de manipulación coordinada.',
    status: 'live',
    color: 'cyan',
  },
] as const

const STATUS_LABELS = {
  live:    { label: 'Activo',      dot: 'bg-cyan shadow-[0_0_8px_#4ECDC4]' },
  beta:    { label: 'Beta',        dot: 'bg-gold shadow-[0_0_8px_#C8A84B]' },
  planned: { label: 'En hoja de ruta', dot: 'bg-tertiary' },
} as const

export function ModulesSection() {
  return (
    <section id="modulos" className="relative px-6 py-32">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-20 text-center">
          <span className="section-tag">La Plataforma</span>
          <motion.h2
            className="font-display text-4xl font-700 tracking-[-0.02em] text-primary md:text-5xl"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            Seis módulos.
            <br />
            <span className="text-gold">Una infraestructura.</span>
          </motion.h2>
        </div>

        {/* Grid */}
        <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((mod, idx) => {
            const Icon = mod.icon
            const status = STATUS_LABELS[mod.status]

            return (
              <motion.article
                key={mod.number}
                className="group relative flex flex-col gap-5 bg-bg p-8 transition-colors duration-300 hover:bg-surface"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, delay: (idx % 3) * 0.08 }}
              >
                {/* Module number */}
                <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-tertiary">
                  {mod.number}
                </span>

                {/* Icon */}
                <div
                  className={`flex h-10 w-10 items-center justify-center border border-border transition-colors duration-300 group-hover:border-border-active ${
                    mod.color === 'cyan' ? 'text-cyan' : 'text-gold'
                  }`}
                >
                  <Icon size={18} strokeWidth={1.5} />
                </div>

                {/* Content */}
                <div className="flex-1">
                  <h3 className="mb-3 font-display text-lg font-600 text-primary leading-tight">
                    {mod.title}
                  </h3>
                  <p className="font-mono text-[13px] leading-relaxed text-secondary">
                    {mod.description}
                  </p>
                </div>

                {/* Status */}
                <div className="flex items-center gap-2 pt-2 border-t border-border">
                  <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary">
                    {status.label}
                  </span>
                </div>

                {/* Hover corner accent */}
                <div className="absolute bottom-0 right-0 h-px w-0 bg-gold transition-all duration-300 group-hover:w-full" />
              </motion.article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
