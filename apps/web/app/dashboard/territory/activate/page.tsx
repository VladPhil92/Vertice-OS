'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'

type InterestRole = 'ambassador' | 'organizer' | 'observer'
type InterestStatus = 'pending' | 'approved' | 'declined' | 'withdrawn'

interface MyTerritory {
  territory_code: string | null
  territory_name: string | null
  activation_status: string | null
  department_name: string | null
}

interface Interest {
  id: string
  territory_code: string
  interest_role: InterestRole
  status: InterestStatus
  message: string | null
  created_at: string
  updated_at: string
}

interface InterestsResponse { data: Interest[]; count: number }

const ROLE_LABEL: Record<InterestRole, string> = {
  ambassador: 'Embajador/a local',
  organizer: 'Organizador/a comunitario/a',
  observer: 'Observador/a territorial',
}

const STATUS_LABEL: Record<InterestStatus, string> = {
  pending: 'En revisión',
  approved: 'Interés aprobado',
  declined: 'No aprobado',
  withdrawn: 'Retirado',
}

export default function TerritoryActivationPage() {
  const [territory, setTerritory] = useState<MyTerritory | null>(null)
  const [interests, setInterests] = useState<Interest[]>([])
  const [role, setRole] = useState<InterestRole>('ambassador')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [current, currentInterests] = await Promise.all([
        apiFetch<MyTerritory>('/territories/me'),
        apiFetch<InterestsResponse>('/territories/activation/me/interests'),
      ])
      setTerritory(current)
      setInterests(currentInterests.data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible cargar tu activación territorial.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const submit = async () => {
    if (!territory?.territory_code) return
    setSaving(true)
    setNotice(null)
    setError(null)
    try {
      await apiFetch(`/territories/activation/${encodeURIComponent(territory.territory_code)}/interests`, {
        method: 'POST',
        body: JSON.stringify({ interest_role: role, message: message.trim() || null }),
      })
      setMessage('')
      setNotice('Tu manifestación quedó registrada. Esto no crea un rol, permiso, reputación adicional ni autoridad de gobernanza.')
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible registrar tu interés.')
    } finally {
      setSaving(false)
    }
  }

  const withdraw = async (interest: Interest) => {
    setError(null)
    setNotice(null)
    try {
      await apiFetch(`/territories/activation/${encodeURIComponent(interest.territory_code)}/interests/${interest.interest_role}`, { method: 'DELETE' })
      setNotice('Manifestación retirada.')
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible retirar tu interés.')
    }
  }

  if (loading) return <div className="mx-auto max-w-5xl px-4 py-10 text-sm text-muted-foreground">Cargando activación comunitaria…</div>

  if (!territory?.territory_code) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="rounded-2xl border border-border bg-card p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Activación comunitaria</p>
          <h1 className="mt-2 text-3xl font-bold">Primero vincula tu territorio</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Para ofrecerte como activador/a local, tu cuenta debe estar vinculada al municipio o distrito donde quieres participar.</p>
          <Link href="/dashboard/territory" className="mt-6 inline-block rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">Seleccionar mi territorio</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Phase 7C · Activación ciudadana</p>
        <h1 className="mt-2 text-3xl font-bold">Ayuda a activar {territory.territory_name ?? 'tu comunidad'}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          Puedes manifestar interés en apoyar la convocatoria, organización o seguimiento local. La revisión es operativa: no convierte tu cuenta en administradora, no verifica residencia, no aumenta reputación y no concede derechos de gobernanza.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href={`/cities/${encodeURIComponent(territory.territory_code)}`} className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:border-primary/40">Ver nodo público</Link>
          <Link href="/dashboard/territory" className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:border-primary/40">Cambiar territorio</Link>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-xl font-semibold">Manifestar interés</h2>
          <label className="mt-5 block text-sm font-medium">
            Cómo quieres ayudar
            <select value={role} onChange={(event) => setRole(event.target.value as InterestRole)} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm">
              {(Object.keys(ROLE_LABEL) as InterestRole[]).map((value) => <option key={value} value={value}>{ROLE_LABEL[value]}</option>)}
            </select>
          </label>
          <label className="mt-4 block text-sm font-medium">
            Mensaje <span className="font-normal text-muted-foreground">(opcional)</span>
            <textarea value={message} onChange={(event) => setMessage(event.target.value.slice(0, 500))} rows={5} placeholder="Cuéntanos brevemente qué experiencia o disponibilidad puedes aportar." className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </label>
          <div className="mt-2 text-right text-xs text-muted-foreground">{message.length}/500</div>
          {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
          {notice && <p className="mt-4 text-sm text-emerald-700 dark:text-emerald-400">{notice}</p>}
          <button type="button" onClick={() => void submit()} disabled={saving} className="mt-5 w-full rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {saving ? 'Registrando…' : 'Registrar mi interés'}
          </button>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">La aprobación de esta manifestación no te añade automáticamente a una cohorte. Esa asignación es un proceso separado y auditable.</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-xl font-semibold">Mis manifestaciones</h2>
          {interests.length === 0 ? (
            <p className="mt-5 rounded-xl bg-muted/50 p-5 text-sm text-muted-foreground">Todavía no has registrado interés de activación territorial.</p>
          ) : (
            <div className="mt-5 space-y-3">
              {interests.map((interest) => (
                <div key={interest.id} className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{ROLE_LABEL[interest.interest_role]}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{STATUS_LABEL[interest.status]} · {new Date(interest.updated_at).toLocaleDateString('es-CO')}</div>
                    </div>
                    {interest.status !== 'withdrawn' && (
                      <button type="button" onClick={() => void withdraw(interest)} className="rounded-lg border border-border px-3 py-2 text-xs font-medium hover:border-destructive/50 hover:text-destructive">Retirar</button>
                    )}
                  </div>
                  {interest.message && <p className="mt-3 text-sm leading-6 text-muted-foreground">{interest.message}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-primary/20 bg-primary/5 p-6 text-sm leading-6">
        <strong>Frontera de autoridad:</strong> manifestar interés, ser aprobado o aparecer en esta cola no modifica autenticación, identity assurance, territory assurance, reputación, ranking, voto, autoridad cívica ni alcance orgánico.
      </section>
    </div>
  )
}
