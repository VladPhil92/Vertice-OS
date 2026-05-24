'use client'

import { useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react'

const LOCALITIES = [
  { id: 1, name: 'Histórica y del Caribe Norte' },
  { id: 2, name: 'De la Virgen y Turística' },
  { id: 3, name: 'Industrial y de la Bahía' },
  { id: 4, name: 'Bayunca' },
] as const

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

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        setError(data.error ?? 'Error al registrarse')
        return
      }

      setDone(true)
    } catch {
      setError('No se pudo conectar con el servidor')
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
          <a href="/auth/login" className="btn-primary">
            Ingresar ahora
          </a>
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
            <span className="section-tag">Registro</span>
            <h1 className="font-display text-2xl font-700 text-primary">
              Crear cuenta ciudadana
            </h1>
            <p className="mt-2 font-mono text-xs text-secondary">
              Paso 1 de 2 — Datos básicos. La verificación de cédula se hace desde el panel.
            </p>
          </div>

          {error && (
            <div className="mb-6 flex items-start gap-3 border border-red/30 bg-red/5 px-4 py-3">
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0 text-red" />
              <span className="font-mono text-xs text-red">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary">
                Correo electrónico
              </label>
              <input
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
              <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary">
                Contraseña
              </label>
              <div className="relative">
                <input
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
                  aria-label={showPassword ? 'Ocultar' : 'Mostrar'}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Cédula */}
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary">
                Cédula de ciudadanía
              </label>
              <input
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
                Se almacena como hash SHA-256 — nunca en texto plano
              </span>
            </div>

            {/* Barrio */}
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary">
                Barrio <span className="text-tertiary/60">(opcional)</span>
              </label>
              <input
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
              <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary">
                Localidad <span className="text-tertiary/60">(opcional)</span>
              </label>
              <select
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
              <a href="/auth/login" className="text-gold hover:underline">
                Ingresar
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
