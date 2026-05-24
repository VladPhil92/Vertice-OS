'use client'

import { useState } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

const CATEGORIES = [
  { value: 'infraestructura', label: 'Infraestructura' },
  { value: 'movilidad',       label: 'Movilidad' },
  { value: 'seguridad',       label: 'Seguridad' },
  { value: 'medio_ambiente',  label: 'Medio ambiente' },
  { value: 'salud',           label: 'Salud' },
  { value: 'educación',       label: 'Educación' },
  { value: 'cultura',         label: 'Cultura' },
  { value: 'economía',        label: 'Economía' },
  { value: 'gobierno',        label: 'Gobierno' },
  { value: 'otro',            label: 'Otro' },
] as const

const SCOPES = [
  { value: 'neighborhood', label: 'Mi barrio'              },
  { value: 'locality',     label: 'Mi localidad'           },
  { value: 'city',         label: 'Ciudad (Cartagena)'     },
  { value: 'regional',     label: 'Regional'               },
  { value: 'national',     label: 'Nacional'               },
] as const

type Category = (typeof CATEGORIES)[number]['value']
type Scope    = (typeof SCOPES)[number]['value']

interface FormState {
  title:             string
  category:          Category | ''
  scope:             Scope | ''
  executive_summary: string
  description:       string
}

const INPUT_CLASS =
  'w-full bg-surface border border-border focus:border-gold/50 px-4 py-3 font-mono text-sm text-primary outline-none transition-colors placeholder:text-tertiary'

export default function NewProposalPage() {
  const [form, setForm] = useState<FormState>({
    title:             '',
    category:          '',
    scope:             '',
    executive_summary: '',
    description:       '',
  })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    if (error) setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.category) { setError('Selecciona una categoría.'); return }
    if (!form.scope)     { setError('Selecciona el alcance.'); return }
    if (form.description.trim().length < 50) {
      setError('La descripción debe tener al menos 50 caracteres.')
      return
    }

    const token = localStorage.getItem('access_token')

    setLoading(true)
    try {
      const res = await fetch(`${API}/governance/proposals`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          Authorization:   `Bearer ${token ?? ''}`,
        },
        body: JSON.stringify({
          title:             form.title.trim(),
          category:          form.category,
          scope:             form.scope,
          executive_summary: form.executive_summary.trim() || undefined,
          description:       form.description.trim(),
        }),
      })

      if (res.status === 401) {
        window.location.href = '/auth/login'
        return
      }

      if (res.status === 201) {
        window.location.href = '/dashboard/proposals'
        return
      }

      const body = await res.json().catch(() => null)
      setError(body?.message ?? `Error ${res.status}. Intenta de nuevo.`)
    } catch {
      setError('No se pudo conectar con el servidor. Verifica tu conexión.')
    } finally {
      setLoading(false)
    }
  }

  const descLen = form.description.length

  return (
    <div>
      <main className="mx-auto max-w-3xl px-6 py-10">
        {/* Page heading */}
        <div className="mb-10">
          <span className="section-tag">Módulo de Gobernanza</span>
          <h1 className="font-display text-3xl font-bold text-primary">
            Nueva propuesta ciudadana
          </h1>
          <p className="mt-3 font-mono text-sm text-secondary">
            Presenta una iniciativa para mejorar Cartagena. Tu propuesta será
            revisada por la comunidad antes de entrar en debate.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-8">

          {/* Title */}
          <div className="flex flex-col gap-2">
            <label htmlFor="title" className="font-mono text-[11px] uppercase tracking-[0.2em] text-tertiary">
              Título <span className="text-gold">*</span>
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              maxLength={200}
              value={form.title}
              onChange={handleChange}
              placeholder="Describe tu propuesta en una frase clara"
              className={INPUT_CLASS}
            />
            <span className="self-end font-mono text-[10px] text-tertiary">
              {form.title.length}/200
            </span>
          </div>

          {/* Category + Scope */}
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label htmlFor="category" className="font-mono text-[11px] uppercase tracking-[0.2em] text-tertiary">
                Categoría <span className="text-gold">*</span>
              </label>
              <select
                id="category"
                name="category"
                required
                value={form.category}
                onChange={handleChange}
                className={INPUT_CLASS}
              >
                <option value="" disabled>Selecciona una categoría</option>
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="scope" className="font-mono text-[11px] uppercase tracking-[0.2em] text-tertiary">
                Alcance <span className="text-gold">*</span>
              </label>
              <select
                id="scope"
                name="scope"
                required
                value={form.scope}
                onChange={handleChange}
                className={INPUT_CLASS}
              >
                <option value="" disabled>Selecciona el alcance</option>
                {SCOPES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Executive summary */}
          <div className="flex flex-col gap-2">
            <label htmlFor="executive_summary" className="font-mono text-[11px] uppercase tracking-[0.2em] text-tertiary">
              Resumen ejecutivo
              <span className="ml-2 text-tertiary normal-case tracking-normal">(opcional)</span>
            </label>
            <textarea
              id="executive_summary"
              name="executive_summary"
              rows={3}
              maxLength={500}
              value={form.executive_summary}
              onChange={handleChange}
              placeholder="Resumen ejecutivo en 2-3 oraciones"
              className={`${INPUT_CLASS} resize-none`}
            />
            <span className="self-end font-mono text-[10px] text-tertiary">
              {form.executive_summary.length}/500
            </span>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-2">
            <label htmlFor="description" className="font-mono text-[11px] uppercase tracking-[0.2em] text-tertiary">
              Descripción completa <span className="text-gold">*</span>
            </label>
            <div className="relative">
              <textarea
                id="description"
                name="description"
                rows={10}
                required
                minLength={50}
                maxLength={10000}
                value={form.description}
                onChange={handleChange}
                placeholder="Describe el problema, el contexto, la solución propuesta y el impacto esperado…"
                className={`${INPUT_CLASS} resize-y`}
              />
              <span
                className={`absolute bottom-3 right-3 font-mono text-[10px] transition-colors ${
                  descLen < 50 ? 'text-red-400' : 'text-tertiary'
                }`}
              >
                {descLen}/10 000
              </span>
            </div>
            {descLen > 0 && descLen < 50 && (
              <p className="font-mono text-[11px] text-red-400">
                Mínimo 50 caracteres ({50 - descLen} restantes)
              </p>
            )}
          </div>

          {/* Info box */}
          <div className="border border-gold/20 bg-gold/5 px-5 py-4">
            <p className="font-mono text-[12px] leading-relaxed text-secondary">
              <span className="text-gold font-medium">¿Cómo funciona el proceso?</span>
              <br />
              Tu propuesta entrará primero en fase{' '}
              <span className="text-gold">'idea'</span>, luego pasará a debate y
              finalmente a votación cuando reúna suficientes avales.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="border border-red-500/30 bg-red-500/10 px-5 py-4">
              <p className="font-mono text-[12px] text-red-400">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-4 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? 'Enviando…' : 'Publicar propuesta'}
            </button>
            <a href="/dashboard" className="btn-ghost">
              Cancelar
            </a>
          </div>

        </form>
      </main>
    </div>
  )
}
