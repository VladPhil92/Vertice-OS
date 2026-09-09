'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { apiFetch } from '@/lib/api'

interface FeedItem {
  id: string
  title: string
  category: string
  status: string
  neighborhood?: string | null
  scope?: string
  created_at: string
}

interface CityOverview {
  territory: {
    code: string
    external_code: string | null
    name: string
    activation_status: string
  }
  activation: {
    momentum_score: number
    activation_status: string
    registered_citizens: number
    active_citizens_30d: number
    civic_actions_30d: number
    verified_actions_90d: number
    reports_30d: number
    proposals_30d: number
  }
  launch: {
    operational_state: 'observing' | 'recruiting' | 'launch_ready' | 'launched' | 'paused'
    active_cohort_members: number
    pending_interest_count: number
    accepting_interest: boolean
  }
  feed: {
    actions: FeedItem[]
    reports: FeedItem[]
    proposals: FeedItem[]
    empty_state: string | null
  }
}

const ACTIVATION_LABEL: Record<string, string> = {
  available: 'Disponible',
  emerging: 'Emergente',
  community_active: 'Comunidad activa',
  pilot_ready: 'Piloto operativo',
  verified_network: 'Red verificada',
}

const LAUNCH_LABEL: Record<string, string> = {
  observing: 'Observando señales locales',
  recruiting: 'Convocando comunidad',
  launch_ready: 'Lista para lanzamiento',
  launched: 'Nodo lanzado',
  paused: 'Activación pausada',
}

export default function PublicCityPage() {
  const params = useParams<{ code: string }>()
  const code = useMemo(() => decodeURIComponent(params.code ?? ''), [params.code])
  const [overview, setOverview] = useState<CityOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!code) return
    let alive = true
    setLoading(true)
    setError(null)
    apiFetch<CityOverview>(`/territories/public/${encodeURIComponent(code)}?feed_limit=6`, { public: true })
      .then((data) => { if (alive) setOverview(data) })
      .catch((cause) => { if (alive) setError(cause instanceof Error ? cause.message : 'No fue posible cargar esta ciudad.') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [code])

  if (loading) return <main className="mx-auto min-h-screen max-w-6xl px-4 py-16 text-sm text-muted-foreground">Cargando nodo territorial…</main>
  if (error || !overview) return <main className="mx-auto min-h-screen max-w-6xl px-4 py-16"><div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">{error ?? 'Ciudad no encontrada.'}</div></main>

  const { territory, activation, launch, feed } = overview
  const activity = [
    ...feed.actions.map((item) => ({ ...item, kind: 'Acción' })),
    ...feed.reports.map((item) => ({ ...item, kind: 'Reporte' })),
    ...feed.proposals.map((item) => ({ ...item, kind: 'Propuesta' })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 12)

  return (
    <main className="min-h-screen bg-background">
      <section className="border-b border-border bg-card/50">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <Link href="/cities" className="text-sm text-primary hover:underline">← Explorar ciudades</Link>
          <div className="mt-5 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Nodo VÉRTICE · Colombia</p>
              <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">{territory.name}</h1>
              <p className="mt-3 text-sm text-muted-foreground">
                {ACTIVATION_LABEL[territory.activation_status] ?? territory.activation_status}
                {territory.external_code ? ` · Código DANE ${territory.external_code}` : ''}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-background p-5 text-right shadow-sm">
              <div className="text-4xl font-bold">{activation.momentum_score}</div>
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">momentum cívico / 100</div>
              <div className="mt-3 h-2 w-52 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, activation.momentum_score)}%` }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-10 px-4 py-10">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Ciudadanía activa · 30d" value={activation.active_citizens_30d} />
          <Metric label="Acciones cívicas · 30d" value={activation.civic_actions_30d} />
          <Metric label="Acciones verificadas · 90d" value={activation.verified_actions_90d} />
          <Metric label="Propuestas · 30d" value={activation.proposals_30d} />
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-2xl border border-border bg-card p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Activación local</p>
            <h2 className="mt-2 text-2xl font-semibold">{LAUNCH_LABEL[launch.operational_state]}</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Este estado describe madurez operativa de comunidad. No concede autoridad política, identidad verificada, reputación adicional ni peso de voto.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Metric label="Cohorte activa" value={launch.active_cohort_members} compact />
              <Metric label="Personas interesadas" value={launch.pending_interest_count} compact />
            </div>
            {launch.accepting_interest ? (
              <div className="mt-6 space-y-3">
                <Link href="/auth/login?next=/dashboard/territory" className="block rounded-xl bg-primary px-4 py-3 text-center text-sm font-semibold text-primary-foreground">
                  Vincular {territory.name} a mi cuenta
                </Link>
                <Link href="/dashboard/territory/activate" className="block rounded-xl border border-border px-4 py-3 text-center text-sm font-semibold hover:border-primary/40">
                  Quiero ayudar a activar mi ciudad
                </Link>
              </div>
            ) : (
              <p className="mt-6 rounded-xl border border-border bg-muted/50 p-4 text-sm text-muted-foreground">La recepción de nuevas manifestaciones está temporalmente pausada.</p>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Actividad pública</p>
                <h2 className="mt-2 text-2xl font-semibold">Lo más reciente en {territory.name}</h2>
              </div>
            </div>
            {activity.length === 0 ? (
              <p className="mt-5 rounded-xl bg-muted/50 p-5 text-sm text-muted-foreground">{feed.empty_state ?? 'Todavía no hay actividad pública.'}</p>
            ) : (
              <div className="mt-5 space-y-3">
                {activity.map((item) => (
                  <div key={`${item.kind}-${item.id}`} className="rounded-xl border border-border p-4">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                      <span>{item.kind}</span><span>·</span><span>{item.category}</span><span>·</span><span>{item.status}</span>
                    </div>
                    <div className="mt-1 font-medium">{item.title}</div>
                    <div className="mt-2 text-xs text-muted-foreground">{new Date(item.created_at).toLocaleDateString('es-CO')}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-primary/20 bg-primary/5 p-6 text-sm leading-6">
          <strong>Cómo se calcula esta señal.</strong> El momentum usa participación, acciones, evidencia, reportes y propuestas. Pagos, donaciones, suscripciones, KYC/KYB, capacidad económica e ideología están explícitamente fuera del cálculo.
        </section>
      </div>
    </main>
  )
}

function Metric({ label, value, compact = false }: { label: string; value: number; compact?: boolean }) {
  return (
    <div className={`rounded-2xl border border-border bg-card ${compact ? 'p-4' : 'p-5'}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`${compact ? 'mt-1 text-xl' : 'mt-2 text-3xl'} font-bold`}>{value}</div>
    </div>
  )
}
