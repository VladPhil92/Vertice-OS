'use client'

import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  ImagePlus,
  Info,
  Loader2,
  MapPin,
  RefreshCw,
  X,
} from 'lucide-react'
import { useState, useEffect, type FormEvent, type ChangeEvent } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'

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
type EvidenceStatus = 'pending' | 'uploading' | 'ready' | 'error'

interface ReportFormData {
  category: Category
  title: string
  description: string
  neighborhood: string
  address_reference: string
}

interface EvidenceDraft {
  key: string
  file: File
  preview_url: string
  status: EvidenceStatus
  media_asset_id?: string
  error?: string
}

interface MediaUploadIntent {
  media_asset_id: string
  upload_url: string
}

interface ConfirmedMedia {
  media_asset_id: string
  url: string
  status: 'confirmed' | 'attached'
}

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'infraestructura', label: 'Infraestructura' },
  { value: 'servicios_publicos', label: 'Servicios Públicos' },
  { value: 'seguridad', label: 'Seguridad' },
  { value: 'medio_ambiente', label: 'Medio Ambiente' },
  { value: 'transporte', label: 'Transporte' },
  { value: 'salud', label: 'Salud' },
  { value: 'educacion', label: 'Educación' },
  { value: 'cultura', label: 'Cultura' },
  { value: 'otro', label: 'Otro' },
]

const CARTAGENA_CENTER = { lat: 10.391, lng: -75.4794 }
const DESCRIPTION_MIN = 20
const DESCRIPTION_MAX = 2000
const TITLE_MAX = 200
const MAX_EVIDENCE = 5
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

const INPUT_CLASS =
  'w-full bg-surface border border-border focus:border-gold/50 px-4 py-3 font-mono text-sm text-primary outline-none transition-colors placeholder:text-tertiary'

export default function NewReportPage() {
  const [form, setForm] = useState<ReportFormData>({
    category: 'infraestructura',
    title: '',
    description: '',
    neighborhood: '',
    address_reference: '',
  })
  const [evidence, setEvidence] = useState<EvidenceDraft[]>([])
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [geoStatus, setGeoStatus] = useState<GeoStatus>('idle')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  function chooseEvidence(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (selected.length === 0) return

    const remaining = Math.max(0, MAX_EVIDENCE - evidence.length)
    const accepted: EvidenceDraft[] = []
    let validationError: string | null = null

    for (const [index, file] of selected.slice(0, remaining).entries()) {
      if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
        validationError = 'Las evidencias deben ser JPEG, PNG o WebP.'
        continue
      }
      if (file.size > MAX_IMAGE_BYTES) {
        validationError = 'Cada fotografía puede pesar máximo 10 MB.'
        continue
      }
      accepted.push({
        key: `${Date.now()}-${index}-${file.name}`,
        file,
        preview_url: URL.createObjectURL(file),
        status: 'pending',
      })
    }

    if (selected.length > remaining) {
      validationError = `Puedes adjuntar máximo ${MAX_EVIDENCE} fotografías por reporte.`
    }
    setEvidence((current) => [...current, ...accepted])
    setError(validationError)
  }

  function removeEvidence(key: string) {
    setEvidence((current) => {
      const target = current.find((item) => item.key === key)
      if (target) URL.revokeObjectURL(target.preview_url)
      return current.filter((item) => item.key !== key)
    })
  }

  function patchEvidence(key: string, patch: Partial<EvidenceDraft>) {
    setEvidence((current) => current.map((item) => (
      item.key === key ? { ...item, ...patch } : item
    )))
  }

  async function ensureEvidenceUploaded(item: EvidenceDraft): Promise<string> {
    if (item.status === 'ready' && item.media_asset_id) return item.media_asset_id

    patchEvidence(item.key, { status: 'uploading', error: undefined })
    try {
      const intent = await apiFetch<MediaUploadIntent>('/territorial/media/upload-intent', {
        method: 'POST',
      })

      const body = new FormData()
      body.append('file', item.file)
      const upload = await fetch(intent.upload_url, { method: 'POST', body })
      if (!upload.ok) throw new Error('El proveedor rechazó la fotografía.')

      const confirmed = await apiFetch<ConfirmedMedia>('/territorial/media/confirm', {
        method: 'POST',
        body: JSON.stringify({ media_asset_id: intent.media_asset_id }),
      })

      patchEvidence(item.key, {
        status: 'ready',
        media_asset_id: confirmed.media_asset_id,
        error: undefined,
      })
      return confirmed.media_asset_id
    } catch (uploadError) {
      const message = uploadError instanceof Error
        ? uploadError.message
        : 'No fue posible cargar esta evidencia.'
      patchEvidence(item.key, { status: 'error', error: message })
      throw uploadError
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
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
      const mediaAssetIds: string[] = []
      for (const item of evidence) {
        mediaAssetIds.push(await ensureEvidenceUploaded(item))
      }

      await apiFetch('/territorial/reports', {
        method: 'POST',
        body: JSON.stringify({
          category: form.category,
          title: form.title.trim(),
          description: form.description.trim(),
          lat: location.lat,
          lng: location.lng,
          neighborhood: form.neighborhood.trim() || undefined,
          address_reference: form.address_reference.trim() || undefined,
          media_asset_ids: mediaAssetIds,
        }),
      })

      window.location.href = '/dashboard/reports'
    } catch {
      setError(
        evidence.some((item) => item.status === 'error')
          ? 'No se pudieron cargar todas las evidencias. Puedes reintentar sin perder el formulario.'
          : 'No se pudo enviar el reporte. Verifica tu conexión e intenta de nuevo.',
      )
    } finally {
      setLoading(false)
    }
  }

  const descLen = form.description.length
  const descOk = descLen >= DESCRIPTION_MIN

  return (
    <div>
      <main className="mx-auto max-w-2xl px-6 py-10">
        <Link
          href="/dashboard"
          className="mb-8 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.15em] text-secondary transition-colors hover:text-primary"
        >
          <ArrowLeft size={12} strokeWidth={1.5} />
          Volver al dashboard
        </Link>

        <div className="mb-8">
          <span className="section-tag">Módulo Territorial</span>
          <h1 className="font-display text-3xl font-bold text-primary">Reportar situación</h1>
          <p className="mt-2 font-mono text-sm text-secondary">
            Informa sobre un problema en tu barrio o localidad. Tu reporte puede incorporar
            evidencia fotográfica verificable desde el momento de publicación.
          </p>
        </div>

        {error && (
          <div className="mb-6 border border-red/40 bg-red/10 px-4 py-3">
            <p className="font-mono text-[12px] text-red-400">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label htmlFor="category" className="font-mono text-[10px] uppercase tracking-[0.25em] text-tertiary">
              Categoría <span className="text-gold">*</span>
            </label>
            <select id="category" name="category" value={form.category} onChange={handleChange} className={INPUT_CLASS}>
              {CATEGORIES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="title" className="font-mono text-[10px] uppercase tracking-[0.25em] text-tertiary">
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
            <span className="self-end font-mono text-[10px] text-tertiary">{form.title.length}/{TITLE_MAX}</span>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="description" className="font-mono text-[10px] uppercase tracking-[0.25em] text-tertiary">
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
              <span className={`font-mono text-[10px] transition-colors ${descLen > 0 && !descOk ? 'text-red-400' : 'text-tertiary'}`}>
                {descLen > 0 && !descOk ? `Faltan ${DESCRIPTION_MIN - descLen} caracteres` : `Mínimo ${DESCRIPTION_MIN} caracteres`}
              </span>
              <span className={`font-mono text-[10px] transition-colors ${descLen > DESCRIPTION_MAX * 0.9 ? 'text-gold' : 'text-tertiary'}`}>
                {descLen}/{DESCRIPTION_MAX}
              </span>
            </div>
          </div>

          <section className="border border-border bg-surface p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">Evidencia fotográfica</h2>
                <p className="mt-1 font-mono text-[10px] leading-5 text-tertiary">
                  Opcional · hasta 5 imágenes JPEG, PNG o WebP · máximo 10 MB por archivo.
                </p>
              </div>
              <span className="font-mono text-[10px] text-tertiary">{evidence.length}/{MAX_EVIDENCE}</span>
            </div>

            {evidence.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {evidence.map((item) => (
                  <div key={item.key} className="relative overflow-hidden border border-border bg-bg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.preview_url} alt="Vista previa de evidencia" className="aspect-square w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeEvidence(item.key)}
                      disabled={loading}
                      aria-label="Quitar fotografía"
                      className="absolute right-2 top-2 rounded-full bg-black/70 p-1.5 text-white disabled:opacity-50"
                    >
                      <X size={12} />
                    </button>
                    <div className="absolute inset-x-0 bottom-0 bg-black/70 px-2 py-1.5 font-mono text-[9px] text-white">
                      {item.status === 'uploading' && 'Cargando…'}
                      {item.status === 'ready' && 'Evidencia confirmada'}
                      {item.status === 'error' && 'Error · se reintentará'}
                      {item.status === 'pending' && 'Lista para cargar'}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex items-center gap-3">
              <input
                id="report-evidence"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                multiple
                onChange={chooseEvidence}
                disabled={loading || evidence.length >= MAX_EVIDENCE}
                className="sr-only"
              />
              <label
                htmlFor="report-evidence"
                className={`inline-flex items-center gap-2 border border-gold/40 bg-gold/10 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-gold ${loading || evidence.length >= MAX_EVIDENCE ? 'pointer-events-none opacity-50' : 'cursor-pointer hover:bg-gold/20'}`}
              >
                <ImagePlus size={13} />
                {evidence.length === 0 ? 'Añadir fotografías' : 'Añadir más'}
              </label>
              <span className="font-mono text-[9px] leading-4 text-tertiary">
                La evidencia facilita verificación, seguimiento y cierre del reporte.
              </span>
            </div>
          </section>

          <div className="flex flex-col gap-2">
            <label htmlFor="neighborhood" className="font-mono text-[10px] uppercase tracking-[0.25em] text-tertiary">
              Barrio <span className="normal-case tracking-normal text-[9px] text-tertiary">(opcional)</span>
            </label>
            <input id="neighborhood" name="neighborhood" type="text" value={form.neighborhood} onChange={handleChange} placeholder="Ej: Manga, Bocagrande, Getsemaní" className={INPUT_CLASS} />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="address_reference" className="font-mono text-[10px] uppercase tracking-[0.25em] text-tertiary">
              Referencia de dirección <span className="normal-case tracking-normal text-[9px] text-tertiary">(opcional)</span>
            </label>
            <input id="address_reference" name="address_reference" type="text" value={form.address_reference} onChange={handleChange} placeholder="Ej: Calle 34 frente al parque" className={INPUT_CLASS} />
          </div>

          <div className="flex items-start gap-3 border border-border bg-surface px-4 py-3.5">
            <MapPin size={14} strokeWidth={1.5} className="mt-0.5 shrink-0 text-gold" />
            <div className="min-w-0 flex-1">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary">Ubicación del reporte</p>
              {geoStatus === 'detecting' && <div className="flex items-center gap-2"><Loader2 size={11} className="animate-spin text-secondary" /><span className="font-mono text-[11px] text-secondary">Detectando tu ubicación…</span></div>}
              {geoStatus === 'ok' && coords && <div className="flex items-center gap-2"><CheckCircle size={11} className="text-emerald-400" /><span className="font-mono text-[11px] text-emerald-400">Ubicación detectada — {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</span></div>}
              {(geoStatus === 'fallback' || geoStatus === 'idle') && <div className="flex items-center gap-2"><Info size={11} className="text-secondary" /><span className="font-mono text-[11px] text-secondary">Usando Cartagena centro como ubicación</span></div>}
              {geoStatus === 'denied' && <div className="flex items-center gap-2"><AlertCircle size={11} className="text-gold" /><span className="font-mono text-[11px] text-gold">Permiso denegado — usando Cartagena centro</span></div>}
            </div>
            {geoStatus !== 'detecting' && (
              <button type="button" onClick={requestLocation} className="flex flex-shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-secondary transition-colors hover:text-primary" aria-label="Re-detectar ubicación">
                <RefreshCw size={11} strokeWidth={1.5} /> Actualizar
              </button>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <Link href="/dashboard" className="btn-ghost px-6 py-3 text-[11px]">Cancelar</Link>
            <button type="submit" disabled={loading || geoStatus === 'detecting'} className="btn-primary px-8 py-3 disabled:cursor-not-allowed disabled:opacity-50 disabled:transform-none">
              {loading ? <span className="flex items-center gap-2"><Loader2 size={13} strokeWidth={1.5} className="animate-spin" />{evidence.length > 0 ? 'Cargando evidencia…' : 'Enviando…'}</span> : 'Enviar reporte'}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
