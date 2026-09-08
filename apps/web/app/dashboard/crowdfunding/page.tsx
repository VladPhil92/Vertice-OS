'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  BadgeDollarSign,
  CheckCircle2,
  CircleDollarSign,
  HandCoins,
  Landmark,
  Loader2,
  Plus,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'

type FundingPolicy = 'flexible' | 'all_or_nothing' | 'milestone'
type BrebKeyType = 'ALPHANUMERIC' | 'MAIL' | 'PHONE' | 'IDENTIFICATION' | 'ESTABLISHMENT_CODE'

type CategoryDefinition = {
  id: string
  label: string
  description: string
  suggestedFundingPolicy: FundingPolicy
}

type ConfigResponse = {
  categoryCatalog: CategoryDefinition[]
  fundingPolicies: FundingPolicy[]
  feePolicy: {
    version: string
    socialEmergencyVerifiedPercent: number
    standardDonationPercent: number
    rewardPrepurchasePercent: number
    tipIsOptional: boolean
    providerProcessingFeeIsSeparate: boolean
  }
}

type Campaign = {
  id: string
  title: string
  summary: string
  category: string
  funding_model: string
  funding_policy: FundingPolicy
  status: string
  compliance_status: string
  goal_amount_cop: number
  raised_amount_cop: number
  currency: string
  neighborhood: string | null
  updated_at: string
}

type PayoutReadiness = {
  identity_verified: boolean
  verification_status: string
  payout_status: string
  requested_at: string | null
  verified_at: string | null
  review_notes: string | null
  can_request_review: boolean
  can_activate_campaign: boolean
}

type BrebPreview = {
  holderName: string
  financialEntity: { name: string; code: string }
  keyType: BrebKeyType
  keyValue: string
}

type RoleContext = {
  active_role: 'citizen' | 'moderator' | 'admin' | 'superadmin'
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  review: 'En revisión',
  verified: 'Lista para activar',
  active: 'Recaudando',
  funded: 'Meta alcanzada',
  executing: 'En ejecución',
  verifying: 'Verificando impacto',
  completed: 'Completada',
  suspended: 'Suspendida',
  investigation: 'En investigación',
}

const COMPLIANCE_LABELS: Record<string, string> = {
  pending: 'Cumplimiento pendiente',
  in_review: 'Cumplimiento en revisión',
  verified: 'Cumplimiento verificado',
  rejected: 'Cumplimiento rechazado',
  suspended: 'Cumplimiento suspendido',
}

const POLICY_LABELS: Record<FundingPolicy, string> = {
  flexible: 'Flexible',
  all_or_nothing: 'Todo o nada',
  milestone: 'Por hitos',
}

const BREB_LABELS: Record<BrebKeyType, string> = {
  ALPHANUMERIC: 'Llave alfanumérica',
  MAIL: 'Correo',
  PHONE: 'Celular',
  IDENTIFICATION: 'Identificación',
  ESTABLISHMENT_CODE: 'Código de comercio',
}

function formatCop(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value)
}

function progressOf(campaign: Campaign) {
  if (campaign.goal_amount_cop <= 0) return 0
  return Math.min(100, Math.round((campaign.raised_amount_cop / campaign.goal_amount_cop) * 100))
}

export default function CrowdfundingDashboardPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [config, setConfig] = useState<ConfigResponse | null>(null)
  const [readiness, setReadiness] = useState<PayoutReadiness | null>(null)
  const [role, setRole] = useState<RoleContext['active_role']>('citizen')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [action, setAction] = useState<string | null>(null)
  const [brebKeyType, setBrebKeyType] = useState<BrebKeyType>('PHONE')
  const [brebKey, setBrebKey] = useState('')
  const [brebPreview, setBrebPreview] = useState<BrebPreview | null>(null)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    setError(null)
    try {
      const [campaignResponse, nextConfig, nextReadiness, roleContext] = await Promise.all([
        apiFetch<{ campaigns: Campaign[] }>('/crowdfunding/me/campaigns'),
        apiFetch<ConfigResponse>('/crowdfunding/config'),
        apiFetch<PayoutReadiness>('/crowdfunding/me/payout-readiness'),
        apiFetch<RoleContext>('/auth/roles').catch(() => null),
      ])
      setCampaigns(campaignResponse.campaigns)
      setConfig(nextConfig)
      setReadiness(nextReadiness)
      if (roleContext) setRole(roleContext.active_role)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar tu centro de financiación.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const categoryLabels = useMemo(
    () => new Map((config?.categoryCatalog ?? []).map((category) => [category.id, category.label])),
    [config],
  )

  const totals = useMemo(() => campaigns.reduce((acc, campaign) => ({
    raised: acc.raised + campaign.raised_amount_cop,
    goal: acc.goal + campaign.goal_amount_cop,
    operating: acc.operating + (['active', 'funded', 'executing', 'verifying'].includes(campaign.status) ? 1 : 0),
  }), { raised: 0, goal: 0, operating: 0 }), [campaigns])

  async function requestReview() {
    setAction('review')
    setActionError(null)
    setNotice(null)
    try {
      const next = await apiFetch<PayoutReadiness>('/crowdfunding/me/payout-readiness/request-review', { method: 'POST' })
      setReadiness(next)
      setNotice('Tu perfil de recaudo fue enviado a revisión.')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No fue posible solicitar la revisión.')
    } finally {
      setAction(null)
    }
  }

  async function activateCampaign(campaignId: string) {
    setAction(`activate:${campaignId}`)
    setActionError(null)
    setNotice(null)
    try {
      await apiFetch(`/crowdfunding/me/campaigns/${campaignId}/activate`, { method: 'POST' })
      await load(true)
      setNotice('Campaña activada. Ya puede recibir aportes cuando el rail de cobro esté operativo.')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No fue posible activar la campaña.')
    } finally {
      setAction(null)
    }
  }

  async function previewBrebDestination() {
    if (!brebKey.trim()) return
    setAction('breb-preview')
    setActionError(null)
    setNotice(null)
    setBrebPreview(null)
    try {
      const preview = await apiFetch<BrebPreview>('/crowdfunding/me/payout-destination/preview', {
        method: 'POST',
        body: JSON.stringify({ keyType: brebKeyType, key: brebKey.trim() }),
      })
      setBrebPreview(preview)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No fue posible resolver la llave BRE-B.')
    } finally {
      setAction(null)
    }
  }

  async function confirmBrebDestination() {
    if (!brebPreview) return
    setAction('breb-confirm')
    setActionError(null)
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
      setNotice('Destino BRE-B confirmado y vinculado a tu perfil de desembolso.')
      setBrebPreview(null)
      setBrebKey('')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No fue posible confirmar el destino BRE-B.')
    } finally {
      setAction(null)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[55vh] max-w-6xl items-center justify-center px-5">
        <Loader2 size={22} className="animate-spin text-[#4A90E2]" />
      </div>
    )
  }

  if (error || !config || !readiness) {
    return (
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <div className="rounded-3xl border border-[#F0C7CB] bg-[#FFF7F8] p-7 text-sm font-semibold text-[#A51E2D]">
          {error ?? 'No fue posible cargar la configuración de financiación.'}
        </div>
      </div>
    )
  }

  const canAdmin = role === 'admin' || role === 'superadmin'

  return (
    <div data-testid="crowdfunding-operational-center" className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      <section className="overflow-hidden rounded-[28px] bg-[#0A2A66] text-white shadow-[0_20px_55px_rgba(10,42,102,.14)]">
        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.15em] text-[#F5B700]"><HandCoins size={14} /> Financiación de impacto</div>
            <h1 className="mt-3 text-3xl font-extrabold tracking-[-.035em] sm:text-4xl">Gestiona el ciclo completo de tus campañas.</h1>
            <p className="mt-3 text-sm font-medium leading-7 text-white/70">Crea, prepara, activa y sigue campañas verificables. El dinero financia ejecución; nunca compra reputación, ranking ni autoridad cívica.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canAdmin && (
              <Link href="/dashboard/admin/crowdfunding" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-xs font-extrabold text-white">
                <Settings2 size={15} /> Operaciones
              </Link>
            )}
            <Link href="/dashboard/crowdfunding/new" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#F5B700] px-5 text-xs font-extrabold text-[#0A2A66]">
              <Plus size={16} /> Crear campaña
            </Link>
          </div>
        </div>
      </section>

      {(notice || actionError) && (
        <div className={`mt-5 rounded-2xl border p-4 text-sm font-semibold ${actionError ? 'border-[#F0C7CB] bg-[#FFF7F8] text-[#A51E2D]' : 'border-[#BFDCC7] bg-[#F4FBF6] text-[#236E35]'}`}>
          {actionError ?? notice}
        </div>
      )}

      <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard icon={CircleDollarSign} label="Recaudado" value={formatCop(totals.raised)} />
        <MetricCard icon={BadgeDollarSign} label="Meta agregada" value={formatCop(totals.goal)} />
        <MetricCard icon={HandCoins} label="Campañas" value={String(campaigns.length)} />
        <MetricCard icon={Users} label="En operación" value={String(totals.operating)} />
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
        <section className="rounded-[28px] border border-[#DCE5EF] bg-white p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[9px] font-extrabold uppercase tracking-[.14em] text-[#7B8799]">Portafolio propio</div>
              <h2 className="mt-1 text-xl font-extrabold text-[#0A2A66]">Mis campañas</h2>
            </div>
            <button type="button" onClick={() => void load(true)} disabled={refreshing} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#DCE5EF] px-4 text-[10px] font-extrabold uppercase tracking-[.06em] text-[#0A2A66] disabled:opacity-50">
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> Actualizar
            </button>
          </div>

          {campaigns.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-[#C9D6E5] bg-[#F7F9FC] p-8 text-center">
              <HandCoins size={28} className="mx-auto text-[#4A90E2]" />
              <h3 className="mt-4 text-lg font-extrabold text-[#0A2A66]">Aún no tienes campañas</h3>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#607087]">Empieza por una categoría, una meta y un presupuesto trazable. La campaña permanecerá como borrador hasta superar revisión.</p>
              <Link href="/dashboard/crowdfunding/new" className="mt-5 inline-flex items-center gap-2 text-xs font-extrabold text-[#0A2A66]">Crear la primera <ArrowRight size={14} /></Link>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {campaigns.map((campaign) => {
                const progress = progressOf(campaign)
                const canActivate = campaign.status === 'verified' && readiness.can_activate_campaign
                return (
                  <article key={campaign.id} className="rounded-2xl border border-[#E1E7EF] p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap gap-2">
                          <Pill>{categoryLabels.get(campaign.category) ?? campaign.category}</Pill>
                          <Pill>{STATUS_LABELS[campaign.status] ?? campaign.status}</Pill>
                          <Pill>{POLICY_LABELS[campaign.funding_policy]}</Pill>
                          <Pill>{COMPLIANCE_LABELS[campaign.compliance_status] ?? campaign.compliance_status}</Pill>
                        </div>
                        <h3 className="mt-3 text-base font-extrabold text-[#0A2A66]">{campaign.title}</h3>
                        <p className="mt-1 line-clamp-2 text-xs font-medium leading-5 text-[#607087]">{campaign.summary}</p>
                      </div>
                      {canActivate && (
                        <button type="button" disabled={action !== null} onClick={() => void activateCampaign(campaign.id)} className="min-h-10 shrink-0 rounded-xl bg-[#2BA745] px-4 text-[10px] font-extrabold uppercase tracking-[.06em] text-white disabled:opacity-60">
                          {action === `activate:${campaign.id}` ? 'Activando…' : 'Activar recaudo'}
                        </button>
                      )}
                    </div>
                    <div className="mt-5 flex items-center justify-between text-[10px] font-bold text-[#607087]">
                      <span>{formatCop(campaign.raised_amount_cop)} recaudados</span>
                      <span>{progress}% de {formatCop(campaign.goal_amount_cop)}</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#EDF2F7]"><div className="h-full rounded-full bg-[#4A90E2]" style={{ width: `${progress}%` }} /></div>
                    {campaign.neighborhood && <div className="mt-3 text-[10px] font-semibold text-[#7B8799]">Territorio: {campaign.neighborhood}</div>}
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <section className="rounded-[26px] border border-[#DCE5EF] bg-white p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E8F5EC] text-[#238A3B]"><ShieldCheck size={19} /></span>
              <div>
                <div className="text-[9px] font-extrabold uppercase tracking-[.12em] text-[#7B8799]">Readiness</div>
                <h2 className="text-sm font-extrabold text-[#0A2A66]">Recaudo y desembolso</h2>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              <StatusRow label="Identidad" value={readiness.identity_verified ? 'Verificada' : 'Pendiente'} ok={readiness.identity_verified} />
              <StatusRow label="Perfil de recaudo" value={readiness.verification_status.replaceAll('_', ' ')} ok={readiness.verification_status === 'verified'} />
              <StatusRow label="Desembolsos" value={readiness.payout_status.replaceAll('_', ' ')} ok={readiness.payout_status === 'eligible'} />
            </div>
            {readiness.review_notes && <div className="mt-4 rounded-xl bg-[#FFF8DF] p-3 text-[11px] font-semibold leading-5 text-[#6C5B21]">{readiness.review_notes}</div>}
            {readiness.can_request_review && (
              <button type="button" disabled={action !== null} onClick={() => void requestReview()} className="mt-5 w-full rounded-xl bg-[#0A2A66] px-4 py-3 text-[10px] font-extrabold uppercase tracking-[.07em] text-white disabled:opacity-60">
                {action === 'review' ? 'Enviando…' : 'Solicitar habilitación'}
              </button>
            )}
            {!readiness.identity_verified && <Link href="/dashboard/identity" className="mt-5 inline-flex items-center gap-2 text-xs font-extrabold text-[#0A2A66]">Verificar identidad <ArrowRight size={14} /></Link>}
          </section>

          {readiness.payout_status === 'eligible' && (
            <section className="rounded-[26px] border border-[#DCE5EF] bg-white p-6">
              <div className="flex items-center gap-3"><Landmark size={20} className="text-[#0A2A66]" /><h2 className="text-sm font-extrabold text-[#0A2A66]">Destino BRE-B</h2></div>
              <p className="mt-3 text-xs font-medium leading-5 text-[#607087]">Resuelve y confirma tu propia llave. Los administradores no pueden sustituir libremente el destino de un desembolso.</p>
              <div className="mt-4 space-y-3">
                <select value={brebKeyType} onChange={(event) => { setBrebKeyType(event.target.value as BrebKeyType); setBrebPreview(null) }} className="min-h-11 w-full rounded-xl border border-[#DCE5EF] bg-white px-3 text-xs font-bold text-[#0A2A66]">
                  {(Object.keys(BREB_LABELS) as BrebKeyType[]).map((type) => <option key={type} value={type}>{BREB_LABELS[type]}</option>)}
                </select>
                <input value={brebKey} onChange={(event) => { setBrebKey(event.target.value); setBrebPreview(null) }} placeholder={brebKeyType === 'PHONE' ? '3XXXXXXXXX' : 'Ingresa tu llave BRE-B'} className="min-h-11 w-full rounded-xl border border-[#DCE5EF] px-3 text-xs font-semibold text-[#0A2A66] outline-none" />
                <button type="button" disabled={!brebKey.trim() || action !== null} onClick={() => void previewBrebDestination()} className="w-full rounded-xl border border-[#BFD0E8] px-4 py-3 text-[10px] font-extrabold uppercase tracking-[.06em] text-[#0A2A66] disabled:opacity-50">
                  {action === 'breb-preview' ? 'Consultando…' : 'Verificar destino'}
                </button>
              </div>
              {brebPreview && (
                <div className="mt-4 rounded-2xl border border-[#BFDCC7] bg-[#F4FBF6] p-4">
                  <div className="flex items-start gap-2"><CheckCircle2 size={17} className="mt-0.5 shrink-0 text-[#238A3B]" /><div><div className="text-xs font-extrabold text-[#174D27]">{brebPreview.holderName}</div><div className="mt-1 text-[11px] font-semibold text-[#397348]">{brebPreview.financialEntity.name} · {brebPreview.keyValue}</div></div></div>
                  <button type="button" disabled={action !== null} onClick={() => void confirmBrebDestination()} className="mt-4 w-full rounded-xl bg-[#238A3B] px-4 py-3 text-[10px] font-extrabold uppercase tracking-[.06em] text-white disabled:opacity-60">
                    {action === 'breb-confirm' ? 'Confirmando…' : 'Confirmar destino'}
                  </button>
                </div>
              )}
            </section>
          )}
        </aside>
      </div>

      <section className="mt-6 rounded-[28px] border border-[#DCE5EF] bg-[#F7F9FC] p-6 sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[.8fr_1.2fr] lg:items-start">
          <div>
            <div className="text-[9px] font-extrabold uppercase tracking-[.14em] text-[#7B8799]">Política vigente · {config.feePolicy.version}</div>
            <h2 className="mt-2 text-xl font-extrabold text-[#0A2A66]">Flexibilidad con reglas visibles</h2>
            <p className="mt-2 text-xs font-medium leading-5 text-[#607087]">La política de financiación y la comisión se leen desde la fuente canónica del backend. La propina es opcional y el procesamiento del proveedor permanece separado.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <PolicyCard title="Social / emergencia" value={`${config.feePolicy.socialEmergencyVerifiedPercent}%`} text="Campañas verificadas" />
            <PolicyCard title="Donación estándar" value={`${config.feePolicy.standardDonationPercent}%`} text="Comisión VÉRTICE" />
            <PolicyCard title="Recompensa / preventa" value={`${config.feePolicy.rewardPrepurchasePercent}%`} text="Todo-o-nada por defecto" />
          </div>
        </div>
        <div className="mt-5 flex items-start gap-2 rounded-2xl bg-white p-4 text-[11px] font-semibold leading-5 text-[#607087]"><AlertCircle size={16} className="mt-0.5 shrink-0 text-[#D39B00]" /> Recaudar, aportar o suscribirse no modifica reputación, ranking, voto ni autoridad cívica.</div>
      </section>
    </div>
  )
}

function MetricCard({ icon: Icon, label, value }: { icon: typeof HandCoins; label: string; value: string }) {
  return <div className="rounded-2xl border border-[#DCE5EF] bg-white p-4 sm:p-5"><div className="flex items-center justify-between"><span className="text-[9px] font-extrabold uppercase tracking-[.1em] text-[#7B8799]">{label}</span><Icon size={16} className="text-[#8AA0BB]" /></div><div className="mt-3 text-lg font-extrabold text-[#0A2A66] sm:text-xl">{value}</div></div>
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-[#EEF3F8] px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[.05em] text-[#53647A]">{children}</span>
}

function StatusRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return <div className="flex items-center justify-between gap-3 rounded-xl bg-[#F7F9FC] px-3 py-2.5 text-xs"><span className="font-semibold text-[#607087]">{label}</span><span className={`font-extrabold capitalize ${ok ? 'text-[#238A3B]' : 'text-[#8A6B00]'}`}>{value}</span></div>
}

function PolicyCard({ title, value, text }: { title: string; value: string; text: string }) {
  return <div className="rounded-2xl border border-[#DCE5EF] bg-white p-4"><div className="text-[9px] font-extrabold uppercase tracking-[.08em] text-[#7B8799]">{title}</div><div className="mt-2 text-2xl font-extrabold text-[#0A2A66]">{value}</div><div className="mt-1 text-[10px] font-semibold text-[#607087]">{text}</div></div>
}
