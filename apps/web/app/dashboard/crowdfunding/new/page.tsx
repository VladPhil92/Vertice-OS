'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CirclePlus, Info, Trash2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'

type FundingPolicy = 'flexible' | 'all_or_nothing' | 'milestone'
type FundingModel = 'donation' | 'reward'

type CrowdfundingConfig = {
  categories: string[]
  fundingModels: FundingModel[]
  fundingPolicies: FundingPolicy[]
  guardrails: {
    flexibleCampaignsCanWithdrawBeforeGoal: boolean
    rewardsDefaultToAllOrNothing: boolean
    requiresComplianceReviewBeforeActivation: boolean
  }
  feePolicy: {
    socialEmergencyVerifiedPercent: number
    standardDonationPercent: number
    rewardPrepurchasePercent: number
  }
}

type BudgetItem = {
  label: string
  amount: string
}

const CATEGORY_LABELS: Record<string, string> = {
  social: 'Causa social',
  emergency: 'Emergencia',
  community: 'Comunidad',
  culture: 'Cultura',
  education: 'Educación',
  environment: 'Medio ambiente',
  animal_welfare: 'Bienestar animal',
  sports: 'Deporte',
  public_space: 'Espacio público',
  technology_civic: 'Tecnología cívica',
  social_entrepreneurship: 'Emprendimiento social',
  heritage: 'Patrimonio',
}

const POLICY_COPY: Record<FundingPolicy, { title: string; text: string }> = {
  flexible: {
    title: 'Flexible',
    text: 'Puedes disponer del saldo liquidado aunque la campaña todavía no alcance la meta.',
  },
  all_or_nothing: {
    title: 'Todo o nada',
    text: 'La campaña se estructura para alcanzar la meta antes de ejecutar el recaudo como proyecto financiado.',
  },
  milestone: {
    title: 'Por hitos',
    text: 'Organiza la financiación y ejecución alrededor de etapas verificables del proyecto.',
  },
}

function parseCop(value: string): number {
  const normalized = value.replace(/[^0-9]/g, '')
  return normalized ? Number(normalized) : 0
}

function formatInputCop(value: string): string {
  const amount = parseCop(value)
  if (!amount) return ''
  return new Intl.NumberFormat('es-CO').format(amount)
}

export default function NewCrowdfundingCampaignPage() {
  const router = useRouter()
  const [config, setConfig] = useState<CrowdfundingConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('community')
  const [fundingModel, setFundingModel] = useState<FundingModel>('donation')
  const [fundingPolicy, setFundingPolicy] = useState<FundingPolicy>('flexible')
  const [goal, setGoal] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [budget, setBudget] = useState<BudgetItem[]>([{ label: '', amount: '' }])

  useEffect(() => {
    apiFetch<CrowdfundingConfig>('/crowdfunding/config', { public: true })
      .then((next) => {
        setConfig(next)
        if (next.categories.length && !next.categories.includes(category)) setCategory(next.categories[0])
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'No fue posible cargar la política de crowdfunding.'))
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const goalAmount = parseCop(goal)
  const budgetTotal = useMemo(
    () => budget.reduce((sum, item) => sum + parseCop(item.amount), 0),
    [budget],
  )
  const budgetFitsGoal = goalAmount > 0 && budgetTotal <= goalAmount

  function changeFundingModel(next: FundingModel) {
    setFundingModel(next)
    if (next === 'reward' && fundingPolicy === 'flexible') {
      setFundingPolicy('all_or_nothing')
    }
  }

  function updateBudget(index: number, field: keyof BudgetItem, value: string) {
    setBudget((current) => current.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [field]: value } : item
    )))
  }

  function removeBudget(index: number) {
    setBudget((current) => current.length === 1 ? current : current.filter((_, itemIndex) => itemIndex !== index))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const cleanBudget = budget.map((item) => ({
      label: item.label.trim(),
      amount_cop: parseCop(item.amount),
    }))

    if (goalAmount < 50_000 || goalAmount > 2_000_000_000) {
      setError('La meta debe estar entre $50.000 y $2.000.000.000 COP.')
      return
    }
    if (budgetTotal > goalAmount) {
      setError('El presupuesto desglosado no puede superar la meta de recaudo.')
      return
    }

    setSubmitting(true)
    try {
      await apiFetch('/crowdfunding/campaigns', {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({
          title: title.trim(),
          summary: summary.trim(),
          description: description.trim(),
          category,
          funding_model: fundingModel,
          funding_policy: fundingPolicy,
          goal_amount_cop: goalAmount,
          ...(neighborhood.trim() ? { neighborhood: neighborhood.trim() } : {}),
          budget: cleanBudget,
        }),
      })
      router.push('/dashboard/crowdfunding')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible crear la campaña.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:py-10">
        <div className="h-72 animate-pulse rounded-[28px] border border-[#E1E7EF] bg-white" />
      </div>
    )
  }

  if (!config) {
    return (
      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
        <div className="rounded-3xl border border-[#F0C7CB] bg-[#FFF7F8] p-7 text-sm font-semibold text-[#A51E2D]">
          {error ?? 'No fue posible cargar las reglas de crowdfunding.'}
        </div>
      </div>
    )
  }

  const estimatedPlatformFee = fundingModel === 'reward'
    ? config.feePolicy.rewardPrepurchasePercent
    : (category === 'social' || category === 'emergency')
      ? config.feePolicy.socialEmergencyVerifiedPercent
      : config.feePolicy.standardDonationPercent

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-10">
      <Link href="/dashboard/crowdfunding" className="inline-flex items-center gap-2 text-xs font-black text-[#607087] hover:text-[#0A2A66]">
        <ArrowLeft size={15} />
        Volver a financiación
      </Link>

      <div className="mt-5 grid gap-7 lg:grid-cols-[1fr_320px]">
        <form onSubmit={submit} className="rounded-[30px] border border-[#DCE5EF] bg-white p-6 sm:p-8">
          <div className="text-[10px] font-black uppercase tracking-[.16em] text-[#7B8799]">Nueva campaña</div>
          <h1 className="mt-2 text-3xl font-black tracking-[-.04em] text-[#0A2A66]">Define una causa financiable</h1>
          <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-[#607087]">
            La claridad del propósito, la meta y el presupuesto facilita la revisión y permite que la comunidad entienda exactamente qué está financiando.
          </p>

          {error && (
            <div className="mt-5 rounded-2xl border border-[#F0C7CB] bg-[#FFF7F8] p-4 text-sm font-semibold text-[#A51E2D]">
              {error}
            </div>
          )}

          <div className="mt-7 grid gap-5">
            <Field label="Título" hint={`${title.length}/120`}>
              <input
                required
                minLength={8}
                maxLength={120}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ej. Recuperemos el parque de nuestro barrio"
                className={inputClass}
              />
            </Field>

            <Field label="Resumen" hint={`${summary.length}/280`}>
              <textarea
                required
                minLength={20}
                maxLength={280}
                rows={3}
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                placeholder="Explica en pocas palabras qué quieres lograr y para quién."
                className={inputClass}
              />
            </Field>

            <Field label="Descripción completa" hint={`${description.length}/8000`}>
              <textarea
                required
                minLength={80}
                maxLength={8000}
                rows={7}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe el problema, la solución, beneficiarios, plan de ejecución y cómo demostrarás los resultados."
                className={inputClass}
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Categoría">
                <select value={category} onChange={(event) => setCategory(event.target.value)} className={inputClass}>
                  {config.categories.map((item) => (
                    <option key={item} value={item}>{CATEGORY_LABELS[item] ?? item.replaceAll('_', ' ')}</option>
                  ))}
                </select>
              </Field>
              <Field label="Barrio o sector" hint="Opcional">
                <input
                  maxLength={120}
                  value={neighborhood}
                  onChange={(event) => setNeighborhood(event.target.value)}
                  placeholder="Ej. Manga"
                  className={inputClass}
                />
              </Field>
            </div>

            <div>
              <div className="text-xs font-black text-[#0A2A66]">Modelo de financiación</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <ChoiceCard
                  active={fundingModel === 'donation'}
                  title="Donación"
                  text="Aportes sin contraprestación económica. Ideal para causas y proyectos de impacto."
                  onClick={() => changeFundingModel('donation')}
                />
                <ChoiceCard
                  active={fundingModel === 'reward'}
                  title="Recompensa / preventa"
                  text="El aporte contempla una recompensa o entrega vinculada a la campaña."
                  onClick={() => changeFundingModel('reward')}
                />
              </div>
            </div>

            <div>
              <div className="text-xs font-black text-[#0A2A66]">Política de financiación</div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {config.fundingPolicies.map((policy) => {
                  const disabled = fundingModel === 'reward' && policy === 'flexible'
                  return (
                    <ChoiceCard
                      key={policy}
                      active={fundingPolicy === policy}
                      disabled={disabled}
                      title={POLICY_COPY[policy].title}
                      text={POLICY_COPY[policy].text}
                      onClick={() => !disabled && setFundingPolicy(policy)}
                    />
                  )
                })}
              </div>
            </div>

            <Field label="Meta de recaudo" hint="Mínimo $50.000 COP">
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-[#7B8799]">$</span>
                <input
                  required
                  inputMode="numeric"
                  value={formatInputCop(goal)}
                  onChange={(event) => setGoal(event.target.value)}
                  placeholder="1.000.000"
                  className={`${inputClass} pl-8`}
                />
              </div>
            </Field>

            <div>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-xs font-black text-[#0A2A66]">Presupuesto desglosado</div>
                  <div className="mt-1 text-[10px] font-semibold text-[#7B8799]">Debe explicar el uso previsto de los fondos.</div>
                </div>
                <button
                  type="button"
                  onClick={() => setBudget((current) => [...current, { label: '', amount: '' }])}
                  className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[.06em] text-[#0A2A66]"
                >
                  <CirclePlus size={14} />
                  Agregar rubro
                </button>
              </div>

              <div className="mt-3 space-y-3">
                {budget.map((item, index) => (
                  <div key={index} className="grid gap-2 sm:grid-cols-[1fr_180px_40px]">
                    <input
                      required
                      minLength={3}
                      maxLength={120}
                      value={item.label}
                      onChange={(event) => updateBudget(index, 'label', event.target.value)}
                      placeholder="Ej. Materiales"
                      className={inputClass}
                    />
                    <input
                      required
                      inputMode="numeric"
                      value={formatInputCop(item.amount)}
                      onChange={(event) => updateBudget(index, 'amount', event.target.value)}
                      placeholder="$ 500.000"
                      className={inputClass}
                    />
                    <button
                      type="button"
                      disabled={budget.length === 1}
                      onClick={() => removeBudget(index)}
                      className="flex min-h-11 items-center justify-center rounded-xl border border-[#E1E7EF] text-[#A51E2D] disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label="Eliminar rubro"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>

              <div className={`mt-3 flex items-center justify-between rounded-xl px-4 py-3 text-xs font-bold ${budgetFitsGoal ? 'bg-[#F4FBF6] text-[#236E35]' : 'bg-[#FFF8DF] text-[#6C5B21]'}`}>
                <span>Presupuesto total</span>
                <span>{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(budgetTotal)}</span>
              </div>
            </div>
          </div>

          <div className="mt-8 border-t border-[#E1E7EF] pt-6">
            <button
              type="submit"
              disabled={submitting || goalAmount < 50_000 || budgetTotal <= 0 || budgetTotal > goalAmount}
              className="min-h-12 w-full rounded-xl bg-[#0A2A66] px-5 text-xs font-black text-white shadow-sm transition hover:bg-[#123C80] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {submitting ? 'Creando campaña…' : 'Crear borrador y enviar a revisión'}
            </button>
          </div>
        </form>

        <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
          <section className="rounded-[24px] border border-[#DCE5EF] bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-black text-[#0A2A66]">
              <Info size={17} />
              Antes de recaudar
            </div>
            <div className="mt-4 space-y-3 text-[11px] font-semibold leading-5 text-[#607087]">
              <p>La creación genera un borrador. La activación exige revisión de compliance e identidad/perfil de desembolso habilitados.</p>
              <p>Las campañas sociales o de emergencia obtienen la tarifa reducida solo después de quedar verificadas.</p>
              <p>Recaudar o aportar no modifica tu reputación cívica.</p>
            </div>
          </section>

          <section className="rounded-[24px] bg-[#0A2A66] p-5 text-white">
            <div className="text-[9px] font-black uppercase tracking-[.12em] text-[#BFD0E8]">Comisión estimada</div>
            <div className="mt-2 text-3xl font-black text-[#F5B700]">{estimatedPlatformFee}%</div>
            <div className="mt-2 text-[11px] font-semibold leading-5 text-white/70">
              Comisión de plataforma según el modelo y categoría actuales. El procesamiento del proveedor se mantiene separado.
            </div>
          </section>

          <section className="rounded-[24px] border border-[#DCE5EF] bg-[#F7F9FC] p-5">
            <div className="text-[9px] font-black uppercase tracking-[.12em] text-[#7B8799]">Política elegida</div>
            <div className="mt-2 text-sm font-black text-[#0A2A66]">{POLICY_COPY[fundingPolicy].title}</div>
            <p className="mt-2 text-[11px] font-semibold leading-5 text-[#607087]">{POLICY_COPY[fundingPolicy].text}</p>
          </section>
        </aside>
      </div>
    </div>
  )
}

const inputClass = 'min-h-11 w-full rounded-xl border border-[#DCE5EF] bg-white px-4 py-3 text-sm font-semibold text-[#0A2A66] outline-none transition placeholder:text-[#9AA5B4] focus:border-[#8EACD2] focus:ring-2 focus:ring-[#EAF1FB]'

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-xs font-black text-[#0A2A66]">{label}</span>
        {hint && <span className="text-[9px] font-bold text-[#9AA5B4]">{hint}</span>}
      </div>
      {children}
    </label>
  )
}

function ChoiceCard({
  active,
  disabled = false,
  title,
  text,
  onClick,
}: {
  active: boolean
  disabled?: boolean
  title: string
  text: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition ${active ? 'border-[#0A2A66] bg-[#EAF1FB]' : 'border-[#DCE5EF] bg-white hover:bg-[#F7F9FC]'} disabled:cursor-not-allowed disabled:opacity-40`}
    >
      <div className="text-xs font-black text-[#0A2A66]">{title}</div>
      <p className="mt-1 text-[10px] font-semibold leading-5 text-[#607087]">{text}</p>
    </button>
  )
}
