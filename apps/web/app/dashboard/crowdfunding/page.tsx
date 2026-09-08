'use client'

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

type ConfigResponse = { categoryCatalog: CategoryDefinition[] }
type CampaignsResponse = { campaigns: Campaign[] }

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  review: 'En revisión',
  verified: 'Verificada',
  active: 'Activa',
  funded: 'Meta alcanzada',
  executing: 'En ejecución',
  verifying: 'Verificando impacto',
  completed: 'Completada',
  suspended: 'Suspendida',
  investigation: 'En investigación',
}

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
