'use client'

import { useEffect, useState } from 'react'

const STATUS_ITEMS = [
  { label: 'PILOTO', value: 'Cartagena de Indias' },
  { label: 'EXPERIENCIA', value: 'Web cívica' },
  { label: 'FLUJO', value: 'Informar · Participar · Vigilar' },
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
    <footer className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#0A2A66]/10 bg-white/94 shadow-[0_-8px_30px_rgba(10,42,102,.06)] backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex gap-1">
            <span className="h-1.5 w-4 rounded-full bg-[#F5B700]" />
            <span className="h-1.5 w-4 rounded-full bg-[#0A2A66]" />
            <span className="h-1.5 w-4 rounded-full bg-[#D72638]" />
          </span>
          <span className="hidden text-[10px] font-extrabold uppercase tracking-[.14em] text-[#0A2A66] sm:inline">
            Portal VÉRTICE
          </span>
        </div>

        <div className="hidden items-center gap-6 md:flex">
          {STATUS_ITEMS.map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <span className="text-[9px] font-extrabold uppercase tracking-[.12em] text-[#7B8799]">
                {item.label}
              </span>
              <span className="text-[10px] font-semibold text-[#4B5870]">{item.value}</span>
            </div>
          ))}
        </div>

        <span className="font-mono text-[9px] uppercase tracking-[.12em] text-[#0A2A66] tabular-nums">
          COT {time}
        </span>
      </div>
    </footer>
  )
}
