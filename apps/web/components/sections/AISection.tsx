'use client'

import { motion } from 'framer-motion'
import { FileText, MapPin, MessageSquare, Scale, Sparkles } from 'lucide-react'

const USE_CASES = [
  {
    icon: MessageSquare,
    title: 'Explicar',
    description: 'Aclara conceptos, procesos y pasos de participación en lenguaje directo.',
    color: '#178C8C',
    bg: '#E7F6F5',
  },
  {
    icon: FileText,
    title: 'Estructurar',
    description: 'Convierte una inquietud o idea inicial en contenido ordenado y comprensible.',
    color: '#4A90E2',
    bg: '#EAF1FB',
  },
  {
    icon: MapPin,
    title: 'Contextualizar',
    description: 'Relaciona preguntas con información territorial y patrones disponibles.',
    color: '#0A2A66',
    bg: '#EDF2F8',
  },
  {
    icon: Scale,
    title: 'Sintetizar',
    description: 'Resume argumentos y puntos de contraste para una deliberación mejor informada.',
    color: '#D72638',
    bg: '#FCEBED',
  },
] as const

const DEMO_MESSAGES = [
  { role: 'user', text: 'Quiero proponer una mejora para un parque de mi barrio. ¿Por dónde empiezo?' },
  {
    role: 'ai',
    text: 'Puedo ayudarte a organizar la idea en cuatro partes: problema observado, lugar, propuesta concreta y resultado esperado. Después puedes llevar ese borrador al módulo de Propuestas y seguir su estado.',
  },
] as const

export function AISection() {
  return (
    <section id="ia" className="relative overflow-hidden px-6 py-28 md:py-36">
      <div className="pointer-events-none absolute inset-x-0 top-20 mx-auto h-[480px] max-w-6xl rounded-[50%] bg-[#4A90E2]/5 blur-3xl" />

      <div className="relative mx-auto max-w-7xl">
        <div className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <span className="section-tag">IA cívica</span>
            <motion.h2
              className="mb-6 font-display text-4xl font-extrabold tracking-[-0.035em] text-[#0A2A66] md:text-5xl lg:text-6xl"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55 }}
            >
              IA para comprender mejor,
              <br />
              <span className="text-[#D72638]">no para decidir por ti.</span>
            </motion.h2>

            <motion.p
              className="mb-9 max-w-2xl text-sm leading-7 text-[#607087] md:text-base"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, delay: 0.08 }}
            >
              La inteligencia artificial de VÉRTICE funciona como una capa de apoyo para explicar,
              ordenar, contextualizar y sintetizar información. No reemplaza la deliberación ni emite
              decisiones en nombre de los ciudadanos.
            </motion.p>

            <div className="grid gap-3 sm:grid-cols-2">
              {USE_CASES.map((item, idx) => {
                const Icon = item.icon
                return (
                  <motion.div
                    key={item.title}
                    className="civic-card-flat p-5"
                    initial={{ opacity: 0, y: 14 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: idx * 0.06 }}
                  >
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl" style={{ color: item.color, background: item.bg }}>
                      <Icon size={18} strokeWidth={1.8} />
                    </div>
                    <div className="mb-2 text-base font-extrabold text-[#0A2A66]">{item.title}</div>
                    <p className="text-xs leading-5 text-[#607087]">{item.description}</p>
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
            <div className="overflow-hidden rounded-[26px] border border-[#E1E7EF] bg-white shadow-[0_24px_70px_rgba(10,42,102,.11)]">
              <div className="flex items-center justify-between border-b border-[#E1E7EF] px-5 py-4 sm:px-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E7F6F5] text-[#178C8C]">
                    <Sparkles size={17} />
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-[#0A2A66]">Asistente cívico</div>
                    <div className="mt-1 text-[9px] font-bold uppercase tracking-[.12em] text-[#7B8799]">Contexto antes que respuesta</div>
                  </div>
                </div>
                <span className="status-dot" />
              </div>

              <div className="flex min-h-[360px] flex-col gap-5 bg-[#F8FAFC] p-5 sm:p-7">
                {DEMO_MESSAGES.map((msg, idx) => (
                  <div key={idx} className={`flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <span className="text-[9px] font-extrabold uppercase tracking-[.13em] text-[#8A96A7]">
                      {msg.role === 'user' ? 'Ciudadano' : 'VÉRTICE IA'}
                    </span>
                    <div
                      className={`max-w-[92%] rounded-2xl px-4 py-3.5 text-xs leading-6 sm:max-w-[86%] ${
                        msg.role === 'user'
                          ? 'bg-[#0A2A66] text-white shadow-sm'
                          : 'border border-[#E1E7EF] bg-white text-[#4B5870]'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}

                <div className="mt-auto pt-3">
                  <div className="flex items-center justify-between rounded-2xl border border-[#D6DFEA] bg-white px-4 py-3.5">
                    <span className="text-xs text-[#9AA6B5]">Escribe una consulta cívica...</span>
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#0A2A66] text-white">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                        <path d="M0 6l12-6-4.5 6 4.5 6z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute -bottom-4 left-5 inline-flex items-center gap-2 rounded-full border border-[#CDE4D2] bg-white px-3 py-2 text-[10px] font-extrabold text-[#2BA745] shadow-sm">
              <ShieldCheckIcon />
              La decisión sigue siendo humana
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

function ShieldCheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3v8Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}
