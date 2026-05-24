'use client'

import { useEffect, useState } from 'react'
import { ThumbsUp } from 'lucide-react'
import { apiFetch } from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

type ProposalStatus =
  | 'idea' | 'draft' | 'debate' | 'voting'
  | 'approved' | 'rejected' | 'executed'

type ProposalScope =
  | 'neighborhood' | 'locality' | 'city' | 'regional' | 'national'

interface Proposal {
  id:                string
  title:             string
  category:          string
  scope:             ProposalScope
  status:            ProposalStatus
  executive_summary: string | null
  description:       string
  endorsement_count: number
  comment_count:     number
  created_at:        string
}

// ─── Config maps ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  ProposalStatus,
  { label: string; className: string }
> = {
  idea:     { label: 'Idea',     className: 'text-tertiary'                     },
  draft:    { label: 'Borrador', className: 'text-secondary'                    },
  debate:   { label: 'Debate',   className: 'text-cyan'                         },
  voting:   { label: 'Votación', className: 'text-gold animate-pulse'           },
  approved: { label: 'Aprobada', className: 'text-emerald-400'                  },
  rejected: { label: 'Rechazada',className: 'text-red-400'                      },
  executed: { label: 'Ejecutada',className: 'text-cyan'                         },
}

const SCOPE_LABELS: Record<ProposalScope, string> = {
  neighborhood: 'Barrio',
  locality:     'Localidad',
  city:         'Ciudad',
  regional:     'Regional',
  national:     'Nacional',
}

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '',         label: 'Todos los estados'    },
  { value: 'idea',     label: 'Idea'                 },
  { value: 'draft',    label: 'Borrador'             },
  { value: 'debate',   label: 'Debate'               },
  { value: 'voting',   label: 'Votación'             },
  { value: 'approved', label: 'Aprobada'             },
  { value: 'rejected', label: 'Rechazada'            },
  { value: 'executed', label: 'Ejecutada'            },
]

const SCOPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '',             label: 'Todos los alcances' },
  { value: 'neighborhood', label: 'Barrio'             },
  { value: 'locality',     label: 'Localidad'          },
  { value: 'city',         label: 'Ciudad'             },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ES_MONTHS = [
  'Ene','Feb','Mar','Abr','May','Jun',
  'Jul','Ago','Sep','Oct','Nov','Dic',
]

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  const dd  = String(d.getDate()).padStart(2, '0')
  const mmm = ES_MONTHS[d.getMonth()]
  const yyyy = d.getFullYear()
  return `${dd} ${mmm} ${yyyy}`
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max).trimEnd() + '…'
}

const SELECT_CLASS =
  'bg-surface border border-border focus:border-gold/50 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-secondary outline-none transition-colors'

// ─── Proposal card ────────────────────────────────────────────────────────────

interface ProposalCardProps {
  proposal:       Proposal
  onEndorse:      (id: string) => void
  endorsing:      boolean
}

function ProposalCard({ proposal, onEndorse, endorsing }: ProposalCardProps) {
  const status   = STATUS_CONFIG[proposal.status] ?? STATUS_CONFIG.idea
  const preview  = proposal.executive_summary?.trim()
    ? truncate(proposal.executive_summary, 120)
    : truncate(proposal.description, 120)

  return (
    <article className="flex flex-col gap-4 border border-border bg-surface p-6 transition-all hover:border-border-active">
      {/* Top row: status + scope */}
      <div className="flex items-center justify-between">
        <span className={`font-mono text-[10px] uppercase tracking-[0.2em] ${status.className}`}>
          {status.label}
        </span>
        <span
          className="font-mono text-[9px] uppercase tracking-[0.2em] text-gold border border-gold/20 px-2 py-0.5"
        >
          {SCOPE_LABELS[proposal.scope] ?? proposal.scope}
        </span>
      </div>

      {/* Title + category */}
      <div>
        <h2 className="font-display text-sm font-bold text-primary leading-snug">
          {proposal.title}
        </h2>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-secondary">
          {proposal.category.replace(/_/g, ' ')}
        </p>
      </div>

      {/* Preview */}
      <p className="font-mono text-[11px] leading-relaxed text-secondary">
        {preview}
      </p>

      {/* Footer: endorse + date */}
      <div className="mt-auto flex items-center justify-between pt-2 border-t border-border">
        <button
          onClick={() => onEndorse(proposal.id)}
          disabled={endorsing}
          title="Avalar esta propuesta"
          className="flex items-center gap-2 font-mono text-[11px] text-tertiary hover:text-gold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ThumbsUp
            size={13}
            strokeWidth={1.5}
            className={endorsing ? 'opacity-50' : ''}
          />
          <span>{proposal.endorsement_count}</span>
          <span className="uppercase tracking-[0.1em] text-[10px]">
            {proposal.endorsement_count === 1 ? 'aval' : 'avales'}
          </span>
        </button>

        <time
          dateTime={proposal.created_at}
          className="font-mono text-[10px] text-tertiary"
        >
          {formatDate(proposal.created_at)}
        </time>
      </div>
    </article>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProposalsPage() {
  const [proposals,  setProposals]  = useState<Proposal[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterScope,  setFilterScope]  = useState('')
  const [endorsingId,  setEndorsingId]  = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    apiFetch<{ proposals: Proposal[] }>('/governance/proposals')
      .then((data) => {
        if (!cancelled) setProposals(data.proposals ?? [])
      })
      .catch(() => {
        if (!cancelled) setError('No se pudieron cargar las propuestas. Intenta de nuevo.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  async function handleEndorse(id: string) {
    if (endorsingId) return
    setEndorsingId(id)

    // Optimistic update
    setProposals(prev =>
      prev.map(p =>
        p.id === id ? { ...p, endorsement_count: p.endorsement_count + 1 } : p,
      ),
    )

    try {
      await apiFetch(`/governance/proposals/${id}/endorse`, { method: 'POST' })
    } catch {
      // Roll back on any error (apiFetch handles 401 redirect automatically)
      setProposals(prev =>
        prev.map(p =>
          p.id === id ? { ...p, endorsement_count: p.endorsement_count - 1 } : p,
        ),
      )
    } finally {
      setEndorsingId(null)
    }
  }

  const filtered = proposals.filter(p => {
    if (filterStatus && p.status !== filterStatus) return false
    if (filterScope  && p.scope  !== filterScope)  return false
    return true
  })

  return (
    <div>
      <main className="mx-auto max-w-5xl px-6 py-10">
        {/* Page heading + CTA */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="section-tag">Módulo de Gobernanza</span>
            <h1 className="font-display text-3xl font-bold text-primary">
              Propuestas ciudadanas
            </h1>
            <p className="mt-2 font-mono text-sm text-secondary">
              Iniciativas presentadas por la comunidad de Cartagena.
            </p>
          </div>
          <a href="/dashboard/proposals/new" className="btn-primary shrink-0">
            Nueva propuesta
          </a>
        </div>

        {/* Filters */}
        <div className="mb-8 flex flex-wrap items-center gap-3">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className={SELECT_CLASS}
          >
            {STATUS_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <select
            value={filterScope}
            onChange={e => setFilterScope(e.target.value)}
            className={SELECT_CLASS}
          >
            {SCOPE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {(filterStatus || filterScope) && (
            <button
              onClick={() => { setFilterStatus(''); setFilterScope('') }}
              className="font-mono text-[10px] uppercase tracking-[0.15em] text-tertiary hover:text-primary transition-colors"
            >
              Limpiar filtros ×
            </button>
          )}

          {!loading && (
            <span className="ml-auto font-mono text-[10px] text-tertiary uppercase tracking-[0.15em]">
              {filtered.length} {filtered.length === 1 ? 'propuesta' : 'propuestas'}
            </span>
          )}
        </div>

        {/* States */}
        {loading && (
          <div className="flex flex-col items-center justify-center gap-5 py-24">
            <svg
              className="animate-spin h-8 w-8 text-gold"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-20"
                cx="12" cy="12" r="10"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                className="opacity-80"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg>
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-tertiary">
              Cargando propuestas…
            </span>
          </div>
        )}

        {!loading && error && (
          <div className="border border-red-500/30 bg-red-500/10 px-6 py-8 text-center">
            <p className="font-mono text-sm text-red-400">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 font-mono text-[11px] uppercase tracking-[0.15em] text-tertiary hover:text-primary transition-colors"
            >
              Reintentar →
            </button>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="border border-border bg-surface px-6 py-16 text-center">
            <p className="font-display text-lg text-secondary">
              {proposals.length === 0
                ? 'Todavía no hay propuestas publicadas.'
                : 'Ninguna propuesta coincide con los filtros seleccionados.'}
            </p>
            <p className="mt-3 font-mono text-sm text-tertiary">
              {proposals.length === 0 && (
                <>
                  Sé el primero —{' '}
                  <a
                    href="/dashboard/proposals/new"
                    className="text-gold hover:underline"
                  >
                    crea una propuesta
                  </a>
                  .
                </>
              )}
            </p>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(proposal => (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                onEndorse={handleEndorse}
                endorsing={endorsingId === proposal.id}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
