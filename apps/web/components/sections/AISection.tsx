'use client'

import { motion } from 'framer-motion'
import { MessageSquare, MapPin, FileText, BarChart3 } from 'lucide-react'

const AGENTS = [
  {
    icon: MessageSquare,
    name: 'CitizenAgent',
    role: 'Consulta ciudadana general',
    description: 'Responde preguntas sobre procesos, trámites y participación cívica en Cartagena.',
  },
  {
    icon: MapPin,
    name: 'TerritorialAgent',
    role: 'Inteligencia territorial',
    description: 'Analiza patrones de reportes por barrio e identifica causas sistémicas.',
  },
  {
    icon: BarChart3,
    name: 'GovernanceAgent',
    role: 'Síntesis de debate',
    description: 'Genera resúmenes imparciales de propuestas con posiciones a favor y en contra.',
  },
  {
    icon: FileText,
    name: 'PolicyAgent',
    role: 'Borradores de política',
    description: 'Convierte demandas ciudadanas en propuestas estructuradas con 9 puntos del marco colombiano.',
  },
] as const

const DEMO_MESSAGES = [
  { role: 'user', text: '¿Cómo puedo crear una propuesta para mejorar el parque de Getsemaní?' },
  {
    role: 'ai',
    text: 'Para crear una propuesta en VÉRTICE OS necesitas:\n1. Verificar tu identidad cívica (nivel 1+)\n2. Ir a Gobernanza → Nueva propuesta\n3. Tu propuesta pasará por: idea → debate → votación → resultado\n\nNecesitas 10 avales para avanzar de idea a debate. ¿Quieres que te ayude a redactar los puntos clave?',
    agent: 'CitizenAgent',
  },
] as const

export function AISection() {
  return (
    <section id="ia" className="relative px-6 py-32 overflow-hidden">
      {/* Accent */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 50% 40% at 80% 50%, rgba(78,205,196,0.04) 0%, transparent 70%)',
        }}
      />

      <div className="relative mx-auto max-w-7xl">
        <div className="grid gap-20 lg:grid-cols-2 lg:items-center">
          {/* Left: text */}
          <div>
            <span className="section-tag">Inteligencia Artificial</span>
            <motion.h2
              className="mb-6 font-display text-4xl font-700 tracking-[-0.02em] text-primary md:text-5xl"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              Seis agentes.
              <br />
              <span className="text-cyan">Un orquestador.</span>
            </motion.h2>

            <motion.p
              className="mb-10 font-mono text-sm leading-relaxed text-secondary"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              El motor de IA de VÉRTICE OS usa LangGraph para orquestar agentes
              especializados en gobernanza, territorio y política pública. Cada
              consulta ciudadana es enrutada automáticamente al agente más apropiado.
            </motion.p>

            {/* Agent grid */}
            <div className="grid gap-3 sm:grid-cols-2">
              {AGENTS.map((agent, idx) => {
                const Icon = agent.icon
                return (
                  <motion.div
                    key={agent.name}
                    className="border border-border p-4 transition-colors hover:border-border-active hover:bg-surface"
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: idx * 0.07 }}
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <Icon size={14} className="text-cyan" strokeWidth={1.5} />
                      <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-gold">
                        {agent.name}
                      </span>
                    </div>
                    <div className="mb-1 font-display text-sm font-600 text-primary">
                      {agent.role}
                    </div>
                    <div className="font-mono text-[12px] leading-relaxed text-secondary">
                      {agent.description}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>

          {/* Right: demo chat */}
          <motion.div
            className="relative"
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            <div className="border border-border bg-surface">
              {/* Chat header */}
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <div className="flex items-center gap-2">
                  <span className="status-dot" />
                  <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-tertiary">
                    Asistente Cívico
                  </span>
                </div>
                <span className="font-mono text-[10px] text-tertiary">
                  claude-sonnet-4-6
                </span>
              </div>

              {/* Messages */}
              <div className="flex flex-col gap-4 p-5">
                {DEMO_MESSAGES.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    {msg.role === 'ai' && (
                      <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-cyan">
                        {'agent' in msg ? msg.agent : ''}
                      </span>
                    )}
                    <div
                      className={`max-w-[85%] px-4 py-3 font-mono text-[13px] leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-navy text-primary'
                          : 'border border-border bg-bg text-secondary'
                      }`}
                    >
                      {msg.text.split('\n').map((line, i) => (
                        <span key={i}>
                          {line}
                          {i < msg.text.split('\n').length - 1 && <br />}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Typing indicator */}
                <div className="flex items-center gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-1.5 w-1.5 rounded-full bg-tertiary animate-blink"
                      style={{ animationDelay: `${i * 0.2}s` }}
                    />
                  ))}
                </div>
              </div>

              {/* Input */}
              <div className="border-t border-border px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex-1 font-mono text-[12px] text-tertiary">
                    Escribe tu consulta cívica...
                  </span>
                  <div className="h-7 w-7 flex items-center justify-center border border-border text-tertiary">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                      <path d="M0 6l12-6-4.5 6 4.5 6z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Decorative label */}
            <div className="absolute -top-3 -right-3 border border-gold/30 bg-bg px-3 py-1">
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-gold">
                Demo
              </span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
