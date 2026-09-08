'use client'

import Link from 'next/link'
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Loader2,
  PencilLine,
  RefreshCw,
  Send,
  ShieldCheck,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'

type FundingModel = 'donation' | 'reward'
type FundingPolicy = 'flexible' | 'all_or_nothing' | 'milestone'
type BudgetItem = { label: string; amount_cop: number }

type CategoryDefinition = {
  id: string
  label: string
  description: string
  suggestedFundingPolicy: FundingPolicy
}

type Campaign = {
  id: string
  title: string
  summary: string
  description: string
  category: string
  funding_model: FundingModel
  funding_policy: FundingPolicy
  status: string
  compliance_status: string
  goal_amount_cop: number
  raised_amount_cop: number
  currency: string
  locality_id: number | null
  neighborhood: string | null
  budget: BudgetItem[]
  review_notes: string | null
  revision_no: number
  submitted_for_review_at: string | null
  last_reviewed_at: string | null
  starts_at: string | null
  ends_at: string | null
  created_at: string
  updated_at: string
}

type LifecycleEvent = {
  id: string
  event_type: string
  revision_no: number
  from_status: string | null
  to_status: string
  notes: string | null
  created_at: string
}

type LifecycleResponse = {
  campaign: Campaign
  events: LifecycleEvent[]
  permissions: {
    can_edit: boolean
    can_submit_for_review: boolean
    can_activate: boolean
  }
}

type ConfigResponse = {
  categoryCatalog: CategoryDefinition[]
  fundingModels: FundingModel[]
  fundingPolicies: FundingPolicy[]
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  review: 'En revisión',
  verified: 'Aprobada · lista para activar',
  active: 'Recaudando',
  funded: 'Meta alcanzada',
  executing: 'En ejecución',
  verifying: 'Verificando impacto',
  completed: 'Completada',
  suspended: 'Suspendida',
  investigation: 'En investigación',
}

const EVENT_LABELS: Record<string, string> = {
  draft_created: 'Borrador creado',
  draft_updated: 'Borrador actualizado',
  submitted_for_review: 'Enviada a revisión',
  changes_requested: 'Cambios solicitados',
  rejected: 'Revisión rechazada',
  approved: 'Campaña aprobada',
  activated: 'Recaudo activado',
  suspended: 'Campaña suspendida',
}

function formatCop(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value))
}

export default function CampaignLifecyclePage() {
  const params = useParams<{ campaignId: string }>()
  const campaignId = params.campaignId
  const [data, setData] = useState<LifecycleResponse | null>(null)
  const [config, setConfig] = useState<ConfigResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [form, setForm] = useState<Campaign | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [next, nextConfig] = await Promise.all([
        apiFetch<LifecycleResponse>(`/crowdfunding/me/campaigns/${campaignId}`),
        apiFetch<ConfigResponse>('/crowdfunding/config'),
      ])
      setData(next)
      setForm(next.campaign)
      setConfig(nextConfig)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar la campaña.')
    } finally {
      setLoading(false)
    }
  }, [campaignId])

  useEffect(() => { void load() }, [load])

  const budgetTotal = useMemo(
    () => (form?.budget ?? []).reduce((sum, item) => sum + Number(item.amount_cop || 0), 0),
    [form?.budget],
  )

  const categoryLabel = config?.categoryCatalog.find((item) => item.id === form?.category)?.label ?? form?.category

  function updateBudget(index: number, field: keyof BudgetItem, value: string) {
    setForm((current) => {
      if (!current) return current
      const next = [...current.budget]
      next[index] = {
        ...next[index],
        [field]: field === 'amount_cop' ? Number(value.replace(/[^0-9]/g, '')) : value,
      }
      return { ...current, budget: next }
    })
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!form || !data?.permissions.can_edit) return
    setBusy('save')
    setError(null)
    setNotice(null)
    try {
      await apiFetch(`/crowdfunding/me/campaigns/${campaignId}`, {
        method: 'PUT',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({
          title: form.title.trim(),
          summary: form.summary.trim(),
          description: form.description.trim(),
          category: form.category,
          funding_model: form.funding_model,
          funding_policy: form.funding_policy,
          goal_amount_cop: Number(form.goal_amount_cop),
          ...(form.locality_id ? { locality_id: form.locality_id } : {}),
          ...(form.neighborhood?.trim() ? { neighborhood: form.neighborhood.trim() } : {}),
          budget: form.budget.map((item) => ({ label: item.label.trim(), amount_cop: Number(item.amount_cop) })),
        }),
      })
      setNotice('Borrador actualizado. Los cambios quedaron registrados en el historial.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible guardar el borrador.')
    } finally {
      setBusy(null)
    }
  }

  async function submitForReview() {
    setBusy('submit')
    setError(null)
    setNotice(null)
    try {
      await apiFetch(`/crowdfunding/me/campaigns/${campaignId}/submit-review`, {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
      })
      setNotice('Campaña enviada formalmente a revisión. Quedó bloqueada para edición hasta una decisión.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible enviar la campaña a revisión.')
    } finally {
      setBusy(null)
    }
  }

  async function activate() {
    setBusy('activate')
    setError(null)
    setNotice(null)
    try {
      await apiFetch(`/crowdfunding/me/campaigns/${campaignId}/activate`, { method: 'POST' })
      setNotice('Campaña activada. Los aportes siguen sujetos al estado del rail financiero certificado.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible activar la campaña.')
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return <div className="flex min-h-[55vh] items-center justify-center"><Loader2 size={22} className="animate-spin text-[#4A90E2]" /></div>
  }

  if (!data || !form || !config) {
    return <div className="mx-auto max-w-5xl px-5 py-10"><div className="rounded-2xl border border-[#F0C7CB] bg-[#FFF7F8] p-5 text-sm font-semibold text-[#A51E2D]">{error ?? 'Campaña no disponible.'}</div></div>
  }

  const editable = data.permissions.can_edit
  const canSubmit = data.permissions.can_submit_for_review
  const canActivate = data.permissions.can_activate

  return (
    <div data-testid="crowdfunding-campaign-lifecycle" className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      <Link href="/dashboard/crowdfunding" className="inline-flex items-center gap-2 text-xs font-extrabold text-[#607087] hover:text-[#0A2A66]"><ArrowLeft size={14} /> Volver a mis campañas</Link>

      <section className="mt-4 rounded-[28px] bg-[#0A2A66] p-6 text-white sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#F5B700]">Campaña · revisión {form.revision_no}</div>
            <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">{form.title}</h1>
            <p className="mt-3 text-sm leading-7 text-white/70">{form.summary}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-[10px] font-extrabold uppercase tracking-[.06em]">
            <span className="rounded-full bg-white/10 px-3 py-2">{STATUS_LABELS[form.status] ?? form.status}</span>
            <span className="rounded-full bg-white/10 px-3 py-2">{categoryLabel}</span>
          </div>
        </div>
      </section>

      {(error || notice) && <div className={`mt-5 rounded-2xl border p-4 text-sm font-semibold ${error ? 'border-[#F0C7CB] bg-[#FFF7F8] text-[#A51E2D]' : 'border-[#BFDCC7] bg-[#F4FBF6] text-[#236E35]'}`}>{error ?? notice}</div>}

      {form.review_notes && (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[#F1DEA5] bg-[#FFF8DF] p-5 text-sm font-semibold leading-6 text-[#6C5B21]">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <div><div className="font-extrabold">Observaciones de revisión</div><div className="mt-1">{form.review_notes}</div></div>
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
        <form onSubmit={save} className="rounded-[28px] border border-[#DCE5EF] bg-white p-5 sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <div><div className="text-[9px] font-extrabold uppercase tracking-[.13em] text-[#7B8799]">Contenido</div><h2 className="mt-1 text-xl font-extrabold text-[#0A2A66]">{editable ? 'Editar borrador' : 'Versión enviada'}</h2></div>
            <PencilLine size={19} className="text-[#8AA0BB]" />
          </div>

          <div className="mt-6 space-y-5">
            <Field label="Título"><input disabled={!editable} required minLength={8} maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="field" /></Field>
            <Field label="Resumen"><textarea disabled={!editable} required minLength={20} maxLength={280} rows={3} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} className="field p-3" /></Field>
            <Field label="Descripción y plan de ejecución"><textarea disabled={!editable} required minLength={80} maxLength={8000} rows={8} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="field p-3" /></Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Categoría"><select disabled={!editable} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="field">{config.categoryCatalog.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
              <Field label="Meta COP"><input disabled={!editable} inputMode="numeric" value={String(form.goal_amount_cop)} onChange={(e) => setForm({ ...form, goal_amount_cop: Number(e.target.value.replace(/[^0-9]/g, '')) })} className="field" /><div className="mt-1 text-[10px] font-semibold text-[#7B8799]">{formatCop(form.goal_amount_cop)}</div></Field>
              <Field label="Modelo"><select disabled={!editable} value={form.funding_model} onChange={(e) => { const model = e.target.value as FundingModel; setForm({ ...form, funding_model: model, funding_policy: model === 'reward' && form.funding_policy === 'flexible' ? 'all_or_nothing' : form.funding_policy }) }} className="field"><option value="donation">Donación</option><option value="reward">Recompensa / preventa</option></select></Field>
              <Field label="Política"><select disabled={!editable} value={form.funding_policy} onChange={(e) => setForm({ ...form, funding_policy: e.target.value as FundingPolicy })} className="field">{config.fundingPolicies.filter((policy) => !(form.funding_model === 'reward' && policy === 'flexible')).map((policy) => <option key={policy} value={policy}>{policy.replaceAll('_', ' ')}</option>)}</select></Field>
              <Field label="Barrio o territorio"><input disabled={!editable} value={form.neighborhood ?? ''} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} className="field" /></Field>
            </div>

            <div>
              <div className="flex items-center justify-between"><span className="text-xs font-extrabold text-[#0A2A66]">Presupuesto</span><span className="text-[10px] font-bold text-[#607087]">{formatCop(budgetTotal)} / {formatCop(form.goal_amount_cop)}</span></div>
              <div className="mt-3 space-y-2">
                {form.budget.map((item, index) => (
                  <div key={`${index}-${item.label}`} className="grid gap-2 sm:grid-cols-[1fr_180px]">
                    <input disabled={!editable} value={item.label} onChange={(e) => updateBudget(index, 'label', e.target.value)} className="field" />
                    <input disabled={!editable} inputMode="numeric" value={String(item.amount_cop)} onChange={(e) => updateBudget(index, 'amount_cop', e.target.value)} className="field" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap justify-end gap-3">
            {editable && <button type="submit" disabled={busy !== null} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#BFD0E8] px-5 text-xs font-extrabold text-[#0A2A66] disabled:opacity-50">{busy === 'save' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Guardar cambios</button>}
            {canSubmit && <button type="button" disabled={busy !== null} onClick={() => void submitForReview()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#0A2A66] px-5 text-xs font-extrabold text-white disabled:opacity-50">{busy === 'submit' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Enviar a revisión</button>}
            {canActivate && <button type="button" disabled={busy !== null} onClick={() => void activate()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#2BA745] px-5 text-xs font-extrabold text-white disabled:opacity-50">{busy === 'activate' ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Activar recaudo</button>}
          </div>
        </form>

        <aside className="space-y-6">
          <section className="rounded-[26px] border border-[#DCE5EF] bg-white p-6">
            <div className="flex items-center gap-3"><ShieldCheck size={19} className="text-[#238A3B]" /><h2 className="text-sm font-extrabold text-[#0A2A66]">Estado de revisión</h2></div>
            <div className="mt-5 space-y-3 text-xs font-semibold text-[#607087]">
              <Row label="Estado" value={STATUS_LABELS[form.status] ?? form.status} />
              <Row label="Compliance" value={form.compliance_status.replaceAll('_', ' ')} />
              <Row label="Revisión" value={`#${form.revision_no}`} />
              <Row label="Enviada" value={formatDate(form.submitted_for_review_at)} />
              <Row label="Última decisión" value={formatDate(form.last_reviewed_at)} />
            </div>
          </section>

          <section className="rounded-[26px] border border-[#DCE5EF] bg-white p-6">
            <div className="flex items-center gap-3"><Clock3 size={19} className="text-[#0A2A66]" /><h2 className="text-sm font-extrabold text-[#0A2A66]">Historial auditable</h2></div>
            <div className="mt-5 space-y-4">
              {data.events.map((event) => (
                <div key={event.id} className="border-l-2 border-[#DCE5EF] pl-4">
                  <div className="text-xs font-extrabold text-[#0A2A66]">{EVENT_LABELS[event.event_type] ?? event.event_type}</div>
                  <div className="mt-1 text-[10px] font-semibold text-[#7B8799]">Revisión {event.revision_no} · {formatDate(event.created_at)}</div>
                  {event.notes && <div className="mt-2 text-[11px] font-medium leading-5 text-[#607087]">{event.notes}</div>}
                </div>
              ))}
            </div>
          </section>

          <div className="flex items-start gap-2 rounded-2xl bg-[#F7F9FC] p-4 text-[11px] font-semibold leading-5 text-[#607087]"><FileCheck2 size={16} className="mt-0.5 shrink-0" /> Editar, aprobar o recaudar son acciones distintas. Una aprobación cívica no mueve dinero y una contribución nunca altera reputación o ranking.</div>
        </aside>
      </div>

      <style jsx global>{`.field{min-height:44px;width:100%;border:1px solid #DCE5EF;border-radius:12px;background:white;padding:0 12px;font-size:12px;font-weight:600;color:#0A2A66;outline:none}.field:focus{border-color:#4A90E2}.field:disabled{background:#F7F9FC;color:#7B8799}`}</style>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs font-extrabold text-[#0A2A66]">{label}</span><div className="mt-2">{children}</div></label>
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4 border-b border-[#EEF2F6] pb-3"><span>{label}</span><span className="text-right font-extrabold text-[#0A2A66]">{value}</span></div>
}
