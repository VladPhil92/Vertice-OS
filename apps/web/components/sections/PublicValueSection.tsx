'use client'

import { motion } from 'framer-motion'
import { MapPin, MessagesSquare, BadgeCheck } from 'lucide-react'

const VALUE_CHAIN = [
  {
    icon: MapPin,
    eyebrow: '01 · Señal ciudadana',
    title: 'Lo que ocurre en tu entorno entra al sistema',
    description:
      'Un problema del barrio, una idea o una necesidad deja de depender de una conversación aislada y se convierte en información estructurada.',
  },
  {
    icon: MessagesSquare,
    eyebrow: '02 · Acción colectiva',
    title: 'La comunidad puede entender, proponer y decidir',
    description:
      'Reportes, propuestas, debate y votación viven dentro de un mismo flujo para que participar no signifique saltar entre herramientas inconexas.',
  },
  {
    icon: BadgeCheck,
    eyebrow: '03 · Trazabilidad',
    title: 'Cada avance conserva contexto y seguimiento',
    description:
      'El estado de una iniciativa, su discusión y sus resultados permanecen visibles para construir memoria cívica y rendición de cuentas.',
  },
] as const

export function PublicValueSection() {
  return (
    <section id="proposito" className="relative px-6 py-28 md:py-36">
      <div className="absolute left-6 right-6 top-0 h-px bg-border" />

      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.55 }}
          >
            <span className="section-tag">Para qué existe VÉRTICE</span>
            <h2 className="max-w-xl font-display text-4xl font-700 tracking-[-0.03em] text-primary md:text-5xl lg:text-6xl">
              No es otra red social.
              <br />
              <span className="text-gold">Es infraestructura para actuar.</span>
            </h2>
          </motion.div>

          <motion.p
            className="max-w-2xl font-mono text-sm leading-7 text-secondary md:text-base"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.55, delay: 0.08 }}
          >
            VÉRTICE OS organiza la participación alrededor de asuntos concretos de ciudad.
            El objetivo es que una señal ciudadana pueda convertirse en evidencia, propuesta,
            deliberación, decisión y seguimiento sin perder su historia en el camino.
          </motion.p>
        </div>

        <div className="mt-16 grid gap-px bg-border lg:grid-cols-3">
          {VALUE_CHAIN.map((item, index) => {
            const Icon = item.icon
            return (
              <motion.article
                key={item.eyebrow}
                className="group relative min-h-[290px] bg-bg p-8 transition-colors duration-300 hover:bg-surface md:p-10"
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.45, delay: index * 0.08 }}
              >
                <div className="mb-10 flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
                    {item.eyebrow}
                  </span>
                  <div className="flex h-10 w-10 items-center justify-center border border-border text-secondary transition-colors group-hover:border-gold/30 group-hover:text-gold">
                    <Icon size={17} strokeWidth={1.5} />
                  </div>
                </div>

                <h3 className="mb-4 max-w-sm font-display text-2xl font-600 leading-tight text-primary">
                  {item.title}
                </h3>
                <p className="max-w-md font-mono text-[13px] leading-6 text-secondary">
                  {item.description}
                </p>

                <div className="absolute bottom-0 left-0 h-px w-0 bg-gold transition-all duration-300 group-hover:w-full" />
              </motion.article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
