'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  HandCoins,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  XCircle,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'

type CampaignReviewItem = {
  id: string
  creator_citizen_id: string
  title: string
  category: string
  funding_model: string
  goal_amount_cop: number
  compliance_status: string
  status: string
  created_at: string
}

type PayoutProfileItem = {
  citizen_id: string
  verification_status: string
  payout_status: string
  requested_at: string | null
}

type ReviewQueue = {
  campaigns: CampaignReviewItem[]
  payout_profiles: PayoutProfileItem[]
}

function formatCop(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(value: string | null) {
  if (!value) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export default function CrowdfundingAdminPage() {
  const [queue, setQueue] = useState<ReviewQueue | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [action, setAction] = useState<string | null>(null)
  const [campaignNotes, setCampaignNotes] = useState<Record<string, string>>({})
  const [profileNotes, setProfileNotes] = useState<Record<string, string>>({})
  const [providerRefs, setProviderRefs] = useState<Record<string, string>>({})

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    setError(null)
    try {
      setQueue(await apiFetch<ReviewQueue>('/crowdfunding/admin/review-queue'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar la cola de crowdfunding.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function reviewCampaign(campaignId: string, decision: 'approve' | 'reject' | 'suspend') {
    setAction(`campaign:${campaignId}:${decision}`)
    setError(null)
    setNotice(null)
    try {
      await apiFetch(`/crowdfunding/admin/campaigns/${campaignId}/review`, {
        method: 'POST',
        body: JSON.stringify({
          decision,
          ...(campaignNotes[campaignId]?.trim() ? { notes: campaignNotes[campaignId].trim() } : {}),
        }),
      })
      setNotice(`Revisión de campaña registrada: ${decision}.`)
      await load(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible registrar la revisión de la campaña.')
    } finally {
      setAction(null)
    }
  }

  async function reviewProfile(citizenId: string, decision: 'approve' | 'reject' | 'suspend') {
    const providerReference = providerRefs[citizenId]?.trim()
    if (decision === 'approve' && !providerReference) {
      setError('La aprobación del perfil requiere una referencia verificable del proveedor KYC/KYB.')
      return
    }

    setAction(`profile:${citizenId}:${decision}`)
    setError(null)
    setNotice(null)
    try {
      await apiFetch(`/crowdfunding/admin/payout-profiles/${citizenId}/review`, {
        method: 'POST',
        body: JSON.stringify({
          decision,
          ...(providerReference ? { provider_reference: providerReference } : {}),
          ...(profileNotes[citizenId]?.trim() ? { notes: profileNotes[citizenId].trim() } : {}),
        }),
      })
      setNotice(`Revisión del perfil de recaudo registrada: ${decision}.`)
      await load(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible registrar la revisión del perfil.')
    } finally {
      setAction(null)
    }
  }

  if (loading) {
    return <div className="flex min-h-[55vh] items-center justify-center"><Loader2 size={22} className="animate-spin text-[#4A90E2]" /></div>
  }

  return (
    <div data-testid="crowdfunding-admin-operations" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
      <Link href="/dashboard/crowdfunding" className="inline-flex items-center gap-2 text-xs font-extrabold text-[#607087] hover:text-[#0A2A66]">
        <ArrowLeft size={14} /> Volver a financiación
      </Link>

      <section className="mt-5 rounded-[28px] bg-[#0A2A66] p-6 text-white shadow-[0_22px_60px_rgba(10,42,102,.14)] sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.14em] text-[#F5B700]"><ShieldCheck size={14} /> Control operativo</div>
            <h1 className="mt-3 text-3xl font-extrabold tracking-[-.035em]">Crowdfunding · Compliance y readiness</h1>
            <p className="mt-3 text-sm leading-7 text-white/70">Revisa campañas y perfiles de recaudo antes de habilitar activación o desembolsos. Ninguna decisión financiera altera reputación o autoridad cívica.</p>
          </div>
          <button type="button" disabled={refreshing} onClick={() => void load(true)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-xs font-extrabold text-white disabled:opacity-60">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Actualizar cola
          </button>
        </div>
      </section>

      {(error || notice) && (
        <div className={`mt-5 rounded-2xl border p-4 text-sm font-semibold ${error ? 'border-[#F0C7CB] bg-[#FFF7F8] text-[#A51E2D]' : 'border-[#BFDCC7] bg-[#F4FBF6] text-[#236E35]'}`}>
          {error ?? notice}
        </div>
      )}

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <SummaryCard icon={HandCoins} label="Campañas por revisar" value={queue?.campaigns.length ?? 0} />
        <SummaryCard icon={UserCheck} label="Perfiles de recaudo" value={queue?.payout_profiles.length ?? 0} />
      </section>

      <section className="mt-6 rounded-[26px] border border-[#DCE5EF] bg-white p-5 sm:p-7">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF1FB] text-[#0A2A66]"><HandCoins size={18} /></span>
          <div>
            <div className="text-[9px] font-extrabold uppercase tracking-[.12em] text-[#7B8799]">Campañas</div>
            <h2 className="text-lg font-extrabold text-[#0A2A66]">Revisión de cumplimiento</h2>
          </div>
        </div>

        {(queue?.campaigns.length ?? 0) === 0 ? (
          <EmptyState text="No hay campañas pendientes de revisión." />
        ) : (
          <div className="mt-5 space-y-4">
            {queue?.campaigns.map((campaign) => (
              <article key={campaign.id} className="rounded-2xl border border-[#E1E7EF] p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2 text-[9px] font-extrabold uppercase tracking-[.06em] text-[#607087]">
                      <span className="rounded-full bg-[#EEF3F8] px-2.5 py-1">{campaign.category}</span>
                      <span className="rounded-full bg-[#FFF8DF] px-2.5 py-1">{campaign.funding_model}</span>
                      <span className="rounded-full bg-[#F7F9FC] px-2.5 py-1">{campaign.compliance_status}</span>
                    </div>
                    <h3 className="mt-3 text-base font-extrabold text-[#0A2A66]">{campaign.title}</h3>
                    <div className="mt-2 text-[11px] font-semibold text-[#7B8799]">Meta {formatCop(campaign.goal_amount_cop)} · Creada {formatDate(campaign.created_at)}</div>
                  </div>
                </div>
                <textarea
                  rows={2}
                  maxLength={2000}
                  value={campaignNotes[campaign.id] ?? ''}
                  onChange={(event) => setCampaignNotes((current) => ({ ...current, [campaign.id]: event.target.value }))}
                  placeholder="Notas de revisión (opcional)"
                  className="mt-4 w-full rounded-xl border border-[#DCE5EF] px-3 py-2 text-xs font-medium text-[#0A2A66] outline-none focus:border-[#8EACD2]"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <ActionButton icon={CheckCircle2} label="Aprobar" disabled={action !== null} onClick={() => void reviewCampaign(campaign.id, 'approve')} tone="positive" />
                  <ActionButton icon={XCircle} label="Rechazar" disabled={action !== null} onClick={() => void reviewCampaign(campaign.id, 'reject')} tone="danger" />
                  <ActionButton icon={ShieldAlert} label="Suspender" disabled={action !== null} onClick={() => void reviewCampaign(campaign.id, 'suspend')} tone="warning" />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-[26px] border border-[#DCE5EF] bg-white p-5 sm:p-7">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E8F5EC] text-[#238A3B]"><UserCheck size={18} /></span>
          <div>
            <div className="text-[9px] font-extrabold uppercase tracking-[.12em] text-[#7B8799]">Beneficiarios</div>
            <h2 className="text-lg font-extrabold text-[#0A2A66]">Perfiles de recaudo y desembolso</h2>
          </div>
        </div>

        {(queue?.payout_profiles.length ?? 0) === 0 ? (
          <EmptyState text="No hay perfiles de recaudo pendientes de revisión." />
        ) : (
          <div className="mt-5 space-y-4">
            {queue?.payout_profiles.map((profile) => (
              <article key={profile.citizen_id} className="rounded-2xl border border-[#E1E7EF] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[9px] font-extrabold uppercase tracking-[.08em] text-[#7B8799]">Ciudadano</div>
                    <div className="mt-1 font-mono text-[11px] font-bold text-[#0A2A66]">{profile.citizen_id}</div>
                  </div>
                  <div className="text-right text-[10px] font-semibold text-[#7B8799]">Solicitado {formatDate(profile.requested_at)}</div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <input
                    value={providerRefs[profile.citizen_id] ?? ''}
                    onChange={(event) => setProviderRefs((current) => ({ ...current, [profile.citizen_id]: event.target.value }))}
                    placeholder="Referencia verificable KYC/KYB (obligatoria al aprobar)"
                    className="min-h-11 rounded-xl border border-[#DCE5EF] px-3 text-xs font-medium text-[#0A2A66] outline-none focus:border-[#8EACD2]"
                  />
                  <input
                    value={profileNotes[profile.citizen_id] ?? ''}
                    onChange={(event) => setProfileNotes((current) => ({ ...current, [profile.citizen_id]: event.target.value }))}
                    placeholder="Notas de revisión (opcional)"
                    className="min-h-11 rounded-xl border border-[#DCE5EF] px-3 text-xs font-medium text-[#0A2A66] outline-none focus:border-[#8EACD2]"
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <ActionButton icon={CheckCircle2} label="Aprobar perfil" disabled={action !== null} onClick={() => void reviewProfile(profile.citizen_id, 'approve')} tone="positive" />
                  <ActionButton icon={XCircle} label="Rechazar" disabled={action !== null} onClick={() => void reviewProfile(profile.citizen_id, 'reject')} tone="danger" />
                  <ActionButton icon={ShieldAlert} label="Suspender" disabled={action !== null} onClick={() => void reviewProfile(profile.citizen_id, 'suspend')} tone="warning" />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="mt-6 flex items-start gap-2 rounded-2xl border border-[#F1DEA5] bg-[#FFF8DF] p-4 text-[11px] font-semibold leading-5 text-[#6C5B21]">
        <AlertCircle size={16} className="mt-0.5 shrink-0" /> Aprobar compliance o readiness no mueve dinero por sí mismo. El movimiento financiero continúa sujeto a los gates del proveedor, conciliación, destino BRE-B verificado y controles de riesgo.
      </div>
    </div>
  )
}

function SummaryCard({ icon: Icon, label, value }: { icon: typeof HandCoins; label: string; value: number }) {
  return <div className="rounded-2xl border border-[#DCE5EF] bg-white p-5"><div className="flex items-center justify-between"><span className="text-[9px] font-extrabold uppercase tracking-[.11em] text-[#7B8799]">{label}</span><Icon size={17} className="text-[#8AA0BB]" /></div><div className="mt-3 text-2xl font-extrabold text-[#0A2A66]">{value}</div></div>
}

function EmptyState({ text }: { text: string }) {
  return <div className="mt-5 rounded-2xl border border-dashed border-[#C9D6E5] bg-[#F7F9FC] p-7 text-center text-sm font-semibold text-[#607087]">{text}</div>
}

function ActionButton({ icon: Icon, label, disabled, onClick, tone }: { icon: typeof CheckCircle2; label: string; disabled: boolean; onClick: () => void; tone: 'positive' | 'danger' | 'warning' }) {
  const classes = tone === 'positive'
    ? 'border-[#BFDCC7] bg-[#F4FBF6] text-[#236E35]'
    : tone === 'danger'
      ? 'border-[#F0C7CB] bg-[#FFF7F8] text-[#A51E2D]'
      : 'border-[#F1DEA5] bg-[#FFF8DF] text-[#806100]'
  return <button type="button" disabled={disabled} onClick={onClick} className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-4 text-[10px] font-extrabold uppercase tracking-[.05em] disabled:opacity-50 ${classes}`}><Icon size={13} /> {label}</button>
}
