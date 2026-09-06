'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Eye,
  FileText,
  GitPullRequest,
  RefreshCw,
  Shield,
  Users,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'

type Role = 'citizen' | 'moderator' | 'admin' | 'superadmin'

interface RoleContext {
  assigned_roles: Role[]
  active_role: Role
}

interface PilotMetrics {
  window_days: number
  cohort: {
    active_citizens: number
    registered_7d: number
    active_7d: number
    verified_citizens: number
    federated_citizens: number
    public_profiles: number
    verification_rate_pct: number
    federation_rate_pct: number
    weekly_active_rate_pct: number
    meaningful_participation_rate_pct: number
  }
  participation: {
    meaningful_participants_7d: number
    reports_7d: number
    proposals_7d: number
    endorsements_7d: number
    validations_7d: number
    follows_7d: number
    attribution_note: string
  }
  operations: {
    reports: { open: number; in_progress: number; resolved: number }
    proposals: { debate: number; voting: number }
    evidence: { corroborations_7d: number; disputes_7d: number }
    privileged_users: number
  }
  geography: {
    privacy_min_group_size: number
    top_neighborhoods: Array<{ neighborhood: string; citizen_count: number }>
    privacy_note: string
  }
  score_policy: {
    social_popularity_affects_reputation: boolean
    community_validation_affects_reputation: boolean
    note: string
  }
  generated_at: string
}

const PILOT_ROLES: Role[] = ['admin', 'superadmin']

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string
  value: number | string
  detail?: string
  icon: typeof Users
}) {
  return (
    <div className="rounded border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest text-tertiary">{label}</span>
        <Icon size={14} className="text-gold" />
      </div>
      <p className="font-display text-2xl font-semibold text-primary">{value}</p>
      {detail && <p className="mt-1 font-mono text-[10px] text-tertiary">{detail}</p>}
    </div>
  )
}

function RateRow({ label, value }: { label: string; value: number }) {
  const safeValue = Math.max(0, Math.min(100, value))
  return (
    <div>
      <div className="mb-1 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider">
        <span className="text-secondary">{label}</span>
        <span className="text-primary">{value.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded bg-bg">
        <div className="h-full bg-gold transition-all" style={{ width: `${safeValue}%` }} />
      </div>
    </div>
  )
}

export default function PilotControlCenterPage() {
  const [roleContext, setRoleContext] = useState<RoleContext | null>(null)
  const [data, setData] = useState<PilotMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const context = await apiFetch<RoleContext>('/auth/roles')
      setRoleContext(context)
      if (!PILOT_ROLES.includes(context.active_role)) {
        setData(null)
        return
      }
      setData(await apiFetch<PilotMetrics>('/dashboard/admin/pilot'))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible cargar el control del piloto')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <div className="flex items-center gap-2 font-mono text-[12px] text-tertiary">
          <RefreshCw size={14} className="animate-spin" />
          Consolidando métricas del piloto…
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 lg:p-8">
        <div className="rounded border border-red/30 bg-red/5 p-5">
          <div className="flex items-center gap-2 text-red-400">
            <AlertCircle size={16} />
            <span className="font-mono text-[12px]">No fue posible cargar el Control Center</span>
          </div>
          <p className="mt-2 font-mono text-[10px] text-tertiary">{error}</p>
          <button
            onClick={load}
            className="mt-4 rounded border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-secondary hover:border-gold hover:text-gold"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (!roleContext || !PILOT_ROLES.includes(roleContext.active_role)) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <div className="max-w-md text-center">
          <Shield size={38} className="mx-auto mb-4 text-tertiary" />
          <p className="font-mono text-[13px] text-secondary">Control del piloto restringido a administradores</p>
          <p className="mt-2 font-mono text-[10px] text-tertiary">
            La moderación operativa continúa disponible en el panel administrativo general.
          </p>
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-8 p-6 lg:p-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-gold">
            <Activity size={13} />
            Piloto controlado · ventana {data.window_days} días
          </div>
          <h1 className="font-display text-2xl font-semibold uppercase tracking-wide text-primary">
            Pilot Control Center
          </h1>
          <p className="mt-1 max-w-2xl font-mono text-[11px] leading-relaxed text-tertiary">
            Estado agregado de cohorte, identidad, participación y operación. No expone PII ni reatribuye votos anónimos.
          </p>
        </div>
        <button
          onClick={load}
          className="flex w-fit items-center gap-2 rounded border border-border px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-secondary hover:border-gold hover:text-gold"
        >
          <RefreshCw size={12} />
          Actualizar
        </button>
      </header>

      <section>
        <h2 className="mb-3 font-mono text-[11px] uppercase tracking-widest text-secondary">Cohorte</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <MetricCard label="Ciudadanos activos" value={data.cohort.active_citizens} icon={Users} />
          <MetricCard label="Registros 7d" value={data.cohort.registered_7d} icon={Users} />
          <MetricCard label="Activos 7d" value={data.cohort.active_7d} icon={Activity} />
          <MetricCard label="Verificados" value={data.cohort.verified_citizens} icon={CheckCircle2} />
          <MetricCard label="Federados" value={data.cohort.federated_citizens} icon={Shield} />
          <MetricCard label="Perfiles públicos" value={data.cohort.public_profiles} icon={Eye} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded border border-border bg-surface p-5">
          <h2 className="mb-5 font-mono text-[11px] uppercase tracking-widest text-secondary">Embudo de activación</h2>
          <div className="space-y-4">
            <RateRow label="Identidad verificada" value={data.cohort.verification_rate_pct} />
            <RateRow label="Identidad federada" value={data.cohort.federation_rate_pct} />
            <RateRow label="Actividad semanal" value={data.cohort.weekly_active_rate_pct} />
            <RateRow label="Participación significativa" value={data.cohort.meaningful_participation_rate_pct} />
          </div>
        </div>

        <div className="rounded border border-border bg-surface p-5">
          <h2 className="mb-5 font-mono text-[11px] uppercase tracking-widest text-secondary">Participación · 7 días</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 font-mono text-[11px]">
            <div><p className="text-tertiary">Participantes significativos</p><p className="mt-1 text-lg text-primary">{data.participation.meaningful_participants_7d}</p></div>
            <div><p className="text-tertiary">Reportes</p><p className="mt-1 text-lg text-primary">{data.participation.reports_7d}</p></div>
            <div><p className="text-tertiary">Propuestas</p><p className="mt-1 text-lg text-primary">{data.participation.proposals_7d}</p></div>
            <div><p className="text-tertiary">Avales</p><p className="mt-1 text-lg text-primary">{data.participation.endorsements_7d}</p></div>
            <div><p className="text-tertiary">Validaciones</p><p className="mt-1 text-lg text-primary">{data.participation.validations_7d}</p></div>
            <div><p className="text-tertiary">Seguimientos</p><p className="mt-1 text-lg text-primary">{data.participation.follows_7d}</p></div>
          </div>
          <p className="mt-5 border-t border-border pt-3 font-mono text-[9px] leading-relaxed text-tertiary">
            {data.participation.attribution_note}
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-mono text-[11px] uppercase tracking-widest text-secondary">Operación y moderación</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Reportes abiertos"
            value={data.operations.reports.open}
            detail={`${data.operations.reports.in_progress} en proceso · ${data.operations.reports.resolved} resueltos`}
            icon={FileText}
          />
          <MetricCard
            label="Propuestas activas"
            value={data.operations.proposals.debate + data.operations.proposals.voting}
            detail={`${data.operations.proposals.debate} debate · ${data.operations.proposals.voting} votación`}
            icon={GitPullRequest}
          />
          <MetricCard
            label="Disputas evidencia 7d"
            value={data.operations.evidence.disputes_7d}
            detail={`${data.operations.evidence.corroborations_7d} corroboraciones`}
            icon={AlertCircle}
          />
          <MetricCard
            label="Operadores privilegiados"
            value={data.operations.privileged_users}
            detail="moderator · admin · superadmin"
            icon={Shield}
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded border border-border bg-surface p-5">
          <h2 className="mb-4 font-mono text-[11px] uppercase tracking-widest text-secondary">Distribución territorial</h2>
          {data.geography.top_neighborhoods.length === 0 ? (
            <p className="font-mono text-[11px] text-tertiary">Aún no hay cohortes territoriales publicables.</p>
          ) : (
            <div className="divide-y divide-border">
              {data.geography.top_neighborhoods.map((item) => (
                <div key={item.neighborhood} className="flex items-center justify-between py-2.5 font-mono text-[11px]">
                  <span className="text-secondary">{item.neighborhood}</span>
                  <span className="text-primary">{item.citizen_count}</span>
                </div>
              ))}
            </div>
          )}
          <p className="mt-4 font-mono text-[9px] leading-relaxed text-tertiary">{data.geography.privacy_note}</p>
        </div>

        <div className="rounded border border-emerald-400/20 bg-emerald-400/5 p-5">
          <div className="mb-3 flex items-center gap-2 text-emerald-400">
            <CheckCircle2 size={15} />
            <h2 className="font-mono text-[11px] uppercase tracking-widest">Integridad del score</h2>
          </div>
          <p className="font-mono text-[11px] leading-relaxed text-secondary">{data.score_policy.note}</p>
          <div className="mt-4 space-y-2 font-mono text-[10px] text-tertiary">
            <p>Popularidad social → reputación: NO</p>
            <p>Corroboración comunitaria → reputación: NO</p>
          </div>
        </div>
      </section>

      <footer className="border-t border-border pt-4 font-mono text-[9px] uppercase tracking-wider text-tertiary">
        Generado {new Date(data.generated_at).toLocaleString('es-CO')}
      </footer>
    </div>
  )
}
