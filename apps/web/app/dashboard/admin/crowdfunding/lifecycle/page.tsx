'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight, Loader2, RefreshCw, ShieldCheck } from 'lucide-react'
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

type ReviewQueue = { campaigns: CampaignReviewItem[] }

function formatCop(value: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)
}

export default function CrowdfundingLifecycleAdminQueuePage() {
  const [campaigns, setCampaigns] = useState<CampaignReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const queue = await apiFetch<ReviewQueue>('/crowdfunding/admin/review-queue')
      setCampaigns(queue.campaigns)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar la cola de revisión.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 size={22} className="animate-spin text-[#4A90E2]" /></div>

  return (
    <div data-testid="crowdfunding-lifecycle-admin-queue" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
      <section className="rounded-[28px] bg-[#0A2A66] p-6 text-white sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.14em] text-[#F5B700]"><ShieldCheck size={14} /> Gate de revisión</div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-.035em]">Campañas formalmente enviadas.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/70">Solo aparecen campañas en `review/in_review`. Un borrador no puede ser aprobado sin que su creador lo haya enviado primero.</p>
          </div>
          <button type="button" onClick={() => void load()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-xs font-extrabold"><RefreshCw size={14} /> Actualizar</button>
        </div>
      </section>

      {error && <div className="mt-5 rounded-2xl border border-[#F0C7CB] bg-[#FFF7F8] p-4 text-sm font-semibold text-[#A51E2D]">{error}</div>}

      {campaigns.length === 0 ? (
        <div className="mt-6 rounded-[26px] border border-dashed border-[#C9D6E5] bg-white p-10 text-center text-sm font-semibold text-[#607087]">No hay campañas formalmente enviadas a revisión.</div>
      ) : (
        <div className="mt-6 space-y-4">
          {campaigns.map((campaign) => (
            <article key={campaign.id} className="rounded-[24px] border border-[#DCE5EF] bg-white p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-2 text-[9px] font-extrabold uppercase tracking-[.05em] text-[#607087]"><span className="rounded-full bg-[#EEF3F8] px-2.5 py-1">{campaign.category}</span><span className="rounded-full bg-[#FFF8DF] px-2.5 py-1">{campaign.funding_model}</span><span className="rounded-full bg-[#EAF7EE] px-2.5 py-1">{campaign.compliance_status}</span></div>
                  <h2 className="mt-3 text-lg font-extrabold text-[#0A2A66]">{campaign.title}</h2>
                  <div className="mt-2 text-[11px] font-semibold text-[#7B8799]">Meta {formatCop(campaign.goal_amount_cop)} · creador {campaign.creator_citizen_id}</div>
                </div>
                <Link href={`/dashboard/admin/crowdfunding/lifecycle/${campaign.id}`} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#0A2A66] px-5 text-[10px] font-extrabold uppercase tracking-[.06em] text-white">Revisar expediente <ArrowRight size={14} /></Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
