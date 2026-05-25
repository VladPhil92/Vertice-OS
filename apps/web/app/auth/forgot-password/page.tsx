'use client'

import { useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, AlertCircle, CheckCircle } from 'lucide-react'
import { apiFetch } from '@/lib/api'

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
        public: true,
      })
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar')
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
          <a href="/" className="inline-flex flex-col items-center gap-3">
            <svg viewBox="0 0 40 40" className="h-10 w-10" fill="none">
              <polygon points="20,3 37,35 3,35" stroke="#C8A84B" strokeWidth="1.5" fill="none" />
              <polygon points="20,11 31,33 9,33" stroke="#C8A84B" strokeWidth="0.75" fill="none" opacity="0.4" />
            </svg>
            <span className="font-display text-xs font-700 uppercase tracking-widest text-gold">
              VÉRTICE OS
            </span>
          </a>
        </div>

        <div className="border border-border bg-surface p-8">
          {sent ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <CheckCircle size={28} strokeWidth={1.5} className="text-cyan" />
              <h1 className="font-display text-xl font-700 text-primary">
                Revisa tu correo
              </h1>
              <p className="font-mono text-xs text-secondary">
                Si el email está registrado, recibirás un enlace para restablecer tu contraseña.
                El enlace expira en 30 minutos.
              </p>
              <a href="/auth/login" className="mt-4 font-mono text-xs text-gold hover:underline">
                ← Volver al inicio de sesión
              </a>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <span className="section-tag">Recuperar acceso</span>
                <h1 className="font-display text-2xl font-700 text-primary">
                  ¿Olvidaste tu contraseña?
                </h1>
                <p className="mt-2 font-mono text-xs text-secondary">
                  Ingresa tu correo y te enviaremos un enlace para restablecerla.
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
                    Correo electrónico
                  </label>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="border border-border bg-bg px-4 py-3 font-mono text-sm text-primary outline-none transition-colors focus:border-border-active placeholder:text-tertiary"
                    placeholder="ciudadano@ejemplo.com"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <span className="font-mono text-[11px] uppercase tracking-[0.1em]">Enviando…</span>
                  ) : (
                    <>
                      <span>Enviar enlace</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 border-t border-border pt-6 text-center">
                <a href="/auth/login" className="inline-flex items-center gap-2 font-mono text-xs text-secondary hover:text-primary">
                  <ArrowLeft size={12} />
                  Volver al inicio de sesión
                </a>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}
