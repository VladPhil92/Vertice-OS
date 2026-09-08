'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, GitBranch, HandCoins, ShieldCheck, WalletCards } from 'lucide-react'
import { apiFetch } from '@/lib/api'

type Campaign = {
  id: string
  title: string
  status: string
  compliance_status: string
}

type PayoutReadiness = {
  identity_verified: boolean
  verification_status: string
  payout_status: string
  can_request_review: boolean
  can_activate_campaign: boolean
}

type BillingAccess = {
  plan: { code: 'free' | 'pro' }
  subscription: null | {
    status: string
    currentPeriodEnd: string | null
    cancelAtPeriodEnd: boolean
  }
}

type CivicCase = {
  id: string
  stage: string
  report: { title: string }
}

type AttentionItem = {
  id: string
  priority: 0 | 1 | 2
  label: string
  detail: string
  href: string
  icon: typeof HandCoins
}

async function optional<T>(path: string): Promise<T | null> {
  try {
    return await apiFetch<T>(path)
  } catch {
    return null
  }
}

export function DashboardOperationalAttention() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [readiness, setReadiness] = useState<PayoutReadiness | null>(null)
  const [billing, setBilling] = useState<BillingAccess | null>(null)
  const [cases, setCases] = useState<CivicCase[]>([])

  useEffect(() => {
    let active = true
    Promise.all([
      optional<{ campaigns: Campaign[] }>('/crowdfunding/me/campaigns'),
      optional<PayoutReadiness>('/crowdfunding/me/payout-readiness'),
      optional<BillingAccess>('/billing/me'),
      optional<{ data: CivicCase[] }>('/workflows/cases?limit=25'),
    ]).then(([campaignResponse, payoutResponse, billingResponse, workflowResponse]) => {
      if (!active) return
      setCampaigns(campaignResponse?.campaigns ?? [])
      setReadiness(payoutResponse)
      setBilling(billingResponse)
      setCases(workflowResponse?.data ?? [])
    })
    return () => { active = false }
  }, [])

  const items = useMemo(() => {
    const next: AttentionItem[] = []
    const hasCampaigns = campaigns.length > 0
    const verifiedCampaigns = campaigns.filter((campaign) => campaign.status === 'verified')
    const campaignsInReview = campaigns.filter((campaign) => ['pending', 'in_review'].includes(campaign.compliance_status))

    if (hasCampaigns && readiness && !readiness.identity_verified) {
      next.push({
        id: 'crowdfunding-identity',
        priority: 0,
        label: 'Verifica tu identidad para habilitar recaudo',
        detail: 'Tus campañas no pueden activarse hasta completar la verificación de identidad.',
        href: '/dashboard/identity',
        icon: ShieldCheck,
      })
    } else if (hasCampaigns && readiness?.can_request_review) {
      next.push({
        id: 'crowdfunding-readiness',
        priority: 0,
        label: 'Solicita habilitación de recaudo',
        detail: 'Tu identidad está lista; falta la revisión del perfil de recaudo y desembolso.',
        href: '/dashboard/crowdfunding',
        icon: WalletCards,
      })
    } else if (verifiedCampaigns.length > 0 && readiness?.can_activate_campaign) {
      next.push({
        id: 'crowdfunding-activation',
        priority: 1,
        label: 'Tienes campañas listas para activar',
        detail: `${verifiedCampaigns.length} campaña${verifiedCampaigns.length === 1 ? '' : 's'} ya superó la revisión y puede iniciar recaudo.`,
        href: '/dashboard/crowdfunding',
        icon: HandCoins,
      })
    } else if (campaignsInReview.length > 0) {
      next.push({
        id: 'crowdfunding-review',
        priority: 2,
        label: 'Campañas en revisión',
        detail: `${campaignsInReview.length} campaña${campaignsInReview.length === 1 ? '' : 's'} espera validación de cumplimiento.`,
        href: '/dashboard/crowdfunding',
        icon: HandCoins,
      })
    }

    const activeCases = cases.filter((item) => item.stage !== 'decision')
    if (activeCases.length > 0) {
      next.push({
        id: 'workflows',
        priority: 2,
        label: 'Expedientes cívicos en curso',
        detail: `${activeCases.length} expediente${activeCases.length === 1 ? '' : 's'} conserva un siguiente paso de gestión.`,
        href: '/dashboard/workflows',
        icon: GitBranch,
      })
    }

    if (billing?.plan.code === 'pro' && billing.subscription?.cancelAtPeriodEnd) {
      next.push({
        id: 'billing-renewal',
        priority: 2,
        label: 'Tu renovación Pro está cancelada',
        detail: 'El acceso se mantiene hasta el cierre del periodo actual. Revisa tu estado de facturación.',
        href: '/dashboard/billing',
        icon: WalletCards,
      })
    }

    return next.sort((a, b) => a.priority - b.priority).slice(0, 3)
  }, [billing, campaigns, cases, readiness])

  if (items.length === 0) return null

  return (
    <section data-testid="dashboard-operational-attention" className="mx-auto w-full max-w-7xl px-4 pt-5 sm:px-6 lg:px-8 lg:pt-7">
      <div className="rounded-[22px] border border-[#D9E4F1] bg-white p-4 shadow-[0_12px_35px_rgba(10,42,102,.05)] sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[9px] font-extrabold uppercase tracking-[.14em] text-[#7B8799]">Atención operativa</div>
            <div className="mt-1 text-sm font-extrabold text-[#0A2A66]">Pendientes que cruzan tus módulos</div>
          </div>
          <div className="text-[10px] font-semibold text-[#7B8799]">Priorizados por bloqueo y siguiente paso</div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {items.map((item) => {
            const Icon = item.icon
            return (
              <Link key={item.id} href={item.href} className="group rounded-2xl border border-[#E1E7EF] bg-[#F9FBFD] p-4 transition hover:border-[#BFD0E8] hover:bg-white">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EAF1FB] text-[#0A2A66]">
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-extrabold text-[#0A2A66]">{item.label}</div>
                    <p className="mt-1 text-[10px] font-medium leading-5 text-[#607087]">{item.detail}</p>
                    <div className="mt-2 inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-[.06em] text-[#246CB6]">
                      Resolver <ArrowRight size={11} className="transition group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
