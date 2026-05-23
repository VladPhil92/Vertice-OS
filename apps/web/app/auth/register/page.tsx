'use client'

import { useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, AlertCircle, CheckCircle } from 'lucide-react'

const LOCALITIES = [
  'Histórica y del Caribe Norte',
  'De la Virgen y Turística',
  'Industrial de la Bahía',
] as const

export default function RegisterPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [form, setForm] = useState({
    email: '',
    password: '',
    display_name: '',
    locality: '',
    neighborhood: '',
  })

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
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
            Tu cuenta fue registrada. Ahora debes verificar tu identidad cívica
            para participar en propuestas y votaciones.
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
              Paso 1 de 2 — Datos básicos. La verificación de cédula es el paso siguiente.
            </p>
          </div>

          {error && (
            <div className="mb-6 flex items-start gap-3 border border-red/30 bg-red/5 px-4 py-3">
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0 text-red" />
              <span className="font-mono text-xs text-red">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {[
              { key: 'display_name', label: 'Nombre público', type: 'text', placeholder: 'Cómo te verán en la plataforma', autoComplete: 'name' },
              { key: 'email', label: 'Correo electrónico', type: 'email', placeholder: 'ciudadano@ejemplo.com', autoComplete: 'email' },
              { key: 'password', label: 'Contraseña (mín. 8 caracteres)', type: 'password', placeholder: '••••••••', autoComplete: 'new-password' },
              { key: 'neighborhood', label: 'Barrio', type: 'text', placeholder: 'Ej: Getsemaní, Manga, Bocagrande…', autoComplete: 'off' },
            ].map(({ key, label, type, placeholder, autoComplete }) => (
              <div key={key} className="flex flex-col gap-1.5">
                <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary">
                  {label}
                </label>
                <input
                  type={type}
                  required
                  autoComplete={autoComplete}
                  value={form[key as keyof typeof form]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="border border-border bg-bg px-4 py-3 font-mono text-sm text-primary outline-none transition-colors focus:border-border-active placeholder:text-tertiary"
                  placeholder={placeholder}
                />
              </div>
            ))}

            {/* Locality select */}
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary">
                Localidad
              </label>
              <select
                required
                value={form.locality}
                onChange={(e) => setForm({ ...form, locality: e.target.value })}
                className="border border-border bg-bg px-4 py-3 font-mono text-sm text-primary outline-none transition-colors focus:border-border-active"
              >
                <option value="" disabled>Selecciona tu localidad</option>
                {LOCALITIES.map((loc) => (
                  <option key={loc} value={loc}>{loc}</option>
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
      </motion.div>
    </div>
  )
}
