'use client'

import { useState, type FormEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, Upload, MapPin, ArrowRight, ArrowLeft,
  AlertCircle, CheckCircle, Clock, Shield, Scale,
} from 'lucide-react'

// ── Tipos locales ─────────────────────────────────────────────────────────────

type Step = 'report' | 'analyzing' | 'result'

interface LegalResult {
  id: string
  legal_type: string
  urgency: string
  rights_affected: string[]
  target_entity: {
    name: string
    email: string
    address: string
    contact_person: string
  }
  response_deadline_days: number
  document_draft: string
  legal_orientation: string
  alternative_remedies: string[]
  next_steps: string[]
}

// ── Etiquetas legibles ────────────────────────────────────────────────────────

const LEGAL_TYPE_LABELS: Record<string, { label: string; color: string; icon: typeof FileText }> = {
  derecho_de_peticion:     { label: 'Derecho de Petición',       color: 'text-cyan',  icon: FileText },
  tutela:                  { label: 'Acción de Tutela',           color: 'text-gold',  icon: Shield   },
  accion_popular:          { label: 'Acción Popular',             color: 'text-cyan',  icon: Scale    },
  accion_de_cumplimiento:  { label: 'Acción de Cumplimiento',     color: 'text-cyan',  icon: Scale    },
  denuncia_penal:          { label: 'Denuncia Penal (Fiscalía)',   color: 'text-red',   icon: AlertCircle },
  queja:                   { label: 'Queja / PQRS',               color: 'text-gold',  icon: FileText },
}

const URGENCY_LABELS: Record<string, { label: string; color: string }> = {
  baja:    { label: 'Urgencia baja',    color: 'text-secondary' },
  media:   { label: 'Urgencia media',   color: 'text-gold'      },
  alta:    { label: 'Urgencia alta',    color: 'text-gold'      },
  critica: { label: 'URGENCIA CRÍTICA', color: 'text-red'       },
}

const CATEGORIES = [
  'Servicios públicos (agua, luz, gas)',
  'Infraestructura vial',
  'Salud',
  'Educación',
  'Medio ambiente',
  'Corrupción o malversación de fondos',
  'Derechos humanos',
  'Vivienda',
  'Seguridad ciudadana',
  'Trámites sin resolver',
  'Otro',
] as const

// ── Componente principal ──────────────────────────────────────────────────────

export default function NewLegalDocumentPage() {
  const [step, setStep] = useState<Step>('report')
  const [error, setError] = useState('')
  const [result, setResult] = useState<LegalResult | null>(null)
  const [editedDraft, setEditedDraft] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const [form, setForm] = useState({
    situation_description: '',
    evidence_description: '',
    location: '',
    category: '',
  })

  async function handleAnalyze(e: FormEvent) {
    e.preventDefault()
    setError('')
    setStep('analyzing')

    try {
      // Primero llama a la API principal que internamente llama al servicio IA
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/legal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? 'Error al analizar la situación')
      }

      const data = await res.json() as LegalResult
      setResult(data)
      setEditedDraft(data.document_draft)
      setStep('result')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setError(msg)
      setStep('report')
    }
  }

  async function handleSubmitDocument(via: 'email' | 'manual') {
    if (!result) return

    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/legal/${result.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ document_draft: editedDraft }),
      })

      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/legal/${result.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ submitted_via: via }),
      })

      setSubmitted(true)
    } catch {
      setError('No se pudo registrar el envío. El documento ya fue generado.')
    }
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border bg-surface/60 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-6 py-4">
          <a href="/dashboard" className="text-tertiary hover:text-secondary transition-colors">
            <ArrowLeft size={16} />
          </a>
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">
              Asistente Legal
            </span>
            <h1 className="font-display text-lg font-700 text-primary leading-tight">
              Nuevo documento jurídico
            </h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        <AnimatePresence mode="wait">

          {/* ── PASO 1: Formulario de reporte ── */}
          {step === 'report' && (
            <motion.div
              key="report"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
            >
              {/* Intro */}
              <div className="mb-8 border border-border bg-surface p-6">
                <div className="flex items-start gap-4">
                  <Scale size={20} className="mt-1 flex-shrink-0 text-gold" strokeWidth={1.5} />
                  <div>
                    <h2 className="mb-1 font-display text-base font-600 text-primary">
                      ¿Cómo funciona?
                    </h2>
                    <p className="font-mono text-[13px] leading-relaxed text-secondary">
                      Describe tu situación. La IA de VÉRTICE OS analizará los hechos,
                      determinará si aplica un <strong className="text-primary">derecho de petición</strong>,{' '}
                      <strong className="text-primary">tutela</strong>, <strong className="text-primary">acción popular</strong>{' '}
                      u otro recurso legal, y generará el documento completo listo para presentar.
                      Completamente gratis, sin necesidad de abogado.
                    </p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="mb-6 flex items-start gap-3 border border-red/30 bg-red/5 px-4 py-3">
                  <AlertCircle size={14} className="mt-0.5 flex-shrink-0 text-red" />
                  <span className="font-mono text-xs text-red">{error}</span>
                </div>
              )}

              <form onSubmit={handleAnalyze} className="flex flex-col gap-6">
                {/* Categoría */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary">
                    Categoría del problema *
                  </label>
                  <select
                    required
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="border border-border bg-bg px-4 py-3 font-mono text-sm text-primary outline-none transition-colors focus:border-border-active"
                  >
                    <option value="" disabled>Selecciona una categoría</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Descripción */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary">
                    Describe la situación con detalle *
                  </label>
                  <textarea
                    required
                    rows={8}
                    minLength={30}
                    maxLength={8000}
                    value={form.situation_description}
                    onChange={(e) => setForm({ ...form, situation_description: e.target.value })}
                    className="resize-none border border-border bg-bg px-4 py-3 font-mono text-sm text-primary outline-none transition-colors focus:border-border-active placeholder:text-tertiary"
                    placeholder="Describe qué pasó, cuándo, dónde, quién es el responsable y cómo te afecta a ti o a tu comunidad. Sé específico: fechas, nombres de entidades, número de personas afectadas, daños materiales o a la salud, intentos previos de solución..."
                  />
                  <span className="font-mono text-[10px] text-tertiary text-right">
                    {form.situation_description.length}/8000 caracteres
                  </span>
                </div>

                {/* Evidencias */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary">
                    Evidencias disponibles (opcional)
                  </label>
                  <textarea
                    rows={3}
                    maxLength={2000}
                    value={form.evidence_description}
                    onChange={(e) => setForm({ ...form, evidence_description: e.target.value })}
                    className="resize-none border border-border bg-bg px-4 py-3 font-mono text-sm text-primary outline-none transition-colors focus:border-border-active placeholder:text-tertiary"
                    placeholder="Describe las evidencias que tienes: fotos, videos, facturas, comunicaciones previas, testigos, documentos oficiales..."
                  />
                </div>

                {/* Ubicación */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary flex items-center gap-2">
                    <MapPin size={11} />
                    Ubicación donde ocurrió (opcional)
                  </label>
                  <input
                    type="text"
                    maxLength={300}
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    className="border border-border bg-bg px-4 py-3 font-mono text-sm text-primary outline-none transition-colors focus:border-border-active placeholder:text-tertiary"
                    placeholder="Ej: Calle 30 con Av. Pedro de Heredia, barrio Manga, Cartagena"
                  />
                </div>

                {/* Nota de privacidad */}
                <div className="border border-border/50 bg-surface/40 px-4 py-3">
                  <p className="font-mono text-[11px] text-tertiary">
                    <Shield size={10} className="inline mr-1.5 text-gold" />
                    Tu información es procesada de forma segura. El documento generado es tuyo y puedes
                    editarlo antes de enviarlo. VÉRTICE OS no envía el documento en tu nombre —
                    tú lo presentas.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={form.situation_description.length < 30 || !form.category}
                  className="btn-primary flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <Scale size={14} />
                  Analizar y generar documento
                  <ArrowRight size={14} />
                </button>
              </form>
            </motion.div>
          )}

          {/* ── PASO 2: Analizando ── */}
          {step === 'analyzing' && (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-32 text-center"
            >
              <div className="mb-8 relative">
                <div className="h-16 w-16 border border-gold/30 flex items-center justify-center">
                  <Scale size={24} className="text-gold animate-pulse" strokeWidth={1} />
                </div>
                <div className="absolute -inset-2 border border-gold/10 animate-slow-pulse" />
              </div>
              <h2 className="mb-3 font-display text-xl font-700 text-primary">
                Analizando tu situación
              </h2>
              <p className="font-mono text-sm text-secondary max-w-sm">
                La IA está revisando la normatividad colombiana aplicable,
                identificando los derechos afectados y generando tu documento legal…
              </p>
              <div className="mt-6 flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-gold animate-blink"
                    style={{ animationDelay: `${i * 0.3}s` }}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* ── PASO 3: Resultado ── */}
          {step === 'result' && result && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-6"
            >
              {submitted ? (
                /* Confirmación de envío */
                <div className="flex flex-col items-center py-20 text-center">
                  <CheckCircle size={48} className="mb-6 text-gold" strokeWidth={1} />
                  <h2 className="mb-3 font-display text-2xl font-700 text-primary">
                    Documento registrado
                  </h2>
                  <p className="mb-8 font-mono text-sm text-secondary max-w-md">
                    El documento quedó guardado en tu historial legal. Recuerda guardar
                    el acuse de recibo cuando lo presentes ante la entidad.
                  </p>
                  <div className="flex gap-3">
                    <a href="/dashboard/legal" className="btn-ghost">Ver mis documentos</a>
                    <a href="/dashboard" className="btn-primary">Volver al dashboard</a>
                  </div>
                </div>
              ) : (
                <>
                  {/* Clasificación IA */}
                  <div className="grid gap-4 sm:grid-cols-3">
                    {/* Tipo legal */}
                    <div className="border border-border bg-surface p-5">
                      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary block mb-2">
                        Instrumento jurídico
                      </span>
                      {(() => {
                        const lt = LEGAL_TYPE_LABELS[result.legal_type]
                        const Icon = lt?.icon ?? FileText
                        return (
                          <div className="flex items-center gap-2">
                            <Icon size={16} className={lt?.color ?? 'text-gold'} strokeWidth={1.5} />
                            <span className={`font-display text-base font-600 ${lt?.color ?? 'text-gold'}`}>
                              {lt?.label ?? result.legal_type}
                            </span>
                          </div>
                        )
                      })()}
                    </div>

                    {/* Urgencia */}
                    <div className="border border-border bg-surface p-5">
                      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary block mb-2">
                        Urgencia
                      </span>
                      {(() => {
                        const u = URGENCY_LABELS[result.urgency]
                        return (
                          <span className={`font-display text-base font-600 ${u?.color ?? 'text-gold'}`}>
                            {u?.label ?? result.urgency}
                          </span>
                        )
                      })()}
                    </div>

                    {/* Plazo */}
                    <div className="border border-border bg-surface p-5">
                      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary block mb-2">
                        Plazo de respuesta
                      </span>
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-cyan" />
                        <span className="font-display text-base font-600 text-cyan">
                          {result.response_deadline_days} días hábiles
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Entidad destino */}
                  <div className="border border-border bg-surface p-5">
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary block mb-3">
                      Entidad destinataria
                    </span>
                    <div className="flex flex-col gap-1">
                      <span className="font-display text-base font-600 text-primary">
                        {result.target_entity.name}
                      </span>
                      <span className="font-mono text-[12px] text-secondary">
                        {result.target_entity.contact_person}
                      </span>
                      <span className="font-mono text-[12px] text-tertiary">
                        {result.target_entity.address}
                      </span>
                      <a
                        href={`mailto:${result.target_entity.email}`}
                        className="font-mono text-[12px] text-cyan hover:underline w-fit"
                      >
                        {result.target_entity.email}
                      </a>
                    </div>
                  </div>

                  {/* Derechos afectados */}
                  {result.rights_affected.length > 0 && (
                    <div className="border border-border bg-surface p-5">
                      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary block mb-3">
                        Derechos afectados
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {result.rights_affected.map((right) => (
                          <span
                            key={right}
                            className="border border-gold/30 px-3 py-1 font-mono text-[11px] text-gold"
                          >
                            {right}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Orientación legal */}
                  <div className="border border-cyan/20 bg-cyan-dim p-5">
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan block mb-3">
                      Orientación jurídica
                    </span>
                    <p className="font-mono text-[13px] leading-relaxed text-secondary">
                      {result.legal_orientation}
                    </p>
                  </div>

                  {/* Documento generado (editable) */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary">
                        Documento generado — edita los campos marcados con [___]
                      </span>
                      <span className="font-mono text-[10px] text-gold">Editable</span>
                    </div>
                    <textarea
                      rows={20}
                      value={editedDraft}
                      onChange={(e) => setEditedDraft(e.target.value)}
                      className="resize-y border border-border bg-bg px-5 py-4 font-mono text-[13px] leading-relaxed text-primary outline-none transition-colors focus:border-border-active"
                    />
                  </div>

                  {/* Próximos pasos */}
                  {result.next_steps.length > 0 && (
                    <div className="border border-border p-5">
                      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary block mb-4">
                        Próximos pasos
                      </span>
                      <ol className="flex flex-col gap-3">
                        {result.next_steps.map((step, i) => (
                          <li key={i} className="flex items-start gap-3">
                            <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center border border-gold/30 font-mono text-[10px] text-gold">
                              {i + 1}
                            </span>
                            <span className="font-mono text-[13px] text-secondary">{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {/* Acciones de envío */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                    <button
                      onClick={() => handleSubmitDocument('manual')}
                      className="btn-ghost flex items-center gap-2"
                    >
                      <Upload size={14} />
                      Marcar como enviado (manual/impreso)
                    </button>
                    <button
                      onClick={() => {
                        // Preparar mailto con el documento
                        const subject = encodeURIComponent('Derecho de Petición — VÉRTICE OS')
                        const body = encodeURIComponent(editedDraft.slice(0, 2000))
                        window.open(`mailto:${result.target_entity.email}?subject=${subject}&body=${body}`)
                        handleSubmitDocument('email')
                      }}
                      className="btn-primary flex items-center gap-2"
                    >
                      <ArrowRight size={14} />
                      Enviar por correo electrónico
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  )
}
