'use client'

import { ArrowLeft, Loader2, Info } from 'lucide-react'
import { useState, type FormEvent, type ChangeEvent } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Category =
  | 'infraestructura'
  | 'servicios_públicos'
  | 'seguridad'
  | 'medio_ambiente'
  | 'movilidad'
  | 'salud'
  | 'educación'
  | 'otro'

interface ReportFormData {
  category: Category
  title: string
  description: string
  neighborhood: string
  address_reference: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'infraestructura',    label: 'Infraestructura' },
  { value: 'servicios_públicos', label: 'Servicios Públicos' },
  { value: 'seguridad',          label: 'Seguridad' },
  { value: 'medio_ambiente',     label: 'Medio Ambiente' },
  { value: 'movilidad',          label: 'Movilidad' },
  { value: 'salud',              label: 'Salud' },
  { value: 'educación',          label: 'Educación' },
  { value: 'otro',               label: 'Otro' },
]

const DESCRIPTION_MIN = 30
const DESCRIPTION_MAX = 5000
const TITLE_MAX = 200

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

const INPUT_CLASS =
  'w-full bg-surface border border-border focus:border-gold/50 px-4 py-3 font-mono text-sm text-primary outline-none transition-colors placeholder:text-tertiary'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function NewReportPage() {
  const [form, setForm] = useState<ReportFormData>({
    category: 'infraestructura',
    title: '',
    description: '',
    neighborhood: '',
    address_reference: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleChange(
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    // Client-side guards
    if (form.title.trim().length === 0) {
      setError('El título es obligatorio.')
      return
    }
    if (form.description.trim().length < DESCRIPTION_MIN) {
      setError(`La descripción debe tener al menos ${DESCRIPTION_MIN} caracteres.`)
      return
    }

    setLoading(true)

    try {
      const token = localStorage.getItem('access_token')

      const res = await fetch(`${API_BASE}/territorial/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          category: form.category,
          title: form.title.trim(),
          description: form.description.trim(),
          neighborhood: form.neighborhood.trim() || undefined,
          address_reference: form.address_reference.trim() || undefined,
        }),
      })

      if (res.status === 201) {
        window.location.href = '/dashboard/reports'
        return
      }

      const data = await res.json().catch(() => ({}))
      setError(
        (data as { message?: string }).message ??
          `Error inesperado (código ${res.status}). Intenta nuevamente.`,
      )
    } catch {
      setError('No se pudo conectar con el servidor. Verifica tu conexión.')
    } finally {
      setLoading(false)
    }
  }

  const descLen = form.description.length
  const descOverMin = descLen >= DESCRIPTION_MIN

  return (
    <div>
      <main className="mx-auto max-w-2xl px-6 py-10">
        {/* Back link */}
        <a
          href="/dashboard"
          className="mb-8 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.15em] text-secondary hover:text-primary transition-colors"
        >
          <ArrowLeft size={12} strokeWidth={1.5} />
          Volver al dashboard
        </a>

        {/* Section header */}
        <div className="mb-8">
          <span className="section-tag">Módulo Territorial</span>
          <h1 className="font-display text-3xl font-bold text-primary">Reportar situación</h1>
          <p className="mt-2 font-mono text-sm text-secondary">
            Informa sobre un problema en tu barrio o localidad. Tu reporte es verificado y
            escalado a las autoridades competentes.
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-6 border border-red/40 bg-red/10 px-4 py-3">
            <p className="font-mono text-[12px] text-red-400">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">

          {/* Category */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="category"
              className="font-mono text-[10px] uppercase tracking-[0.25em] text-tertiary"
            >
              Categoría <span className="text-gold">*</span>
            </label>
            <select
              id="category"
              name="category"
              value={form.category}
              onChange={handleChange}
              className={INPUT_CLASS}
            >
              {CATEGORIES.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="title"
              className="font-mono text-[10px] uppercase tracking-[0.25em] text-tertiary"
            >
              Título <span className="text-gold">*</span>
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              maxLength={TITLE_MAX}
              value={form.title}
              onChange={handleChange}
              placeholder="Describe el problema en pocas palabras"
              className={INPUT_CLASS}
            />
            <span className="self-end font-mono text-[10px] text-tertiary">
              {form.title.length}/{TITLE_MAX}
            </span>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="description"
              className="font-mono text-[10px] uppercase tracking-[0.25em] text-tertiary"
            >
              Descripción <span className="text-gold">*</span>
            </label>
            <textarea
              id="description"
              name="description"
              required
              minLength={DESCRIPTION_MIN}
              maxLength={DESCRIPTION_MAX}
              rows={6}
              value={form.description}
              onChange={handleChange}
              placeholder="Describe la situación con detalle: ¿qué ocurre, desde cuándo, cómo afecta a la comunidad?"
              className={`${INPUT_CLASS} resize-y`}
            />
            <div className="flex items-center justify-between">
              <span
                className={`font-mono text-[10px] transition-colors ${
                  descLen > 0 && !descOverMin ? 'text-red-400' : 'text-tertiary'
                }`}
              >
                {descLen > 0 && !descOverMin
                  ? `Mínimo ${DESCRIPTION_MIN - descLen} caracteres más`
                  : `Mínimo ${DESCRIPTION_MIN} caracteres`}
              </span>
              <span
                className={`font-mono text-[10px] transition-colors ${
                  descLen > DESCRIPTION_MAX * 0.9 ? 'text-gold' : 'text-tertiary'
                }`}
              >
                {descLen}/{DESCRIPTION_MAX}
              </span>
            </div>
          </div>

          {/* Neighborhood */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="neighborhood"
              className="font-mono text-[10px] uppercase tracking-[0.25em] text-tertiary"
            >
              Barrio <span className="text-tertiary text-[9px] normal-case tracking-normal">(opcional)</span>
            </label>
            <input
              id="neighborhood"
              name="neighborhood"
              type="text"
              value={form.neighborhood}
              onChange={handleChange}
              placeholder="Ej: Manga, Bocagrande, Getsemaní"
              className={INPUT_CLASS}
            />
          </div>

          {/* Address reference */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="address_reference"
              className="font-mono text-[10px] uppercase tracking-[0.25em] text-tertiary"
            >
              Referencia de dirección <span className="text-tertiary text-[9px] normal-case tracking-normal">(opcional)</span>
            </label>
            <input
              id="address_reference"
              name="address_reference"
              type="text"
              value={form.address_reference}
              onChange={handleChange}
              placeholder="Ej: Calle 34 frente al parque"
              className={INPUT_CLASS}
            />
          </div>

          {/* Evidence note */}
          <div className="flex items-start gap-3 border border-border bg-surface px-4 py-3">
            <Info size={14} strokeWidth={1.5} className="mt-0.5 shrink-0 text-cyan" />
            <p className="font-mono text-[11px] text-secondary">
              Puedes adjuntar fotos en una próxima versión.
            </p>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-between pt-2">
            <a
              href="/dashboard"
              className="btn-ghost py-3 px-6 text-[11px]"
            >
              Cancelar
            </a>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary py-3 px-8 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={13} strokeWidth={1.5} className="animate-spin" />
                  Enviando…
                </span>
              ) : (
                'Enviar reporte'
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
