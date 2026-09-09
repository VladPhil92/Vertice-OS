'use client'

import { useState } from 'react'
import { apiFetch } from '@/lib/api'

type InterestStatus = 'pending' | 'approved' | 'declined' | 'withdrawn'
type InterestRole = 'ambassador' | 'organizer' | 'observer'

interface Interest {
  id: string
  territory_code: string
  citizen_id: string
  interest_role: InterestRole
  status: InterestStatus
  message: string | null
  civic_profile_type: string
  public_civic_profile: boolean
  created_at: string
}

interface QueueResponse { data: Interest[]; count: number }

const ROLE_LABEL: Record<InterestRole, string> = {
  ambassador: 'Embajador/a local',
  organizer: 'Organizador/a',
  observer: 'Observador/a',
}

export default function ActivationInterestAdminPage() {
  const [territoryCode, setTerritoryCode] = useState('CO-MP-13001')
  const [status, setStatus] = useState<InterestStatus>('pending')
  const [items, setItems] = useState<Interest[]>([])
  const [loading, setLoading] = useState(false)
  const [acting, setActing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    if (!territoryCode.trim()) return
    setLoading(true)
    setError(null)
    try {
      const result = await apiFetch<QueueResponse>(`/territories/activation/admin/${encodeURIComponent(territoryCode.trim())}/interests?status=${status}&limit=100`)
      setItems(result.data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible cargar la cola.')
    } finally {
      setLoading(false)
    }
  }

  const review = async (item: Interest, next: 'approved' | 'declined') => {
    setActing(item.id)
    setError(null)
    try {
      await apiFetch(`/territories/activation/admin/interests/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: next,
          reason: next === 'approved'
            ? 'Cumple revisión operativa para continuar el proceso de activación.'
            : 'No cumple por ahora los criterios operativos de activación.',
        }),
      })
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible revisar la manifestación.')
    } finally {
      setActing(null)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8 lg:px-8">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">Phase 7C · National Citizen Activation</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary">Cola de intereses ciudadanos</h1>
        <p className="mt-2 max-w-3xl text-sm text-secondary">La aprobación sólo valida interés operativo. No concede roles de autenticación, cohortes automáticas, identity assurance, reputación ni autoridad de gobernanza.</p>
      </header>

      <section className="rounded border border-border bg-surface p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
          <input value={territoryCode} onChange={(event) => setTerritoryCode(event.target.value)} placeholder="CO-MP-13001" className="rounded border border-border bg-bg px-3 py-2 font-mono text-xs text-primary outline-none focus:border-gold" />
          <select value={status} onChange={(event) => setStatus(event.target.value as InterestStatus)} className="rounded border border-border bg-bg px-3 py-2 text-xs text-primary">
            <option value="pending">Pendientes</option>
            <option value="approved">Aprobados</option>
            <option value="declined">No aprobados</option>
            <option value="withdrawn">Retirados</option>
          </select>
          <button type="button" onClick={() => void load()} disabled={loading} className="rounded bg-gold px-4 py-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-black disabled:opacity-50">{loading ? 'Cargando…' : 'Consultar'}</button>
        </div>
      </section>

      {error && <div className="rounded border border-red/30 bg-red/5 p-4 text-sm text-red-400">{error}</div>}

      <section className="space-y-3">
        {items.length === 0 ? (
          <div className="rounded border border-border bg-surface p-8 text-center text-sm text-tertiary">No hay registros cargados para este filtro.</div>
        ) : items.map((item) => (
          <article key={item.id} className="rounded border border-border bg-surface p-4">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-tertiary">
                  <span>{ROLE_LABEL[item.interest_role]}</span><span>·</span><span>{item.status}</span><span>·</span><span>{item.civic_profile_type}</span>
                </div>
                <div className="mt-2 break-all font-mono text-xs text-primary">Citizen {item.citizen_id}</div>
                {item.message && <p className="mt-3 max-w-3xl text-sm leading-6 text-secondary">{item.message}</p>}
                <p className="mt-2 text-[11px] text-tertiary">Registrado {new Date(item.created_at).toLocaleString('es-CO')}</p>
              </div>
              {item.status === 'pending' && (
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => void review(item, 'approved')} disabled={acting === item.id} className="rounded border border-emerald-500/40 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-emerald-400 disabled:opacity-50">Aprobar interés</button>
                  <button type="button" onClick={() => void review(item, 'declined')} disabled={acting === item.id} className="rounded border border-red/40 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-red-400 disabled:opacity-50">No aprobar</button>
                </div>
              )}
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}
