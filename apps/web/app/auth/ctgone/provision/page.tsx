'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { requireApiBaseUrl } from '@/lib/api'

type ProvisionResponse = {
  redirect_url?: string
  status?: string
  error?: string
  code?: string
  message?: string
}

export default function CtgOneProvisionPage() {
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function connect() {
      const accessToken = localStorage.getItem('access_token')
      if (!accessToken) {
        window.location.replace('/auth/login?next=/auth/ctgone/provision')
        return
      }

      try {
        const apiUrl = requireApiBaseUrl()
        const response = await fetch(`${apiUrl}/auth/ctgone/provision`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
          credentials: 'include',
        })
        const body = await response.json().catch(() => ({})) as ProvisionResponse

        if (!response.ok || !body.redirect_url) {
          if (response.status === 401) {
            window.location.replace('/auth/login?next=/auth/ctgone/provision')
            return
          }
          if (body.code === 'VERIFIED_IDENTITY_REQUIRED') {
            throw new Error('Debes verificar tu identidad en VÉRTICE antes de crear una cuenta CTG One usando estos datos.')
          }
          if (body.code === 'CTG_ONE_LINK_REQUIRED') {
            throw new Error('Ya existe una cuenta CTG One con este correo. Inicia sesión allí y vincula las cuentas explícitamente; no se fusionarán sólo por coincidencia de correo.')
          }
          throw new Error(body.message ?? body.error ?? 'No fue posible abrir CTG One desde VÉRTICE.')
        }

        if (!cancelled) window.location.replace(body.redirect_url)
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'No fue posible conectar con CTG One.')
        }
      }
    }

    void connect()
    return () => { cancelled = true }
  }, [])

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F9FC] px-6 text-[#0A2A66]">
      <div className="w-full max-w-md rounded-3xl border border-[#E1E7EF] bg-white p-8 text-center shadow-[0_20px_60px_rgba(10,42,102,.08)]">
        <div className="mx-auto mb-5 h-3 w-3 animate-pulse rounded-full bg-[#F5B700] shadow-[0_0_0_8px_rgba(245,183,0,.12)]" />
        <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#7B8799]">VÉRTICE → CTG ONE</p>
        <h1 className="mt-3 text-2xl font-extrabold">Conectando el ecosistema</h1>
        <p className="mt-3 text-sm leading-6 text-[#607087]">
          VÉRTICE valida tu sesión local y solicita a CTG One una sesión independiente. No compartimos contraseñas ni cookies entre plataformas.
        </p>

        {error ? (
          <div className="mt-6 rounded-2xl border border-[#D72638]/20 bg-[#FCEBED] p-4 text-sm text-[#B11D2C]">
            <p>{error}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-4 text-xs font-bold">
              <Link href="/dashboard/identity" className="underline">Revisar identidad</Link>
              <a href="https://ctgone.com/iniciar-sesion" className="underline">Ingresar a CTG One</a>
              <Link href="/dashboard" className="underline">Volver a VÉRTICE</Link>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  )
}
