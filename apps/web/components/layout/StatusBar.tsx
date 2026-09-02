'use client'

import { useEffect, useState } from 'react'

const STATUS_ITEMS = [
  { label: 'PILOTO', value: 'Cartagena de Indias' },
  { label: 'EXPERIENCIA', value: 'Web cívica' },
  { label: 'FLUJO', value: 'Reportar · Proponer · Decidir' },
] as const

export function StatusBar() {
  const [time, setTime] = useState('')

  useEffect(() => {
    const update = () => {
      setTime(
        new Date().toLocaleTimeString('es-CO', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
          timeZone: 'America/Bogota',
        }),
      )
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-bg/88 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-2">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-gold" />
          <span className="font-mono text-micro uppercase tracking-[0.2em] text-tertiary">
            Portal VÉRTICE
          </span>
        </div>

        <div className="hidden items-center gap-6 md:flex">
          {STATUS_ITEMS.map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <span className="font-mono text-micro uppercase tracking-[0.2em] text-tertiary">
                {item.label}:
              </span>
              <span className="font-mono text-micro text-secondary">{item.value}</span>
            </div>
          ))}
        </div>

        <span className="font-mono text-micro uppercase tracking-[0.2em] text-gold tabular-nums">
          COT {time}
        </span>
      </div>
    </footer>
  )
}
