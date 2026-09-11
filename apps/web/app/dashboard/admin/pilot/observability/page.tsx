'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Activity, AlertTriangle, ArrowLeft, Loader2, RefreshCw } from 'lucide-react'
import { apiFetch } from '@/lib/api'

type PilotRecord = Record<string, string> & { id: string }

type PilotSummary = {
  status: 'operational'
  retention_days: number
  revision: string
  unique_users_approx: number
  event_counts: Record<string, number>
  outcome_counts: Record<string, number>
  recent_feedback: PilotRecord[]
  recent_incidents: PilotRecord[]
  privacy: {
    raw_citizen_ids_stored: false
    emails_stored: false
    gps_stored: false
    arbitrary_event_payloads_allowed: false
  }
}

export default function PilotObservabilityPage() {
  const [summary, setSummary] = useState<PilotSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium')
  const [incident, setIncident] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    setSummary(await apiFetch<PilotSummary>('/pilot/admin/summary'))
  }, [])

  useEffect(() => {
    load()
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'No fue posible cargar la observabilidad.'))
      .finally(() => setLoading(false))
  }, [load])

  async function submitIncident() {
    if (incident.trim().length < 8) return
    setSubmitting(true)
    setError(null)
    try {
      await apiFetch('/pilot/admin/incidents', {
        method: 'POST',
        body: JSON.stringify({
          severity,
          code: 'OPERATOR_OBSERVATION',
          summary: incident.trim(),
          action: severity === 'critical' ? 'stop_pilot' : severity === 'high' ? 'pause_pilot' : 'observe',
        }),
      })
      setIncident('')
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible registrar el incidente.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="p-6 lg:p-8"><div className="h-80 animate-pulse rounded border border-border bg-surface" /></div>
  }

  return (
    <div className="space-y-7 p-6 lg:p-8" data-testid="pilot-observability-control-plane">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href="/dashboard/admin/pilot" className="mb-3 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-tertiary hover:text-gold">
            <ArrowLeft size={12} /> Pilot Control Center
          </Link>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-gold"><Activity size={13} /> Phase 7I</div>
          <h1 className="mt-2 font-display text-2xl font-semibold uppercase tracking-wide text-primary">Observabilidad operativa</h1>
          <p className="mt-2 max-w-2xl font-mono text-[10px] leading-relaxed text-tertiary">Journey, feedback e incidentes de corta retención. No modifica reputación, autoridad cívica ni estado financiero.</p>
        </div>
        <button onClick={() => void load()} className="flex w-fit items-center gap-2 rounded border border-border px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-secondary hover:border-gold hover:text-gold"><RefreshCw size={12} /> Actualizar</button>
      </header>

      {error && <div className="rounded border border-red/30 bg-red/5 p-4 font-mono text-[11px] text-red-400">{error}</div>}

      {summary && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Usuarios aprox." value={summary.unique_users_approx} />
            <Metric label="Eventos" value={Object.values(summary.event_counts).reduce((sum, value) => sum + value, 0)} />
            <Metric label="Feedback visible" value={summary.recent_feedback.length} />
            <Metric label="Retención" value={`${summary.retention_days}d`} />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded border border-border bg-surface p-5">
              <h2 className="font-mono text-[11px] uppercase tracking-widest text-secondary">Eventos</h2>
              <div className="mt-4 space-y-2">
                {Object.entries(summary.event_counts).length === 0 ? <Empty text="Sin telemetría todavía." /> : Object.entries(summary.event_counts).sort((a, b) => b[1] - a[1]).map(([name, value]) => <Row key={name} label={name} value={value} />)}
              </div>
            </div>
            <div className="rounded border border-border bg-surface p-5">
              <h2 className="font-mono text-[11px] uppercase tracking-widest text-secondary">Resultados</h2>
              <div className="mt-4 space-y-2">
                {Object.entries(summary.outcome_counts).length === 0 ? <Empty text="Sin resultados todavía." /> : Object.entries(summary.outcome_counts).map(([name, value]) => <Row key={name} label={name} value={value} />)}
              </div>
            </div>
          </section>

          <section className="rounded border border-border bg-surface p-5">
            <h2 className="font-mono text-[11px] uppercase tracking-widest text-secondary">Privacidad</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Privacy label="IDs crudos" safe={!summary.privacy.raw_citizen_ids_stored} />
              <Privacy label="Emails" safe={!summary.privacy.emails_stored} />
              <Privacy label="GPS" safe={!summary.privacy.gps_stored} />
              <Privacy label="Payload arbitrario" safe={!summary.privacy.arbitrary_event_payloads_allowed} />
            </div>
            <p className="mt-4 break-all font-mono text-[9px] text-tertiary">Runtime SHA: {summary.revision}</p>
          </section>

          <section className="rounded border border-border bg-surface p-5">
            <h2 className="font-mono text-[11px] uppercase tracking-widest text-secondary">Feedback reciente</h2>
            <div className="mt-4 space-y-3">
              {summary.recent_feedback.length === 0 ? <Empty text="Sin comentarios todavía." /> : summary.recent_feedback.map((item) => (
                <article key={item.id} className="rounded border border-border bg-bg p-4">
                  <p className="font-mono text-[9px] uppercase tracking-wider text-tertiary">{item.category} · {item.surface}{item.rating ? ` · ${item.rating}/5` : ''}</p>
                  <p className="mt-2 text-sm leading-6 text-secondary">{item.message}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded border border-gold/30 bg-gold/5 p-5">
            <div className="flex items-center gap-2"><AlertTriangle size={15} className="text-gold" /><h2 className="font-mono text-[11px] uppercase tracking-widest text-secondary">Registrar incidente</h2></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-[180px_1fr]">
              <select value={severity} onChange={(event) => setSeverity(event.target.value as typeof severity)} className="min-h-11 rounded border border-border bg-bg px-3 font-mono text-[11px] text-secondary">
                <option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option><option value="critical">Crítica</option>
              </select>
              <input value={incident} onChange={(event) => setIncident(event.target.value)} maxLength={240} placeholder="Resumen sin datos personales" className="min-h-11 rounded border border-border bg-bg px-3 text-sm text-primary outline-none focus:border-gold" />
            </div>
            <button disabled={submitting || incident.trim().length < 8} onClick={() => void submitIncident()} className="mt-3 flex items-center gap-2 rounded bg-primary px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-wider text-bg disabled:opacity-50">
              {submitting && <Loader2 size={12} className="animate-spin" />} Registrar
            </button>
          </section>
        </>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded border border-border bg-surface p-4"><p className="font-mono text-[9px] uppercase tracking-widest text-tertiary">{label}</p><p className="mt-2 font-display text-2xl font-semibold text-primary">{value}</p></div>
}

function Row({ label, value }: { label: string; value: number }) {
  return <div className="flex items-center justify-between rounded border border-border bg-bg px-3 py-2.5"><span className="font-mono text-[10px] text-secondary">{label}</span><span className="font-mono text-[11px] font-bold text-primary">{value}</span></div>
}

function Privacy({ label, safe }: { label: string; safe: boolean }) {
  return <div className="rounded border border-border bg-bg p-3"><p className="font-mono text-[9px] text-tertiary">{label}</p><p className={`mt-1 font-mono text-[11px] font-bold ${safe ? 'text-emerald-400' : 'text-red-400'}`}>{safe ? 'No almacenado' : 'Revisar'}</p></div>
}

function Empty({ text }: { text: string }) {
  return <p className="rounded border border-border bg-bg p-4 font-mono text-[10px] text-tertiary">{text}</p>
}
