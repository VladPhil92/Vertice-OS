'use client'

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

function formatCop(value: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)
}

export default function NewCrowdfundingCampaignPage() {
  const router = useRouter()
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
          neighborhood: form.neighborhood.trim() || undefined,
          budget: normalizedBudget,
        }),
      })
      router.push('/dashboard/crowdfunding')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible guardar la campaña.')
    } finally {
      setSubmitting(false)
    }
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
