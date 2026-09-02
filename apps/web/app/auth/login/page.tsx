'use client'

import { useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import { Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { BrandLogo } from '@/components/ui/BrandLogo'
import { requireApiBaseUrl } from '@/lib/api'

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
      const baseUrl = requireApiBaseUrl()
      const res = await fetch(`${baseUrl}/auth/token`, {
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
    } catch (err) {
      setError(
        err instanceof Error && err.message === 'API_NOT_CONFIGURED'
          ? 'El servicio de VÉRTICE aún no tiene configurada su URL de API de producción.'
          : 'No se pudo conectar con el servidor',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F9FC] px-6 py-12">
      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex rounded-2xl bg-white px-5 py-3 shadow-sm">
            <BrandLogo compact priority />
          </Link>
        </div>

        <div className="overflow-hidden rounded-[24px] border border-[#E1E7EF] bg-white shadow-[0_20px_60px_rgba(10,42,102,.08)]">
          <div className="h-1.5 bg-[linear-gradient(90deg,#F5B700_0_33%,#0A2A66_33%_66%,#D72638_66%_100%)]" />
          <div className="p-7 sm:p-8">
            <div className="mb-8">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#D98B00]">Acceso ciudadano</span>
              <h1 className="mt-2 font-display text-2xl font-extrabold tracking-[-0.03em] text-[#0A2A66]">
                Ingresa a tu cuenta
              </h1>
              <p className="mt-2 text-xs font-semibold leading-5 text-[#607087]">
                Accede a tu identidad, participación y seguimiento dentro de VÉRTICE.
              </p>
            </div>

            {error && (
              <div className="mb-6 flex items-start gap-3 rounded-xl border border-[#D72638]/25 bg-[#FCEBED] px-4 py-3">
                <AlertCircle size={15} className="mt-0.5 flex-shrink-0 text-[#D72638]" />
                <span className="text-xs font-semibold leading-5 text-[#A11D2A]">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#607087]">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="rounded-xl border border-[#D6DFEA] bg-white px-4 py-3 text-sm text-[#0A2A66] outline-none transition-colors focus:border-[#4A90E2] placeholder:text-[#A5AFBD]"
                  placeholder="ciudadano@ejemplo.com"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#607087]">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full rounded-xl border border-[#D6DFEA] bg-white px-4 py-3 pr-12 text-sm text-[#0A2A66] outline-none transition-colors focus:border-[#4A90E2] placeholder:text-[#A5AFBD]"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#7B8799] hover:text-[#0A2A66]"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#0A2A66] px-5 py-3 text-xs font-extrabold text-white transition hover:bg-[#123B7A] disabled:opacity-50"
              >
                {loading ? (
                  <span>Verificando…</span>
                ) : (
                  <>
                    <span>Ingresar</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 border-t border-[#E1E7EF] pt-6 text-center">
              <p className="text-xs font-semibold text-[#7B8799]">
                ¿No tienes cuenta?{' '}
                <Link href="/auth/register" className="font-extrabold text-[#0A2A66] hover:underline">
                  Regístrate aquí
                </Link>
              </p>
              <p className="mt-3 text-xs font-semibold text-[#7B8799]">
                <Link href="/auth/forgot-password" className="hover:text-[#0A2A66]">
                  ¿Olvidaste tu contraseña?
                </Link>
              </p>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-[10px] font-semibold leading-5 text-[#7B8799]">
          Tus datos están protegidos bajo la Ley 1581 de 2012 (Habeas Data Colombia)
        </p>
      </motion.div>
    </div>
  )
}