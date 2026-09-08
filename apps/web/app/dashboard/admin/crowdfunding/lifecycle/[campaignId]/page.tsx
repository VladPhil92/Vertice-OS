'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Loader2,
  RotateCcw,
  ShieldAlert,
  XCircle,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'

type BudgetItem = { label: string; amount_cop: number }
type LifecycleEvent = {
  id: string
  event_type: string
  revision_no: number
  actor_citizen_id: string | null
  notes: string | null
  created_at: string
}

type AdminLifecycleResponse = {
  campaign: {
    id: string
    creator_citizen_id: string
    title: string
    summary: string
    description: string
    category: string
    funding_model: string
    funding_policy: string
    status: string
    compliance_status: string
    goal_amount_cop: number
    raised_amount_cop: number
    neighborhood: string | null
    budget: BudgetItem[]
    review_notes: string | null
    revision_no: number
    submitted_for_review_at: string | null
    last_reviewed_at: string | null
    created_at: string
    updated_at: string
  }
  events: LifecycleEvent[]
  reviewable: boolean
}

const EVENT_LABELS: Record<string, string> = {
  draft_created: 'Borrador creado',
  draft_updated: 'Borrador actualizado',
  submitted_for_review: 'Enviada a revisión',
  changes_requested: 'Cambios solicitados',
  rejected: 'Rechazada',
  approved: 'Aprobada',
  activated: 'Activada',
  suspended: 'Suspendida',
}

function formatCop(value: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value))
}

export default function AdminCampaignLifecycleDetailPage() {
  const params = useParams<{ campaignId: string }>()
  const router = useRouter()
  const campaignId = params.campaignId
  const [data, setData] = useState<AdminLifecycleResponse | null>(null)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function load() {
    setError(null)
    try {
      setData(await apiFetch<AdminLifecycleResponse>(`/crowdfunding/admin/lifecycle/campaigns/${campaignId}`))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar el expediente de la campaña.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [campaignId])

  async function decide(decision: 'approve' | 'request_changes' | 'reject' | 'suspend') {
    if (decision !== 'approve' && notes.trim().length < 10) {
      setError('Solicitar cambios, rechazar o suspender requiere observaciones de al menos 10 caracteres.')
      return
    }
    setBusy(decision)
    setError(null)
    setNotice(null)
    try {
      await apiFetch(`/crowdfunding/admin/lifecycle/campaigns/${campaignId}/review`, {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ decision, ...(notes.trim() ? { notes: notes.trim() } : {}) }),
      })
      setNotice(`Decisión registrada: ${decision}.`)
      setNotes('')
      await load()
      if (decision !== 'suspend') router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible registrar la decisión.')
    } finally {
      setBusy(null)
    }
  }

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 size={22} className="animate-spin text-[#4A90E2]" /></div>
  if (!data) return <div className="mx-auto max-w-6xl px-5 py-10"><div className="rounded-2xl border border-[#F0C7CB] bg-[#FFF7F8] p-5 text-sm font-semibold text-[#A51E2D]">{error ?? 'Expediente no disponible.'}</div></div>

  const { campaign } = data
  const budgetTotal = (campaign.budget ?? []).reduce((sum, item) => sum + Number(item.amount_cop || 0), 0)

  return (
    <div data-testid="crowdfunding-admin-lifecycle-detail" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
      <Link href="/dashboard/admin/crowdfunding/lifecycle" className="inline-flex items-center gap-2 text-xs font-extrabold text-[#607087] hover:text-[#0A2A66]"><ArrowLeft size={14} /> Volver a la cola</Link>

      <section className="mt-5 rounded-[28px] bg-[#0A2A66] p-6 text-white sm:p-8">
        <div className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#F5B700]">Expediente · revisión {campaign.revision_no}</div>
        <h1 className="mt-2 text-3xl font-extrabold tracking-[-.035em]">{campaign.title}</h1>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-white/70">{campaign.summary}</p>
        <div className="mt-5 flex flex-wrap gap-2 text-[9px] font-extrabold uppercase tracking-[.05em]"><span className="rounded-full bg-white/10 px-3 py-2">{campaign.category}</span><span className="rounded-full bg-white/10 px-3 py-2">{campaign.funding_model}</span><span className="rounded-full bg-white/10 px-3 py-2">{campaign.funding_policy}</span><span className="rounded-full bg-white/10 px-3 py-2">{campaign.status}/{campaign.compliance_status}</span></div>
      </section>

      {(error || notice) && <div className={`mt-5 rounded-2xl border p-4 text-sm font-semibold ${error ? 'border-[#F0C7CB] bg-[#FFF7F8] text-[#A51E2D]' : 'border-[#BFDCC7] bg-[#F4FBF6] text-[#236E35]'}`}>{error ?? notice}</div>}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_.7fr]">
        <main className="space-y-6">
          <section className="rounded-[26px] border border-[#DCE5EF] bg-white p-6">
            <h2 className="text-lg font-extrabold text-[#0A2A66]">Plan presentado</h2>
            <div className="mt-4 whitespace-pre-wrap text-sm font-medium leading-7 text-[#526176]">{campaign.description}</div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2"><Info label="Meta" value={formatCop(campaign.goal_amount_cop)} /><Info label="Recaudado" value={formatCop(campaign.raised_amount_cop)} /><Info label="Territorio" value={campaign.neighborhood ?? 'No especificado'} /><Info label="Creador" value={campaign.creator_citizen_id} /></div>
          </section>

          <section className="rounded-[26px] border border-[#DCE5EF] bg-white p-6">
            <div className="flex items-center justify-between"><h2 className="text-lg font-extrabold text-[#0A2A66]">Presupuesto</h2><span className="text-xs font-extrabold text-[#607087]">{formatCop(budgetTotal)} / {formatCop(campaign.goal_amount_cop)}</span></div>
            <div className="mt-4 divide-y divide-[#EEF2F6]">{(campaign.budget ?? []).map((item, index) => <div key={`${item.label}-${index}`} className="flex items-center justify-between gap-4 py-3 text-sm"><span className="font-semibold text-[#526176]">{item.label}</span><span className="font-extrabold text-[#0A2A66]">{formatCop(item.amount_cop)}</span></div>)}</div>
          </section>

          <section className="rounded-[26px] border border-[#DCE5EF] bg-white p-6">
            <div className="flex items-center gap-2"><Clock3 size={18} className="text-[#0A2A66]" /><h2 className="text-lg font-extrabold text-[#0A2A66]">Historial de lifecycle</h2></div>
            <div className="mt-5 space-y-4">{data.events.map((event) => <div key={event.id} className="border-l-2 border-[#DCE5EF] pl-4"><div className="text-xs font-extrabold text-[#0A2A66]">{EVENT_LABELS[event.event_type] ?? event.event_type}</div><div className="mt-1 text-[10px] font-semibold text-[#7B8799]">Revisión {event.revision_no} · {formatDate(event.created_at)}{event.actor_citizen_id ? ` · actor ${event.actor_citizen_id}` : ''}</div>{event.notes && <div className="mt-2 text-[11px] font-medium leading-5 text-[#607087]">{event.notes}</div>}</div>)}</div>
          </section>
        </main>

        <aside className="space-y-6">
          <section className="rounded-[26px] border border-[#DCE5EF] bg-white p-6">
            <h2 className="text-sm font-extrabold text-[#0A2A66]">Control de revisión</h2>
            <div className="mt-4 space-y-3 text-xs"><Info label="Enviada" value={formatDate(campaign.submitted_for_review_at)} /><Info label="Última revisión" value={formatDate(campaign.last_reviewed_at)} /></div>
            {!data.reviewable && <div className="mt-4 flex items-start gap-2 rounded-xl bg-[#FFF8DF] p-3 text-[11px] font-semibold leading-5 text-[#6C5B21]"><AlertTriangle size={15} className="mt-0.5 shrink-0" /> Esta campaña ya no está en `review/in_review`. Las decisiones ordinarias quedan bloqueadas.</div>}
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} rows={5} placeholder="Observaciones de revisión. Obligatorias para solicitar cambios, rechazar o suspender." className="mt-4 w-full rounded-xl border border-[#DCE5EF] p-3 text-xs font-medium leading-5 text-[#0A2A66] outline-none focus:border-[#4A90E2]" />
            <div className="mt-4 grid gap-2">
              <Action disabled={!data.reviewable || busy !== null} onClick={() => void decide('approve')} icon={CheckCircle2} label={busy === 'approve' ? 'Aprobando…' : 'Aprobar campaña'} className="bg-[#238A3B] text-white" />
              <Action disabled={!data.reviewable || busy !== null} onClick={() => void decide('request_changes')} icon={RotateCcw} label={busy === 'request_changes' ? 'Registrando…' : 'Solicitar cambios'} className="border border-[#D7B94C] bg-[#FFF8DF] text-[#6C5B21]" />
              <Action disabled={!data.reviewable || busy !== null} onClick={() => void decide('reject')} icon={XCircle} label={busy === 'reject' ? 'Rechazando…' : 'Rechazar'} className="border border-[#F0C7CB] bg-[#FFF7F8] text-[#A51E2D]" />
              <Action disabled={busy !== null} onClick={() => void decide('suspend')} icon={ShieldAlert} label={busy === 'suspend' ? 'Suspendiendo…' : 'Suspender'} className="border border-[#E7C9A7] bg-[#FFF8EE] text-[#8A541D]" />
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-[#F7F9FC] p-3"><div className="text-[9px] font-extrabold uppercase tracking-[.08em] text-[#7B8799]">{label}</div><div className="mt-1 break-all text-xs font-extrabold text-[#0A2A66]">{value}</div></div>
}

function Action({ disabled, onClick, icon: Icon, label, className }: { disabled: boolean; onClick: () => void; icon: typeof CheckCircle2; label: string; className: string }) {
  return <button type="button" disabled={disabled} onClick={onClick} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-[10px] font-extrabold uppercase tracking-[.06em] disabled:opacity-40 ${className}`}><Icon size={14} />{label}</button>
}
