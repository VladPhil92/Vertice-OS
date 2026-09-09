'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  AlertTriangle,
  Banknote,
  CircleDollarSign,
  Gauge,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Siren,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'

type Capability = 'pro_checkout' | 'crowdfunding_collection' | 'crowdfunding_payouts'

type RuntimeControl = {
  capability: Capability
  emergency_stop: boolean
  reason: string | null
  updated_by_citizen_id: string | null
  updated_at: string
}

type CommandCenter = {
  state: 'nominal' | 'degraded' | 'blocked'
  generatedAt: string
  providers: {
    mercadopago: 'ready' | 'disabled' | 'misconfigured'
    wompiPayouts: 'ready' | 'disabled' | 'misconfigured'
  }
  releaseSwitches: {
    crowdfundingCollectionEnabled: boolean
    crowdfundingPayoutsEnabled: boolean
  }
  controls: RuntimeControl[]
  metrics: {
    pendingPayments: number
    stalePendingPayments: number
    providerStateUnknown: number
    paid24hCop: number
    platformFees24hCop: number
    failedWebhooks24h: number
    staleReceivedWebhooks: number
    pendingRefunds: number
    refundsReconciliationRequired: number
    payoutsInFlight: number
    payoutsReconciliationRequired: number
    openRiskFlags: number
    escalatedRiskFlags: number
    criticalRiskFlags: number
  }
  slos: Record<string, boolean>
  finance: {
    provider: string
    reconciliation: {
      id: string
      status: string
      scanned_count: number
      changed_count: number
      failed_count: number
      started_at: string
      completed_at: string | null
    } | null
    openRiskFlags: number
    pendingRefunds: number
  }
  payoutOperations: {
    readiness: string
    operationallyCertified: boolean
    executionEnabled: boolean
    providerState: string
  }
  certificationBoundary: {
    internalFinancialIntegrity: string
    providerMoneyMovement: string
  }
}

const labels: Record<Capability, { title: string; description: string }> = {
  pro_checkout: {
    title: 'Checkout VÉRTICE Pro',
    description: 'Detiene nuevas suscripciones. Cancelación, webhook y conciliación continúan activos.',
  },
  crowdfunding_collection: {
    title: 'Recaudo crowdfunding',
    description: 'Detiene nuevos aportes sin bloquear refunds ni conciliación de aportes existentes.',
  },
  crowdfunding_payouts: {
    title: 'Desembolsos crowdfunding',
    description: 'Detiene nuevas instrucciones BRE-B; payouts ya emitidos conservan reconciliación.',
  },
}

function formatCop(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Sin evidencia'
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function StatePill({ state }: { state: string }) {
  const tone = state === 'nominal' || state === 'ready' || state === 'integrated'
    ? 'border-[#BFDCC7] bg-[#F4FBF6] text-[#236E35]'
    : state === 'blocked' || state === 'disabled' || state === 'misconfigured'
      ? 'border-[#F0C7CB] bg-[#FFF7F8] text-[#A51E2D]'
      : 'border-[#EAD59A] bg-[#FFFBEC] text-[#8B6410]'
  return <span className={`rounded-full border px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[.08em] ${tone}`}>{state}</span>
}

export default function FinanceOperationsCommandCenterPage() {
  const [data, setData] = useState<CommandCenter | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [action, setAction] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [reasons, setReasons] = useState<Partial<Record<Capability, string>>>({})

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    setError(null)
    try {
      setData(await apiFetch<CommandCenter>('/billing/admin/finance/command-center'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar el control plane financiero.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const failedSlos = useMemo(
    () => Object.entries(data?.slos ?? {}).filter(([, ok]) => !ok).map(([name]) => name),
    [data],
  )

  async function toggleControl(control: RuntimeControl) {
    const nextStop = !control.emergency_stop
    const reason = reasons[control.capability]?.trim()
    if (nextStop && (!reason || reason.length < 8)) {
      setError('Para activar un emergency stop registra una razón operativa de al menos 8 caracteres.')
      return
    }

    setAction(`control:${control.capability}`)
    setError(null)
    setNotice(null)
    try {
      await apiFetch(`/billing/admin/finance/controls/${control.capability}`, {
        method: 'PUT',
        body: JSON.stringify({ emergencyStop: nextStop, ...(nextStop ? { reason } : {}) }),
      })
      setNotice(nextStop ? `Emergency stop activado: ${labels[control.capability].title}.` : `Rail restaurado: ${labels[control.capability].title}.`)
      setReasons((current) => ({ ...current, [control.capability]: '' }))
      await load(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible actualizar el control financiero.')
    } finally {
      setAction(null)
    }
  }

  async function runOperation(kind: 'reconcile' | 'risk') {
    setAction(kind)
    setError(null)
    setNotice(null)
    try {
      if (kind === 'reconcile') {
        await apiFetch('/billing/admin/finance/reconcile/enqueue', { method: 'POST', body: JSON.stringify({}) })
        setNotice('Conciliación financiera encolada.')
      } else {
        await apiFetch('/billing/admin/finance/risk/scan', { method: 'POST', body: JSON.stringify({}) })
        setNotice('Escaneo de riesgo completado.')
      }
      await load(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'La operación financiera no pudo ejecutarse.')
    } finally {
      setAction(null)
    }
  }

  if (loading) {
    return <div className="flex min-h-[55vh] items-center justify-center"><Loader2 size={24} className="animate-spin text-[#4A90E2]" /></div>
  }

  return (
    <div data-testid="finance-operations-command-center" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
      <section className="rounded-[28px] bg-[#071C45] p-6 text-white shadow-[0_24px_70px_rgba(7,28,69,.18)] sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.14em] text-[#F5B700]"><Gauge size={14} /> Phase 4 · Financial Operations</div>
            <h1 className="mt-3 text-3xl font-extrabold tracking-[-.035em]">Command Center financiero</h1>
            <p className="mt-3 text-sm leading-7 text-white/70">Observa recaudo, conciliación, riesgo, refunds y payouts desde una sola superficie. Los emergency stops bloquean únicamente nuevas instrucciones de dinero y nunca modifican reputación, identidad o autoridad cívica.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {data && <StatePill state={data.state} />}
            <button type="button" onClick={() => void load(true)} disabled={refreshing} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-xs font-extrabold disabled:opacity-60">
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Actualizar
            </button>
          </div>
        </div>
      </section>

      {(error || notice) && (
        <div className={`mt-5 rounded-2xl border p-4 text-sm font-semibold ${error ? 'border-[#F0C7CB] bg-[#FFF7F8] text-[#A51E2D]' : 'border-[#BFDCC7] bg-[#F4FBF6] text-[#236E35]'}`}>
          {error ?? notice}
        </div>
      )}

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={CircleDollarSign} label="Pagado últimas 24h" value={formatCop(data?.metrics.paid24hCop ?? 0)} />
        <Metric icon={Banknote} label="Fees VÉRTICE 24h" value={formatCop(data?.metrics.platformFees24hCop ?? 0)} />
        <Metric icon={RotateCcw} label="Pendientes / stale" value={`${data?.metrics.pendingPayments ?? 0} / ${data?.metrics.stalePendingPayments ?? 0}`} />
        <Metric icon={ShieldAlert} label="Riesgo abierto / crítico" value={`${data?.metrics.openRiskFlags ?? 0} / ${data?.metrics.criticalRiskFlags ?? 0}`} />
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <div className="rounded-[26px] border border-[#DCE5EF] bg-white p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[9px] font-extrabold uppercase tracking-[.12em] text-[#7B8799]">Emergency controls</div>
              <h2 className="mt-1 text-lg font-extrabold text-[#0A2A66]">Rails de dinero</h2>
              <p className="mt-2 text-xs leading-6 text-[#607087]">Cambiar estos controles requiere rol activo superadmin. Reconciliación, cancelaciones, refunds y webhooks permanecen disponibles.</p>
            </div>
            <Siren size={20} className="text-[#B63A46]" />
          </div>

          <div className="mt-5 space-y-4">
            {data?.controls.map((control) => (
              <article key={control.capability} className={`rounded-2xl border p-4 ${control.emergency_stop ? 'border-[#E9BFC4] bg-[#FFF8F9]' : 'border-[#E1E7EF] bg-[#FBFCFE]'}`}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-extrabold text-[#0A2A66]">{labels[control.capability].title}</h3>
                      <StatePill state={control.emergency_stop ? 'blocked' : 'nominal'} />
                    </div>
                    <p className="mt-2 text-[11px] leading-5 text-[#607087]">{labels[control.capability].description}</p>
                    <div className="mt-2 text-[10px] font-semibold text-[#8994A5]">Último cambio {formatDate(control.updated_at)}{control.reason ? ` · ${control.reason}` : ''}</div>
                  </div>
                  <button type="button" disabled={action !== null} onClick={() => void toggleControl(control)} className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-[11px] font-extrabold disabled:opacity-50 ${control.emergency_stop ? 'bg-[#E8F5EC] text-[#236E35]' : 'bg-[#FFF0F2] text-[#A51E2D]'}`}>
                    {control.emergency_stop ? <ToggleLeft size={17} /> : <ToggleRight size={17} />}
                    {control.emergency_stop ? 'Restaurar rail' : 'Emergency stop'}
                  </button>
                </div>
                {!control.emergency_stop && (
                  <input
                    value={reasons[control.capability] ?? ''}
                    onChange={(event) => setReasons((current) => ({ ...current, [control.capability]: event.target.value }))}
                    maxLength={500}
                    placeholder="Razón obligatoria si necesitas detener este rail"
                    className="mt-3 min-h-10 w-full rounded-xl border border-[#DCE5EF] bg-white px-3 text-xs font-medium text-[#0A2A66] outline-none focus:border-[#8EACD2]"
                  />
                )}
              </article>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <section className="rounded-[26px] border border-[#DCE5EF] bg-white p-5 sm:p-7">
            <div className="flex items-center gap-3">
              <Activity size={18} className="text-[#4A90E2]" />
              <h2 className="text-lg font-extrabold text-[#0A2A66]">Providers y switches</h2>
            </div>
            <div className="mt-5 space-y-3 text-xs font-semibold text-[#607087]">
              <Row label="Mercado Pago" value={<StatePill state={data?.providers.mercadopago ?? 'disabled'} />} />
              <Row label="Wompi BRE-B" value={<StatePill state={data?.providers.wompiPayouts ?? 'disabled'} />} />
              <Row label="Collection release switch" value={data?.releaseSwitches.crowdfundingCollectionEnabled ? 'ON' : 'OFF'} />
              <Row label="Payout release switch" value={data?.releaseSwitches.crowdfundingPayoutsEnabled ? 'ON' : 'OFF'} />
              <Row label="Payout operational certification" value={data?.payoutOperations.operationallyCertified ? 'verified' : 'not verified'} />
            </div>
          </section>

          <section className="rounded-[26px] border border-[#DCE5EF] bg-white p-5 sm:p-7">
            <div className="flex items-center gap-3">
              {failedSlos.length === 0 ? <ShieldCheck size={18} className="text-[#238A3B]" /> : <AlertTriangle size={18} className="text-[#B3780C]" />}
              <h2 className="text-lg font-extrabold text-[#0A2A66]">SLO guardrails</h2>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {Object.entries(data?.slos ?? {}).map(([name, ok]) => (
                <div key={name} className={`rounded-xl border px-3 py-2 text-[10px] font-bold ${ok ? 'border-[#CFE5D4] bg-[#F7FCF8] text-[#236E35]' : 'border-[#EAD59A] bg-[#FFFBEC] text-[#8B6410]'}`}>
                  {name}: {ok ? 'OK' : 'ATTENTION'}
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>

      <section className="mt-6 rounded-[26px] border border-[#DCE5EF] bg-white p-5 sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[9px] font-extrabold uppercase tracking-[.12em] text-[#7B8799]">Recovery operations</div>
            <h2 className="mt-1 text-lg font-extrabold text-[#0A2A66]">Conciliación y riesgo</h2>
            <p className="mt-2 text-xs leading-6 text-[#607087]">Estas acciones siguen disponibles incluso si un rail está detenido.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={action !== null} onClick={() => void runOperation('reconcile')} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#0A2A66] px-4 text-xs font-extrabold text-white disabled:opacity-50">
              <RotateCcw size={14} /> Encolar conciliación
            </button>
            <button type="button" disabled={action !== null} onClick={() => void runOperation('risk')} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#DCE5EF] px-4 text-xs font-extrabold text-[#0A2A66] disabled:opacity-50">
              <ShieldAlert size={14} /> Escanear riesgo
            </button>
            <Link href="/dashboard/admin/crowdfunding" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#DCE5EF] px-4 text-xs font-extrabold text-[#0A2A66]">Compliance</Link>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric icon={RefreshCw} label="Refunds pending / reconcile" value={`${data?.metrics.pendingRefunds ?? 0} / ${data?.metrics.refundsReconciliationRequired ?? 0}`} />
          <Metric icon={Banknote} label="Payouts inflight / reconcile" value={`${data?.metrics.payoutsInFlight ?? 0} / ${data?.metrics.payoutsReconciliationRequired ?? 0}`} />
          <Metric icon={Activity} label="Webhook failed / stale" value={`${data?.metrics.failedWebhooks24h ?? 0} / ${data?.metrics.staleReceivedWebhooks ?? 0}`} />
          <Metric icon={AlertTriangle} label="Provider state unknown" value={String(data?.metrics.providerStateUnknown ?? 0)} />
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-[#DCE5EF] bg-[#F8FAFD] p-4 text-[11px] font-semibold leading-6 text-[#607087]">
        <strong className="text-[#0A2A66]">Certification boundary:</strong> integridad financiera interna = <strong>{data?.certificationBoundary.internalFinancialIntegrity}</strong>. Movimiento real de Mercado Pago/Wompi = <strong>{data?.certificationBoundary.providerMoneyMovement}</strong>. Un dashboard verde no sustituye canaries, settlement/refund real, payout BRE-B real ni evidencia bancaria externa.
      </section>
    </div>
  )
}

function Metric({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#DCE5EF] bg-white p-4">
      <div className="flex items-center gap-2 text-[9px] font-extrabold uppercase tracking-[.08em] text-[#7B8799]"><Icon size={13} /> {label}</div>
      <div className="mt-2 text-xl font-extrabold tracking-[-.02em] text-[#0A2A66]">{value}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-3 border-b border-[#EEF2F6] pb-3 last:border-0 last:pb-0"><span>{label}</span><span className="text-right font-extrabold text-[#0A2A66]">{value}</span></div>
}
