'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Loader2, AlertTriangle, ThumbsUp,
  Calendar, Clock, CheckCircle, XCircle, Minus,
  Users, BarChart2, Vote,
} from 'lucide-react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'
import { CategoryTag } from '@/components/ui/CategoryTag'

// ── Types ─────────────────────────────────────────────────────────────────────

type ProposalStatus =
  | 'idea' | 'draft' | 'debate' | 'voting'
  | 'approved' | 'rejected' | 'executed'
  | 'archived' | 'failed_execution' | 'quorum_failed'

type ProposalScope = 'neighborhood' | 'locality' | 'city' | 'regional' | 'national'

interface ProposalDetail {
  id: string
  title: string
  description: string
  executive_summary: string | null
  category: string
  scope: ProposalScope
  status: ProposalStatus
  endorsement_count: number
  comment_count: number
  view_count: number
  total_votes: number
  approve_votes_weighted: number
  reject_votes_weighted: number
  abstain_votes_weighted: number
  quorum_required: number | null
  approval_threshold: number | null
  eligible_voters: number | null
  rejection_reason: string | null
  voting_starts_at: string | null
  voting_ends_at: string | null
  decided_at: string | null
  created_at: string
}

interface VoteTally {
  total_votes: number
  approve_weighted: number
  reject_weighted: number
  abstain_weighted: number
  quorum_required: number | null
  approval_threshold: number | null
  eligible_voters: number | null
  quorum_reached: boolean | null
  approval_percentage: number | null
  voting_ends_at: string | null
}

// ── Config ────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ProposalStatus, {
  label: string
  tagVariant: string
  color: string
}> = {
  idea:             { label: 'Idea',           tagVariant: 'servicios',  color: 'rgba(240,237,232,0.22)' },
  draft:            { label: 'Borrador',        tagVariant: 'pendiente',  color: 'rgba(240,237,232,0.22)' },
  debate:           { label: 'En debate',       tagVariant: 'nuevo',      color: '#4ECDC4'                },
  voting:           { label: 'En votación',     tagVariant: 'tendencia',  color: '#FFB522'                },
  approved:         { label: 'Aprobada',        tagVariant: 'resuelto',   color: '#27AE60'                },
  rejected:         { label: 'Rechazada',       tagVariant: 'urgente',    color: '#C0392B'                },
  executed:         { label: 'Ejecutada',       tagVariant: 'resuelto',   color: '#27AE60'                },
  archived:         { label: 'Archivada',       tagVariant: 'pendiente',  color: 'rgba(240,237,232,0.22)' },
  failed_execution: { label: 'Fallo ejecución', tagVariant: 'urgente',    color: '#C0392B'                },
  quorum_failed:    { label: 'Sin quórum',      tagVariant: 'pendiente',  color: 'rgba(240,237,232,0.22)' },
}

const SCOPE_LABELS: Record<ProposalScope, string> = {
  neighborhood: 'Barrio',
  locality:     'Localidad',
  city:         'Ciudad',
  regional:     'Regional',
  national:     'Nacional',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

function formatShortDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function timeRemaining(iso: string | null): string {
  if (!iso) return ''
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Finalizado'
  const days    = Math.floor(diff / 86400000)
  const hours   = Math.floor((diff % 86400000) / 3600000)
  if (days > 0)  return `${days}d ${hours}h restantes`
  const minutes = Math.floor((diff % 3600000) / 60000)
  return `${hours}h ${minutes}m restantes`
}

// ── Vote bar ──────────────────────────────────────────────────────────────────

function VoteBar({ approve, reject, abstain }: { approve: number; reject: number; abstain: number }) {
  const total = approve + reject + abstain
  if (total === 0) {
    return (
      <div className="h-2 w-full rounded-full bg-white/5" />
    )
  }
  const aPct = Math.round((approve / total) * 100)
  const rPct = Math.round((reject  / total) * 100)
  const abPct = 100 - aPct - rPct
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full">
      <div style={{ width: `${aPct}%`,  backgroundColor: '#27AE60' }} />
      <div style={{ width: `${rPct}%`,  backgroundColor: '#C0392B' }} />
      <div style={{ width: `${abPct}%`, backgroundColor: 'rgba(240,237,232,0.12)' }} />
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProposalDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [proposal, setProposal]   = useState<ProposalDetail | null>(null)
  const [tally, setTally]         = useState<VoteTally | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [endorsing, setEndorsing] = useState(false)
  const [voting, setVoting]       = useState(false)
  const [voteResult, setVoteResult] = useState<'cast' | 'error' | null>(null)

  const loadProposal = useCallback(async () => {
    if (!id) return
    try {
      const [p, t] = await Promise.all([
        apiFetch<ProposalDetail>(`/governance/proposals/${id}`, { public: true }),
        apiFetch<VoteTally>(`/governance/proposals/${id}/tally`, { public: true })
          .catch(() => null),
      ])
      setProposal(p)
      setTally(t)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { void loadProposal() }, [loadProposal])

  async function handleEndorse() {
    if (!proposal || endorsing) return
    setEndorsing(true)
    try {
      const res = await apiFetch<{ endorsement_count: number }>(`/governance/proposals/${id}/endorse`, { method: 'POST' })
      setProposal(prev => prev ? { ...prev, endorsement_count: res.endorsement_count } : prev)
    } catch { /* apiFetch handles 401 redirect */ }
    finally { setEndorsing(false) }
  }

  async function handleVote(voteValue: 1 | -1 | 0) {
    if (!proposal || voting) return
    setVoting(true)
    try {
      await apiFetch(`/governance/proposals/${id}/vote`, {
        method: 'POST',
        body: JSON.stringify({ vote_value: voteValue }),
      })
      setVoteResult('cast')
      const updated = await apiFetch<VoteTally>(`/governance/proposals/${id}/tally`, { public: true })
      setTally(updated)
    } catch {
      setVoteResult('error')
    } finally {
      setVoting(false)
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 size={22} className="animate-spin text-gold" />
      </div>
    )
  }

  if (error || !proposal) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <AlertTriangle size={28} strokeWidth={1.5} className="mx-auto mb-4 text-tertiary" />
        <p className="font-mono text-[13px] text-secondary">
          {error ?? 'Propuesta no encontrada'}
        </p>
        <button
          onClick={() => router.back()}
          className="mt-4 font-mono text-[11px] uppercase tracking-wider text-gold hover:opacity-70"
        >
          ← Volver
        </button>
      </div>
    )
  }

  const sc = STATUS_CONFIG[proposal.status] ?? STATUS_CONFIG.idea
  const inDebate = proposal.status === 'debate'
  const inVoting = proposal.status === 'voting'

  const totalWeighted = (tally?.approve_weighted ?? 0)
    + (tally?.reject_weighted ?? 0)
    + (tally?.abstain_weighted ?? 0)

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 space-y-8">

      {/* ── Back nav ─────────────────────────────────────────────────── */}
      <nav className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-tertiary transition-colors hover:text-gold"
        >
          <ArrowLeft size={11} />
          Propuestas
        </button>
        <span className="text-tertiary/40">/</span>
        <span className="font-mono text-[10px] text-tertiary">Detalle</span>
      </nav>

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div>
        <div className="mb-3 h-0.5 w-12" style={{ backgroundColor: sc.color }} />

        <div className="flex items-start justify-between gap-4">
          <h1 className="font-display text-2xl font-bold leading-tight text-primary">
            {proposal.title}
          </h1>
          <CategoryTag variant={sc.tagVariant} label={sc.label} size="md" />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">
            {proposal.category.replace(/_/g, ' ')}
          </span>
          <span
            className="font-mono text-[10px] uppercase tracking-[0.15em] border px-2 py-0.5"
            style={{ color: sc.color, borderColor: `${sc.color}30` }}
          >
            {SCOPE_LABELS[proposal.scope] ?? proposal.scope}
          </span>
          <span className="flex items-center gap-1 font-mono text-[10px] text-tertiary">
            <Calendar size={9} />
            {formatShortDate(proposal.created_at)}
          </span>
        </div>
      </div>

      {/* ── Executive summary ────────────────────────────────────────── */}
      {proposal.executive_summary && (
        <div className="border-l-2 pl-4" style={{ borderColor: sc.color }}>
          <p className="font-mono text-[12px] leading-relaxed text-secondary italic">
            {proposal.executive_summary}
          </p>
        </div>
      )}

      {/* ── Description ──────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary">
          Descripción
        </h2>
        <p className="font-mono text-[13px] leading-relaxed text-secondary whitespace-pre-wrap">
          {proposal.description}
        </p>
      </div>

      {/* ── Vote tally ───────────────────────────────────────────────── */}
      {(inVoting || proposal.status === 'approved' || proposal.status === 'rejected' || proposal.status === 'quorum_failed') && tally && (
        <div className="space-y-4 border border-border bg-surface p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary flex items-center gap-2">
              <BarChart2 size={12} />
              Resultado de votación
            </h2>
            {inVoting && proposal.voting_ends_at && (
              <span className="font-mono text-[10px] text-gold animate-pulse">
                {timeRemaining(proposal.voting_ends_at)}
              </span>
            )}
          </div>

          <VoteBar
            approve={tally.approve_weighted}
            reject={tally.reject_weighted}
            abstain={tally.abstain_weighted}
          />

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'A favor',    value: tally.approve_weighted, color: '#27AE60', icon: CheckCircle },
              { label: 'En contra',  value: tally.reject_weighted,  color: '#C0392B', icon: XCircle },
              { label: 'Abstención', value: tally.abstain_weighted, color: 'rgba(240,237,232,0.22)', icon: Minus },
            ].map(({ label, value, color, icon: Icon }) => (
              <div key={label} className="flex flex-col gap-1.5 border border-border p-3">
                <div className="flex items-center gap-1.5">
                  <Icon size={11} style={{ color }} strokeWidth={1.5} />
                  <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-tertiary">{label}</span>
                </div>
                <span className="font-mono text-[15px] font-semibold" style={{ color }}>
                  {totalWeighted > 0 ? `${Math.round((value / totalWeighted) * 100)}%` : '—'}
                </span>
                <span className="font-mono text-[9px] text-tertiary">
                  {Math.round(value)} votos ponderados
                </span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[10px] font-mono text-tertiary">
            <span className="flex items-center gap-1.5">
              <Vote size={10} />
              {tally.total_votes} participantes
            </span>
            {tally.quorum_required && (
              <span>
                Quórum: {tally.quorum_reached ? '✓ alcanzado' : `${tally.quorum_required} requerido`}
              </span>
            )}
            {tally.approval_threshold && (
              <span>Umbral: {Math.round(tally.approval_threshold * 100)}%</span>
            )}
          </div>
        </div>
      )}

      {/* ── Voting action ─────────────────────────────────────────────── */}
      {inVoting && voteResult !== 'cast' && (
        <div className="space-y-3 border border-gold/20 bg-gold/5 p-5">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold flex items-center gap-2">
            <Vote size={12} />
            Emite tu voto
          </h2>
          {voteResult === 'error' && (
            <p className="font-mono text-[11px] text-red-400">
              No se pudo registrar tu voto. Verifica que hayas iniciado sesión.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleVote(1)}
              disabled={voting}
              className="flex items-center gap-2 border border-emerald/40 bg-emerald/10 px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-emerald transition-colors hover:bg-emerald/20 disabled:opacity-50"
            >
              <CheckCircle size={12} strokeWidth={1.5} />
              A favor
            </button>
            <button
              onClick={() => handleVote(-1)}
              disabled={voting}
              className="flex items-center gap-2 border border-red/40 bg-red/10 px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-red transition-colors hover:bg-red/20 disabled:opacity-50"
            >
              <XCircle size={12} strokeWidth={1.5} />
              En contra
            </button>
            <button
              onClick={() => handleVote(0)}
              disabled={voting}
              className="flex items-center gap-2 border border-border px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-tertiary transition-colors hover:text-secondary disabled:opacity-50"
            >
              <Minus size={12} strokeWidth={1.5} />
              Abstención
            </button>
          </div>
          {voting && (
            <div className="flex items-center gap-2">
              <Loader2 size={12} className="animate-spin text-gold" />
              <span className="font-mono text-[10px] text-tertiary">Registrando voto…</span>
            </div>
          )}
        </div>
      )}

      {voteResult === 'cast' && (
        <div className="flex items-center gap-3 border border-emerald/30 bg-emerald/5 px-5 py-4">
          <CheckCircle size={14} className="text-emerald flex-shrink-0" strokeWidth={1.5} />
          <span className="font-mono text-[12px] text-secondary">
            Voto registrado correctamente. Gracias por participar.
          </span>
        </div>
      )}

      {/* ── Stats row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
        <div className="flex flex-col gap-2 bg-surface p-4">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-tertiary">Avales</span>
          <div className="flex items-center gap-2">
            <ThumbsUp size={13} className="text-gold" strokeWidth={1.5} />
            <span className="font-mono text-[15px] text-gold">{proposal.endorsement_count}</span>
          </div>
        </div>
        <div className="flex flex-col gap-2 bg-surface p-4">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-tertiary">Participantes</span>
          <div className="flex items-center gap-2">
            <Users size={13} className="text-secondary" strokeWidth={1.5} />
            <span className="font-mono text-[15px] text-secondary">{proposal.total_votes}</span>
          </div>
        </div>
        <div className="flex flex-col gap-2 bg-surface p-4">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-tertiary">Creada</span>
          <span className="flex items-center gap-1.5 font-mono text-[11px] text-secondary">
            <Calendar size={10} />
            {formatShortDate(proposal.created_at)}
          </span>
        </div>
        <div className="flex flex-col gap-2 bg-surface p-4">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-tertiary">
            {proposal.voting_ends_at ? 'Cierre votación' : proposal.decided_at ? 'Decidida' : 'Estado'}
          </span>
          <span className="flex items-center gap-1.5 font-mono text-[11px] text-secondary">
            <Clock size={10} />
            {formatShortDate(proposal.voting_ends_at ?? proposal.decided_at)}
          </span>
        </div>
      </div>

      {/* ── Rejection reason ─────────────────────────────────────────── */}
      {proposal.rejection_reason && (
        <div className="space-y-2 border border-red/20 bg-red/5 px-5 py-4">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-red-400">
            Motivo de rechazo
          </span>
          <p className="font-mono text-[12px] text-secondary">{proposal.rejection_reason}</p>
        </div>
      )}

      {/* ── Actions ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 border-t border-border pt-6">
        {inDebate && (
          <button
            onClick={handleEndorse}
            disabled={endorsing}
            className="flex items-center gap-2 border border-gold/40 bg-gold/10 px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-gold transition-colors hover:bg-gold/20 disabled:opacity-50"
          >
            <ThumbsUp size={12} strokeWidth={1.5} />
            {endorsing ? 'Avalando…' : `Avalar (${proposal.endorsement_count})`}
          </button>
        )}
        <Link
          href="/dashboard/proposals"
          className="flex items-center gap-2 border border-border px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-tertiary transition-colors hover:text-secondary"
        >
          <ArrowLeft size={12} />
          Volver a la lista
        </Link>
      </div>

    </div>
  )
}
