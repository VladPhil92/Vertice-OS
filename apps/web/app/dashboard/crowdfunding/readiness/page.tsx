'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  HandCoins,
  Landmark,
  Loader2,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  WalletCards,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'

type CapabilityState = 'ready' | 'disabled' | 'misconfigured'
type ReadinessState = 'ready' | 'action_required' | 'pending_review' | 'platform_blocked' | 'blocked'
type BrebKeyType = 'ALPHANUMERIC' | 'MAIL' | 'PHONE' | 'IDENTIFICATION' | 'ESTABLISHMENT_CODE'

type Blocker = {
  code: string
  scope: 'user' | 'campaign' | 'platform'
  message: string
  action_href: string | null
}

type CampaignReadiness = {
  id: string
  title: string
  status: string
  compliance_status: string
  review_notes: string | null
  lifecycle_ready: boolean
  can_activate: boolean
  can_accept_contributions: boolean
  blockers: Blocker[]
}

type ReadinessResponse = {
  generated_at: string
  identity: { state: ReadinessState; verified: boolean }
  payout_profile: {
    state: ReadinessState
    verification_status: string
    payout_status: string
    requested_at: string | null
    verified_at: string | null
    review_notes: string | null
    can_request_review: boolean
  }
  payout_destination: {
    state: ReadinessState
    registered: boolean
    key_type: string | null
  }
  platform: {
    ctg_one_federation: CapabilityState
    collection_provider: CapabilityState
    crowdfunding_collection: CapabilityState
    payout_provider: CapabilityState
    payout_execution: CapabilityState
    payout_certification: string
  }
  blockers: Blocker[]
  user_ready: boolean
  platform_ready: boolean
  ready_for_campaign_activation: boolean
  campaigns: CampaignReadiness[]
}

type BrebPreview = {
  holderName: string
  financialEntity: { name: string; code: string }
  keyType: BrebKeyType
  keyValue: string
}

const STATE_LABELS: Record<ReadinessState, string> = {
  ready: 'Listo',
  action_required: 'Acción requerida',
  pending_review: 'En revisión',
  platform_blocked: 'Bloqueo de plataforma',
  blocked: 'Bloqueado',
}

const BREB_LABELS: Record<BrebKeyType, string> = {
  ALPHANUMERIC: 'Llave alfanumérica',
  MAIL: 'Correo',
  PHONE: 'Celular',
  IDENTIFICATION: 'Identificación',
  ESTABLISHMENT_CODE: 'Código de comercio',
}

function Capability({ value }: { value: CapabilityState | string }) {
  const ready = value === 'ready' || value === 'verified'
  return <span className={`rounded-full px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[.05em] ${ready ? 'bg-[#E8F5EC] text-[#238A3B]' : 'bg-[#FFF8DF] text-[#7A6100]'}`}>{value.replaceAll('_', ' ')}</span>
}

function StageCard({ icon: Icon, title, state, text, action }: {
  icon: typeof ShieldCheck
  title: string
  state: ReadinessState
  text: string
  action?: React.ReactNode
}) {
  const ready = state === 'ready'
  return (
    <article className="rounded-2xl border border-[#DCE5EF] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${ready ? 'bg-[#E8F5EC] text-[#238A3B]' : 'bg-[#FFF8DF] text-[#8A6B00]'}`}><Icon size={18} /></span>
        <span className={`rounded-full px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[.05em] ${ready ? 'bg-[#E8F5EC] text-[#238A3B]' : 'bg-[#FFF8DF] text-[#7A6100]'}`}>{STATE_LABELS[state]}</span>
      </div>
      <h2 className="mt-4 text-sm font-extrabold text-[#0A2A66]">{title}</h2>
      <p className="mt-2 text-xs font-medium leading-5 text-[#607087]">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </article>
  )
}

export default function CrowdfundingReadinessPage() {
  const [data, setData] = useState<ReadinessResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [brebKeyType, setBrebKeyType] = useState<BrebKeyType>('PHONE')
  const [brebKey, setBrebKey] = useState('')
  const [brebPreview, setBrebPreview] = useState<BrebPreview | null>(null)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    setError(null)
    try {
      setData(await apiFetch<ReadinessResponse>('/crowdfunding/me/readiness'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible evaluar la preparación de crowdfunding.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function requestProfileReview() {
    setBusy('profile-review')
    setError(null)
    setNotice(null)
    try {
      await apiFetch('/crowdfunding/me/payout-readiness/request-review', { method: 'POST' })
      setNotice('Perfil enviado a revisión administrativa.')
      await load(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible solicitar la revisión.')
    } finally {
      setBusy(null)
    }
  }

  async function previewDestination() {
    if (!brebKey.trim()) return
    setBusy('breb-preview')
    setError(null)
    setNotice(null)
    setBrebPreview(null)
    try {
      setBrebPreview(await apiFetch<BrebPreview>('/crowdfunding/me/payout-destination/preview', {
        method: 'POST',
        body: JSON.stringify({ keyType: brebKeyType, key: brebKey.trim() }),
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible resolver la llave BRE-B.')
    } finally {
      setBusy(null)
    }
  }

  async function confirmDestination() {
    if (!brebPreview) return
    setBusy('breb-confirm')
    setError(null)
    setNotice(null)
    try {
      await apiFetch('/crowdfunding/me/payout-destination', {
        method: 'POST',
        body: JSON.stringify({
          keyType: brebKeyType,
          key: brebKey.trim(),
          confirmedHolderName: brebPreview.holderName,
          confirmedFinancialEntityCode: brebPreview.financialEntity.code,
        }),
      })
      setBrebPreview(null)
      setBrebKey('')
      setNotice('Destino BRE-B verificado y vinculado a tu perfil.')
      await load(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible confirmar el destino BRE-B.')
    } finally {
      setBusy(null)
    }
  }

  async function activateCampaign(campaignId: string) {
    setBusy(`activate:${campaignId}`)
    setError(null)
    setNotice(null)
    try {
      await apiFetch(`/crowdfunding/me/campaigns/${campaignId}/activate`, { method: 'POST' })
      setNotice('Campaña activada con readiness operativo completo.')
      await load(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible activar la campaña.')
    } finally {
      setBusy(null)
    }
  }

  if (loading) return <div className="flex min-h-[55vh] items-center justify-center"><Loader2 size={22} className="animate-spin text-[#4A90E2]" /></div>

  if (!data) {
    return <div className="mx-auto max-w-6xl px-5 py-10"><div className="rounded-2xl border border-[#F0C7CB] bg-[#FFF7F8] p-5 text-sm font-semibold text-[#A51E2D]">{error ?? 'Readiness no disponible.'}</div></div>
  }

  const destinationActionable = data.payout_profile.state === 'ready'
    && !data.payout_destination.registered
    && data.platform.payout_provider === 'ready'

  return (
    <div data-testid="crowdfunding-readiness-workspace" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
      <section className="rounded-[28px] bg-[#0A2A66] p-6 text-white shadow-[0_22px_60px_rgba(10,42,102,.14)] sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.14em] text-[#F5B700]"><ShieldCheck size={14} /> Readiness financiero</div>
            <h1 className="mt-3 text-3xl font-extrabold tracking-[-.035em]">Todo lo que debe estar listo antes de recaudar dinero real.</h1>
            <p className="mt-3 text-sm leading-7 text-white/70">VÉRTICE separa identidad, cumplimiento, destino del beneficiario y disponibilidad de proveedores. Una campaña no se activa si cualquiera de esos gates falla.</p>
          </div>
          <button type="button" disabled={refreshing} onClick={() => void load(true)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-xs font-extrabold text-white disabled:opacity-60"><RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Reevaluar</button>
        </div>
      </section>

      {(error || notice) && <div className={`mt-5 rounded-2xl border p-4 text-sm font-semibold ${error ? 'border-[#F0C7CB] bg-[#FFF7F8] text-[#A51E2D]' : 'border-[#BFDCC7] bg-[#F4FBF6] text-[#236E35]'}`}>{error ?? notice}</div>}

      <section className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#DCE5EF] bg-white p-5"><div className="text-[9px] font-extrabold uppercase tracking-[.1em] text-[#7B8799]">Usuario</div><div className={`mt-2 text-xl font-extrabold ${data.user_ready ? 'text-[#238A3B]' : 'text-[#8A6B00]'}`}>{data.user_ready ? 'Listo' : 'Pendiente'}</div></div>
        <div className="rounded-2xl border border-[#DCE5EF] bg-white p-5"><div className="text-[9px] font-extrabold uppercase tracking-[.1em] text-[#7B8799]">Plataforma</div><div className={`mt-2 text-xl font-extrabold ${data.platform_ready ? 'text-[#238A3B]' : 'text-[#8A6B00]'}`}>{data.platform_ready ? 'Lista' : 'Bloqueada'}</div></div>
        <div className="rounded-2xl border border-[#DCE5EF] bg-white p-5"><div className="text-[9px] font-extrabold uppercase tracking-[.1em] text-[#7B8799]">Activación</div><div className={`mt-2 text-xl font-extrabold ${data.ready_for_campaign_activation ? 'text-[#238A3B]' : 'text-[#8A6B00]'}`}>{data.ready_for_campaign_activation ? 'Habilitable' : 'No habilitable'}</div></div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StageCard icon={UserCheck} title="1. Identidad" state={data.identity.state} text={data.identity.verified ? 'Identidad verificada para operaciones financieras.' : 'La identidad debe verificarse antes de iniciar habilitación financiera.'} action={!data.identity.verified ? <Link href="/dashboard/identity" className="inline-flex items-center gap-2 text-xs font-extrabold text-[#0A2A66]">Ir a identidad <ArrowRight size={13} /></Link> : undefined} />
        <StageCard icon={ShieldCheck} title="2. Perfil KYC/KYB" state={data.payout_profile.state} text={`${data.payout_profile.verification_status.replaceAll('_', ' ')} · ${data.payout_profile.payout_status.replaceAll('_', ' ')}`} action={data.payout_profile.can_request_review ? <button type="button" disabled={busy !== null} onClick={() => void requestProfileReview()} className="rounded-xl bg-[#0A2A66] px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-[.06em] text-white disabled:opacity-50">{busy === 'profile-review' ? 'Enviando…' : 'Solicitar revisión'}</button> : undefined} />
        <StageCard icon={Landmark} title="3. Destino BRE-B" state={data.payout_destination.state} text={data.payout_destination.registered ? `Destino propio confirmado · ${data.payout_destination.key_type}` : 'El beneficiario debe confirmar personalmente su destino; un administrador no puede sustituirlo.'} />
        <StageCard icon={CircleDollarSign} title="4. Rails financieros" state={data.platform_ready ? 'ready' : 'platform_blocked'} text="Cobro, desembolso y certificación operativa deben estar listos antes de activar recaudo real." />
      </section>

      {destinationActionable && (
        <section className="mt-6 rounded-[26px] border border-[#DCE5EF] bg-white p-6">
          <div className="flex items-center gap-3"><Landmark size={20} className="text-[#0A2A66]" /><div><div className="text-[9px] font-extrabold uppercase tracking-[.1em] text-[#7B8799]">Self-service</div><h2 className="text-lg font-extrabold text-[#0A2A66]">Confirmar destino BRE-B</h2></div></div>
          <p className="mt-3 max-w-3xl text-xs font-medium leading-5 text-[#607087]">La llave se resuelve de nuevo contra el proveedor y VÉRTICE persiste únicamente una huella criptográfica, no tus datos bancarios crudos.</p>
          <div className="mt-5 grid gap-3 md:grid-cols-[220px_1fr_auto]">
            <select value={brebKeyType} onChange={(event) => { setBrebKeyType(event.target.value as BrebKeyType); setBrebPreview(null) }} className="min-h-11 rounded-xl border border-[#DCE5EF] bg-white px-3 text-xs font-bold text-[#0A2A66]">{(Object.keys(BREB_LABELS) as BrebKeyType[]).map((type) => <option key={type} value={type}>{BREB_LABELS[type]}</option>)}</select>
            <input value={brebKey} onChange={(event) => { setBrebKey(event.target.value); setBrebPreview(null) }} placeholder="Ingresa tu llave BRE-B" className="min-h-11 rounded-xl border border-[#DCE5EF] px-3 text-xs font-semibold text-[#0A2A66] outline-none focus:border-[#4A90E2]" />
            <button type="button" disabled={!brebKey.trim() || busy !== null} onClick={() => void previewDestination()} className="rounded-xl border border-[#BFD0E8] px-4 text-[10px] font-extrabold uppercase tracking-[.06em] text-[#0A2A66] disabled:opacity-50">{busy === 'breb-preview' ? 'Consultando…' : 'Verificar'}</button>
          </div>
          {brebPreview && <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-[#BFDCC7] bg-[#F4FBF6] p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-xs font-extrabold text-[#174D27]">{brebPreview.holderName}</div><div className="mt-1 text-[11px] font-semibold text-[#397348]">{brebPreview.financialEntity.name} · {brebPreview.keyValue}</div></div><button type="button" disabled={busy !== null} onClick={() => void confirmDestination()} className="rounded-xl bg-[#238A3B] px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-[.06em] text-white disabled:opacity-60">{busy === 'breb-confirm' ? 'Confirmando…' : 'Confirmar destino'}</button></div>}
        </section>
      )}

      <section className="mt-6 rounded-[26px] border border-[#DCE5EF] bg-white p-6">
        <div className="flex items-center gap-3"><WalletCards size={20} className="text-[#0A2A66]" /><div><div className="text-[9px] font-extrabold uppercase tracking-[.1em] text-[#7B8799]">Runtime financiero</div><h2 className="text-lg font-extrabold text-[#0A2A66]">Estado de proveedores</h2></div></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Provider label="CTG One federation" value={data.platform.ctg_one_federation} />
          <Provider label="Proveedor de cobro" value={data.platform.collection_provider} />
          <Provider label="Cobro crowdfunding" value={data.platform.crowdfunding_collection} />
          <Provider label="Proveedor de desembolso" value={data.platform.payout_provider} />
          <Provider label="Ejecución de desembolsos" value={data.platform.payout_execution} />
          <Provider label="Certificación de desembolso" value={data.platform.payout_certification} />
        </div>
      </section>

      {data.blockers.length > 0 && (
        <section className="mt-6 rounded-[26px] border border-[#F1DEA5] bg-[#FFFDF4] p-6">
          <div className="flex items-center gap-2 text-sm font-extrabold text-[#6C5B21]"><AlertTriangle size={18} /> Bloqueos actuales</div>
          <div className="mt-4 space-y-3">{data.blockers.map((blocker) => <div key={blocker.code} className="flex flex-col gap-2 rounded-xl bg-white p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-[9px] font-extrabold uppercase tracking-[.06em] text-[#9A7B15]">{blocker.scope} · {blocker.code}</div><div className="mt-1 text-xs font-semibold text-[#5E5946]">{blocker.message}</div></div>{blocker.action_href && <Link href={blocker.action_href} className="inline-flex items-center gap-1 text-xs font-extrabold text-[#0A2A66]">Resolver <ArrowRight size={13} /></Link>}</div>)}</div>
        </section>
      )}

      <section className="mt-6 rounded-[26px] border border-[#DCE5EF] bg-white p-6">
        <div className="flex items-center gap-3"><HandCoins size={20} className="text-[#0A2A66]" /><div><div className="text-[9px] font-extrabold uppercase tracking-[.1em] text-[#7B8799]">Campañas</div><h2 className="text-lg font-extrabold text-[#0A2A66]">Readiness por campaña</h2></div></div>
        {data.campaigns.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-[#C9D6E5] bg-[#F7F9FC] p-7 text-center text-sm font-semibold text-[#607087]">No tienes campañas todavía.</div> : <div className="mt-5 space-y-4">{data.campaigns.map((campaign) => <article key={campaign.id} className="rounded-2xl border border-[#E1E7EF] p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap gap-2"><Capability value={campaign.status} /><Capability value={campaign.compliance_status} />{campaign.can_accept_contributions && <span className="rounded-full bg-[#E8F5EC] px-2.5 py-1 text-[9px] font-extrabold uppercase text-[#238A3B]">recaudo operativo</span>}</div><h3 className="mt-3 text-sm font-extrabold text-[#0A2A66]">{campaign.title}</h3>{campaign.blockers[0] && <div className="mt-2 flex items-start gap-2 text-[11px] font-semibold leading-5 text-[#7A6100]"><Clock3 size={14} className="mt-0.5 shrink-0" />{campaign.blockers[0].message}</div>}</div><div className="flex flex-wrap gap-2"><Link href={`/dashboard/crowdfunding/${campaign.id}`} className="inline-flex min-h-10 items-center rounded-xl border border-[#DCE5EF] px-4 text-[10px] font-extrabold uppercase tracking-[.05em] text-[#0A2A66]">Gestionar</Link>{campaign.can_activate && <button type="button" disabled={busy !== null} onClick={() => void activateCampaign(campaign.id)} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#238A3B] px-4 text-[10px] font-extrabold uppercase tracking-[.05em] text-white disabled:opacity-50"><CheckCircle2 size={13} />{busy === `activate:${campaign.id}` ? 'Activando…' : 'Activar recaudo'}</button>}</div></div></article>)}</div>}
      </section>

      <div className="mt-6 flex items-start gap-2 rounded-2xl border border-[#DCE5EF] bg-[#F7F9FC] p-4 text-[11px] font-semibold leading-5 text-[#607087]"><AlertTriangle size={15} className="mt-0.5 shrink-0 text-[#D39B00]" /> Este readiness controla dinero, no influencia cívica. Verificación financiera, aportes, suscripciones o desembolsos nunca aumentan reputación, ranking, voto ni alcance orgánico.</div>
    </div>
  )
}

function Provider({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3 rounded-xl bg-[#F7F9FC] p-3"><span className="text-[10px] font-bold text-[#607087]">{label}</span><Capability value={value} /></div>
}
