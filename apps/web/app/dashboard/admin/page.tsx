'use client'

import { useEffect, useState, useCallback } from 'react'
import { Shield, ChevronRight, RefreshCw, AlertCircle, CheckCircle, Archive } from 'lucide-react'
import { apiFetch } from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

type ReportStatus = 'open' | 'in_progress' | 'resolved' | 'rejected' | 'duplicate'
type ProposalStatus = 'idea' | 'draft' | 'debate' | 'voting' | 'approved' | 'rejected' | 'archived' | 'executed'

interface ReportSummary {
  id: string
  title: string
  category: string
  neighborhood: string | null
  status: ReportStatus
  urgency_score: number
  created_at: string
  lng: number
  lat: number
}

interface ProposalSummary {
  id: string
  title: string
  category: string
  scope: string
  status: ProposalStatus
  endorsement_count: number
  total_votes: number
  created_at: string
}

// ─── Config ───────────────────────────────────────────────────────────────────

const REPORT_STATUS_OPTIONS: ReportStatus[] = ['open', 'in_progress', 'resolved', 'rejected', 'duplicate']

const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  open:        'Abierto',
  in_progress: 'En proceso',
  resolved:    'Resuelto',
  rejected:    'Rechazado',
  duplicate:   'Duplicado',
}

const PROPOSAL_STATUS_LABEL: Record<ProposalStatus, { label: string; color: string }> = {
  idea:     { label: 'Idea',      color: 'text-tertiary'    },
  draft:    { label: 'Borrador',  color: 'text-secondary'   },
  debate:   { label: 'Debate',    color: 'text-cyan'        },
  voting:   { label: 'Votación',  color: 'text-gold'        },
  approved: { label: 'Aprobada',  color: 'text-emerald-400' },
  rejected: { label: 'Rechazada', color: 'text-red-400'     },
  archived: { label: 'Archivada', color: 'text-tertiary'    },
  executed: { label: 'Ejecutada', color: 'text-emerald-400' },
}

const PROPOSAL_ADVANCE_LABEL: Partial<Record<ProposalStatus, string>> = {
  idea:   'Avanzar → Borrador',
  draft:  'Avanzar → Debate',
  debate: 'Abrir votación',
  voting: 'Aprobar',
}

// ─── Access guard ─────────────────────────────────────────────────────────────

function getTokenRole(): string {
  try {
    const token = localStorage.getItem('access_token')
    if (!token) return 'citizen'
    const payload = JSON.parse(atob(token.split('.')[1]))
    return (payload.role as string) ?? 'citizen'
  } catch {
    return 'citizen'
  }
}

// ─── Reports tab ─────────────────────────────────────────────────────────────

function ReportsQueue() {
  const [reports, setReports] = useState<ReportSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [updating, setUpdating] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = filterStatus ? `?status=${filterStatus}` : ''
      const res = await apiFetch<{ data: ReportSummary[] }>(`/territorial/admin/reports${qs}`)
      setReports(res.data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [filterStatus])

  useEffect(() => { load() }, [load])

  async function changeStatus(reportId: string, newStatus: ReportStatus) {
    setUpdating(reportId)
    try {
      await apiFetch(`/territorial/reports/${reportId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      })
      setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: newStatus } : r))
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setUpdating(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="rounded border border-border bg-surface px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-secondary focus:outline-none focus:border-gold"
        >
          <option value="">Todos los estados</option>
          {REPORT_STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{REPORT_STATUS_LABEL[s]}</option>
          ))}
        </select>
        <button
          onClick={load}
          className="flex items-center gap-1.5 rounded border border-border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-secondary transition-colors hover:border-gold hover:text-gold"
        >
          <RefreshCw size={11} />
          Actualizar
        </button>
        <span className="font-mono text-[11px] text-tertiary">{reports.length} reportes</span>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded border border-red/30 bg-red/5 px-4 py-3 font-mono text-[12px] text-red-400">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded border border-border bg-surface" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <p className="py-12 text-center font-mono text-[12px] text-tertiary">
          No hay reportes con ese filtro
        </p>
      ) : (
        <div className="space-y-2">
          {reports.map(report => (
            <div
              key={report.id}
              className="flex items-center gap-4 rounded border border-border bg-surface px-4 py-3 transition-colors hover:border-gold/30"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-[12px] text-primary">{report.title}</p>
                <p className="font-mono text-[10px] text-tertiary">
                  {report.category} · {report.neighborhood ?? 'Sin barrio'} ·{' '}
                  {new Date(report.created_at).toLocaleDateString('es-CO')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={report.status}
                  onChange={e => changeStatus(report.id, e.target.value as ReportStatus)}
                  disabled={updating === report.id}
                  className="rounded border border-border bg-bg px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-secondary focus:outline-none focus:border-gold disabled:opacity-50"
                >
                  {REPORT_STATUS_OPTIONS.map(s => (
                    <option key={s} value={s}>{REPORT_STATUS_LABEL[s]}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Proposals tab ────────────────────────────────────────────────────────────

function ProposalsQueue() {
  const [proposals, setProposals] = useState<ProposalSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [acting, setActing] = useState<string | null>(null)
  const [archiveReason, setArchiveReason] = useState<string>('')
  const [archiving, setArchiving] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = filterStatus ? `?status=${filterStatus}` : ''
      const res = await apiFetch<{ data: ProposalSummary[] }>(`/governance/admin/proposals${qs}`)
      setProposals(res.data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [filterStatus])

  useEffect(() => { load() }, [load])

  async function advance(proposalId: string) {
    setActing(proposalId)
    try {
      const updated = await apiFetch<ProposalSummary>(`/governance/admin/proposals/${proposalId}/advance`, {
        method: 'POST',
      })
      setProposals(prev => prev.map(p => p.id === proposalId ? { ...p, status: updated.status } : p))
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setActing(null)
    }
  }

  async function archive(proposalId: string) {
    const reason = archiveReason.trim() || 'Archivada por moderador'
    setActing(proposalId)
    setArchiving(null)
    try {
      const updated = await apiFetch<ProposalSummary>(`/governance/admin/proposals/${proposalId}/archive`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      })
      setProposals(prev => prev.map(p => p.id === proposalId ? { ...p, status: updated.status } : p))
      setArchiveReason('')
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setActing(null)
    }
  }

  const activeStatuses = ['idea', 'draft', 'debate', 'voting']

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="rounded border border-border bg-surface px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-secondary focus:outline-none focus:border-gold"
        >
          <option value="">Todos los estados</option>
          {Object.keys(PROPOSAL_STATUS_LABEL).map(s => (
            <option key={s} value={s}>{PROPOSAL_STATUS_LABEL[s as ProposalStatus].label}</option>
          ))}
        </select>
        <button
          onClick={load}
          className="flex items-center gap-1.5 rounded border border-border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-secondary transition-colors hover:border-gold hover:text-gold"
        >
          <RefreshCw size={11} />
          Actualizar
        </button>
        <span className="font-mono text-[11px] text-tertiary">{proposals.length} propuestas</span>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded border border-red/30 bg-red/5 px-4 py-3 font-mono text-[12px] text-red-400">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded border border-border bg-surface" />
          ))}
        </div>
      ) : proposals.length === 0 ? (
        <p className="py-12 text-center font-mono text-[12px] text-tertiary">
          No hay propuestas con ese filtro
        </p>
      ) : (
        <div className="space-y-2">
          {proposals.map(proposal => {
            const sc = PROPOSAL_STATUS_LABEL[proposal.status]
            const canAdvance = activeStatuses.includes(proposal.status)
            const canArchive = !['archived', 'executed', 'approved'].includes(proposal.status)
            const isActing = acting === proposal.id

            return (
              <div key={proposal.id} className="rounded border border-border bg-surface transition-colors hover:border-gold/30">
                <div className="flex items-center gap-4 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-[12px] text-primary">{proposal.title}</p>
                    <p className="font-mono text-[10px] text-tertiary">
                      {proposal.category} · {proposal.scope} ·{' '}
                      {proposal.endorsement_count} avales · {proposal.total_votes} votos ·{' '}
                      {new Date(proposal.created_at).toLocaleDateString('es-CO')}
                    </p>
                  </div>
                  <span className={`font-mono text-[10px] uppercase tracking-wider ${sc.color}`}>
                    {sc.label}
                  </span>
                  <div className="flex items-center gap-2">
                    {canAdvance && (
                      <button
                        onClick={() => advance(proposal.id)}
                        disabled={isActing}
                        className="flex items-center gap-1 rounded border border-gold/40 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-gold transition-colors hover:bg-gold/10 disabled:opacity-50"
                      >
                        <ChevronRight size={10} />
                        {PROPOSAL_ADVANCE_LABEL[proposal.status] ?? 'Avanzar'}
                      </button>
                    )}
                    {canArchive && (
                      <button
                        onClick={() => setArchiving(archiving === proposal.id ? null : proposal.id)}
                        disabled={isActing}
                        className="flex items-center gap-1 rounded border border-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-tertiary transition-colors hover:border-red/40 hover:text-red-400 disabled:opacity-50"
                      >
                        <Archive size={10} />
                        Archivar
                      </button>
                    )}
                  </div>
                </div>

                {archiving === proposal.id && (
                  <div className="flex items-center gap-2 border-t border-border px-4 py-2">
                    <input
                      type="text"
                      placeholder="Motivo del archivo (opcional)"
                      value={archiveReason}
                      onChange={e => setArchiveReason(e.target.value)}
                      className="flex-1 rounded border border-border bg-bg px-3 py-1.5 font-mono text-[11px] text-primary placeholder-tertiary focus:border-red/40 focus:outline-none"
                    />
                    <button
                      onClick={() => archive(proposal.id)}
                      disabled={isActing}
                      className="flex items-center gap-1 rounded border border-red/40 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-red-400 transition-colors hover:bg-red/10 disabled:opacity-50"
                    >
                      <CheckCircle size={10} />
                      Confirmar
                    </button>
                    <button
                      onClick={() => setArchiving(null)}
                      className="font-mono text-[10px] uppercase tracking-wider text-tertiary hover:text-primary"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'reports' | 'proposals'

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('reports')
  const [role, setRole] = useState<string>('citizen')

  useEffect(() => {
    setRole(getTokenRole())
  }, [])

  if (!['moderator', 'admin'].includes(role)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <Shield size={40} className="mx-auto mb-4 text-tertiary" />
          <p className="font-mono text-[13px] text-secondary">Acceso restringido a moderadores</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <Shield size={20} className="text-gold" />
        <div>
          <h1 className="font-display text-xl font-semibold uppercase tracking-wide text-primary">
            Panel de Moderación
          </h1>
          <p className="font-mono text-[11px] uppercase tracking-widest text-tertiary">
            {role === 'admin' ? 'Administrador' : 'Moderador'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 border-b border-border">
        {(['reports', 'proposals'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              'px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider transition-colors',
              tab === t
                ? 'border-b-2 border-gold text-gold'
                : 'text-tertiary hover:text-secondary',
            ].join(' ')}
          >
            {t === 'reports' ? 'Reportes Territoriales' : 'Propuestas Ciudadanas'}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'reports' ? <ReportsQueue /> : <ProposalsQueue />}
    </div>
  )
}
