'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const CTG_ONE_AUTHORIZE_URL = 'https://ctgone.com/api/federation/vertice/authorize'
const VERIFIER_KEY = 'vertice.ctgone.pkce_verifier'
const STATE_KEY = 'vertice.ctgone.state'

function base64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

async function sha256Base64Url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return base64Url(new Uint8Array(digest))
}

export default function CtgOneFederationStartPage() {
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function start() {
      try {
        const verifierBytes = crypto.getRandomValues(new Uint8Array(32))
        const stateBytes = crypto.getRandomValues(new Uint8Array(24))
        const verifier = base64Url(verifierBytes)
        const state = base64Url(stateBytes)
        const challenge = await sha256Base64Url(verifier)
        if (cancelled) return

        sessionStorage.setItem(VERIFIER_KEY, verifier)
        sessionStorage.setItem(STATE_KEY, state)

        const authorize = new URL(CTG_ONE_AUTHORIZE_URL)
        authorize.searchParams.set('code_challenge', challenge)
        authorize.searchParams.set('state', state)
        window.location.replace(authorize.toString())
      } catch {
        if (!cancelled) setError('No se pudo iniciar la conexión segura con CTG One.')
      }
    }

    void start()
    return () => { cancelled = true }
  }, [])

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F9FC] px-6 text-[#0A2A66]">
      <div className="w-full max-w-md rounded-3xl border border-[#E1E7EF] bg-white p-8 text-center shadow-[0_20px_60px_rgba(10,42,102,.08)]">
        <div className="mx-auto mb-5 h-3 w-3 animate-pulse rounded-full bg-[#F5B700] shadow-[0_0_0_8px_rgba(245,183,0,.12)]" />
        <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#7B8799]">VÉRTICE / CTG ONE</p>
        <h1 className="mt-3 text-2xl font-extrabold">Conectando tu cuenta</h1>
        <p className="mt-3 text-sm leading-6 text-[#607087]">
          Estamos iniciando un intercambio PKCE de un solo uso. Tus credenciales de CTG One no se comparten con VÉRTICE.
        </p>
        {error ? (
          <div className="mt-6 rounded-2xl border border-[#D72638]/20 bg-[#FCEBED] p-4 text-sm text-[#B11D2C]">
            <p>{error}</p>
            <Link href="/" className="mt-3 inline-block font-bold underline">Volver a VÉRTICE</Link>
          </div>
        ) : null}
      </div>
    </main>
  )
}
