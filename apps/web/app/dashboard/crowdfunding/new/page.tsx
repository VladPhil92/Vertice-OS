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
import Link from 'next/link'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, HandCoins, Loader2, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'

type FundingModel = 'donation' | 'reward'
type FundingPolicy = 'flexible' | 'all_or_nothing' | 'milestone'

type CategoryDefinition = {
  id: string
  label: string
  description: string
  suggestedFundingPolicy: FundingPolicy
}

type ConfigResponse = {
  categoryCatalog: CategoryDefinition[]
  fundingModels: FundingModel[]
  fundingPolicies: FundingPolicy[]
  currency: 'COP'
}

type CreatedCampaignResponse = {
  campaign: { id: string; title: string; funding_policy: FundingPolicy }
  nextStep: 'compliance_review'
  activationRequiresReview: boolean
}

type BudgetRow = { id: string; label: string; amount: string }

const POLICY_COPY: Record<FundingPolicy, { label: string; description: string }> = {
  flexible: { label: 'Flexible', description: 'La campaña puede usar fondos verificados aunque todavía no alcance la meta.' },
  all_or_nothing: { label: 'Todo o nada', description: 'La campaña se estructura para depender de alcanzar la meta definida.' },
  milestone: { label: 'Por hitos', description: 'La ejecución y liberación de recursos se organiza alrededor de hitos verificables.' },
}

const MODEL_COPY: Record<FundingModel, { label: string; description: string }> = {
  donation: { label: 'Donación', description: 'Aporte sin participación, deuda, rentabilidad ni retorno financiero.' },
  reward: { label: 'Recompensa / preventa', description: 'El aporte puede tener una recompensa no financiera claramente descrita.' },
}

function parseCop(value: string) {
  const normalized = value.replace(/[^0-9]/g, '')
  return normalized ? Number(normalized) : 0
}

function formatInputCop(value: string): string {
  const amount = parseCop(value)
  if (!amount) return ''
  return new Intl.NumberFormat('es-CO').format(amount)
function formatCop(value: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)
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

  const [config, setConfig] = useState<ConfigResponse | null>(null)
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState('')
  const [fundingModel, setFundingModel] = useState<FundingModel>('donation')
  const [fundingPolicy, setFundingPolicy] = useState<FundingPolicy>('flexible')
  const [form, setForm] = useState({
    title: '',
    summary: '',
    description: '',
    goal: '',
    neighborhood: '',
  })
  const [budget, setBudget] = useState<BudgetRow[]>([
    { id: crypto.randomUUID(), label: '', amount: '' },
  ])

  useEffect(() => {
    let active = true
    apiFetch<ConfigResponse>('/crowdfunding/config')
      .then((response) => {
        if (!active) return
        setConfig(response)
        const first = response.categoryCatalog?.[0]
        if (first) {
          setCategory(first.id)
          setFundingPolicy(first.suggestedFundingPolicy)
        }
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'No fue posible cargar la configuración de recaudo.')
      })
      .finally(() => {
        if (active) setLoadingConfig(false)
      })
    return () => { active = false }
  }, [])

  const selectedCategory = config?.categoryCatalog.find((item) => item.id === category)
  const goalAmount = parseCop(form.goal)
  const budgetTotal = useMemo(() => budget.reduce((sum, item) => sum + parseCop(item.amount), 0), [budget])
  const budgetRemaining = Math.max(0, goalAmount - budgetTotal)

  function selectCategory(next: CategoryDefinition) {
    setCategory(next.id)
    if (fundingModel === 'donation') setFundingPolicy(next.suggestedFundingPolicy)
  }

  function selectModel(next: FundingModel) {
    setFundingModel(next)
    if (next === 'reward' && fundingPolicy === 'flexible') setFundingPolicy('all_or_nothing')
    if (next === 'donation' && selectedCategory) setFundingPolicy(selectedCategory.suggestedFundingPolicy)
  }

  function updateBudget(id: string, field: 'label' | 'amount', value: string) {
    setBudget((rows) => rows.map((row) => row.id === id ? { ...row, [field]: value } : row))
  }

  function addBudgetRow() {
    if (budget.length >= 50) return
    setBudget((rows) => [...rows, { id: crypto.randomUUID(), label: '', amount: '' }])
  }

  function removeBudgetRow(id: string) {
    if (budget.length === 1) return
    setBudget((rows) => rows.filter((row) => row.id !== id))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (!config || !category) {
      setError('La configuración de categorías aún no está disponible.')
      return
    }
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
    const normalizedBudget = budget.map((row) => ({ label: row.label.trim(), amount_cop: parseCop(row.amount) }))
    if (normalizedBudget.some((row) => row.label.length < 3 || row.amount_cop <= 0)) {
      setError('Cada partida del presupuesto necesita un concepto de al menos 3 caracteres y un valor mayor que cero.')
      return
    }

    setSubmitting(true)
    try {
      await apiFetch<CreatedCampaignResponse>('/crowdfunding/campaigns', {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({
          title: form.title.trim(),
          summary: form.summary.trim(),
          description: form.description.trim(),
          category,
          funding_model: fundingModel,
          funding_policy: fundingPolicy,
          goal_amount_cop: goalAmount,
          ...(neighborhood.trim() ? { neighborhood: neighborhood.trim() } : {}),
          budget: cleanBudget,
          neighborhood: form.neighborhood.trim() || undefined,
          budget: normalizedBudget,
        }),
      })
      router.push('/dashboard/crowdfunding')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible crear la campaña.')
      setError(err instanceof Error ? err.message : 'No fue posible guardar la campaña.')
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
  if (loadingConfig) {
    return <div className="flex min-h-[50vh] items-center justify-center gap-2 text-sm font-semibold text-[#607087]"><Loader2 size={18} className="animate-spin" /> Cargando categorías de recaudo…</div>
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      <Link href="/dashboard/crowdfunding" className="inline-flex items-center gap-2 text-xs font-extrabold text-[#607087] hover:text-[#0A2A66]"><ArrowLeft size={14} /> Volver a recaudo</Link>

      <section className="mt-4 overflow-hidden rounded-[28px] border border-[#DCE5EF] bg-white shadow-[0_18px_55px_rgba(10,42,102,.07)]">
        <div className="h-1.5 bg-[linear-gradient(90deg,#F5B700_0_33%,#4A90E2_33%_66%,#D72638_66%)]" />
        <div className="p-5 sm:p-8">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.15em] text-[#246CB6]"><HandCoins size={14} /> Nueva campaña</div>
            <h1 className="mt-2 text-2xl font-extrabold tracking-[-.03em] text-[#0A2A66] sm:text-3xl">Define primero qué tipo de causa vas a financiar.</h1>
            <p className="mt-3 text-sm font-medium leading-7 text-[#607087]">La categoría determina el contexto de revisión y sugiere una política de recaudo. Guardar este formulario crea un borrador: no habilita cobros ni desembolsos automáticamente.</p>
          </div>

          {error && <div className="mt-5 rounded-2xl border border-[#F1C8CE] bg-[#FCEBED] p-4 text-sm font-semibold text-[#A91D2E]">{error}</div>}

          <form onSubmit={submit} className="mt-7 space-y-8">
            <fieldset>
              <legend className="text-sm font-extrabold text-[#0A2A66]">1. Categoría de la campaña</legend>
              <p className="mt-1 text-xs font-medium text-[#7B8799]">Selecciona la categoría que describe el destino real de los recursos.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(config?.categoryCatalog ?? []).map((item) => {
                  const active = category === item.id
                  return (
                    <button key={item.id} type="button" onClick={() => selectCategory(item)} className={['relative rounded-2xl border p-4 text-left transition', active ? 'border-[#4A90E2] bg-[#EDF4FC] shadow-sm' : 'border-[#DCE5EF] bg-white hover:border-[#B8CAE0]'].join(' ')}>
                      {active && <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-[#0A2A66] text-white"><Check size={13} /></span>}
                      <div className="pr-8 text-sm font-extrabold text-[#0A2A66]">{item.label}</div>
                      <div className="mt-2 text-[11px] font-medium leading-5 text-[#607087]">{item.description}</div>
                      <div className="mt-3 text-[9px] font-extrabold uppercase tracking-[.08em] text-[#246CB6]">Sugerida: {POLICY_COPY[item.suggestedFundingPolicy].label}</div>
                    </button>
                  )
                })}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-sm font-extrabold text-[#0A2A66]">2. Modelo y política de recaudo</legend>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {(['donation', 'reward'] as FundingModel[]).map((model) => (
                  <button key={model} type="button" onClick={() => selectModel(model)} className={['rounded-2xl border p-4 text-left', fundingModel === model ? 'border-[#4A90E2] bg-[#EDF4FC]' : 'border-[#DCE5EF] bg-white'].join(' ')}>
                    <div className="text-sm font-extrabold text-[#0A2A66]">{MODEL_COPY[model].label}</div>
                    <div className="mt-2 text-[11px] font-medium leading-5 text-[#607087]">{MODEL_COPY[model].description}</div>
                  </button>
                ))}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {(config?.fundingPolicies ?? []).map((policy) => {
                  const disabled = fundingModel === 'reward' && policy === 'flexible'
                  return (
                    <button key={policy} type="button" disabled={disabled} onClick={() => setFundingPolicy(policy)} className={['rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-40', fundingPolicy === policy ? 'border-[#F5B700] bg-[#FFF9E6]' : 'border-[#DCE5EF] bg-white'].join(' ')}>
                      <div className="text-xs font-extrabold text-[#0A2A66]">{POLICY_COPY[policy].label}</div>
                      <div className="mt-2 text-[10px] font-medium leading-5 text-[#607087]">{POLICY_COPY[policy].description}</div>
                    </button>
                  )
                })}
              </div>
            </fieldset>

            <fieldset className="space-y-5">
              <legend className="text-sm font-extrabold text-[#0A2A66]">3. Información pública de la causa</legend>
              <label className="block">
                <span className="text-xs font-extrabold text-[#0A2A66]">Título</span>
                <input required minLength={8} maxLength={120} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Ej. Dotar la biblioteca comunitaria de Olaya" className="mt-2 min-h-12 w-full rounded-xl border border-[#DCE5EF] px-4 text-sm text-[#0A2A66] outline-none focus:border-[#4A90E2]" />
              </label>
              <label className="block">
                <span className="text-xs font-extrabold text-[#0A2A66]">Resumen</span>
                <textarea required minLength={20} maxLength={280} rows={3} value={form.summary} onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))} placeholder="Explica en pocas palabras qué se financiará y a quién beneficia." className="mt-2 w-full rounded-xl border border-[#DCE5EF] p-4 text-sm leading-6 text-[#0A2A66] outline-none focus:border-[#4A90E2]" />
                <div className="mt-1 text-right text-[10px] font-semibold text-[#8A96A6]">{form.summary.length}/280</div>
              </label>
              <label className="block">
                <span className="text-xs font-extrabold text-[#0A2A66]">Descripción y plan de ejecución</span>
                <textarea required minLength={80} maxLength={8000} rows={8} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Describe el problema, la solución, responsables, beneficiarios, evidencias esperadas y cómo se rendirán cuentas." className="mt-2 w-full rounded-xl border border-[#DCE5EF] p-4 text-sm leading-6 text-[#0A2A66] outline-none focus:border-[#4A90E2]" />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-extrabold text-[#0A2A66]">Meta de recaudo (COP)</span>
                  <input required inputMode="numeric" value={form.goal} onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))} placeholder="5000000" className="mt-2 min-h-12 w-full rounded-xl border border-[#DCE5EF] px-4 text-sm text-[#0A2A66] outline-none focus:border-[#4A90E2]" />
                  {goalAmount > 0 && <div className="mt-1 text-[10px] font-semibold text-[#7B8799]">{formatCop(goalAmount)}</div>}
                </label>
                <label className="block">
                  <span className="text-xs font-extrabold text-[#0A2A66]">Barrio o territorio</span>
                  <input minLength={2} maxLength={120} value={form.neighborhood} onChange={(e) => setForm((f) => ({ ...f, neighborhood: e.target.value }))} placeholder="Ej. Olaya Herrera" className="mt-2 min-h-12 w-full rounded-xl border border-[#DCE5EF] px-4 text-sm text-[#0A2A66] outline-none focus:border-[#4A90E2]" />
                </label>
              </div>
            </fieldset>

            <fieldset>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <legend className="text-sm font-extrabold text-[#0A2A66]">4. Presupuesto desglosado</legend>
                  <p className="mt-1 text-xs font-medium text-[#7B8799]">Cada peso solicitado debe poder relacionarse con conceptos verificables.</p>
                </div>
                <button type="button" onClick={addBudgetRow} disabled={budget.length >= 50} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#C8D5E5] px-4 text-xs font-extrabold text-[#0A2A66] disabled:opacity-50"><Plus size={14} /> Añadir partida</button>
              </div>
              <div className="mt-4 space-y-3">
                {budget.map((row, index) => (
                  <div key={row.id} className="grid gap-3 rounded-2xl border border-[#E1E7EF] bg-[#FAFBFD] p-3 sm:grid-cols-[1fr_180px_42px]">
                    <input required minLength={3} maxLength={120} value={row.label} onChange={(e) => updateBudget(row.id, 'label', e.target.value)} placeholder={`Concepto ${index + 1}`} className="min-h-11 rounded-xl border border-[#DCE5EF] bg-white px-3 text-sm text-[#0A2A66] outline-none focus:border-[#4A90E2]" />
                    <input required inputMode="numeric" value={row.amount} onChange={(e) => updateBudget(row.id, 'amount', e.target.value)} placeholder="Valor COP" className="min-h-11 rounded-xl border border-[#DCE5EF] bg-white px-3 text-sm text-[#0A2A66] outline-none focus:border-[#4A90E2]" />
                    <button type="button" disabled={budget.length === 1} onClick={() => removeBudgetRow(row.id)} className="flex min-h-11 items-center justify-center rounded-xl text-[#A91D2E] hover:bg-[#FCEBED] disabled:opacity-25" aria-label={`Eliminar partida ${index + 1}`}><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-3 rounded-2xl bg-[#F7F9FC] p-4 text-xs sm:grid-cols-3">
                <div><div className="font-bold text-[#7B8799]">Meta</div><div className="mt-1 font-extrabold text-[#0A2A66]">{formatCop(goalAmount)}</div></div>
                <div><div className="font-bold text-[#7B8799]">Presupuesto</div><div className={['mt-1 font-extrabold', budgetTotal > goalAmount && goalAmount > 0 ? 'text-[#D72638]' : 'text-[#0A2A66]'].join(' ')}>{formatCop(budgetTotal)}</div></div>
                <div><div className="font-bold text-[#7B8799]">Sin asignar</div><div className="mt-1 font-extrabold text-[#0A2A66]">{formatCop(budgetRemaining)}</div></div>
              </div>
            </fieldset>

            <div className="rounded-2xl border border-[#D7E5DA] bg-[#F2F8F3] p-4 text-[11px] font-semibold leading-6 text-[#46624C]">
              <div className="flex items-start gap-2"><ShieldCheck size={16} className="mt-1 shrink-0 text-[#2BA745]" /><span>Al guardar declaras un propósito de recaudo, no una inversión. La campaña queda en borrador y deberá superar revisión de cumplimiento, identidad y habilitación financiera antes de aceptar aportes. El monto recaudado no compra reputación ni alcance cívico.</span></div>
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Link href="/dashboard/crowdfunding" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#DCE5EF] px-5 text-xs font-extrabold text-[#607087]">Cancelar</Link>
              <button disabled={submitting || !config || !category} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#0A2A66] px-6 text-xs font-extrabold text-white disabled:opacity-60">
                {submitting && <Loader2 size={15} className="animate-spin" />} Guardar borrador
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  )
}
