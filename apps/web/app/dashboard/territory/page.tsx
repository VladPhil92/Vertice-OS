'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { useDashboardRuntime } from '@/components/dashboard/DashboardIdentityProvider'

interface Territory {
  code: string
  external_code: string | null
  name: string
  level: 'municipality' | 'district' | string
  parent_code: string | null
  activation_status: 'available' | 'emerging' | 'community_active' | 'pilot_ready' | 'verified_network'
}

interface TerritoryListResponse {
  data: Territory[]
  count: number
}

interface MyTerritory {
  territory_code: string | null
  neighborhood: string | null
  territory_name: string | null
  territory_level: string | null
  activation_status: string | null
  department_name: string | null
}

interface RankingEntry extends Territory {
  momentum_score: number
  registered_citizens: number
  active_citizens_30d: number
  civic_actions_30d: number
  verified_actions_90d: number
  reports_30d: number
  proposals_30d: number
  recommended_status: string
}

interface RankingResponse {
  data: RankingEntry[]
  count: number
}

const STATUS_LABEL: Record<string, string> = {
  available: 'Disponible',
  emerging: 'Emergente',
  community_active: 'Comunidad activa',
  pilot_ready: 'Piloto operativo',
  verified_network: 'Red verificada',
}

export default function TerritoryPage() {
  const { dashboard, refresh } = useDashboardRuntime()
  const [current, setCurrent] = useState<MyTerritory | null>(null)
  const [options, setOptions] = useState<Territory[]>([])
  const [ranking, setRanking] = useState<RankingEntry[]>([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [me, municipalities, districts, rankingData] = await Promise.all([
        apiFetch<MyTerritory>('/territories/me'),
        apiFetch<TerritoryListResponse>('/territories?level=municipality&limit=80', { public: true }),
        apiFetch<TerritoryListResponse>('/territories?level=district&limit=80', { public: true }),
        apiFetch<RankingResponse>('/territories/activation/ranking?limit=8', { public: true }),
      ])
      setCurrent(me)
      setSelected(me.territory_code ?? '')
      setNeighborhood(me.neighborhood ?? '')
      setOptions([...municipalities.data, ...districts.data].sort((a, b) => a.name.localeCompare(b.name, 'es')))
      setRanking(rankingData.data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible cargar la red territorial.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const search = async () => {
    setSearching(true)
    setError(null)
    try {
      const suffix = query.trim() ? `&q=${encodeURIComponent(query.trim())}` : ''
      const [municipalities, districts] = await Promise.all([
        apiFetch<TerritoryListResponse>(`/territories?level=municipality&limit=100${suffix}`, { public: true }),
        apiFetch<TerritoryListResponse>(`/territories?level=district&limit=100${suffix}`, { public: true }),
      ])
      setOptions([...municipalities.data, ...districts.data].sort((a, b) => a.name.localeCompare(b.name, 'es')))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible buscar territorios.')
    } finally {
      setSearching(false)
    }
  }

  const save = async () => {
    if (!selected) return
    setSaving(true)
    setMessage(null)
    setError(null)
    try {
      await apiFetch('/territories/me', {
        method: 'PUT',
        body: JSON.stringify({ territory_code: selected, neighborhood: neighborhood.trim() || null }),
      })
      await Promise.all([load(), refresh('dashboard')])
      setMessage('Tu nodo territorial quedó actualizado. Esto personaliza VÉRTICE, pero no crea por sí solo residencia electoral verificada.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible actualizar tu territorio.')
    } finally {
      setSaving(false)
    }
  }

  const selectedTerritory = useMemo(
    () => options.find((territory) => territory.code === selected) ?? null,
    [options, selected],
  )

  if (loading) {
    return <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-muted-foreground">Cargando red territorial de Colombia…</div>
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">VÉRTICE Colombia</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Tu municipio es un nodo de una sola red nacional</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          VÉRTICE está disponible para Colombia. Cartagena es el primer territorio con piloto operativo certificado, pero tu cuenta, historial cívico y comunidad pertenecen a la misma plataforma nacional.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-muted/60 p-4">
            <div className="text-xs text-muted-foreground">Territorio actual</div>
            <div className="mt-1 font-semibold">{current?.territory_name ?? dashboard?.profile.territory_name ?? 'Sin seleccionar'}</div>
          </div>
          <div className="rounded-xl bg-muted/60 p-4">
            <div className="text-xs text-muted-foreground">Departamento</div>
            <div className="mt-1 font-semibold">{current?.department_name ?? '—'}</div>
          </div>
          <div className="rounded-xl bg-muted/60 p-4">
            <div className="text-xs text-muted-foreground">Estado de red</div>
            <div className="mt-1 font-semibold">{STATUS_LABEL[current?.activation_status ?? 'available'] ?? 'Disponible'}</div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Selecciona tu municipio o distrito</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Esta selección organiza contenido y comunidad. Es autodeclarada y no equivale a verificación de residencia para procesos de gobernanza.
          </p>

          <div className="mt-5 flex gap-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') void search() }}
              placeholder="Busca Cartagena, Medellín, Bogotá, municipio o código DANE"
              className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              type="button"
              onClick={() => void search()}
              disabled={searching}
              className="rounded-xl bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground disabled:opacity-60"
            >
              {searching ? 'Buscando…' : 'Buscar'}
            </button>
          </div>

          <select
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
            className="mt-4 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm"
          >
            <option value="">Selecciona un territorio</option>
            {options.map((territory) => (
              <option key={territory.code} value={territory.code}>
                {territory.name}{territory.external_code ? ` · DANE ${territory.external_code}` : ''} · {STATUS_LABEL[territory.activation_status] ?? territory.activation_status}
              </option>
            ))}
          </select>

          <label className="mt-4 block text-sm font-medium">
            Barrio o vereda <span className="font-normal text-muted-foreground">(opcional)</span>
            <input
              value={neighborhood}
              onChange={(event) => setNeighborhood(event.target.value)}
              placeholder="Ej. Manga, El Poblado, Chapinero…"
              className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>

          {selectedTerritory && (
            <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
              <span className="font-semibold">{selectedTerritory.name}</span> está {STATUS_LABEL[selectedTerritory.activation_status]?.toLowerCase() ?? 'disponible'} en la red nacional.
            </div>
          )}

          {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
          {message && <p className="mt-4 text-sm text-emerald-700 dark:text-emerald-400">{message}</p>}

          <button
            type="button"
            onClick={() => void save()}
            disabled={!selected || saving}
            className="mt-5 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Activar este territorio en mi cuenta'}
          </button>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Ciudades con mayor momentum</h2>
          <p className="mt-2 text-sm text-muted-foreground">La señal usa actividad cívica, nunca pagos, suscripciones o monto donado.</p>
          <div className="mt-5 space-y-3">
            {ranking.map((city, index) => (
              <div key={city.code} className="rounded-xl border border-border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground">#{index + 1} · {STATUS_LABEL[city.activation_status] ?? city.activation_status}</div>
                    <div className="font-semibold">{city.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">{city.momentum_score}</div>
                    <div className="text-[11px] text-muted-foreground">momentum / 100</div>
                  </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${city.momentum_score}%` }} />
                </div>
              </div>
            ))}
            {ranking.length === 0 && <p className="text-sm text-muted-foreground">La red nacional comienza con sus primeros nodos.</p>}
          </div>
        </div>
      </section>
    </div>
  )
}
