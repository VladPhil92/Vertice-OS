'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, Crown, ShieldCheck, Sparkles } from 'lucide-react'
import { apiFetch } from '@/lib/api'

type BillingAccess = {
  plan: {
    code: 'free' | 'pro'
    name: string
    description: string
    priceCop: { monthly: number; annual: number }
    entitlements: string[]
    limits: {
      activeProjects: number
      evidenceStorageMb: number
      aiRequestsPerMonth: number
      scheduledPostsPerMonth: number
    }
  }
  subscription: null | {
    id: string
    status: string
    billingCycle: 'monthly' | 'annual' | null
    provider: string | null
    currentPeriodStart: string | null
    currentPeriodEnd: string | null
    cancelAtPeriodEnd: boolean
  }
  reputationNeutrality: Record<string, boolean>
}

const ENTITLEMENT_LABELS: Record<string, string> = {
  'civic:core': 'Participación cívica esencial',
  'community:participation': 'Red y comunidad',
  'reputation:core': 'Reputación cívica completa',
  'crowdfunding:contribute': 'Aportes a causas',
  'projects:extended': 'Capacidad ampliada de proyectos',
  'analytics:advanced': 'Analítica avanzada',
  'exports:reports': 'Reportes y exportaciones',
  'ai:extended': 'Mayor capacidad de IA',
  'publishing:automation': 'Automatización de publicaciones',
  'crowdfunding:analytics': 'Analítica de crowdfunding',
}

function formatCop(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(value: string | null) {
  if (!value) return 'Sin fecha definida'
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value))
}

export default function BillingPage() {
  const [access, setAccess] = useState<BillingAccess | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiFetch<BillingAccess>('/billing/me')
      .then(setAccess)
      .catch((err) => setError(err instanceof Error ? err.message : 'No fue posible consultar tu plan.'))
  }, [])

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
        <div className="rounded-3xl border border-[#F0C7CB] bg-[#FFF7F8] p-7 text-sm font-semibold text-[#A51E2D]">{error}</div>
      </div>
    )
  }

  if (!access) {
    return (
      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
        <div className="h-52 animate-pulse rounded-3xl border border-[#E1E7EF] bg-white" />
      </div>
    )
  }

  const isPro = access.plan.code === 'pro'

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-10">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[.16em] text-[#7B8799]">Cuenta · Suscripción</div>
          <h1 className="mt-2 text-3xl font-black tracking-[-.035em] text-[#0A2A66] sm:text-4xl">Tu plan VÉRTICE</h1>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#607087]">
            La suscripción amplía herramientas y capacidad operativa. Nunca modifica reputación, ranking, voto o credibilidad cívica.
          </p>
        </div>
        <Link href="/pricing" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#BFD0E8] bg-white px-5 text-xs font-black text-[#0A2A66] transition hover:bg-[#F7F9FC]">
          Comparar planes
          <ArrowRight size={15} />
        </Link>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
        <section className={`rounded-[28px] border p-7 sm:p-8 ${isPro ? 'border-[#0A2A66] bg-[#0A2A66] text-white' : 'border-[#DCE5EF] bg-white text-[#0A2A66]'}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className={`text-[10px] font-black uppercase tracking-[.15em] ${isPro ? 'text-[#BFD0E8]' : 'text-[#7B8799]'}`}>Plan actual</div>
              <div className="mt-3 flex items-center gap-3">
                <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${isPro ? 'bg-[#F5B700] text-[#0A2A66]' : 'bg-[#EAF1FB] text-[#0A2A66]'}`}>
                  {isPro ? <Crown size={21} /> : <Sparkles size={20} />}
                </span>
                <h2 className="text-2xl font-black">{access.plan.name}</h2>
              </div>
            </div>
            <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[.1em] ${isPro ? 'bg-white/10 text-white' : 'bg-[#E8F5EC] text-[#238A3B]'}`}>
              {access.subscription?.status ?? 'activo'}
            </span>
          </div>

          <p className={`mt-5 text-sm font-medium leading-6 ${isPro ? 'text-white/70' : 'text-[#607087]'}`}>{access.plan.description}</p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            {access.plan.entitlements.map((entitlement) => (
              <div key={entitlement} className={`flex items-start gap-2 rounded-xl p-3 text-xs font-bold ${isPro ? 'bg-white/[.07] text-white/85' : 'bg-[#F7F9FC] text-[#43506A]'}`}>
                <CheckCircle2 size={15} className={isPro ? 'text-[#F5B700]' : 'text-[#2BA745]'} />
                {ENTITLEMENT_LABELS[entitlement] ?? entitlement}
              </div>
            ))}
          </div>

          <div className={`mt-7 grid gap-3 border-t pt-6 sm:grid-cols-4 ${isPro ? 'border-white/10' : 'border-[#E1E7EF]'}`}>
            <Metric label="Proyectos" value={`${access.plan.limits.activeProjects}`} muted={isPro} />
            <Metric label="Evidencias" value={`${Math.round(access.plan.limits.evidenceStorageMb / 1000 * 10) / 10} GB`} muted={isPro} />
            <Metric label="IA / mes" value={`${access.plan.limits.aiRequestsPerMonth}`} muted={isPro} />
            <Metric label="Programaciones" value={`${access.plan.limits.scheduledPostsPerMonth}`} muted={isPro} />
          </div>

          {!isPro && (
            <div className="mt-7 flex flex-col gap-3 rounded-2xl bg-[#FFF8DF] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-black text-[#0A2A66]">VÉRTICE Pro · {formatCop(15_000)}/mes</div>
                <div className="mt-1 text-xs font-semibold text-[#6C5B21]">O {formatCop(150_000)} al año.</div>
              </div>
              <Link href="/pricing" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#0A2A66] px-4 text-[11px] font-black text-white">
                Ver Pro <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </section>

        <div className="space-y-6">
          <section className="rounded-[24px] border border-[#DCE5EF] bg-white p-6">
            <div className="flex items-center gap-3">
              <ShieldCheck size={20} className="text-[#2BA745]" />
              <h2 className="text-base font-black text-[#0A2A66]">Separación de reputación</h2>
            </div>
            <p className="mt-3 text-xs font-medium leading-6 text-[#607087]">
              Pagar Pro, donar o recaudar fondos no genera puntos. La reputación sigue dependiendo exclusivamente de señales cívicas y evidencia verificable.
            </p>
          </section>

          <section className="rounded-[24px] border border-[#DCE5EF] bg-white p-6">
            <h2 className="text-base font-black text-[#0A2A66]">Estado de facturación</h2>
            {access.subscription ? (
              <dl className="mt-4 space-y-3 text-xs">
                <BillingRow label="Ciclo" value={access.subscription.billingCycle === 'annual' ? 'Anual' : 'Mensual'} />
                <BillingRow label="Proveedor" value={access.subscription.provider ?? 'No informado'} />
                <BillingRow label="Vigencia" value={formatDate(access.subscription.currentPeriodEnd)} />
                <BillingRow label="Renovación" value={access.subscription.cancelAtPeriodEnd ? 'Se cancelará al cierre' : 'Activa'} />
              </dl>
            ) : (
              <p className="mt-3 text-xs font-medium leading-6 text-[#607087]">
                Free no requiere medio de pago ni registro de suscripción.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value, muted }: { label: string; value: string; muted: boolean }) {
  return (
    <div>
      <div className={`text-[9px] font-black uppercase tracking-[.1em] ${muted ? 'text-white/45' : 'text-[#9AA5B4]'}`}>{label}</div>
      <div className={`mt-1 text-lg font-black ${muted ? 'text-white' : 'text-[#0A2A66]'}`}>{value}</div>
    </div>
  )
}

function BillingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#EEF2F6] pb-3 last:border-0 last:pb-0">
      <dt className="font-semibold text-[#7B8799]">{label}</dt>
      <dd className="text-right font-black text-[#0A2A66]">{value}</dd>
    </div>
  )
}
