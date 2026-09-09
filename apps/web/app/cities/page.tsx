'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'

type ActivationStatus = 'available' | 'emerging' | 'community_active' | 'pilot_ready' | 'verified_network'

interface Territory {
  code: string
  external_code: string | null
  name: string
  level: string
  activation_status: ActivationStatus
}

interface TerritoryListResponse { data: Territory[]; count: number }
interface RankingEntry extends Territory { momentum_score: number }
interface RankingResponse { data: RankingEntry[]; count: number }

const STATUS_LABEL: Record<ActivationStatus, string> = {
  available: 'Disponible',
  emerging: 'Emergente',
  community_active: 'Comunidad activa',
  pilot_ready: 'Piloto operativo',
  verified_network: 'Red verificada',
}

export default function CitiesPage() {
  const [cities, setCities] = useState<Territory[]>([])
  const [ranking, setRanking] = useState<RankingEntry[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadCities = useCallback(async (q = '') => {
    setLoading(true)
    setError(null)
    try {
      const suffix = q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ''
      const [municipalities, districts, top] = await Promise.all([
        apiFetch<TerritoryListResponse>(`/territories?level=municipality&limit=80${suffix}`, { public: true }),
        apiFetch<TerritoryListResponse>(`/territories?level=district&limit=80${suffix}`, { public: true }),
        apiFetch<RankingResponse>('/territories/activation/ranking?limit=12', { public: true }),
      ])
      const merged = [...municipalities.data, ...districts.data]
        .filter((city, index, all) => all.findIndex((candidate) => candidate.code === city.code) === index)
        .sort((a, b) => a.name.localeCompare(b.name, 'es'))
      setCities(merged)
      setRanking(top.data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible cargar la red nacional.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadCities() }, [loadCities])

  return (
    <main className="min-h-screen bg-background">
      <section className="border-b border-border bg-card/50">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">VÉRTICE Colombia</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl">
            Encuentra tu ciudad. Mira qué está pasando. Ayuda a activar tu comunidad.
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground">
            Cada municipio o distrito funciona como un nodo de una sola red cívica nacional. El estado de activación se calcula con participación y evidencia comunitaria, nunca con dinero, donaciones o capacidad económica.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') void loadCities(query) }}
              placeholder="Busca Cartagena, Medellín, Bogotá o tu municipio"
              className="min-w-0 flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              type="button"
              onClick={() => void loadCities(query)}
              className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
            >
              Buscar ciudad
            </button>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-12 px-4 py-10">
        {error && <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>}

        <section>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Red nacional</p>
              <h2 className="mt-1 text-2xl font-semibold">Ciudades con mayor momentum cívico</h2>
            </div>
            <Link href="/auth/login?next=/dashboard/territory" className="text-sm font-medium text-primary hover:underline">
              Vincular mi ciudad →
            </Link>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {ranking.map((city, index) => (
              <Link key={city.code} href={`/cities/${encodeURIComponent(city.code)}`} className="rounded-2xl border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground">#{index + 1} · {STATUS_LABEL[city.activation_status]}</div>
                    <h3 className="mt-1 text-lg font-semibold">{city.name}</h3>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">{city.momentum_score}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">momentum</div>
                  </div>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, city.momentum_score)}%` }} />
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Explorar</p>
            <h2 className="mt-1 text-2xl font-semibold">Municipios y distritos</h2>
          </div>
          {loading ? (
            <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 9 }).map((_, index) => <div key={index} className="h-24 animate-pulse rounded-2xl bg-muted" />)}
            </div>
          ) : cities.length === 0 ? (
            <p className="mt-5 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">No encontramos un territorio con esa búsqueda.</p>
          ) : (
            <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {cities.map((city) => (
                <Link key={city.code} href={`/cities/${encodeURIComponent(city.code)}`} className="rounded-xl border border-border bg-card p-4 transition hover:border-primary/40">
                  <div className="text-sm font-semibold">{city.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {STATUS_LABEL[city.activation_status]}{city.external_code ? ` · DANE ${city.external_code}` : ''}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
