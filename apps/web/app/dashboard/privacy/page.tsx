'use client'

import { useState } from 'react'
import Link from 'next/link'
import { apiFetch, ApiRequestError } from '@/lib/api'

interface AccountDeletionReceipt {
  request_id: string
  status: 'completed'
  completed_at: string
  retention_policy_version: string
  retained_categories: string[]
  auxiliary_cleanup_queued: boolean
}

const REQUIRED_CONFIRMATION = 'ELIMINAR'

export default function PrivacyPage() {
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canDelete = confirmation.trim().toUpperCase() === REQUIRED_CONFIRMATION && !busy

  async function deleteAccount() {
    if (!canDelete) return
    const accepted = window.confirm(
      'Esta acción elimina tu cuenta e identidad personal de forma irreversible. ¿Deseas continuar?',
    )
    if (!accepted) return

    setBusy(true)
    setError(null)
    try {
      await apiFetch<AccountDeletionReceipt>('/auth/account', {
        method: 'DELETE',
        body: JSON.stringify({ confirmation: REQUIRED_CONFIRMATION, source: 'web' }),
        timeoutMs: 60_000,
      })

      localStorage.removeItem('access_token')
      localStorage.removeItem('citizen_id')
      document.cookie = 'vertice_auth=; path=/; max-age=0; SameSite=Strict'
      window.location.replace('/account-deletion?deleted=1')
    } catch (cause) {
      if (cause instanceof ApiRequestError) {
        setError(cause.message)
      } else {
        setError(cause instanceof Error ? cause.message : 'No fue posible eliminar la cuenta.')
      }
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-5 pb-24 md:p-8">
      <header>
        <div className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#7B8799]">Cuenta</div>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-[#0A2A66]">Privacidad y datos</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#607087]">
          Puedes eliminar tu cuenta desde este panel. La operación elimina tus credenciales e identificadores directos y no puede revertirse.
        </p>
      </header>

      <section className="grid gap-5 md:grid-cols-2">
        <div className="rounded-3xl border border-[#DDE5EF] bg-white p-6 shadow-sm">
          <h2 className="text-base font-extrabold text-[#0A2A66]">Se elimina</h2>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-[#526174]">
            <li>• correo, contraseña y hash de documento;</li>
            <li>• sesiones y roles activos;</li>
            <li>• identidades externas y proofing;</li>
            <li>• dispositivos push y perfil público;</li>
            <li>• avatar, seguidores y publicaciones sociales.</li>
          </ul>
        </div>

        <div className="rounded-3xl border border-[#E5DDD5] bg-[#FFFDF9] p-6">
          <h2 className="text-base font-extrabold text-[#6E3B32]">Retención seudonimizada</h2>
          <p className="mt-4 text-sm leading-6 text-[#665B53]">
            Registros cívicos, financieros o de auditoría pueden conservarse cuando sean necesarios para integridad histórica, obligaciones contables, prevención de fraude o resolución de disputas. Se elimina la relación pública y los identificadores personales directos.
          </p>
          <Link href="/account-deletion" className="mt-4 inline-block text-sm font-bold text-[#0A2A66] underline underline-offset-4">
            Ver información pública del proceso
          </Link>
        </div>
      </section>

      <section className="rounded-3xl border border-[#E2B7B0] bg-[#FFF7F5] p-6">
        <h2 className="text-xl font-black text-[#812F2F]">Eliminar cuenta permanentemente</h2>
        <p className="mt-3 text-sm leading-6 text-[#6E5651]">
          Escribe <strong>{REQUIRED_CONFIRMATION}</strong> para habilitar el botón. Después tendrás una última confirmación del navegador.
        </p>

        <label className="mt-5 block text-xs font-extrabold uppercase tracking-[.1em] text-[#765C57]" htmlFor="delete-confirmation">
          Confirmación
        </label>
        <input
          id="delete-confirmation"
          value={confirmation}
          disabled={busy}
          onChange={(event) => setConfirmation(event.target.value)}
          autoComplete="off"
          className="mt-2 min-h-12 w-full rounded-2xl border border-[#CFA9A2] bg-white px-4 text-sm font-bold outline-none focus:border-[#812F2F] focus:ring-2 focus:ring-[#812F2F]/15"
          placeholder={REQUIRED_CONFIRMATION}
        />

        {error && (
          <div role="alert" className="mt-4 rounded-2xl border border-[#E3B4AE] bg-white px-4 py-3 text-sm font-semibold text-[#812F2F]">
            {error}
          </div>
        )}

        <button
          type="button"
          disabled={!canDelete}
          onClick={() => void deleteAccount()}
          className="mt-5 min-h-12 rounded-2xl bg-[#812F2F] px-6 py-3 text-sm font-extrabold text-white transition hover:bg-[#6E2727] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? 'Eliminando…' : 'Eliminar mi cuenta'}
        </button>
      </section>
    </div>
  )
}
