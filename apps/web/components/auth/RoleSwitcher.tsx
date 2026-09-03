'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Crown, RefreshCw, ShieldCheck } from 'lucide-react'
import { requireApiBaseUrl } from '@/lib/api'

type Role = 'citizen' | 'moderator' | 'admin' | 'superadmin'

type RoleContext = {
  assigned_roles: Role[]
  active_role: Role
}

const LABELS: Record<Role, string> = {
  citizen: 'Ciudadano',
  moderator: 'Moderador',
  admin: 'Administrador',
  superadmin: 'Superadmin',
}

export function RoleSwitcher({ onRoleChange }: { onRoleChange?: (role: Role) => void }) {
  const [context, setContext] = useState<RoleContext | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) return
    try {
      const baseUrl = requireApiBaseUrl()
      fetch(`${baseUrl}/auth/roles`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      })
        .then(async (response) => {
          if (!response.ok) throw new Error('No fue posible consultar los roles')
          return response.json() as Promise<RoleContext>
        })
        .then((data) => {
          setContext(data)
          onRoleChange?.(data.active_role)
        })
        .catch(() => setError('No fue posible cargar los roles'))
    } catch {
      setError('API no configurada')
    }
  }, [onRoleChange])

  async function switchRole(role: Role) {
    if (!context || role === context.active_role) return
    const token = localStorage.getItem('access_token')
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const baseUrl = requireApiBaseUrl()
      const response = await fetch(`${baseUrl}/auth/roles/switch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({ role }),
      })
      const data = await response.json() as { access_token?: string; active_role?: Role; error?: string }
      if (!response.ok || !data.access_token || !data.active_role) {
        throw new Error(data.error ?? 'No fue posible cambiar el rol')
      }
      localStorage.setItem('access_token', data.access_token)
      setContext({ ...context, active_role: data.active_role })
      onRoleChange?.(data.active_role)
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cambiar el rol')
    } finally {
      setLoading(false)
    }
  }

  if (!context || context.assigned_roles.length <= 1) return null

  const isSuperadmin = context.assigned_roles.includes('superadmin')

  return (
    <div className="mx-3 mb-3 rounded-2xl border border-[#D8E2EF] bg-[#F7F9FC] p-3">
      <div className="flex items-center gap-2 text-[9px] font-extrabold uppercase tracking-[.13em] text-[#607087]">
        {isSuperadmin ? <Crown size={13} className="text-[#D98B00]" /> : <ShieldCheck size={13} />}
        Rol activo
      </div>
      <div className="mt-2 flex items-center gap-2">
        <select
          value={context.active_role}
          disabled={loading}
          onChange={(event) => void switchRole(event.target.value as Role)}
          className="min-w-0 flex-1 rounded-xl border border-[#CCD8E6] bg-white px-3 py-2 text-[11px] font-bold text-[#0A2A66] outline-none focus:border-[#4A90E2]"
          aria-label="Cambiar rol activo"
        >
          {context.assigned_roles.map((role) => (
            <option key={role} value={role}>{LABELS[role]}</option>
          ))}
        </select>
        {loading && <RefreshCw size={14} className="animate-spin text-[#4A90E2]" />}
      </div>
      {isSuperadmin && (
        <Link
          href="/dashboard/authority"
          className="mt-2 block text-[10px] font-extrabold text-[#0A2A66] hover:underline"
        >
          Administrar roles y superadmins →
        </Link>
      )}
      {error && <p className="mt-2 text-[10px] font-semibold text-[#A11D2A]">{error}</p>}
    </div>
  )
}
