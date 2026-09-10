'use client'

import { useCallback, useEffect, useState } from 'react'
import { FileText, ShieldCheck, Vote } from 'lucide-react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'
import {
  eligibilityExperience,
  type GovernanceEligibility,
} from '@/lib/governance-eligibility'

interface Proposal {
  id: string
  title: string
  category: string
  scope: string
  status: string
  executive_summary: string | null
  description: string
  endorsement_count: number
  total_votes: number
  approve_votes_weighted: number
  reject_votes_weighted: number
  abstain_votes_weighted: number
  voting_starts_at: string | null
  voting_ends_at: string | null
  quorum_required: number | null
  approval_threshold: number | null
  eligible_voters: number | null
  created_at: string
}

const SCOPE_LABELS: Record<string, string> = {
  neighborhood: 'Barrio',
  locality: 'Localidad',
  city: 'Ciudad',
  regional: 'Regional',
  national: 'Nacional',
}

const CATEGORY_LABELS: Record<string, string> = {
  infraestructura: 'Infraestructura',
  movilidad: 'Movilidad',
  seguridad: 'Seguridad',
  medio_ambiente: 'Medio ambiente',
  salud: 'Salud',
  educacion: 'Educación',
  cultura: 'Cultura',
  servicios_publicos: 'Servicios Públicos',
  gobernanza: 'Gobernanza',
  otro: 'Otro',
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
  if (total === 0) return <p className="font-mono text-[10px] text-tertiary">Aún no hay votos registrados</p>
  const ap = (approve / total) * 100
  const ab = (abstain / total) * 100
  const re = (reject / total) * 100
  return (
    <div className="space-y-1.5">
      <div className="flex h-2 overflow-hidden rounded-full bg-surface">
        <div className="bg-emerald-500 transition-all" style={{ width: `${ap}%` }} />
        <div className="bg-gold/60 transition-all" style={{ width: `${ab}%` }} />
        <div className="bg-red-500 transition-all" style={{ width: `${re}%` }} />
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
  const [eligibility, setEligibility] = useState<Record<string, GovernanceEligibility | null>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [voted, setVoted] = useState<Record<string, number>>({})
  const [voting, setVoting] = useState<string | null>(null)

  const loadEligibility = useCallback(async (items: Proposal[]) => {
    const results = await Promise.allSettled(
      items.map(async (proposal) => [
        proposal.id,
        await apiFetch<GovernanceEligibility>(`/governance/proposals/${proposal.id}/eligibility`),
      ] as const),
    )
    const next: Record<string, GovernanceEligibility | null> = {}
    for (const result of results) {
      if (result.status === 'fulfilled') next[result.value[0]] = result.value[1]
    }
    for (const proposal of items) {
      if (!(proposal.id in next)) next[proposal.id] = null
    }
    setEligibility(next)
  }, [])

  useEffect(() => {
    apiFetch<{ data: Proposal[]; count: number }>('/governance/proposals?status=voting', { public: true })
      .then(async (body) => {
        const items = body.data ?? []
        setProposals(items)
        await loadEligibility(items)
      })
      .catch(() => setError('Error cargando propuestas'))
      .finally(() => setLoading(false))
  }, [loadEligibility])

  async function castVote(proposalId: string, value: 1 | 0 | -1) {
    if (voted[proposalId] !== undefined || voting) return
    if (eligibility[proposalId]?.eligible !== true) return
    setVoting(proposalId)
    try {
      await apiFetch(`/governance/proposals/${proposalId}/vote`, {
        method: 'POST',
        body: JSON.stringify({ vote_value: value }),
      })
      setVoted((prev) => ({ ...prev, [proposalId]: value }))
      await loadEligibility(proposals)
    } catch {
      await loadEligibility(proposals)
    } finally {
      setVoting(null)
    }
  }

  return (
    <div>
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8">
          <span className="section-tag">Gobernanza cívica</span>
          <h1 className="font-display text-2xl font-700 text-primary">Propuestas en votación</h1>
          <p className="mt-1 max-w-3xl font-mono text-sm leading-6 text-secondary">
            Cada integrante del padrón congelado cuenta como un elector. La delegación puede representar a otra persona, pero una participación directa reemplaza esa delegación y evita el doble conteo.
          </p>
        </div>

        <div className="mb-6 border border-border bg-surface p-4 font-mono text-[11px] leading-5 text-secondary">
          <ShieldCheck className="mr-2 inline h-4 w-4 text-gold" />
          La aplicación consulta tu elegibilidad al servidor para cada propuesta. GPS, reputación, pagos o cambiar el contexto activo no pueden habilitar un voto.
        </div>

        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="h-8 w-8 animate-spin rounded-full border-t border-gold" />
          </div>
        )}

        {error && (
          <div className="border border-red-500/30 bg-red-500/10 p-4 font-mono text-sm text-red-400">{error}</div>
        )}

        {!loading && !error && proposals.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
            <Vote className="h-12 w-12 text-border" />
            <p className="font-display text-lg text-secondary">No hay propuestas abiertas para votar</p>
            <p className="font-mono text-xs text-tertiary">Las propuestas pasan por debate antes de llegar a votación.</p>
            <Link href="/dashboard/proposals" className="btn-ghost mt-4 flex items-center gap-2 px-6 py-2.5 text-xs">
              <FileText className="h-3.5 w-3.5" />
              Ver todas las propuestas
            </Link>
          </div>
        )}

        {!loading && proposals.length > 0 && (
          <div className="space-y-6">
            {proposals.map((proposal) => {
              const hasVoted = voted[proposal.id] !== undefined
              const isVoting = voting === proposal.id
              const endingSoon = proposal.voting_ends_at && hoursLeft(proposal.voting_ends_at) < 24
              const preflight = eligibility[proposal.id]
              const experience = preflight ? eligibilityExperience(preflight.reason_code) : null
              const canVote = preflight?.eligible === true && !hasVoted

              return (
                <div key={proposal.id} className="space-y-5 border border-border bg-surface p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="animate-pulse font-mono text-[9px] font-600 uppercase tracking-widest text-gold">Votación activa</span>
                        <span className="border border-border px-1.5 py-0.5 font-mono text-[9px] uppercase text-secondary">
                          {SCOPE_LABELS[proposal.scope] ?? proposal.scope}
                        </span>
                        <span className="font-mono text-[9px] uppercase text-tertiary">{CATEGORY_LABELS[proposal.category] ?? proposal.category}</span>
                      </div>
                      <h2 className="font-display text-base font-700 text-primary">{proposal.title}</h2>
                    </div>
                    {proposal.voting_ends_at && (
                      <div className={`text-right font-mono text-[10px] ${endingSoon ? 'text-red-400' : 'text-tertiary'}`}>
                        <div className="uppercase tracking-wider">Cierra</div>
                        <div>{formatDate(proposal.voting_ends_at)}</div>
                        {endingSoon && <div className="mt-0.5 text-[9px]">¡Menos de 24h!</div>}
                      </div>
                    )}
                  </div>

                  <p className="font-mono text-[11px] text-secondary">
                    {(proposal.executive_summary ?? proposal.description).slice(0, 200)}
                    {(proposal.executive_summary ?? proposal.description).length > 200 ? '…' : ''}
                  </p>

                  <VoteBar
                    approve={Number(proposal.approve_votes_weighted)}
                    reject={Number(proposal.reject_votes_weighted)}
                    abstain={Number(proposal.abstain_votes_weighted)}
                  />

                  {proposal.quorum_required !== null && (
                    <div className="flex flex-wrap gap-6 border-t border-border pt-4">
                      <div>
                        <div className="font-mono text-[9px] uppercase tracking-wider text-tertiary">Quórum requerido</div>
                        <div className="font-display text-sm text-gold">{(proposal.quorum_required * 100).toFixed(0)}%</div>
                      </div>
                      {proposal.eligible_voters !== null && (
                        <div>
                          <div className="font-mono text-[9px] uppercase tracking-wider text-tertiary">Electores elegibles</div>
                          <div className="font-display text-sm text-primary">{proposal.eligible_voters.toLocaleString('es-CO')}</div>
                        </div>
                      )}
                      <div>
                        <div className="font-mono text-[9px] uppercase tracking-wider text-tertiary">Votos emitidos</div>
                        <div className="font-display text-sm text-primary">{proposal.total_votes}</div>
                      </div>
                    </div>
                  )}

                  {preflight && experience ? (
                    <div className={`border p-4 ${experience.tone === 'positive'
                      ? 'border-emerald-500/30 bg-emerald-500/10'
                      : experience.tone === 'warning'
                        ? 'border-gold/30 bg-gold/5'
                        : 'border-red-500/30 bg-red-500/10'}`}>
                      <div className="font-display text-sm font-700 text-primary">{experience.title}</div>
                      <p className="mt-1 font-mono text-[10px] leading-5 text-secondary">{experience.description}</p>
                      <div className="mt-2 font-mono text-[9px] uppercase tracking-wider text-tertiary">
                        Autoridad: {preflight.authority === 'frozen_electorate' ? 'padrón congelado' : preflight.authority === 'current_assurance' ? 'assurance vigente' : 'sin autorización'}
                      </div>
                      {experience.actionHref && experience.actionLabel && !preflight.eligible && (
                        <Link href={experience.actionHref} className="mt-3 inline-block border border-border px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-primary hover:border-gold hover:text-gold">
                          {experience.actionLabel}
                        </Link>
                      )}
                    </div>
                  ) : (
                    <div className="border border-red-500/30 bg-red-500/10 p-4 font-mono text-[10px] leading-5 text-red-400">
                      No fue posible certificar tu elegibilidad en este momento. Los controles de voto permanecen bloqueados por seguridad.
                    </div>
                  )}

                  {hasVoted ? (
                    <div className="border border-emerald-500/30 bg-emerald-500/10 p-3 text-center font-mono text-sm text-emerald-400">
                      ✓ Voto registrado — {voted[proposal.id] === 1 ? 'A favor' : voted[proposal.id] === -1 ? 'En contra' : 'Abstención'}
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        onClick={() => castVote(proposal.id, 1)}
                        disabled={!canVote || isVoting}
                        className="border border-emerald-500/40 bg-emerald-500/10 py-3 font-mono text-[11px] uppercase tracking-wider text-emerald-400 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-30"
                      >A favor</button>
                      <button
                        onClick={() => castVote(proposal.id, 0)}
                        disabled={!canVote || isVoting}
                        className="border border-gold/30 bg-gold/5 py-3 font-mono text-[11px] uppercase tracking-wider text-gold transition-colors hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-30"
                      >Abstención</button>
                      <button
                        onClick={() => castVote(proposal.id, -1)}
                        disabled={!canVote || isVoting}
                        className="border border-red-500/40 bg-red-500/10 py-3 font-mono text-[11px] uppercase tracking-wider text-red-400 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-30"
                      >En contra</button>
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
