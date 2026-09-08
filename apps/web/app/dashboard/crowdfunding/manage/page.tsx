'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, HandCoins, Loader2, RefreshCw } from 'lucide-react'
import { apiFetch } from '@/lib/api'

type FundingPolicy = 'flexible' | 'all_or_nothing' | 'milestone'

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
  neighborhood: string | null
  updated_at: string
}

type CategoryDefinition = { id: string; label: string }
type ConfigResponse = { categoryCatalog: CategoryDefinition[] }

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador', review: 'En revisión', verified: 'Lista para activar', active: 'Recaudando',
  funded: 'Meta alcanzada', executing: 'En ejecución', verifying: 'Verificando impacto',
  completed: 'Completada', suspended: 'Suspendida', investigation: 'En investigación',
}

function formatCop(value: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)
}

export default function ManageCrowdfundingCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [config, setConfig] = useState<ConfigResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [owned, nextConfig] = await Promise.all([
        apiFetch<{ campaigns: Campaign[] }>('/crowdfunding/me/campaigns'),
        apiFetch<ConfigResponse>('/crowdfunding/config'),
      ])
      setCampaigns(owned.campaigns)
      setConfig(nextConfig)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar tus campañas.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const categoryLabels = useMemo(
    () => new Map((config?.categoryCatalog ?? []).map((item) => [item.id, item.label])),
    [config],
  )

  if (loading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 size={22} className="animate-spin text-[#4A90E2]" /></div>
  }

  return (
    <div data-testid="crowdfunding-campaign-manager" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
      <section className="rounded-[28px] bg-[#0A2A66] p-6 text-white sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#F5B700]">Lifecycle</div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-.035em]">Gestiona cada campaña por estado.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/70">Edita borradores, responde observaciones, envía revisiones y consulta el historial de decisiones. Una campaña enviada a revisión queda bloqueada para edición hasta que exista una decisión.</p>
          </div>
          <button type="button" onClick={() => void load()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-xs font-extrabold"><RefreshCw size={14} /> Actualizar</button>
        </div>
      </section>

      {error && <div className="mt-5 rounded-2xl border border-[#F0C7CB] bg-[#FFF7F8] p-4 text-sm font-semibold text-[#A51E2D]">{error}</div>}

      {campaigns.length === 0 ? (
        <div className="mt-6 rounded-[26px] border border-dashed border-[#C9D6E5] bg-white p-10 text-center">
          <HandCoins size={28} className="mx-auto text-[#4A90E2]" />
          <h2 className="mt-4 text-lg font-extrabold text-[#0A2A66]">No hay campañas todavía</h2>
          <Link href="/dashboard/crowdfunding/new" className="mt-5 inline-flex items-center gap-2 text-xs font-extrabold text-[#0A2A66]">Crear campaña <ArrowRight size={14} /></Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {campaigns.map((campaign) => {
            const progress = campaign.goal_amount_cop > 0
              ? Math.min(100, Math.round((campaign.raised_amount_cop / campaign.goal_amount_cop) * 100))
              : 0
            return (
              <article key={campaign.id} className="rounded-[24px] border border-[#DCE5EF] bg-white p-5 shadow-[0_10px_30px_rgba(10,42,102,.04)]">
                <div className="flex flex-wrap gap-2 text-[9px] font-extrabold uppercase tracking-[.05em] text-[#607087]">
                  <span className="rounded-full bg-[#EEF3F8] px-2.5 py-1">{categoryLabels.get(campaign.category) ?? campaign.category}</span>
                  <span className="rounded-full bg-[#FFF8DF] px-2.5 py-1">{STATUS_LABELS[campaign.status] ?? campaign.status}</span>
                  <span className="rounded-full bg-[#F7F9FC] px-2.5 py-1">{campaign.compliance_status.replaceAll('_', ' ')}</span>
                </div>
                <h2 className="mt-4 text-lg font-extrabold text-[#0A2A66]">{campaign.title}</h2>
                <p className="mt-2 line-clamp-2 text-xs font-medium leading-5 text-[#607087]">{campaign.summary}</p>
                <div className="mt-5 flex items-center justify-between text-[10px] font-bold text-[#607087]"><span>{formatCop(campaign.raised_amount_cop)}</span><span>{progress}% de {formatCop(campaign.goal_amount_cop)}</span></div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#EDF2F7]"><div className="h-full rounded-full bg-[#4A90E2]" style={{ width: `${progress}%` }} /></div>
                <Link href={`/dashboard/crowdfunding/${campaign.id}`} className="mt-5 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#0A2A66] px-4 text-[10px] font-extrabold uppercase tracking-[.06em] text-white">Gestionar campaña <ArrowRight size={14} /></Link>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
