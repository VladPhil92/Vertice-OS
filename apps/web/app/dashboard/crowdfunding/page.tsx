'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  ArrowRight,
  BadgeDollarSign,
  CheckCircle2,
  CircleDollarSign,
  HandCoins,
  Landmark,
  Plus,
  RefreshCw,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'

type FundingPolicy = 'flexible' | 'all_or_nothing' | 'milestone'
type BrebKeyType = 'ALPHANUMERIC' | 'MAIL' | 'PHONE' | 'IDENTIFICATION' | 'ESTABLISHMENT_CODE'

type CrowdfundingConfig = {
  categories: string[]
  fundingModels: string[]
  fundingPolicies: FundingPolicy[]
  campaignStatuses: string[]
  guardrails: {
    flexibleCampaignsCanWithdrawBeforeGoal: boolean
    rewardsDefaultToAllOrNothing: boolean
    contributionChangesReputation: boolean
    amountRaisedChangesReputation: boolean
    requiresComplianceReviewBeforeActivation: boolean
  }
  feePolicy: {
    version: string
    socialEmergencyVerifiedPercent: number
    standardDonationPercent: number
    rewardPrepurchasePercent: number
    tipIsOptional: boolean
    providerProcessingFeeIsSeparate: boolean
  }
  currency: 'COP'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, HandCoins, Loader2, Plus, ShieldCheck } from 'lucide-react'
import { apiFetch } from '@/lib/api'

type CategoryDefinition = {
  id: string
  label: string
  description: string
  suggestedFundingPolicy: string
}

type Campaign = {
  id: string
  title: string
  slug: string
  summary: string
  category: string
  funding_model: 'donation' | 'reward'
  funding_policy: FundingPolicy
  summary: string
  category: string
  funding_model: string
  funding_policy: string
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

const POLICY_LABELS: Record<FundingPolicy, string> = {
  flexible: 'Flexible',
  all_or_nothing: 'Todo o nada',
  milestone: 'Por hitos',
}
type ConfigResponse = { categoryCatalog: CategoryDefinition[] }
type CampaignsResponse = { campaigns: Campaign[] }

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  review: 'En revisión',
  verified: 'Verificada',
  active: 'Recaudando',
  funded: 'Financiada',
  executing: 'En ejecución',
  verifying: 'Verificando resultados',
  active: 'Activa',
  funded: 'Meta alcanzada',
  executing: 'En ejecución',
  verifying: 'Verificando impacto',
  completed: 'Completada',
  suspended: 'Suspendida',
  investigation: 'En investigación',
}

const COMPLIANCE_LABELS: Record<string, string> = {
  pending: 'Compliance pendiente',
  in_review: 'Compliance en revisión',
  verified: 'Compliance verificado',
  rejected: 'Compliance rechazado',
  suspended: 'Compliance suspendido',
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

export default function CrowdfundingPage() {
  const [config, setConfig] = useState<CrowdfundingConfig | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [readiness, setReadiness] = useState<PayoutReadiness | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [action, setAction] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [brebKeyType, setBrebKeyType] = useState<BrebKeyType>('PHONE')
  const [brebKey, setBrebKey] = useState('')
  const [brebPreview, setBrebPreview] = useState<BrebPreview | null>(null)

  const load = useCallback(async () => {
    setError(null)
    const [nextConfig, owned, nextReadiness] = await Promise.all([
      apiFetch<CrowdfundingConfig>('/crowdfunding/config', { public: true }),
      apiFetch<{ campaigns: Campaign[] }>('/crowdfunding/me/campaigns'),
      apiFetch<PayoutReadiness>('/crowdfunding/me/payout-readiness'),
    ])
    setConfig(nextConfig)
    setCampaigns(owned.campaigns)
    setReadiness(nextReadiness)
  }, [])

  useEffect(() => {
    load()
      .catch((err) => setError(err instanceof Error ? err.message : 'No fue posible cargar financiación.'))
      .finally(() => setLoading(false))
  }, [load])

  const totals = useMemo(() => {
    return campaigns.reduce((acc, campaign) => ({
      raised: acc.raised + campaign.raised_amount_cop,
      goal: acc.goal + campaign.goal_amount_cop,
      active: acc.active + (['active', 'funded', 'executing', 'verifying'].includes(campaign.status) ? 1 : 0),
    }), { raised: 0, goal: 0, active: 0 })
  }, [campaigns])

  async function requestReview() {
    setAction('review')
    setActionError(null)
    setNotice(null)
    try {
      const next = await apiFetch<PayoutReadiness>('/crowdfunding/me/payout-readiness/request-review', {
        method: 'POST',
      })
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
      await load()
      setNotice('Campaña activada. Ya puede recibir aportes.')
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
      setNotice('Destino BRE-B confirmado. Los desembolsos solo podrán dirigirse a este destino verificado.')
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
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-10">
        <div className="h-64 animate-pulse rounded-[28px] border border-[#E1E7EF] bg-white" />
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

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-10">
      <header className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.16em] text-[#7B8799]">
            <HandCoins size={15} className="text-[#D39B00]" />
            Financiación de impacto
          </div>
          <h1 className="mt-2 text-3xl font-black tracking-[-.04em] text-[#0A2A66] sm:text-4xl">
            Crowdfunding VÉRTICE
          </h1>
          <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-[#607087]">
            Recauda para causas sociales, comunitarias, culturales y proyectos verificables. El dinero financia ejecución; nunca compra reputación, ranking ni influencia cívica.
          </p>
        </div>
        <Link
          href="/dashboard/crowdfunding/new"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#0A2A66] px-5 text-xs font-black text-white shadow-sm transition hover:bg-[#123C80]"
        >
          <Plus size={16} />
          Crear campaña
        </Link>
      </header>

      {(notice || actionError) && (
        <div className={`mt-6 rounded-2xl border p-4 text-sm font-semibold ${actionError ? 'border-[#F0C7CB] bg-[#FFF7F8] text-[#A51E2D]' : 'border-[#BFDCC7] bg-[#F4FBF6] text-[#236E35]'}`}>
          {actionError ?? notice}
        </div>
      )}

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={CircleDollarSign} label="Recaudado" value={formatCop(totals.raised)} />
        <MetricCard icon={BadgeDollarSign} label="Meta acumulada" value={formatCop(totals.goal)} />
        <MetricCard icon={HandCoins} label="Campañas" value={String(campaigns.length)} />
        <MetricCard icon={Users} label="En operación" value={String(totals.active)} />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_.6fr]">
        <div className="rounded-[28px] border border-[#DCE5EF] bg-white p-6 sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[.14em] text-[#7B8799]">Portafolio propio</div>
              <h2 className="mt-1 text-xl font-black text-[#0A2A66]">Mis campañas</h2>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#DCE5EF] px-4 text-[10px] font-black uppercase tracking-[.06em] text-[#0A2A66]"
            >
              <RefreshCw size={13} />
              Actualizar
            </button>
          </div>

          {campaigns.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-[#C9D6E5] bg-[#F7F9FC] p-7 text-center">
              <HandCoins size={26} className="mx-auto text-[#7B8799]" />
              <div className="mt-3 text-sm font-black text-[#0A2A66]">Aún no tienes campañas</div>
              <p className="mx-auto mt-2 max-w-lg text-xs font-medium leading-5 text-[#607087]">
                Crea un borrador con meta y presupuesto. La campaña pasa por revisión antes de poder recaudar.
              </p>
              <Link href="/dashboard/crowdfunding/new" className="mt-4 inline-flex items-center gap-2 text-xs font-black text-[#0A2A66]">
                Crear la primera
                <ArrowRight size={14} />
              </Link>
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
                          <Pill>{STATUS_LABELS[campaign.status] ?? campaign.status}</Pill>
                          <Pill>{POLICY_LABELS[campaign.funding_policy] ?? campaign.funding_policy}</Pill>
                          <Pill>{COMPLIANCE_LABELS[campaign.compliance_status] ?? campaign.compliance_status}</Pill>
                        </div>
                        <h3 className="mt-3 text-base font-black text-[#0A2A66]">{campaign.title}</h3>
                        <p className="mt-1 line-clamp-2 text-xs font-medium leading-5 text-[#607087]">{campaign.summary}</p>
                      </div>
                      {canActivate && (
                        <button
                          type="button"
                          disabled={action !== null}
                          onClick={() => void activateCampaign(campaign.id)}
                          className="min-h-10 shrink-0 rounded-xl bg-[#2BA745] px-4 text-[10px] font-black uppercase tracking-[.06em] text-white disabled:opacity-60"
                        >
                          {action === `activate:${campaign.id}` ? 'Activando…' : 'Activar recaudo'}
                        </button>
                      )}
                    </div>
                    <div className="mt-5">
                      <div className="flex items-center justify-between text-[10px] font-bold text-[#607087]">
                        <span>{formatCop(campaign.raised_amount_cop)} recaudados</span>
                        <span>{progress}% de {formatCop(campaign.goal_amount_cop)}</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#EAF1FB]">
                        <div className="h-full rounded-full bg-[#0A2A66]" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <section className="rounded-[26px] border border-[#DCE5EF] bg-white p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E8F5EC] text-[#238A3B]">
                <ShieldCheck size={19} />
              </span>
              <div>
                <div className="text-[10px] font-black uppercase tracking-[.12em] text-[#7B8799]">Recaudo y compliance</div>
                <h2 className="text-sm font-black text-[#0A2A66]">Estado operativo</h2>
              </div>
            </div>

            <div className="mt-5 space-y-3 text-xs">
              <StatusRow label="Identidad" value={readiness.identity_verified ? 'Verificada' : 'Pendiente'} ok={readiness.identity_verified} />
              <StatusRow label="Perfil de recaudo" value={readiness.verification_status.replaceAll('_', ' ')} ok={readiness.verification_status === 'verified'} />
              <StatusRow label="Desembolsos" value={readiness.payout_status.replaceAll('_', ' ')} ok={readiness.payout_status === 'eligible'} />
            </div>

            {readiness.review_notes && (
              <div className="mt-4 rounded-xl bg-[#FFF8DF] p-3 text-[11px] font-semibold leading-5 text-[#6C5B21]">
                {readiness.review_notes}
              </div>
            )}

            {readiness.can_request_review && (
              <button
                type="button"
                disabled={action !== null}
                onClick={() => void requestReview()}
                className="mt-5 w-full rounded-xl bg-[#0A2A66] px-4 py-3 text-[10px] font-black uppercase tracking-[.07em] text-white disabled:opacity-60"
              >
                {action === 'review' ? 'Enviando…' : 'Solicitar habilitación de recaudo'}
              </button>
            )}

            {!readiness.identity_verified && (
              <Link href="/dashboard/identity" className="mt-5 inline-flex items-center gap-2 text-xs font-black text-[#0A2A66]">
                Verificar identidad
                <ArrowRight size={14} />
              </Link>
            )}
          </section>

          <section className="rounded-[26px] border border-[#DCE5EF] bg-white p-6">
            <div className="flex items-center gap-3">
              <Landmark size={20} className="text-[#0A2A66]" />
              <h2 className="text-sm font-black text-[#0A2A66]">Destino BRE-B</h2>
            </div>
            <p className="mt-3 text-xs font-medium leading-5 text-[#607087]">
              VÉRTICE resuelve la llave con el proveedor antes de guardarla. Confirma titular y entidad; la plataforma no almacena la llave como destino libre para administradores.
            </p>

            <div className="mt-4 space-y-3">
              <select
                value={brebKeyType}
                onChange={(event) => {
                  setBrebKeyType(event.target.value as BrebKeyType)
                  setBrebPreview(null)
                }}
                className="min-h-11 w-full rounded-xl border border-[#DCE5EF] bg-white px-3 text-xs font-bold text-[#0A2A66] outline-none focus:border-[#8EACD2]"
              >
                {(Object.keys(BREB_LABELS) as BrebKeyType[]).map((type) => (
                  <option key={type} value={type}>{BREB_LABELS[type]}</option>
                ))}
              </select>
              <input
                value={brebKey}
                onChange={(event) => {
                  setBrebKey(event.target.value)
                  setBrebPreview(null)
                }}
                placeholder={brebKeyType === 'PHONE' ? '3XXXXXXXXX' : 'Ingresa tu llave BRE-B'}
                className="min-h-11 w-full rounded-xl border border-[#DCE5EF] px-3 text-xs font-semibold text-[#0A2A66] outline-none placeholder:text-[#9AA5B4] focus:border-[#8EACD2]"
              />
              <button
                type="button"
                disabled={!brebKey.trim() || action !== null}
                onClick={() => void previewBrebDestination()}
                className="w-full rounded-xl border border-[#BFD0E8] px-4 py-3 text-[10px] font-black uppercase tracking-[.06em] text-[#0A2A66] disabled:opacity-50"
              >
                {action === 'breb-preview' ? 'Consultando…' : 'Verificar destino'}
              </button>
            </div>

            {brebPreview && (
              <div className="mt-4 rounded-2xl border border-[#BFDCC7] bg-[#F4FBF6] p-4">
                <div className="flex items-start gap-2">
                  <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-[#238A3B]" />
                  <div>
                    <div className="text-xs font-black text-[#174D27]">{brebPreview.holderName}</div>
                    <div className="mt-1 text-[11px] font-semibold text-[#397348]">
                      {brebPreview.financialEntity.name} · {brebPreview.keyValue}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={action !== null}
                  onClick={() => void confirmBrebDestination()}
                  className="mt-4 w-full rounded-xl bg-[#238A3B] px-4 py-3 text-[10px] font-black uppercase tracking-[.06em] text-white disabled:opacity-60"
                >
                  {action === 'breb-confirm' ? 'Confirmando…' : 'Confirmar como destino de desembolso'}
                </button>
              </div>
            )}
          </section>
        </div>
      </section>

      <section className="mt-6 rounded-[28px] border border-[#DCE5EF] bg-[#F7F9FC] p-6 sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[.8fr_1.2fr] lg:items-start">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[.14em] text-[#7B8799]">Política vigente · {config.feePolicy.version}</div>
            <h2 className="mt-2 text-xl font-black text-[#0A2A66]">Flexibilidad con reglas visibles</h2>
            <p className="mt-2 text-xs font-medium leading-5 text-[#607087]">
              La financiación flexible permite retirar saldo liquidado antes de alcanzar la meta. Recompensas y preventas parten de todo-o-nada. Las contribuciones pendientes no bloquean el saldo ya liquidado.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <PolicyCard title="Social / emergencia" value={`${config.feePolicy.socialEmergencyVerifiedPercent}%`} text="Campañas verificadas" />
            <PolicyCard title="Donación estándar" value={`${config.feePolicy.standardDonationPercent}%`} text="Comisión de plataforma" />
            <PolicyCard title="Recompensa / preventa" value={`${config.feePolicy.rewardPrepurchasePercent}%`} text="Todo-o-nada por defecto" />
          </div>
        </div>
        <div className="mt-5 flex items-start gap-2 rounded-2xl bg-white p-4 text-[11px] font-semibold leading-5 text-[#607087]">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-[#D39B00]" />
          La propina a VÉRTICE es opcional y el costo de procesamiento del proveedor de pagos se mantiene separado de la comisión de plataforma.
        </div>
      </section>
    </div>
  )
}

function MetricCard({ icon: Icon, label, value }: { icon: typeof HandCoins; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#DCE5EF] bg-white p-5">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-black uppercase tracking-[.12em] text-[#7B8799]">{label}</span>
        <Icon size={17} className="text-[#8AA0BB]" />
      </div>
      <div className="mt-3 text-xl font-black tracking-[-.025em] text-[#0A2A66]">{value}</div>
    </div>
  )
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-[#EEF3F8] px-2.5 py-1 text-[9px] font-black uppercase tracking-[.06em] text-[#53647A]">
      {children}
    </span>
  )
}

function StatusRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-[#F7F9FC] px-3 py-2.5">
      <span className="font-semibold text-[#607087]">{label}</span>
      <span className={`font-black capitalize ${ok ? 'text-[#238A3B]' : 'text-[#8A6B00]'}`}>{value}</span>
    </div>
  )
}

function PolicyCard({ title, value, text }: { title: string; value: string; text: string }) {
  return (
    <div className="rounded-2xl border border-[#DCE5EF] bg-white p-4">
      <div className="text-[9px] font-black uppercase tracking-[.08em] text-[#7B8799]">{title}</div>
      <div className="mt-2 text-2xl font-black text-[#0A2A66]">{value}</div>
      <div className="mt-1 text-[10px] font-semibold text-[#607087]">{text}</div>
const POLICY_LABELS: Record<string, string> = {
  flexible: 'Flexible',
  all_or_nothing: 'Todo o nada',
  milestone: 'Por hitos',
}

function formatCop(value: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)
}

export default function CrowdfundingDashboardPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [categories, setCategories] = useState<CategoryDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    Promise.all([
      apiFetch<CampaignsResponse>('/crowdfunding/me/campaigns'),
      apiFetch<ConfigResponse>('/crowdfunding/config'),
    ])
      .then(([campaignResponse, config]) => {
        if (!active) return
        setCampaigns(campaignResponse.campaigns)
        setCategories(config.categoryCatalog ?? [])
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'No fue posible cargar tus campañas.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const categoryLabels = useMemo(
    () => new Map(categories.map((category) => [category.id, category.label])),
    [categories],
  )

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      <section className="overflow-hidden rounded-[28px] border border-[#DCE5EF] bg-white shadow-[0_18px_55px_rgba(10,42,102,.07)]">
        <div className="h-1.5 bg-[linear-gradient(90deg,#F5B700_0_33%,#4A90E2_33%_66%,#D72638_66%)]" />
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.15em] text-[#246CB6]"><HandCoins size={14} /> Recaudo comunitario</div>
            <h1 className="mt-2 text-2xl font-extrabold tracking-[-.03em] text-[#0A2A66] sm:text-3xl">Financia acciones verificables, no promesas financieras.</h1>
            <p className="mt-3 text-sm font-medium leading-7 text-[#607087]">Crea campañas de donación o recompensa con presupuesto, categoría y política de recaudo. Antes de recibir dinero, cada campaña debe superar controles de identidad, cumplimiento y habilitación financiera.</p>
          </div>
          <Link href="/dashboard/crowdfunding/new" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#0A2A66] px-5 text-xs font-extrabold text-white shadow-sm hover:bg-[#123B7A]">
            <Plus size={16} /> Crear campaña
          </Link>
        </div>
      </section>

      <div className="mt-5 rounded-2xl border border-[#D7E5DA] bg-[#F2F8F3] p-4 text-[11px] font-semibold leading-6 text-[#46624C]">
        <div className="flex items-start gap-2"><ShieldCheck size={16} className="mt-1 shrink-0 text-[#2BA745]" /><span>El dinero recaudado, el método de pago, una suscripción o una donación no aumentan reputación ni ranking cívico. Las campañas de inversión, deuda, reparto de utilidades, venta de tokens o rentabilidad prometida están excluidas.</span></div>
      </div>

      {error && <div className="mt-5 rounded-2xl border border-[#F1C8CE] bg-[#FCEBED] p-4 text-sm font-semibold text-[#A91D2E]">{error}</div>}

      {loading ? (
        <div className="mt-8 flex items-center justify-center gap-2 py-14 text-sm font-semibold text-[#607087]"><Loader2 size={18} className="animate-spin" /> Cargando campañas…</div>
      ) : campaigns.length === 0 ? (
        <section className="mt-6 rounded-[24px] border border-dashed border-[#C8D5E5] bg-white p-8 text-center">
          <HandCoins size={30} className="mx-auto text-[#4A90E2]" />
          <h2 className="mt-4 text-lg font-extrabold text-[#0A2A66]">Aún no tienes campañas</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm font-medium leading-6 text-[#607087]">Empieza seleccionando la categoría correcta. La plataforma adaptará la política sugerida de recaudo y exigirá un presupuesto trazable antes de guardar el borrador.</p>
          <Link href="/dashboard/crowdfunding/new" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#F5B700] px-5 text-xs font-extrabold text-[#0A2A66]">Crear primera campaña <ArrowRight size={14} /></Link>
        </section>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {campaigns.map((campaign) => {
            const progress = campaign.goal_amount_cop > 0 ? Math.min(100, Math.round((campaign.raised_amount_cop / campaign.goal_amount_cop) * 100)) : 0
            return (
              <article key={campaign.id} className="rounded-[24px] border border-[#DCE5EF] bg-white p-5 shadow-[0_10px_30px_rgba(10,42,102,.05)]">
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.08em]">
                  <span className="rounded-full bg-[#EAF1FB] px-2.5 py-1 text-[#246CB6]">{categoryLabels.get(campaign.category) ?? campaign.category}</span>
                  <span className="rounded-full bg-[#F7F9FC] px-2.5 py-1 text-[#607087]">{STATUS_LABELS[campaign.status] ?? campaign.status}</span>
                  <span className="rounded-full bg-[#FFF6D6] px-2.5 py-1 text-[#806100]">{POLICY_LABELS[campaign.funding_policy] ?? campaign.funding_policy}</span>
                </div>
                <h2 className="mt-4 text-lg font-extrabold text-[#0A2A66]">{campaign.title}</h2>
                <p className="mt-2 line-clamp-2 text-sm font-medium leading-6 text-[#607087]">{campaign.summary}</p>
                <div className="mt-5 flex items-end justify-between gap-4">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[.08em] text-[#8A96A6]">Recaudado</div>
                    <div className="mt-1 text-lg font-extrabold text-[#0A2A66]">{formatCop(campaign.raised_amount_cop)}</div>
                    <div className="text-[11px] font-semibold text-[#7B8799]">Meta {formatCop(campaign.goal_amount_cop)}</div>
                  </div>
                  <div className="text-right text-xs font-extrabold text-[#246CB6]">{progress}%</div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#EDF2F7]"><div className="h-full rounded-full bg-[#4A90E2]" style={{ width: `${progress}%` }} /></div>
                <div className="mt-4 text-[10px] font-semibold text-[#7B8799]">Cumplimiento: {campaign.compliance_status === 'verified' ? 'verificado' : 'pendiente de revisión'}{campaign.neighborhood ? ` · ${campaign.neighborhood}` : ''}</div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
