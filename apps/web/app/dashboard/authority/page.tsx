'use client'

import { useCallback, useEffect, useState } from 'react'
import { Crown, Search, ShieldAlert, ShieldCheck, UserCog } from 'lucide-react'
import { requireApiBaseUrl } from '@/lib/api'

type Role = 'citizen' | 'moderator' | 'admin' | 'superadmin'
type UserRow = {
  id: string
  email: string | null
  display_name: string | null
  roles: Role[]
}

const ROLE_LABELS: Record<Role, string> = {
  citizen: 'Ciudadano',
  moderator: 'Moderador',
  admin: 'Administrador',
  superadmin: 'Superadmin',
}

const EDITABLE_ROLES: Role[] = ['moderator', 'admin', 'superadmin']

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

export default function AuthorityPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadUsers = useCallback(async (search = '') => {
    const token = localStorage.getItem('access_token')
    if (!token) return
    setLoading(true)
    setError('')
    try {
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
    if (isSuperadmin) void loadUsers('')
  }, [loadUsers])

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
      setMessage('Roles actualizados y auditados correctamente.')
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
          <h1 className="mt-4 text-2xl font-extrabold text-[#0A2A66]">Acceso reservado al superadmin</h1>
          <p className="mt-3 text-sm leading-6 text-[#607087]">
            Debes activar el rol Superadmin desde el selector de tu dashboard para administrar concesiones.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl p-5 sm:p-8 lg:p-10">
      <div className="rounded-[28px] border border-[#E1E7EF] bg-white p-6 shadow-[0_18px_50px_rgba(10,42,102,.06)] sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.15em] text-[#D98B00]">
              <Crown size={15} /> Autoridad raíz
            </div>
            <h1 className="mt-2 text-2xl font-extrabold tracking-[-.03em] text-[#0A2A66]">Administración de roles</h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#607087]">
              Concede o retira roles de VÉRTICE. La plataforma impide eliminar al último superadmin y registra cada cambio en el log administrativo.
            </p>
          </div>
          <div className="rounded-2xl border border-[#D6E6D9] bg-[#F1F8F2] px-4 py-3 text-xs font-bold text-[#246B32]">
            <div className="flex items-center gap-2"><ShieldCheck size={15} /> Sesión superadmin verificada</div>
          </div>
        </div>

        <form
          className="mt-7 flex gap-2"
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

        {error && <div className="mt-4 rounded-xl bg-[#FCEBED] px-4 py-3 text-xs font-bold text-[#A11D2A]">{error}</div>}
        {message && <div className="mt-4 rounded-xl bg-[#F1F8F2] px-4 py-3 text-xs font-bold text-[#246B32]">{message}</div>}

        <div className="mt-6 space-y-3">
          {loading ? (
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
                        <input
                          type="checkbox"
                          className="mr-2 align-middle"
                          checked={checked}
                          onChange={() => toggleRole(user, role)}
                        />
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
      </div>
    </div>
  )
}
