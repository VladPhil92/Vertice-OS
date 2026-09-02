'use client'

import { motion } from 'framer-motion'
import { FileText, MapPin, MessageSquare, Scale } from 'lucide-react'

const USE_CASES = [
  {
    icon: MessageSquare,
    title: 'Explicar',
    description: 'Aclara conceptos, procesos y pasos de participación en lenguaje directo.',
  },
  {
    icon: FileText,
    title: 'Estructurar',
    description: 'Ayuda a convertir una inquietud o idea inicial en contenido más ordenado y comprensible.',
  },
  {
    icon: MapPin,
    title: 'Contextualizar',
    description: 'Relaciona preguntas con información territorial y patrones disponibles dentro de la plataforma.',
  },
  {
    icon: Scale,
    title: 'Sintetizar',
    description: 'Resume argumentos y puntos de contraste para facilitar una deliberación mejor informada.',
  },
] as const

const DEMO_MESSAGES = [
  { role: 'user', text: 'Quiero proponer una mejora para un parque de mi barrio. ¿Por dónde empiezo?' },
  {
    role: 'ai',
    text: 'Puedo ayudarte a organizar la idea en cuatro partes: problema observado, lugar, propuesta concreta y resultado esperado. Después puedes llevar ese borrador al módulo de Propuestas y seguir su estado desde el dashboard.',
  },
] as const

export function AISection() {
  return (
    <section id="ia" className="relative overflow-hidden px-6 py-28 md:py-36">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 50% 45% at 82% 45%, rgba(78,205,196,0.055) 0%, transparent 72%)',
        }}
      />

      <div className="relative mx-auto max-w-7xl">
        <div className="grid gap-16 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <div>
            <span className="section-tag">IA cívica</span>
            <motion.h2
              className="mb-6 font-display text-4xl font-700 tracking-[-0.03em] text-primary md:text-5xl lg:text-6xl"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55 }}
            >
              IA para entender mejor.
              <br />
              <span className="text-cyan">La decisión sigue siendo humana.</span>
            </motion.h2>

            <motion.p
              className="mb-10 max-w-2xl font-mono text-sm leading-7 text-secondary md:text-base"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, delay: 0.08 }}
            >
              La inteligencia artificial de VÉRTICE funciona como una capa de apoyo para explicar,
              ordenar, contextualizar y sintetizar información. No reemplaza la deliberación ni emite
              decisiones en nombre de los ciudadanos.
            </motion.p>

            <div className="grid gap-px bg-border sm:grid-cols-2">
              {USE_CASES.map((item, idx) => {
                const Icon = item.icon
                return (
                  <motion.div
                    key={item.title}
                    className="bg-bg p-5 transition-colors hover:bg-surface"
                    initial={{ opacity: 0, y: 14 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: idx * 0.06 }}
                  >
                    <Icon size={15} className="mb-5 text-cyan" strokeWidth={1.5} />
                    <div className="mb-2 font-display text-lg font-600 text-primary">{item.title}</div>
                    <p className="font-mono text-[11px] leading-5 text-secondary">{item.description}</p>
                  </motion.div>
                )
              })}
            </div>
          </div>

          <motion.div
            className="relative"
            initial={{ opacity: 0, x: 28 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.65, delay: 0.14 }}
          >
            <div className="border border-border bg-surface shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div className="flex items-center gap-2">
                  <span className="status-dot" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-primary">
                    Asistente cívico
                  </span>
                </div>
                <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-tertiary">
                  Contexto antes que respuesta
                </span>
              </div>

              <div className="flex min-h-[330px] flex-col gap-5 p-5 md:p-7">
                {DEMO_MESSAGES.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-tertiary">
                      {msg.role === 'user' ? 'Ciudadano' : 'VÉRTICE IA'}
                    </span>
                    <div
                      className={`max-w-[90%] px-4 py-3.5 font-mono text-[12px] leading-6 ${
                        msg.role === 'user'
                          ? 'bg-navy text-primary'
                          : 'border border-border bg-bg text-secondary'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}

                <div className="mt-auto border-t border-border pt-5">
                  <div className="flex items-center justify-between border border-border bg-bg px-4 py-3">
                    <span className="font-mono text-[11px] text-tertiary">Escribe una consulta cívica...</span>
                    <div className="flex h-7 w-7 items-center justify-center border border-cyan/20 text-cyan">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                        <path d="M0 6l12-6-4.5 6 4.5 6z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute -bottom-4 -left-4 border border-cyan/20 bg-bg px-3 py-2">
              <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-cyan">
                Apoyo · no autoridad
              </span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
