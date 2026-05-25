'use client'

import { useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import { Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ email: '', password: '' })

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        setError(data.error ?? 'Error al ingresar')
        return
      }

      const data = await res.json() as { access_token: string; citizen_id: string; expires_in: number }
      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('citizen_id', data.citizen_id)
      // Cookie readable by Next.js Edge Middleware — used for server-side route protection.
      // Lifetime matches the refresh token (7 days); actual JWT validity enforced by the API.
      document.cookie = `vertice_auth=1; path=/; max-age=${7 * 24 * 3600}; SameSite=Strict`
      // Redirect to the originally requested page, or the dashboard
      const params = new URLSearchParams(window.location.search)
      window.location.href = params.get('next') ?? '/dashboard'
    } catch {
      setError('No se pudo conectar con el servidor')
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
          <div className="mb-8">
            <span className="section-tag">Acceso</span>
            <h1 className="font-display text-2xl font-700 text-primary">
              Ingresa a tu cuenta
            </h1>
            <p className="mt-2 font-mono text-xs text-secondary">
              Identificación ciudadana segura con JWT + verificación de identidad
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
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="border border-border bg-bg px-4 py-3 font-mono text-sm text-primary outline-none transition-colors focus:border-border-active placeholder:text-tertiary"
                placeholder="ciudadano@ejemplo.com"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full border border-border bg-bg px-4 py-3 pr-12 font-mono text-sm text-primary outline-none transition-colors focus:border-border-active placeholder:text-tertiary"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-tertiary hover:text-secondary"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span className="font-mono text-[11px] uppercase tracking-[0.1em]">
                  Verificando…
                </span>
              ) : (
                <>
                  <span>Ingresar</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 border-t border-border pt-6 text-center">
            <p className="font-mono text-xs text-tertiary">
              ¿No tienes cuenta?{' '}
              <a href="/auth/register" className="text-gold hover:underline">
                Regístrate aquí
              </a>
            </p>
            <p className="mt-3 font-mono text-xs text-tertiary">
              <a href="/auth/forgot-password" className="text-secondary hover:text-primary">
                ¿Olvidaste tu contraseña?
              </a>
            </p>
          </div>
        </div>

        <p className="mt-6 text-center font-mono text-[10px] text-tertiary">
          Tus datos están protegidos bajo la Ley 1581 de 2012 (Habeas Data Colombia)
        </p>
      </motion.div>
    </div>
  )
}
