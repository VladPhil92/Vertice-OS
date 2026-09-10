'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { apiFetch } from '@/lib/api'

interface CommunityPolicyState {
  current_version: string
  accepted: boolean
  accepted_version: string | null
  accepted_at: string | null
  guidelines_url: string
}

export default function DashboardTemplate({ children }: { children: ReactNode }) {
  const [policy, setPolicy] = useState<CommunityPolicyState | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    apiFetch<CommunityPolicyState>('/community/safety/policy')
      .then((state) => { if (active) setPolicy(state) })
      .catch(() => undefined)
    return () => { active = false }
  }, [])

  async function acceptPolicy() {
    if (!policy || busy) return
    setBusy(true)
    setError(null)
    try {
      const next = await apiFetch<CommunityPolicyState>('/community/safety/policy/accept', {
        method: 'POST',
        body: JSON.stringify({ policy_version: policy.current_version }),
      })
      setPolicy(next)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible registrar la aceptación de las normas.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {children}
      {policy && !policy.accepted ? (
        <aside
          role="region"
          aria-label="Normas de Comunidad"
          className="fixed bottom-4 left-4 right-4 z-[70] mx-auto max-w-3xl rounded-2xl border border-[#D9C990] bg-[#FFF8E5] p-4 shadow-[0_18px_55px_rgba(10,42,102,.18)] sm:left-auto sm:right-6 sm:max-w-md"
        >
          <div className="text-xs font-extrabold uppercase tracking-[.1em] text-[#806210]">Normas de Comunidad</div>
          <p className="mt-2 text-xs font-medium leading-5 text-[#62552E]">
            Antes de publicar, editar tu perfil o adjuntar evidencia debes revisar y aceptar las normas de seguridad de VÉRTICE.
          </p>
          {error ? <p className="mt-2 text-xs font-semibold text-[#A91D2E]">{error}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={policy.guidelines_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[#806210] px-3 text-xs font-extrabold text-[#6D5715]"
            >
              Leer normas
            </a>
            <button
              type="button"
              disabled={busy}
              onClick={() => void acceptPolicy()}
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[#0A2A66] px-4 text-xs font-extrabold text-white disabled:opacity-50"
            >
              {busy ? 'Guardando…' : 'Acepto las normas'}
            </button>
          </div>
        </aside>
      ) : null}
    </>
  )
}
