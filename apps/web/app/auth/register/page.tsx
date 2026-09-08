'use client'

import { useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'
import { requireApiBaseUrl } from '@/lib/api'

const LOCALITIES = [
  { id: 1, name: 'Histórica y del Caribe Norte' },
  { id: 2, name: 'De la Virgen y Turística' },
  { id: 3, name: 'Industrial y de la Bahía' },
  { id: 4, name: 'Bayunca' },
] as const

type ApiErrorBody = {
  error?: string
  message?: string
  code?: string
}

async function registrationErrorMessage(res: Response): Promise<string> {
  const data = await res.json().catch(() => ({})) as ApiErrorBody

  if (res.status === 502 || data.code === 'API_UPSTREAM_UNAVAILABLE') {
    return 'El servicio de VÉRTICE no respondió. Intenta nuevamente en unos minutos.'
  }

  if (res.status === 503 || data.code === 'API_UPSTREAM_NOT_CONFIGURED') {
    return 'El servicio de registro de VÉRTICE no está disponible temporalmente.'
  }

  if (res.status === 429) {
    return 'Se alcanzó el límite temporal de intentos de registro. Intenta nuevamente más tarde.'
  }

  return data.error ?? data.message ?? 'No fue posible completar el registro.'
}

export default function RegisterPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({
    email: '',
    password: '',
    cedula: '',
    locality_id: '' as '' | number,
    neighborhood: '',
  })

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const body = {
        ...form,
        locality_id: form.locality_id === '' ? undefined : Number(form.locality_id),
      }
      const baseUrl = requireApiBaseUrl()

      // Production must remain same-origin. /api is proxied by Vercel/Next.js
      // to the canonical Railway API, matching the rest of the auth boundary.
      const res = await fetch(`${baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        setError(await registrationErrorMessage(res))
        return
      }

      setDone(true)
    } catch {
      setError('No se pudo establecer conexión con el servicio de VÉRTICE. Verifica tu conexión e intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <motion.div
          className="w-full max-w-md text-center"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <CheckCircle size={48} className="mx-auto mb-6 text-gold" strokeWidth={1} />
          <h1 className="mb-3 font-display text-2xl font-700 text-primary">
            Cuenta creada
          </h1>
          <p className="mb-8 font-mono text-sm text-secondary">
            Tu cuenta fue registrada. Ingresa con tu correo y contraseña,
            luego verifica tu identidad cívica para participar en propuestas y votaciones.
          </p>
          <Link href="/auth/login" className="btn-primary">
            Ingresar ahora
          </Link>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-20">
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
          <div className="mb-8">
            <span className="section-tag">Registro</span>
            <h1 className="font-display text-2xl font-700 text-primary">
              Crear cuenta ciudadana
            </h1>
            <p className="mt-2 font-mono text-xs text-secondary">
              Paso 1 de 2 — Datos básicos. La verificación de cédula se hace desde el panel.
            </p>
          </div>

          {error && (
            <div className="mb-6 flex items-start gap-3 border border-red/30 bg-red/5 px-4 py-3" role="alert">
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0 text-red" />
              <span className="font-mono text-xs text-red">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="register-email" className="font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary">
                Correo electrónico
              </label>
              <input
                id="register-email"
                type="email"
                required
                autoComplete="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                className="border border-border bg-bg px-4 py-3 font-mono text-sm text-primary outline-none transition-colors focus:border-border-active placeholder:text-tertiary"
                placeholder="ciudadano@ejemplo.com"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="register-password" className="font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="register-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => update('password', e.target.value)}
                  className="w-full border border-border bg-bg px-4 py-3 pr-12 font-mono text-sm text-primary outline-none transition-colors focus:border-border-active placeholder:text-tertiary"
                  placeholder="Mín. 8 caracteres, 1 mayúscula, 1 número"
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

            {/* Cédula */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="register-cedula" className="font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary">
                Cédula de ciudadanía
              </label>
              <input
                id="register-cedula"
                type="text"
                required
                inputMode="numeric"
                pattern="[0-9]{6,10}"
                autoComplete="off"
                value={form.cedula}
                onChange={(e) => update('cedula', e.target.value.replace(/\D/g, '').slice(0, 10))}
                className="border border-border bg-bg px-4 py-3 font-mono text-sm text-primary outline-none transition-colors focus:border-border-active placeholder:text-tertiary"
                placeholder="Solo dígitos, 6–10 caracteres"
              />
              <span className="font-mono text-[10px] text-tertiary">
                Se protege mediante HMAC-SHA-256 con secreto del servidor — nunca en texto plano
              </span>
            </div>

            {/* Barrio */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="register-neighborhood" className="font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary">
                Barrio <span className="text-tertiary/60">(opcional)</span>
              </label>
              <input
                id="register-neighborhood"
                type="text"
                autoComplete="off"
                value={form.neighborhood}
                onChange={(e) => update('neighborhood', e.target.value)}
                className="border border-border bg-bg px-4 py-3 font-mono text-sm text-primary outline-none transition-colors focus:border-border-active placeholder:text-tertiary"
                placeholder="Ej: Getsemaní, Manga, Bocagrande…"
              />
            </div>

            {/* Localidad */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="register-locality" className="font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary">
                Localidad <span className="text-tertiary/60">(opcional)</span>
              </label>
              <select
                id="register-locality"
                value={form.locality_id}
                onChange={(e) => setForm(prev => ({ ...prev, locality_id: e.target.value === '' ? '' : Number(e.target.value) }))}
                className="border border-border bg-bg px-4 py-3 font-mono text-sm text-primary outline-none transition-colors focus:border-border-active"
              >
                <option value="">Selecciona tu localidad</option>
                {LOCALITIES.map((loc) => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span className="font-mono text-[11px] uppercase tracking-[0.1em]">Creando cuenta…</span>
              ) : (
                <>
                  <span>Crear cuenta</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 border-t border-border pt-6 text-center">
            <p className="font-mono text-xs text-tertiary">
              ¿Ya tienes cuenta?{' '}
              <Link href="/auth/login" className="text-gold hover:underline">
                Ingresar
              </Link>
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
