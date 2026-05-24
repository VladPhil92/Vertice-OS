'use client'

import { useEffect, useState } from 'react'
import { FileText, Vote } from 'lucide-react'
import { apiFetch } from '@/lib/api'

interface Proposal {
  id:                      string
  title:                   string
  category:                string
  scope:                   string
  status:                  string
  executive_summary:       string | null
  description:             string
  endorsement_count:       number
  total_votes:             number
  approve_votes_weighted:  number
  reject_votes_weighted:   number
  abstain_votes_weighted:  number
  voting_starts_at:        string | null
  voting_ends_at:          string | null
  quorum_required:         number | null
  approval_threshold:      number | null
  eligible_voters:         number | null
  created_at:              string
}

const SCOPE_LABELS: Record<string, string> = {
  neighborhood: 'Barrio',
  locality:     'Localidad',
  city:         'Cartagena',
  regional:     'Regional',
  national:     'Nacional',
}

const CATEGORY_LABELS: Record<string, string> = {
  infraestructura:   'Infraestructura',
  movilidad:         'Movilidad',
  seguridad:         'Seguridad',
  medio_ambiente:    'Medio ambiente',
  salud:             'Salud',
  educacion:         'Educación',
  cultura:           'Cultura',
  servicios_publicos: 'Servicios Públicos',
  gobernanza:        'Gobernanza',
  otro:              'Otro',
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

function hoursLeft(iso: string): number {
  return (new Date(iso).getTime() - Date.now()) / 3_600_000
}

function VoteBar({ approve, reject, abstain }: { approve: number; reject: number; abstain: number }) {
  const total = approve + reject + abstain
  if (total === 0) return (
    <p className="font-mono text-[10px] text-tertiary">Sé el primero en votar</p>
  )
  const ap = (approve / total) * 100
  const ab = (abstain / total) * 100
  const re = (reject  / total) * 100
  return (
    <div className="space-y-1.5">
      <div className="flex h-2 overflow-hidden rounded-full bg-surface">
        <div className="bg-emerald-500 transition-all" style={{ width: `${ap}%` }} />
        <div className="bg-gold/60 transition-all"    style={{ width: `${ab}%` }} />
        <div className="bg-red-500 transition-all"    style={{ width: `${re}%` }} />
      </div>
      <div className="flex justify-between font-mono text-[9px]">
        <span className="text-emerald-400">A favor {ap.toFixed(0)}%</span>
        <span className="text-gold/70">Abstención {ab.toFixed(0)}%</span>
        <span className="text-red-400">En contra {re.toFixed(0)}%</span>
      </div>
    </div>
  )
}

export default function GovernancePage() {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [voted, setVoted]         = useState<Record<string, number>>({})
  const [voting, setVoting]       = useState<string | null>(null)

  useEffect(() => {
    apiFetch<{ proposals: Proposal[] }>('/governance/proposals?status=voting')
      .then((b) => setProposals(b.proposals ?? []))
      .catch(() => setError('Error cargando propuestas'))
      .finally(() => setLoading(false))
  }, [])

  async function castVote(proposalId: string, value: 1 | 0 | -1) {
    if (voted[proposalId] !== undefined || voting) return
    setVoting(proposalId)
    try {
      await apiFetch(`/governance/proposals/${proposalId}/vote`, {
        method: 'POST',
        body: JSON.stringify({ vote_value: value }),
      })
      setVoted((prev) => ({ ...prev, [proposalId]: value }))
    } catch {
      // apiFetch handles 401 redirect automatically
    } finally {
      setVoting(null)
    }
  }

  return (
    <div>
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8">
          <span className="section-tag">Gobernanza Líquida</span>
          <h1 className="font-display text-2xl font-700 text-primary">Propuestas en votación</h1>
          <p className="mt-1 font-mono text-sm text-secondary">
            Tu voto tiene peso. Cada voto se pondera por tu reputación cívica.
          </p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin rounded-full h-8 w-8 border-t border-gold" />
          </div>
        )}

        {error && (
          <div className="border border-red-500/30 bg-red-500/10 p-4 font-mono text-sm text-red-400">{error}</div>
        )}

        {!loading && !error && proposals.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
            <Vote className="h-12 w-12 text-border" />
            <p className="font-display text-lg text-secondary">No hay propuestas abiertas para votar</p>
            <p className="font-mono text-xs text-tertiary">
              Las propuestas pasan por debate antes de llegar a votación.
            </p>
            <a href="/dashboard/proposals" className="btn-ghost mt-4 text-xs py-2.5 px-6 flex items-center gap-2">
              <FileText className="h-3.5 w-3.5" />
              Ver todas las propuestas
            </a>
          </div>
        )}

        {!loading && proposals.length > 0 && (
          <div className="space-y-6">
            {proposals.map((p) => {
              const hasVoted   = voted[p.id] !== undefined
              const isVoting   = voting === p.id
              const endingSoon = p.voting_ends_at && hoursLeft(p.voting_ends_at) < 24

              return (
                <div key={p.id} className="border border-border bg-surface p-6 space-y-5">
                  {/* Header */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[9px] font-600 uppercase tracking-widest text-gold animate-pulse">
                          Votación activa
                        </span>
                        <span className="font-mono text-[9px] uppercase text-secondary border border-border px-1.5 py-0.5">
                          {SCOPE_LABELS[p.scope] ?? p.scope}
                        </span>
                        <span className="font-mono text-[9px] uppercase text-tertiary">
                          {CATEGORY_LABELS[p.category] ?? p.category}
                        </span>
                      </div>
                      <h2 className="font-display text-base font-700 text-primary">{p.title}</h2>
                    </div>
                    {p.voting_ends_at && (
                      <div className={`text-right font-mono text-[10px] ${endingSoon ? 'text-red-400' : 'text-tertiary'}`}>
                        <div className="uppercase tracking-wider">Cierra</div>
                        <div>{formatDate(p.voting_ends_at)}</div>
                        {endingSoon && <div className="text-[9px] mt-0.5">¡Menos de 24h!</div>}
                      </div>
                    )}
                  </div>

                  {/* Summary */}
                  <p className="font-mono text-[11px] text-secondary">
                    {(p.executive_summary ?? p.description).slice(0, 200)}
                    {(p.executive_summary ?? p.description).length > 200 ? '…' : ''}
                  </p>

                  {/* Progress bar */}
                  <VoteBar
                    approve={Number(p.approve_votes_weighted)}
                    reject={Number(p.reject_votes_weighted)}
                    abstain={Number(p.abstain_votes_weighted)}
                  />

                  {/* Quorum info */}
                  {p.quorum_required !== null && (
                    <div className="flex flex-wrap gap-6 border-t border-border pt-4">
                      <div>
                        <div className="font-mono text-[9px] uppercase tracking-wider text-tertiary">Quórum requerido</div>
                        <div className="font-display text-sm text-gold">{(p.quorum_required * 100).toFixed(0)}%</div>
                      </div>
                      {p.eligible_voters !== null && (
                        <div>
                          <div className="font-mono text-[9px] uppercase tracking-wider text-tertiary">Electores elegibles</div>
                          <div className="font-display text-sm text-primary">{p.eligible_voters.toLocaleString('es-CO')}</div>
                        </div>
                      )}
                      <div>
                        <div className="font-mono text-[9px] uppercase tracking-wider text-tertiary">Votos emitidos</div>
                        <div className="font-display text-sm text-primary">{p.total_votes}</div>
                      </div>
                    </div>
                  )}

                  {/* Vote buttons */}
                  {hasVoted ? (
                    <div className="border border-emerald-500/30 bg-emerald-500/10 p-3 text-center font-mono text-sm text-emerald-400">
                      ✓ Voto registrado —{' '}
                      {voted[p.id] === 1 ? 'A favor' : voted[p.id] === -1 ? 'En contra' : 'Abstención'}
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        onClick={() => castVote(p.id, 1)}
                        disabled={!!isVoting}
                        className="border border-emerald-500/40 bg-emerald-500/10 py-3 font-mono text-[11px] uppercase tracking-wider text-emerald-400 transition-colors hover:bg-emerald-500/20 disabled:opacity-40"
                      >
                        A favor
                      </button>
                      <button
                        onClick={() => castVote(p.id, 0)}
                        disabled={!!isVoting}
                        className="border border-gold/30 bg-gold/5 py-3 font-mono text-[11px] uppercase tracking-wider text-gold transition-colors hover:bg-gold/10 disabled:opacity-40"
                      >
                        Abstención
                      </button>
                      <button
                        onClick={() => castVote(p.id, -1)}
                        disabled={!!isVoting}
                        className="border border-red-500/40 bg-red-500/10 py-3 font-mono text-[11px] uppercase tracking-wider text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-40"
                      >
                        En contra
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
