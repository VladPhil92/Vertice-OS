'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { apiFetch } from '@/lib/api'

type Availability = {
  reports: 'available' | 'unavailable' | 'not_requested'
  proposals: 'available' | 'unavailable' | 'not_requested'
  degraded: boolean
}

type FeedHealthResponse = {
  availability?: Availability
}

export function CommunityResilienceBanner() {
  const [availability, setAvailability] = useState<Availability | null>(null)
  const [checking, setChecking] = useState(false)

  async function check() {
    setChecking(true)
    try {
      const response = await apiFetch<FeedHealthResponse>('/community/feed?limit=1', { public: true, retries: 0 })
      setAvailability(response.availability ?? null)
    } catch {
      setAvailability({ reports: 'unavailable', proposals: 'unavailable', degraded: true })
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => { void check() }, [])

  if (!availability?.degraded) return null

  const unavailable = [
    availability.reports === 'unavailable' ? 'reportes' : null,
    availability.proposals === 'unavailable' ? 'propuestas' : null,
  ].filter(Boolean).join(' y ')

  const totalOutage = availability.reports === 'unavailable' && availability.proposals === 'unavailable'

  return (
    <div data-testid="community-degraded-banner" className="mx-auto mt-4 flex w-full max-w-7xl flex-col gap-3 rounded-2xl border border-[#E8D7A0] bg-[#FFF9E8] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="flex items-start gap-3">
        <AlertTriangle size={17} className="mt-0.5 shrink-0 text-[#9B7200]" />
        <div>
          <p className="text-xs font-black text-[#725500]">Red Cívica en modo de disponibilidad parcial</p>
          <p className="mt-1 text-[11px] font-semibold leading-5 text-[#806C35]">
            {totalOutage
              ? 'Las fuentes principales no están respondiendo. Las demás funciones del Dashboard continúan disponibles.'
              : `${unavailable} ${unavailable === 'propuestas' ? 'están' : 'están'} temporalmente no disponibles. Lo visible conserva sus señales y evidencia originales.`}
          </p>
        </div>
      </div>
      <button type="button" onClick={() => void check()} disabled={checking} className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-xl border border-[#DCC887] bg-white px-3 text-[9px] font-black uppercase tracking-[.06em] text-[#725500] disabled:opacity-50">
        <RefreshCw size={12} className={checking ? 'animate-spin' : ''} /> Reintentar
      </button>
    </div>
  )
}
