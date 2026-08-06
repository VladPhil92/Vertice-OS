'use client'

import { useState, type FormEvent, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Eye, EyeOff, ArrowRight, AlertCircle, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'

export default function ResetPasswordPage() {
  const [token, setToken]           = useState('')
  const [password, setPassword]     = useState('')
  const [confirm, setConfirm]       = useState('')
  const [showPwd, setShowPwd]       = useState(false)
  const [loading, setLoading]       = useState(false)
  const [done, setDone]             = useState(false)
  const [error, setError]           = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setToken(params.get('token') ?? '')
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }
    if (!token) {
      setError('Token inválido. Solicita un nuevo enlace.')
      return
    }

    setLoading(true)
    try {
      await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, new_password: password }),
        public: true,
      })
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al restablecer')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {/* Logo */}
        <div className="mb-10 text-center">
          <Link href="/" className="inline-flex flex-col items-center gap-3">
            <svg viewBox="0 0 40 40" className="h-10 w-10" fill="none">
              <polygon points="20,3 37,35 3,35" stroke="#C8A84B" strokeWidth="1.5" fill="none" />
              <polygon points="20,11 31,33 9,33" stroke="#C8A84B" strokeWidth="0.75" fill="none" opacity="0.4" />
            </svg>
            <span className="font-display text-xs font-700 uppercase tracking-widest text-gold">
              VÉRTICE OS
            </span>
          </Link>
        </div>

        <div className="border border-border bg-surface p-8">
          {done ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <CheckCircle size={28} strokeWidth={1.5} className="text-cyan" />
              <h1 className="font-display text-xl font-700 text-primary">
                Contraseña actualizada
              </h1>
              <p className="font-mono text-xs text-secondary">
                Tu contraseña ha sido restablecida. Todas tus sesiones activas fueron cerradas por seguridad.
              </p>
              <Link href="/auth/login" className="btn-primary mt-4 inline-flex items-center gap-2">
                <span>Iniciar sesión</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <span className="section-tag">Nueva contraseña</span>
                <h1 className="font-display text-2xl font-700 text-primary">
                  Restablece tu contraseña
                </h1>
                <p className="mt-2 font-mono text-xs text-secondary">
                  Elige una contraseña segura de al menos 8 caracteres.
                </p>
              </div>

              {error && (
                <div className="mb-6 flex items-start gap-3 border border-red/30 bg-red/5 px-4 py-3">
                  <AlertCircle size={14} className="mt-0.5 flex-shrink-0 text-red" />
                  <span className="font-mono text-xs text-red">{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary">
                    Nueva contraseña
                  </label>
                  <div className="relative">
                    <input
                      type={showPwd ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full border border-border bg-bg px-4 py-3 pr-12 font-mono text-sm text-primary outline-none transition-colors focus:border-border-active placeholder:text-tertiary"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-tertiary hover:text-secondary"
                      onClick={() => setShowPwd(!showPwd)}
                      aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary">
                    Confirmar contraseña
                  </label>
                  <input
                    type={showPwd ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="border border-border bg-bg px-4 py-3 font-mono text-sm text-primary outline-none transition-colors focus:border-border-active placeholder:text-tertiary"
                    placeholder="••••••••"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !token}
                  className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <span className="font-mono text-[11px] uppercase tracking-[0.1em]">Guardando…</span>
                  ) : (
                    <>
                      <span>Guardar contraseña</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}
