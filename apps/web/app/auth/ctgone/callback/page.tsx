'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const VERIFIER_KEY = 'vertice.ctgone.pkce_verifier'
const STATE_KEY = 'vertice.ctgone.state'
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

export default function CtgOneFederationCallbackPage() {
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function finish() {
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code') ?? ''
      const returnedState = params.get('state') ?? ''
      const verifier = sessionStorage.getItem(VERIFIER_KEY) ?? ''
      const expectedState = sessionStorage.getItem(STATE_KEY) ?? ''

      // Remove the one-time code from browser history before any network call.
      window.history.replaceState({}, '', '/auth/ctgone/callback')
      sessionStorage.removeItem(VERIFIER_KEY)
      sessionStorage.removeItem(STATE_KEY)

      if (!code || !verifier || !returnedState || returnedState !== expectedState) {
        setError('La respuesta de CTG One no coincide con la sesión segura iniciada en este navegador.')
        return
      }

      try {
        const response = await fetch(`${API_URL}/auth/ctgone/exchange`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ code, code_verifier: verifier }),
        })

        const body = await response.json().catch(() => ({})) as {
          access_token?: string
          citizen_id?: string
          error?: string
          code?: string
        }

        if (!response.ok || !body.access_token || !body.citizen_id) {
          if (body.code === 'FEDERATION_LINK_REQUIRED') {
            throw new Error('Ya existe una cuenta VÉRTICE con este correo. Debes vincularla explícitamente antes de usar CTG One.')
          }
          throw new Error(body.error ?? 'No fue posible crear la sesión VÉRTICE.')
        }

        if (cancelled) return
        localStorage.setItem('access_token', body.access_token)
        localStorage.setItem('citizen_id', body.citizen_id)
        document.cookie = `vertice_auth=1; path=/; max-age=${7 * 24 * 3600}; SameSite=Strict`
        window.location.replace('/dashboard')
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'No fue posible completar la conexión con CTG One.')
        }
      }
    }

    void finish()
    return () => { cancelled = true }
  }, [])

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F9FC] px-6 text-[#0A2A66]">
      <div className="w-full max-w-md rounded-3xl border border-[#E1E7EF] bg-white p-8 text-center shadow-[0_20px_60px_rgba(10,42,102,.08)]">
        <div className="mx-auto mb-5 h-3 w-3 animate-pulse rounded-full bg-[#2BA745] shadow-[0_0_0_8px_rgba(43,167,69,.10)]" />
        <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#7B8799]">CTG ONE → VÉRTICE</p>
        <h1 className="mt-3 text-2xl font-extrabold">Validando identidad federada</h1>
        <p className="mt-3 text-sm leading-6 text-[#607087]">
          VÉRTICE está canjeando el código de un solo uso y creando una sesión local independiente.
        </p>
        {error ? (
          <div className="mt-6 rounded-2xl border border-[#D72638]/20 bg-[#FCEBED] p-4 text-sm text-[#B11D2C]">
            <p>{error}</p>
            <div className="mt-4 flex justify-center gap-4 text-xs font-bold">
              <Link href="/auth/ctgone/start" className="underline">Reintentar</Link>
              <Link href="/auth/login" className="underline">Ingresar a VÉRTICE</Link>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  )
}
