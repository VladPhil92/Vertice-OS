'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'
import { useDashboardRuntime } from '@/components/dashboard/DashboardIdentityProvider'

type EvidenceType = 'secure_document' | 'institutional_attestation' | 'provider_attestation'

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

interface AssuranceRequest {
  id: string
  territory_code: string
  territory_name: string | null
  status: string
  evidence_type: EvidenceType
  submitted_at: string
  verified_at: string | null
  expires_at: string | null
}

interface AssuranceState {
  territory_code: string | null
  territory_name: string | null
  territory_level: string | null
  territory_assurance_level: number
  effective_territory_assurance_level: number
  territory_assurance_effective: boolean
  current_request_verified_at: string | null
  current_request_expires_at: string | null
  renewal_required: boolean
  pending_request: AssuranceRequest | null
  governance_effect: 'territorial_prerequisite_satisfied' | 'none_expired_residence' | 'none_without_verified_residence'
}

const STATUS_LABEL: Record<string, string> = {
  available: 'Disponible',
  emerging: 'Emerente',
  community_active: 'Comunidad activa',
  pilot_ready: 'Piloto operativo',
  verified_network: 'Red verificada',
}

const EVIDENCE_LABEL: Record<EvidenceType, string> = {
  secure_document: 'Documento revisado en canal seguro',
  institutional_attestation: 'Constancia institucional',
  provider_attestation: 'Atestación de proveedor autorizado',
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
  }).format(new Date(value))
}

export default function TerritoryPage() {
  const { dashboard, refresh } = useDashboardRuntime()
  const [current, setCurrent] = useState<MyTerritory | null>(null)
  const [assurance, setAssurance] = useState<AssuranceState | null>(null)
  const [options, setOptions] = useState<Territory[]>([])
  const [ranking, setRanking] = useState<RankingEntry[]>([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [evidenceType, setEvidenceType] = useState<EvidenceType>('secure_document')
  const [evidenceReference, setEvidenceReference] = useState('')
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submittingAssurance, setSubmittingAssurance] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [me, assuranceState, municipalities, districts, rankingData] = await Promise.all([
        apiFetch<MyTerritory>('/territories/me'),
        apiFetch<AssuranceState>('/territories/assurance/me'),
        apiFetch<TerritoryListResponse>('/territories?level=municipality&limit=80', { public: true }),
        apiFetch<TerritoryListResponse>('/territories?level=district&limit=80', { public: true }),
        apiFetch<RankingResponse>('/territories/activation/ranking?limit=8', { public: true }),
      ])
      setCurrent(me)
      setAssurance(assuranceState)
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
      setMessage('Tu nodo territorial quedó actualizado. Si cambiaste de municipio o distrito, cualquier verificación de residencia anterior queda invalidada por diseño.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible actualizar tu territorio.')
    } finally {
      setSaving(false)
    }
  }

  const submitAssurance = async () => {
    const reference = evidenceReference.trim()
    setMessage(null)
    setError(null)

    if (!current?.territory_code) {
      setError('Selecciona primero tu municipio o distrito principal.')
      return
    }
    if (reference.length < 16) {
      setError('La referencia segura debe tener al menos 16 caracteres.')
      return
    }
    if (/^https?:\/\//i.test(reference)) {
      setError('No pegues URLs. Usa únicamente la referencia opaca emitida por el canal seguro o proveedor de verificación.')
      return
    }

    setSubmittingAssurance(true)
    try {
      const result = await apiFetch<{ reused: boolean; renewal: boolean; request: AssuranceRequest }>(
        '/territories/assurance/requests',
        {
          method: 'POST',
          body: JSON.stringify({ evidence_type: evidenceType, evidence_reference: reference }),
        },
      )
      setEvidenceReference('')
      setMessage(
        result.reused
          ? 'Ya existe una verificación o solicitud activa para este territorio.'
          : result.renewal
            ? 'Renovación enviada. Tu verificación vigente conserva efecto hasta su expiración o hasta ser reemplazada por una nueva decisión válida.'
            : 'Solicitud enviada. La residencia no tendrá efecto de gobernanza hasta que sea verificada.',
      )
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible enviar la solicitud de verificación.')
    } finally {
      setSubmittingAssurance(false)
    }
  }

  const selectedTerritory = useMemo(
    () => options.find((territory) => territory.code === selected) ?? null,
    [options, selected],
  )

  const assurancePresentation = useMemo(() => {
    if (!assurance) return { label: 'Sin datos', detail: 'No fue posible determinar el estado.', className: 'border-border bg-muted/30' }
    if (assurance.pending_request) {
      return {
        label: 'En revisión',
        detail: `Solicitud recibida el ${formatDate(assurance.pending_request.submitted_at)}. La selección territorial sigue siendo autodeclarada hasta una decisión válida.`,
        className: 'border-amber-500/30 bg-amber-500/5',
      }
    }
    if (assurance.territory_assurance_effective && assurance.renewal_required) {
      return {
        label: 'Verificada · renovar ahora',
        detail: `Vigente hasta ${formatDate(assurance.current_request_expires_at)}. Ya estás dentro de la ventana de renovación de 30 días.`,
        className: 'border-amber-500/30 bg-amber-500/5',
      }
    }
    if (assurance.territory_assurance_effective) {
      return {
        label: 'Residencia verificada',
        detail: `Vigente hasta ${formatDate(assurance.current_request_expires_at)}. Esta prueba puede satisfacer el requisito territorial de nuevas votaciones compatibles.`,
        className: 'border-emerald-500/30 bg-emerald-500/5',
      }
    }
    if (assurance.governance_effect === 'none_expired_residence') {
      return {
        label: 'Verificación vencida',
        detail: 'Ya no puede usarse para entrar a nuevos padrones subnacionales. Renovarla no altera padrones que ya estén congelados.',
        className: 'border-destructive/30 bg-destructive/5',
      }
    }
    return {
      label: 'Residencia no verificada',
      detail: 'Tu municipio principal organiza contenido y comunidad, pero no acredita residencia para gobernanza.',
      className: 'border-border bg-muted/30',
    }
  }, [assurance])

  const canSubmitAssurance = Boolean(current?.territory_code)
    && !assurance?.pending_request
    && (!assurance?.territory_assurance_effective || assurance.renewal_required)

  if (loading) {
    return <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-muted-foreground">Cargando red territorial de Colombia…</div>
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">VÉRTICE Colombia · Phase 7G.3</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Territorio, residencia y elegibilidad</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          Tu municipio principal, tu ubicación actual y tu residencia verificada son estados distintos. Solo una verificación de residencia vigente puede satisfacer el requisito territorial de un nuevo padrón subnacional; la elegibilidad final siempre la decide el servidor para cada propuesta.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-muted/60 p-4">
            <div className="text-xs text-muted-foreground">Territorio principal</div>
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

      <section className={`rounded-2xl border p-6 ${assurancePresentation.className}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Residence assurance</p>
            <h2 className="mt-1 text-xl font-semibold">{assurancePresentation.label}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{assurancePresentation.detail}</p>
          </div>
          {assurance?.territory_assurance_effective && (
            <div className="rounded-xl border border-border bg-background/70 px-4 py-3 text-right text-xs">
              <div className="text-muted-foreground">Verificada</div>
              <div className="font-medium">{formatDate(assurance.current_request_verified_at)}</div>
              <div className="mt-1 text-muted-foreground">Expira</div>
              <div className="font-medium">{formatDate(assurance.current_request_expires_at)}</div>
            </div>
          )}
        </div>

        {assurance?.pending_request ? (
          <div className="mt-5 rounded-xl border border-border bg-background/70 p-4 text-sm">
            <span className="font-semibold">Solicitud {assurance.pending_request.id.slice(0, 8)}…</span>
            <span className="text-muted-foreground"> · {EVIDENCE_LABEL[assurance.pending_request.evidence_type]}</span>
          </div>
        ) : canSubmitAssurance ? (
          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1.4fr_auto] lg:items-end">
            <label className="text-sm font-medium">
              Tipo de evidencia
              <select
                value={evidenceType}
                onChange={(event) => setEvidenceType(event.target.value as EvidenceType)}
                className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm"
              >
                {(Object.keys(EVIDENCE_LABEL) as EvidenceType[]).map((value) => (
                  <option key={value} value={value}>{EVIDENCE_LABEL[value]}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              Referencia segura
              <input
                value={evidenceReference}
                onChange={(event) => setEvidenceReference(event.target.value)}
                autoComplete="off"
                placeholder="vault:opaque/reference-token"
                className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3 font-mono text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
            <button
              type="button"
              onClick={() => void submitAssurance()}
              disabled={submittingAssurance}
              className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {submittingAssurance ? 'Enviando…' : assurance?.renewal_required ? 'Renovar' : 'Verificar residencia'}
            </button>
          </div>
        ) : assurance?.territory_assurance_effective ? (
          <p className="mt-5 text-sm text-muted-foreground">La renovación se habilita automáticamente durante los últimos 30 días de vigencia.</p>
        ) : (
          <p className="mt-5 text-sm text-muted-foreground">Selecciona primero un municipio o distrito principal para iniciar la verificación.</p>
        )}

        <div className="mt-5 rounded-xl border border-border bg-background/60 p-4 text-xs leading-5 text-muted-foreground">
          <span className="font-semibold text-foreground">Privacidad y autoridad.</span> No pegues documentos, números de identificación, coordenadas, fotos ni URLs. Vértice recibe únicamente una referencia opaca del canal seguro. GPS, reputación, suscripción, pagos, donaciones y crowdfunding no verifican residencia ni conceden voto.
        </div>
      </section>

      {error && <p className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>}
      {message && <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-700 dark:text-emerald-400">{message}</p>}

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Selecciona tu municipio o distrito</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Esta selección organiza contenido y comunidad. Es autodeclarada: cambiarla invalida cualquier assurance residencial anterior y nunca debe utilizarse para reflejar un viaje temporal.
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

          <button
            type="button"
            onClick={() => void save()}
            disabled={!selected || saving}
            className="mt-5 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Usar como territorio principal'}
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

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Antes de votar</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Cada propuesta aplica su propio preflight server-side. Antes de abrir la votación se evalúan pruebas vigentes; después de abrirla, la pertenencia al padrón congelado es la única autoridad y no puede ampliarse retrospectivamente.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/dashboard/governance" className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Revisar votaciones</Link>
          <Link href="/dashboard/identity" className="rounded-xl border border-border px-4 py-2 text-sm font-medium">Estado de identidad</Link>
        </div>
      </section>
    </div>
  )
}
