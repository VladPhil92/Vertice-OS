'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  ExternalLink,
  FileCheck2,
  Loader2,
  MapPin,
  MessageSquareWarning,
  PlayCircle,
  ShieldCheck,
  Target,
  ThumbsUp,
  Users,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'

type CivicActionStatus =
  | 'proposed'
  | 'preparing'
  | 'in_progress'
  | 'result_declared'
  | 'under_verification'
  | 'verified'
  | 'not_completed'
  | 'no_evidence'
  | 'disputed'
  | 'cancelled'

type ConfidenceLevel = 'low' | 'medium' | 'high'
type ValidationStance = 'corroborate' | 'dispute'
type EvidenceType = 'photo' | 'video' | 'document' | 'location' | 'external_record'

interface ScoreExplanation {
  dimension: string
  label: string
  points: number
  max_points: number
}

interface CivicAction {
  id: string
  actor: { id: string; display_name: string; neighborhood: string | null; actor_kind: string; organization: string | null }
  title: string
  problem: string
  objective: string
  category: string
  neighborhood: string | null
  beneficiaries_estimate: number | null
  status: CivicActionStatus
  result_summary: string | null
  target_date: string | null
  created_at: string
  updated_at: string
  evidence_count: number
  external_evidence_count: number
  collaborators_count: number
  community_validation: { corroborations: number; disputes: number; total: number }
  civic_score: number
  score_version: string
  score_explanation: ScoreExplanation[]
  confidence_score: number
  confidence_level: ConfidenceLevel
  evidence_level: number
}

interface Evidence {
  id: string
  evidence_type: EvidenceType
  evidence_url: string
  description: string | null
  source_url: string | null
  content_hash: string | null
  review_status: string
  created_at: string
}

interface EvidenceResponse { data: Evidence[] }
interface ValidationResponse { corroborations: number; disputes: number; total: number; my_stance: ValidationStance | null; my_note: string | null }

const STATUS_LABEL: Record<CivicActionStatus, string> = {
  proposed: 'Propuesta',
  preparing: 'En preparación',
  in_progress: 'En ejecución',
  result_declared: 'Resultado declarado',
  under_verification: 'En verificación',
  verified: 'Verificada',
  not_completed: 'No completada',
  no_evidence: 'Sin evidencia suficiente',
  disputed: 'Disputada',
  cancelled: 'Cancelada',
}

const EVIDENCE_LEVEL_LABEL = [
  'L0 · Declaración',
  'L1 · Evidencia adjunta',
  'L2 · Corroboración comunitaria',
  'L3 · Fuente externa en revisión',
  'L4 · Verificación VÉRTICE',
]

const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = { low: 'Baja', medium: 'Media', high: 'Alta' }

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

export default function CivicActionDetailPage() {
  const params = useParams<{ actionId: string }>()
  const actionId = params.actionId
  const [action, setAction] = useState<CivicAction | null>(null)
  const [evidence, setEvidence] = useState<Evidence[]>([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [evidenceForm, setEvidenceForm] = useState({
    evidence_type: 'photo' as EvidenceType,
    evidence_url: '',
    description: '',
    source_url: '',
    content_hash: '',
  })

  const citizenId = typeof window === 'undefined' ? null : localStorage.getItem('citizen_id')
  const isOwner = Boolean(action && citizenId === action.actor.id)

  async function load() {
    setError(null)
    try {
      const [actionData, evidenceData] = await Promise.all([
        apiFetch<CivicAction>(`/civic-actions/${actionId}`),
        apiFetch<EvidenceResponse>(`/civic-actions/${actionId}/evidence`),
      ])
      setAction(actionData)
      setEvidence(evidenceData.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar la acción cívica.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [actionId]) // eslint-disable-line react-hooks/exhaustive-deps

  const nextOwnerAction = useMemo(() => {
    if (!action || !isOwner) return null
    if (action.status === 'proposed') return { status: 'preparing', label: 'Pasar a preparación' }
    if (action.status === 'preparing') return { status: 'in_progress', label: 'Iniciar ejecución' }
    if (['not_completed', 'disputed', 'no_evidence'].includes(action.status)) return { status: 'in_progress', label: 'Reabrir ejecución' }
    return null
  }, [action, isOwner])

  async function changeStatus(status: string, resultSummary?: string) {
    setWorking(true)
    setError(null)
    try {
      const updated = await apiFetch<CivicAction>(`/civic-actions/${actionId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, ...(resultSummary ? { result_summary: resultSummary } : {}) }),
      })
      setAction(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible actualizar el estado.')
    } finally {
      setWorking(false)
    }
  }

  async function declareResult() {
    const summary = window.prompt('Describe el resultado observable y qué evidencia lo respalda:')
    if (!summary || summary.trim().length < 10) return
    await changeStatus('result_declared', summary.trim())
  }

  async function submitEvidence(event: FormEvent) {
    event.preventDefault()
    setWorking(true)
    setError(null)
    try {
      await apiFetch(`/civic-actions/${actionId}/evidence`, {
        method: 'POST',
        body: JSON.stringify({
          evidence_type: evidenceForm.evidence_type,
          evidence_url: evidenceForm.evidence_url,
          description: evidenceForm.description || null,
          source_url: evidenceForm.source_url || null,
          content_hash: evidenceForm.content_hash || null,
        }),
      })
      setEvidenceForm({ evidence_type: 'photo', evidence_url: '', description: '', source_url: '', content_hash: '' })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible adjuntar la evidencia.')
    } finally {
      setWorking(false)
    }
  }

  async function validate(stance: ValidationStance) {
    let note: string | null = null
    if (stance === 'dispute') {
      note = window.prompt('Explica qué parte de la evidencia debe revisarse:')
      if (!note || note.trim().length < 10) return
    }
    setWorking(true)
    setError(null)
    try {
      await apiFetch<ValidationResponse>(`/civic-actions/${actionId}/validation`, {
        method: 'PUT',
        body: JSON.stringify({ stance, note }),
      })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible registrar tu validación.')
    } finally {
      setWorking(false)
    }
  }

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-[#4A90E2]" /></div>
  if (error && !action) return <div className="mx-auto max-w-4xl px-4 py-10"><div className="rounded-3xl border border-[#F1C8CE] bg-[#FCEBED] p-6 text-sm font-semibold text-[#A91D2E]">{error}</div></div>
  if (!action) return null

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      <Link href="/dashboard/community/actions" className="inline-flex items-center gap-2 text-xs font-extrabold text-[#607087] hover:text-[#0A2A66]"><ArrowLeft size={14} /> Volver a acciones</Link>

      {error && <div className="mt-4 rounded-2xl border border-[#F1C8CE] bg-[#FCEBED] p-4 text-sm font-semibold text-[#A91D2E]">{error}</div>}

      <section className="mt-4 overflow-hidden rounded-[28px] border border-[#DCE5EF] bg-white shadow-[0_18px_55px_rgba(10,42,102,.07)]">
        <div className="h-1.5 bg-[linear-gradient(90deg,#F5B700_0_33%,#4A90E2_33%_66%,#D72638_66%)]" />
        <div className="p-5 sm:p-7 lg:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 max-w-3xl">
              <div className="flex flex-wrap items-center gap-2 text-[9px] font-extrabold uppercase tracking-[.1em]">
                <span className="rounded-full bg-[#EDF3FA] px-3 py-1.5 text-[#246CB6]">{STATUS_LABEL[action.status]}</span>
                <span className="text-[#7B8799]">{action.category}</span>
              </div>
              <h1 className="mt-3 text-2xl font-extrabold tracking-[-.03em] text-[#0A2A66] sm:text-4xl">{action.title}</h1>
              <div className="mt-3 flex flex-wrap gap-3 text-[10px] font-semibold text-[#7B8799]">
                <span>{action.actor.display_name}</span>
                {action.neighborhood && <span className="inline-flex items-center gap-1"><MapPin size={12} /> {action.neighborhood}</span>}
                <span>Actualizada {formatDate(action.updated_at)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex">
              <div className="rounded-2xl bg-[#EDF3FA] px-5 py-3 text-center"><div className="text-2xl font-extrabold text-[#0A2A66]">{action.civic_score}</div><div className="text-[8px] font-extrabold uppercase text-[#7B8799]">VÉRTICE score</div></div>
              <div className="rounded-2xl bg-[#F7F9FC] px-5 py-3 text-center"><div className="text-2xl font-extrabold text-[#0A2A66]">{action.confidence_score}</div><div className="text-[8px] font-extrabold uppercase text-[#7B8799]">Confianza {CONFIDENCE_LABEL[action.confidence_level]}</div></div>
            </div>
          </div>

          <div className="mt-7 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl bg-[#F7F9FC] p-5"><div className="text-[9px] font-extrabold uppercase tracking-[.1em] text-[#7B8799]">Problema</div><p className="mt-2 text-sm font-medium leading-7 text-[#526176]">{action.problem}</p></div>
            <div className="rounded-2xl bg-[#EDF3FA] p-5"><div className="text-[9px] font-extrabold uppercase tracking-[.1em] text-[#246CB6]">Objetivo verificable</div><p className="mt-2 text-sm font-medium leading-7 text-[#526176]">{action.objective}</p></div>
          </div>

          {action.result_summary && <div className="mt-4 rounded-2xl border border-[#CBE9D1] bg-[#EAF6ED] p-5"><div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.1em] text-[#237D36]"><BadgeCheck size={14} /> Resultado declarado</div><p className="mt-2 text-sm font-medium leading-7 text-[#3E6847]">{action.result_summary}</p></div>}

          <div className="mt-5 flex flex-wrap gap-2">
            {action.target_date && <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F7F9FC] px-3 py-2 text-[9px] font-extrabold text-[#607087]"><Target size={12} /> Meta {action.target_date}</span>}
            {action.beneficiaries_estimate != null && <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F7F9FC] px-3 py-2 text-[9px] font-extrabold text-[#607087]"><Users size={12} /> {action.beneficiaries_estimate} beneficiarios estimados</span>}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF4D1] px-3 py-2 text-[9px] font-extrabold text-[#8A6500]"><ShieldCheck size={12} /> {EVIDENCE_LEVEL_LABEL[action.evidence_level]}</span>
          </div>

          {isOwner && (
            <div className="mt-6 flex flex-wrap gap-2 border-t border-[#E9EDF3] pt-5">
              {nextOwnerAction && <button disabled={working} onClick={() => changeStatus(nextOwnerAction.status)} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#0A2A66] px-4 text-[10px] font-extrabold text-white disabled:opacity-50"><PlayCircle size={14} /> {nextOwnerAction.label}</button>}
              {action.status === 'in_progress' && <button disabled={working} onClick={declareResult} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#2BA745] px-4 text-[10px] font-extrabold text-white disabled:opacity-50"><FileCheck2 size={14} /> Declarar resultado</button>}
              {!['verified', 'under_verification', 'cancelled'].includes(action.status) && <button disabled={working} onClick={() => changeStatus('cancelled')} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#E4B8BE] bg-white px-4 text-[10px] font-extrabold text-[#A91D2E] disabled:opacity-50"><CircleAlert size={14} /> Cancelar acción</button>}
            </div>
          )}
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px]">
        <section className="space-y-5">
          <div className="rounded-[24px] border border-[#E1E7EF] bg-white p-5 shadow-[0_10px_35px_rgba(10,42,102,.05)] sm:p-6">
            <div className="flex items-center justify-between gap-3"><div><div className="text-[9px] font-extrabold uppercase tracking-[.12em] text-[#7B8799]">Evidence ledger</div><h2 className="mt-1 text-lg font-extrabold text-[#0A2A66]">Evidencia trazable</h2></div><ShieldCheck size={20} className="text-[#D98B00]" /></div>
            <div className="mt-4 space-y-3">
              {evidence.length === 0 && <div className="rounded-2xl bg-[#F7F9FC] p-5 text-sm font-medium text-[#607087]">Aún no hay evidencia adjunta.</div>}
              {evidence.map((item) => (
                <a key={item.id} href={item.evidence_url} target="_blank" rel="noreferrer" className="flex gap-3 rounded-2xl border border-[#E1E7EF] p-4 transition hover:bg-[#F7F9FC]">
                  <ShieldCheck size={16} className="mt-0.5 shrink-0 text-[#246CB6]" />
                  <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-[9px] font-extrabold uppercase text-[#246CB6]">{item.evidence_type.replace('_', ' ')}</span><span className="text-[8px] font-bold uppercase text-[#7B8799]">{item.review_status}</span></div><div className="mt-1 truncate text-xs font-extrabold text-[#0A2A66]">{item.description || item.evidence_url}</div>{item.content_hash && <div className="mt-1 truncate font-mono text-[8px] text-[#94A0B0]">sha256:{item.content_hash}</div>}</div>
                  <ExternalLink size={13} className="shrink-0 text-[#94A0B0]" />
                </a>
              ))}
            </div>

            {isOwner && (
              <form onSubmit={submitEvidence} className="mt-5 rounded-2xl bg-[#F7F9FC] p-4">
                <div className="text-[10px] font-extrabold uppercase tracking-[.1em] text-[#0A2A66]">Adjuntar evidencia</div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <select value={evidenceForm.evidence_type} onChange={(event) => setEvidenceForm((current) => ({ ...current, evidence_type: event.target.value as EvidenceType }))} className="min-h-11 rounded-xl border border-[#DCE5EF] bg-white px-3 text-xs text-[#0A2A66]">
                    <option value="photo">Foto</option><option value="video">Video</option><option value="document">Documento</option><option value="location">Ubicación</option><option value="external_record">Registro externo</option>
                  </select>
                  <input required type="url" value={evidenceForm.evidence_url} onChange={(event) => setEvidenceForm((current) => ({ ...current, evidence_url: event.target.value }))} placeholder="URL de la evidencia" className="min-h-11 rounded-xl border border-[#DCE5EF] bg-white px-3 text-xs text-[#0A2A66]" />
                  <input value={evidenceForm.description} onChange={(event) => setEvidenceForm((current) => ({ ...current, description: event.target.value }))} placeholder="Descripción" className="min-h-11 rounded-xl border border-[#DCE5EF] bg-white px-3 text-xs text-[#0A2A66]" />
                  <input type="url" value={evidenceForm.source_url} onChange={(event) => setEvidenceForm((current) => ({ ...current, source_url: event.target.value }))} placeholder="URL fuente externa (si aplica)" className="min-h-11 rounded-xl border border-[#DCE5EF] bg-white px-3 text-xs text-[#0A2A66]" />
                </div>
                <input value={evidenceForm.content_hash} onChange={(event) => setEvidenceForm((current) => ({ ...current, content_hash: event.target.value }))} placeholder="SHA-256 opcional para prevenir reutilización" className="mt-3 min-h-11 w-full rounded-xl border border-[#DCE5EF] bg-white px-3 font-mono text-[10px] text-[#0A2A66]" />
                <button disabled={working} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#0A2A66] px-4 text-[10px] font-extrabold text-white disabled:opacity-50">{working && <Loader2 size={13} className="animate-spin" />} Añadir evidencia</button>
              </form>
            )}
          </div>
        </section>

        <aside className="space-y-5">
          <section className="rounded-[24px] border border-[#E1E7EF] bg-white p-5 shadow-[0_10px_35px_rgba(10,42,102,.05)]">
            <div className="text-[9px] font-extrabold uppercase tracking-[.12em] text-[#7B8799]">Score explicable · {action.score_version}</div>
            <div className="mt-4 space-y-2">
              {action.score_explanation.map((item) => (
                <div key={item.dimension} className="flex items-center justify-between gap-3 text-[10px]"><span className="font-semibold text-[#607087]">{item.label}</span><strong className="text-[#0A2A66]">{item.points}/{item.max_points}</strong></div>
              ))}
            </div>
            <div className="mt-4 rounded-xl bg-[#EDF3FA] p-3 text-[10px] font-semibold leading-5 text-[#526176]">La confianza ({action.confidence_score}/100) no se suma al score. Señala cuánta trazabilidad respalda la calificación.</div>
          </section>

          <section className="rounded-[24px] border border-[#E1E7EF] bg-white p-5 shadow-[0_10px_35px_rgba(10,42,102,.05)]">
            <div className="text-[9px] font-extrabold uppercase tracking-[.12em] text-[#7B8799]">Validación comunitaria</div>
            <div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-xl bg-[#EAF6ED] p-3 text-center"><div className="text-xl font-extrabold text-[#237D36]">{action.community_validation.corroborations}</div><div className="text-[8px] font-bold uppercase text-[#5D8064]">Corroboran</div></div><div className="rounded-xl bg-[#FCEBED] p-3 text-center"><div className="text-xl font-extrabold text-[#A91D2E]">{action.community_validation.disputes}</div><div className="text-[8px] font-bold uppercase text-[#8A5A61]">Disputan</div></div></div>
            {!isOwner && <div className="mt-3 grid grid-cols-2 gap-2"><button disabled={working} onClick={() => validate('corroborate')} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-[#EAF6ED] px-3 text-[9px] font-extrabold text-[#237D36]"><ThumbsUp size={12} /> Corroborar</button><button disabled={working} onClick={() => validate('dispute')} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-[#FCEBED] px-3 text-[9px] font-extrabold text-[#A91D2E]"><MessageSquareWarning size={12} /> Disputar</button></div>}
            <p className="mt-3 text-[9px] font-semibold leading-5 text-[#7B8799]">Solo identidades verificadas pueden validar. Una persona aporta una sola señal y el responsable no puede auto-validarse.</p>
          </section>
        </aside>
      </div>
    </div>
  )
}
