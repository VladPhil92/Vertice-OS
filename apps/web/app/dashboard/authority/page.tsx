'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Crown,
  ExternalLink,
  History,
  LockKeyhole,
  MapPinned,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
  ShieldCheck,
  UserCog,
  Users,
  Vote,
} from 'lucide-react'
import { requireApiBaseUrl } from '@/lib/api'

type Role = 'citizen' | 'moderator' | 'admin' | 'superadmin'
type Tab = 'overview' | 'roles' | 'audit' | 'system'

type UserRow = {
  id: string
  email: string | null
  display_name: string | null
  roles: Role[]
}

type ControlPlaneOverview = {
  authority: {
    citizens_total: number
    active_citizens: number
    verified_citizens: number
    moderators: number
    admins: number
    superadmins: number
    privileged_sessions: number
  }
  operations: {
    reports_open: number
    reports_in_progress: number
    proposals_active: number
    proposals_voting: number
    audit_events_24h: number
  }
  guardrails: {
    last_superadmin_protected: boolean
    audit_log_append_only: boolean
    vote_mutation_exposed: boolean
    manual_identity_override_exposed: boolean
  }
  generated_at: string
}

type AuditEvent = {
  id: string
  actor: {
    citizen_id: string
    display_name: string | null
    email: string | null
  }
  action: string
  target: {
    type: string
    id: string
  }
  result: string
  reason: string | null
  metadata: unknown
  created_at: string
}

type HealthState = {
  status: 'ok' | 'degraded' | 'unavailable'
  checks: Record<string, 'ok' | 'fail'>
  capabilities: Record<string, string>
  version: string
  revision: string
  timestamp: string
}

const ROLE_LABELS: Record<Role, string> = {
  citizen: 'Ciudadano',
  moderator: 'Moderador',
  admin: 'Administrador',
  superadmin: 'Superadmin',
}

const EDITABLE_ROLES: Role[] = ['moderator', 'admin', 'superadmin']

const TABS: Array<{ id: Tab; label: string; icon: typeof Crown }> = [
  { id: 'overview', label: 'Centro de control', icon: Crown },
  { id: 'roles', label: 'Usuarios y autoridad', icon: Users },
  { id: 'audit', label: 'Auditoría', icon: History },
  { id: 'system', label: 'Estado del sistema', icon: Server },
]

function tokenRole(): string {
  try {
    const token = localStorage.getItem('access_token')
    if (!token) return 'citizen'
    const payload = JSON.parse(atob(token.split('.')[1])) as { role?: string }
    return payload.role ?? 'citizen'
  } catch {
    return 'citizen'
  }
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-CO').format(value)
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function Metric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="rounded-2xl border border-[#E1E7EF] bg-white p-5 shadow-sm">
      <div className="text-[9px] font-extrabold uppercase tracking-[.13em] text-[#7B8799]">{label}</div>
      <div className="mt-2 text-3xl font-extrabold text-[#0A2A66]">{formatNumber(value)}</div>
      <div className="mt-1 text-xs leading-5 text-[#607087]">{detail}</div>
    </div>
  )
}

export default function AuthorityPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [overview, setOverview] = useState<ControlPlaneOverview | null>(null)
  const [audit, setAudit] = useState<AuditEvent[]>([])
  const [health, setHealth] = useState<HealthState | null>(null)
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const request = useCallback(async <T,>(path: string): Promise<T> => {
    const token = localStorage.getItem('access_token')
    if (!token) throw new Error('Sesión no disponible')
    const baseUrl = requireApiBaseUrl()
    const response = await fetch(`${baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
    })
    if (response.status === 403) {
      setAuthorized(false)
      throw new Error('El rol Superadmin no está activo en esta sesión')
    }
    const data = await response.json() as T & { error?: string }
    if (!response.ok) throw new Error(data.error ?? 'La operación no pudo completarse')
    return data
  }, [])

  const loadControlPlane = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const token = localStorage.getItem('access_token')
      if (!token) throw new Error('Sesión no disponible')
      const baseUrl = requireApiBaseUrl()
      const [overviewData, auditData, healthResponse] = await Promise.all([
        request<ControlPlaneOverview>('/superadmin/overview'),
        request<{ data: AuditEvent[] }>('/superadmin/audit?limit=40'),
        fetch(`${baseUrl}/health/ready`, { credentials: 'include' }),
      ])
      const healthData = await healthResponse.json() as HealthState
      setOverview(overviewData)
      setAudit(auditData.data)
      setHealth(healthData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar el plano de control')
    } finally {
      setLoading(false)
    }
  }, [request])

  const loadUsers = useCallback(async (search = '') => {
    setLoading(true)
    setError('')
    try {
      const token = localStorage.getItem('access_token')
      if (!token) throw new Error('Sesión no disponible')
      const baseUrl = requireApiBaseUrl()
      const response = await fetch(`${baseUrl}/auth/role-admin/users?q=${encodeURIComponent(search)}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      })
      if (response.status === 403) {
        setAuthorized(false)
        return
      }
      const data = await response.json() as { users?: UserRow[]; error?: string }
      if (!response.ok) throw new Error(data.error ?? 'No fue posible cargar los usuarios')
      setUsers(data.users ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar los usuarios')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const isSuperadmin = tokenRole() === 'superadmin'
    setAuthorized(isSuperadmin)
    if (isSuperadmin) {
      void Promise.all([loadControlPlane(), loadUsers('')])
    }
  }, [loadControlPlane, loadUsers])

  function toggleRole(user: UserRow, role: Role) {
    if (role === 'citizen') return
    setUsers((current) => current.map((item) => {
      if (item.id !== user.id) return item
      const hasRole = item.roles.includes(role)
      const roles = hasRole
        ? item.roles.filter((existing) => existing !== role)
        : [...item.roles, role]
      return { ...item, roles: ['citizen', ...roles.filter((value) => value !== 'citizen')] as Role[] }
    }))
  }

  async function saveRoles(user: UserRow) {
    const token = localStorage.getItem('access_token')
    if (!token) return
    setSavingId(user.id)
    setError('')
    setMessage('')
    try {
      const baseUrl = requireApiBaseUrl()
      const response = await fetch(`${baseUrl}/auth/role-admin/users/${user.id}/roles`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({ roles: user.roles }),
      })
      const data = await response.json() as { roles?: Role[]; error?: string }
      if (!response.ok) throw new Error(data.error ?? 'No fue posible guardar los roles')
      setUsers((current) => current.map((item) => (
        item.id === user.id ? { ...item, roles: data.roles ?? user.roles } : item
      )))
      setMessage('Roles actualizados y registrados en auditoría.')
      await loadControlPlane()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible guardar los roles')
      await loadUsers(query)
    } finally {
      setSavingId(null)
    }
  }

  if (authorized === null) {
    return <div className="p-8 text-sm font-semibold text-[#607087]">Validando autoridad…</div>
  }

  if (!authorized) {
    return (
      <div className="mx-auto max-w-2xl p-6 sm:p-10">
        <div className="rounded-3xl border border-[#E5CBD0] bg-white p-8 shadow-sm">
          <ShieldAlert className="text-[#D72638]" size={28} />
          <h1 className="mt-4 text-2xl font-extrabold text-[#0A2A66]">Acceso reservado al Superadmin</h1>
          <p className="mt-3 text-sm leading-6 text-[#607087]">
            Activa el rol Superadmin desde el selector del dashboard. La autorización también se valida en el servidor.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F7F9FC]">
      <div className="mx-auto w-full max-w-7xl p-5 sm:p-8 lg:p-10">
        <section className="overflow-hidden rounded-[28px] bg-[#071F4D] text-white shadow-[0_24px_70px_rgba(10,42,102,.18)]">
          <div className="flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.16em] text-[#F5D46E]">
                <Crown size={15} /> Autoridad raíz · Superadmin
              </div>
              <h1 className="mt-3 font-display text-3xl font-extrabold tracking-[-.03em] sm:text-4xl">Control VÉRTICE</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#C9D7EB]">
                Gobierno técnico y operacional de la plataforma. La autoridad administra accesos y operaciones, pero no puede reescribir votos, auditoría ni convertir manualmente una identidad en verificada.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void Promise.all([loadControlPlane(), loadUsers(query)])}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-xs font-extrabold disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualizar estado
            </button>
          </div>
        </section>

        <nav className="mt-5 flex gap-2 overflow-x-auto pb-1" aria-label="Secciones del Control VÉRTICE">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              type="button"
              key={id}
              onClick={() => setTab(id)}
              aria-current={tab === id ? 'page' : undefined}
              className={[
                'inline-flex flex-shrink-0 items-center gap-2 rounded-xl border px-4 py-3 text-xs font-extrabold transition',
                tab === id
                  ? 'border-[#0A2A66] bg-[#0A2A66] text-white'
                  : 'border-[#DCE4EE] bg-white text-[#607087] hover:border-[#AFC1D9] hover:text-[#0A2A66]',
              ].join(' ')}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </nav>

        {error && <div className="mt-5 rounded-xl border border-[#F1C8CE] bg-[#FCEBED] px-4 py-3 text-xs font-bold text-[#A11D2A]">{error}</div>}
        {message && <div className="mt-5 rounded-xl border border-[#CBE9D1] bg-[#F1F8F2] px-4 py-3 text-xs font-bold text-[#246B32]">{message}</div>}

        {tab === 'overview' && (
          <div className="mt-6 space-y-6">
            <section>
              <div className="flex items-center gap-2 text-[#0A2A66]">
                <Users size={17} />
                <h2 className="text-sm font-extrabold uppercase tracking-[.08em]">Autoridad y cuentas</h2>
              </div>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Ciudadanos" value={overview?.authority.citizens_total ?? 0} detail={`${formatNumber(overview?.authority.active_citizens ?? 0)} cuentas activas`} />
                <Metric label="Identidades verificadas" value={overview?.authority.verified_citizens ?? 0} detail="Nivel de verificación ≥ 1" />
                <Metric label="Superadmins" value={overview?.authority.superadmins ?? 0} detail={`${formatNumber(overview?.authority.admins ?? 0)} admins · ${formatNumber(overview?.authority.moderators ?? 0)} moderadores`} />
                <Metric label="Sesiones privilegiadas" value={overview?.authority.privileged_sessions ?? 0} detail="Roles operativos activos ahora" />
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
              <div className="rounded-3xl border border-[#E1E7EF] bg-white p-5 shadow-sm sm:p-6">
                <div className="flex items-center gap-2 text-[#0A2A66]">
                  <Activity size={17} />
                  <h2 className="text-sm font-extrabold uppercase tracking-[.08em]">Operación cívica</h2>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <Link href="/dashboard/admin" className="rounded-2xl border border-[#E1E7EF] p-4 transition hover:border-[#AFC1D9]">
                    <div className="flex items-center gap-2 text-sm font-extrabold text-[#0A2A66]"><MapPinned size={16} /> Moderación territorial</div>
                    <p className="mt-2 text-xs leading-5 text-[#607087]">{formatNumber((overview?.operations.reports_open ?? 0) + (overview?.operations.reports_in_progress ?? 0))} reportes abiertos o en gestión.</p>
                  </Link>
                  <Link href="/dashboard/admin" className="rounded-2xl border border-[#E1E7EF] p-4 transition hover:border-[#AFC1D9]">
                    <div className="flex items-center gap-2 text-sm font-extrabold text-[#0A2A66]"><Vote size={16} /> Gobernanza activa</div>
                    <p className="mt-2 text-xs leading-5 text-[#607087]">{formatNumber(overview?.operations.proposals_active ?? 0)} iniciativas activas · {formatNumber(overview?.operations.proposals_voting ?? 0)} en votación.</p>
                  </Link>
                  <Link href="/dashboard/admin/pilot" className="rounded-2xl border border-[#E1E7EF] p-4 transition hover:border-[#AFC1D9]">
                    <div className="flex items-center gap-2 text-sm font-extrabold text-[#0A2A66]"><Activity size={16} /> Piloto Cartagena</div>
                    <p className="mt-2 text-xs leading-5 text-[#607087]">Accede al control operacional del piloto sin mezclarlo con autoridad raíz.</p>
                  </Link>
                  <button type="button" onClick={() => setTab('audit')} className="rounded-2xl border border-[#E1E7EF] p-4 text-left transition hover:border-[#AFC1D9]">
                    <div className="flex items-center gap-2 text-sm font-extrabold text-[#0A2A66]"><History size={16} /> Auditoría administrativa</div>
                    <p className="mt-2 text-xs leading-5 text-[#607087]">{formatNumber(overview?.operations.audit_events_24h ?? 0)} eventos registrados durante las últimas 24 horas.</p>
                  </button>
                </div>
              </div>

              <div className="rounded-3xl border border-[#D8E2EF] bg-[#EDF3FA] p-5 sm:p-6">
                <div className="flex items-center gap-2 text-[#0A2A66]">
                  <LockKeyhole size={17} />
                  <h2 className="text-sm font-extrabold uppercase tracking-[.08em]">Límites de autoridad</h2>
                </div>
                <div className="mt-5 space-y-3">
                  {[
                    ['Último Superadmin protegido', overview?.guardrails.last_superadmin_protected],
                    ['Auditoría append-only', overview?.guardrails.audit_log_append_only],
                    ['Mutación de votos no expuesta', overview ? !overview.guardrails.vote_mutation_exposed : false],
                    ['Override manual de identidad no expuesto', overview ? !overview.guardrails.manual_identity_override_exposed : false],
                  ].map(([label, ok]) => (
                    <div key={String(label)} className="flex items-start gap-3 rounded-xl bg-white/80 p-3">
                      {ok ? <CheckCircle2 size={17} className="mt-0.5 flex-shrink-0 text-[#2BA745]" /> : <AlertTriangle size={17} className="mt-0.5 flex-shrink-0 text-[#D98B00]" />}
                      <span className="text-xs font-bold leading-5 text-[#40516A]">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        )}

        {tab === 'roles' && (
          <section className="mt-6 rounded-3xl border border-[#E1E7EF] bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-[#D98B00]"><Crown size={15} /><span className="text-[10px] font-extrabold uppercase tracking-[.14em]">Concesiones de autoridad</span></div>
                <h2 className="mt-2 text-xl font-extrabold text-[#0A2A66]">Usuarios y roles</h2>
                <p className="mt-1 text-xs leading-5 text-[#607087]">Toda modificación es autorizada por backend y registrada en el log administrativo.</p>
              </div>
            </div>

            <form
              className="mt-5 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                void loadUsers(query)
              }}
            >
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8A97A8]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por nombre, correo o ID ciudadano"
                  className="w-full rounded-xl border border-[#D6DFEA] py-3 pl-10 pr-4 text-sm text-[#0A2A66] outline-none focus:border-[#4A90E2]"
                />
              </div>
              <button className="rounded-xl bg-[#0A2A66] px-5 py-3 text-xs font-extrabold text-white">Buscar</button>
            </form>

            <div className="mt-6 space-y-3">
              {loading && users.length === 0 ? (
                <div className="py-10 text-center text-sm font-semibold text-[#7B8799]">Cargando usuarios…</div>
              ) : users.length === 0 ? (
                <div className="py-10 text-center text-sm font-semibold text-[#7B8799]">No se encontraron usuarios.</div>
              ) : users.map((user) => (
                <div key={user.id} className="rounded-2xl border border-[#E1E7EF] p-4 sm:p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <UserCog size={16} className="text-[#4A90E2]" />
                        <span className="truncate text-sm font-extrabold text-[#0A2A66]">{user.display_name || user.email || 'Ciudadano VÉRTICE'}</span>
                      </div>
                      {user.email && <div className="mt-1 truncate text-xs font-semibold text-[#7B8799]">{user.email}</div>}
                      <div className="mt-1 font-mono text-[10px] text-[#9AA6B5]">{user.id}</div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-lg border border-[#D6DFEA] bg-[#F7F9FC] px-3 py-2 text-[11px] font-bold text-[#607087]">Ciudadano</span>
                      {EDITABLE_ROLES.map((role) => {
                        const checked = user.roles.includes(role)
                        return (
                          <label key={role} className={[
                            'cursor-pointer rounded-lg border px-3 py-2 text-[11px] font-bold transition',
                            checked ? 'border-[#0A2A66] bg-[#EAF1FB] text-[#0A2A66]' : 'border-[#D6DFEA] bg-white text-[#7B8799]',
                          ].join(' ')}>
                            <input type="checkbox" className="mr-2 align-middle" checked={checked} onChange={() => toggleRole(user, role)} />
                            {ROLE_LABELS[role]}
                          </label>
                        )
                      })}
                      <button
                        type="button"
                        disabled={savingId === user.id}
                        onClick={() => void saveRoles(user)}
                        className="rounded-lg bg-[#0A2A66] px-4 py-2 text-[11px] font-extrabold text-white disabled:opacity-50"
                      >
                        {savingId === user.id ? 'Guardando…' : 'Guardar roles'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === 'audit' && (
          <section className="mt-6 rounded-3xl border border-[#E1E7EF] bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-[#0A2A66]"><History size={16} /><span className="text-[10px] font-extrabold uppercase tracking-[.14em]">Registro de solo lectura</span></div>
                <h2 className="mt-2 text-xl font-extrabold text-[#0A2A66]">Auditoría administrativa</h2>
                <p className="mt-1 text-xs leading-5 text-[#607087]">Quién actuó, qué hizo, sobre qué recurso y con qué resultado. Esta superficie no ofrece edición ni eliminación.</p>
              </div>
              <button type="button" onClick={() => void loadControlPlane()} className="rounded-xl border border-[#D6DFEA] p-2.5 text-[#607087]" aria-label="Actualizar auditoría"><RefreshCw size={15} /></button>
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-[#E1E7EF]">
              {audit.length === 0 ? (
                <div className="p-8 text-center text-sm font-semibold text-[#7B8799]">No hay eventos administrativos para mostrar.</div>
              ) : audit.map((event, index) => (
                <div key={event.id} className={`grid gap-3 p-4 lg:grid-cols-[1.1fr_1.3fr_1fr_.8fr] ${index > 0 ? 'border-t border-[#E9EDF2]' : ''}`}>
                  <div>
                    <div className="text-xs font-extrabold text-[#0A2A66]">{event.actor.display_name || event.actor.email || 'Operador VÉRTICE'}</div>
                    <div className="mt-1 text-[10px] text-[#8A97A8]">{formatDate(event.created_at)}</div>
                  </div>
                  <div>
                    <div className="font-mono text-[11px] font-bold text-[#40516A]">{event.action}</div>
                    {event.reason && <div className="mt-1 text-[10px] text-[#7B8799]">{event.reason}</div>}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[9px] font-extrabold uppercase tracking-[.08em] text-[#9AA6B5]">{event.target.type}</div>
                    <div className="mt-1 truncate font-mono text-[10px] text-[#607087]" title={event.target.id}>{event.target.id}</div>
                  </div>
                  <div>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[9px] font-extrabold uppercase ${event.result === 'success' || event.result === 'granted' ? 'bg-[#EAF6ED] text-[#237D36]' : 'bg-[#FFF4D1] text-[#8A6500]'}`}>
                      {event.result}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === 'system' && (
          <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_.8fr]">
            <div className="rounded-3xl border border-[#E1E7EF] bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-2 text-[#0A2A66]"><Server size={16} /><h2 className="text-sm font-extrabold uppercase tracking-[.08em]">Dependencias de runtime</h2></div>
              <div className="mt-5 space-y-3">
                {health ? Object.entries(health.checks).map(([name, state]) => (
                  <div key={name} className="flex items-center justify-between rounded-xl border border-[#E5EAF0] p-4">
                    <span className="text-xs font-extrabold capitalize text-[#40516A]">{name}</span>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-extrabold uppercase ${state === 'ok' ? 'bg-[#EAF6ED] text-[#237D36]' : 'bg-[#FCEBED] text-[#A11D2A]'}`}>
                      {state === 'ok' ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}{state}
                    </span>
                  </div>
                )) : <div className="text-sm text-[#7B8799]">Estado no disponible.</div>}
              </div>
              {health && (
                <div className="mt-5 rounded-xl bg-[#F7F9FC] p-4 text-[10px] leading-5 text-[#607087]">
                  Estado global: <strong>{health.status}</strong> · versión {health.version} · revisión {health.revision}
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-[#E1E7EF] bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-2 text-[#0A2A66]"><ShieldCheck size={16} /><h2 className="text-sm font-extrabold uppercase tracking-[.08em]">Capacidades</h2></div>
              <div className="mt-5 space-y-2">
                {health ? Object.entries(health.capabilities).map(([name, state]) => (
                  <div key={name} className="flex items-center justify-between gap-4 rounded-xl bg-[#F7F9FC] px-3 py-3">
                    <span className="min-w-0 truncate font-mono text-[10px] text-[#526176]">{name}</span>
                    <span className={`flex-shrink-0 text-[9px] font-extrabold uppercase ${state === 'ready' || state === 'enabled' ? 'text-[#237D36]' : state === 'misconfigured' ? 'text-[#A11D2A]' : 'text-[#8A6500]'}`}>{state}</span>
                  </div>
                )) : <div className="text-sm text-[#7B8799]">Capacidades no disponibles.</div>}
              </div>
              <Link href="/dashboard/admin/pilot" className="mt-5 inline-flex items-center gap-1.5 text-xs font-extrabold text-[#0A2A66] hover:underline">
                Abrir control del piloto <ExternalLink size={12} />
              </Link>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
