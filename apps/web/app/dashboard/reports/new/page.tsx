'use client'

import { ArrowLeft, Loader2, Info, MapPin, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react'
import { useState, useEffect, type FormEvent, type ChangeEvent } from 'react'
import { apiFetch } from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

type Category =
  | 'infraestructura'
  | 'servicios_publicos'
  | 'seguridad'
  | 'medio_ambiente'
  | 'transporte'
  | 'salud'
  | 'educacion'
  | 'cultura'
  | 'otro'

type GeoStatus = 'idle' | 'detecting' | 'ok' | 'fallback' | 'denied'

interface ReportFormData {
  category:          Category
  title:             string
  description:       string
  neighborhood:      string
  address_reference: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'infraestructura',    label: 'Infraestructura' },
  { value: 'servicios_publicos', label: 'Servicios Públicos' },
  { value: 'seguridad',          label: 'Seguridad' },
  { value: 'medio_ambiente',     label: 'Medio Ambiente' },
  { value: 'transporte',         label: 'Transporte' },
  { value: 'salud',              label: 'Salud' },
  { value: 'educacion',          label: 'Educación' },
  { value: 'cultura',            label: 'Cultura' },
  { value: 'otro',               label: 'Otro' },
]

const CARTAGENA_CENTER = { lat: 10.391, lng: -75.4794 }
const DESCRIPTION_MIN  = 20
const DESCRIPTION_MAX  = 2000
const TITLE_MAX        = 200

const INPUT_CLASS =
  'w-full bg-surface border border-border focus:border-gold/50 px-4 py-3 font-mono text-sm text-primary outline-none transition-colors placeholder:text-tertiary'

// ─── Component ────────────────────────────────────────────────────────────────

export default function NewReportPage() {
  const [form, setForm] = useState<ReportFormData>({
    category:          'infraestructura',
    title:             '',
    description:       '',
    neighborhood:      '',
    address_reference: '',
  })

  const [coords, setCoords]       = useState<{ lat: number; lng: number } | null>(null)
  const [geoStatus, setGeoStatus] = useState<GeoStatus>('idle')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)

  // Auto-detect on mount
  useEffect(() => {
    requestLocation()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function requestLocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setCoords(CARTAGENA_CENTER)
      setGeoStatus('fallback')
      return
    }
    setGeoStatus('detecting')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setGeoStatus('ok')
      },
      () => {
        setCoords(CARTAGENA_CENTER)
        setGeoStatus(window.location.protocol === 'https:' ? 'denied' : 'fallback')
      },
      { timeout: 8000, maximumAge: 60_000 },
    )
  }

  function handleChange(
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (form.title.trim().length === 0) {
      setError('El título es obligatorio.')
      return
    }
    if (form.description.trim().length < DESCRIPTION_MIN) {
      setError(`La descripción debe tener al menos ${DESCRIPTION_MIN} caracteres.`)
      return
    }

    const location = coords ?? CARTAGENA_CENTER
    setLoading(true)

    try {
      await apiFetch('/territorial/reports', {
        method: 'POST',
        body: JSON.stringify({
          category:          form.category,
          title:             form.title.trim(),
          description:       form.description.trim(),
          lat:               location.lat,
          lng:               location.lng,
          neighborhood:      form.neighborhood.trim() || undefined,
          address_reference: form.address_reference.trim() || undefined,
          media_urls:        [],
        }),
      })

      window.location.href = '/dashboard/reports'
    } catch {
      setError('No se pudo enviar el reporte. Verifica tu conexión e intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const descLen    = form.description.length
  const descOk     = descLen >= DESCRIPTION_MIN

  return (
    <div>
      <main className="mx-auto max-w-2xl px-6 py-10">

        {/* Back */}
        <a
          href="/dashboard"
          className="mb-8 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.15em] text-secondary transition-colors hover:text-primary"
        >
          <ArrowLeft size={12} strokeWidth={1.5} />
          Volver al dashboard
        </a>

        {/* Header */}
        <div className="mb-8">
          <span className="section-tag">Módulo Territorial</span>
          <h1 className="font-display text-3xl font-bold text-primary">Reportar situación</h1>
          <p className="mt-2 font-mono text-sm text-secondary">
            Informa sobre un problema en tu barrio o localidad. Tu reporte es verificado y
            escalado a las autoridades competentes.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 border border-red/40 bg-red/10 px-4 py-3">
            <p className="font-mono text-[12px] text-red-400">{error}</p>
          </div>
        )}

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
                <option key={value} value={value}>{label}</option>
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
                  descLen > 0 && !descOk ? 'text-red-400' : 'text-tertiary'
                }`}
              >
                {descLen > 0 && !descOk
                  ? `Faltan ${DESCRIPTION_MIN - descLen} caracteres`
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
              Barrio{' '}
              <span className="normal-case tracking-normal text-[9px] text-tertiary">(opcional)</span>
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
              Referencia de dirección{' '}
              <span className="normal-case tracking-normal text-[9px] text-tertiary">(opcional)</span>
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

          {/* Geolocation status */}
          <div className="flex items-start gap-3 border border-border bg-surface px-4 py-3.5">
            <MapPin size={14} strokeWidth={1.5} className="mt-0.5 shrink-0 text-gold" />
            <div className="flex-1 min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary mb-1">
                Ubicación del reporte
              </p>
              {geoStatus === 'detecting' && (
                <div className="flex items-center gap-2">
                  <Loader2 size={11} className="animate-spin text-secondary" />
                  <span className="font-mono text-[11px] text-secondary">Detectando tu ubicación…</span>
                </div>
              )}
              {geoStatus === 'ok' && coords && (
                <div className="flex items-center gap-2">
                  <CheckCircle size={11} className="text-emerald-400" />
                  <span className="font-mono text-[11px] text-emerald-400">
                    Ubicación detectada — {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                  </span>
                </div>
              )}
              {(geoStatus === 'fallback' || geoStatus === 'idle') && (
                <div className="flex items-center gap-2">
                  <Info size={11} className="text-secondary" />
                  <span className="font-mono text-[11px] text-secondary">
                    Usando Cartagena centro como ubicación
                  </span>
                </div>
              )}
              {geoStatus === 'denied' && (
                <div className="flex items-center gap-2">
                  <AlertCircle size={11} className="text-gold" />
                  <span className="font-mono text-[11px] text-gold">
                    Permiso denegado — usando Cartagena centro
                  </span>
                </div>
              )}
            </div>
            {geoStatus !== 'detecting' && (
              <button
                type="button"
                onClick={requestLocation}
                className="flex-shrink-0 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-secondary transition-colors hover:text-primary"
                aria-label="Re-detectar ubicación"
              >
                <RefreshCw size={11} strokeWidth={1.5} />
                Actualizar
              </button>
            )}
          </div>

          {/* Submit */}
          <div className="flex items-center justify-between pt-2">
            <a href="/dashboard" className="btn-ghost py-3 px-6 text-[11px]">
              Cancelar
            </a>
            <button
              type="submit"
              disabled={loading || geoStatus === 'detecting'}
              className="btn-primary py-3 px-8 disabled:cursor-not-allowed disabled:opacity-50 disabled:transform-none"
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
