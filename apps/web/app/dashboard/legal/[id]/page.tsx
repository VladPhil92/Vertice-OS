'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, CheckCircle, Clock, AlertTriangle, XCircle,
  FileText, Copy, Mail, MapPin, User, Phone, Building2,
  Shield, Scale, Check,
} from 'lucide-react'

// ── Constants ────────────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

const LEGAL_TYPE_LABELS: Record<string, string> = {
  derecho_de_peticion:    'Derecho de Petición',
  tutela:                 'Acción de Tutela',
  accion_popular:         'Acción Popular',
  accion_de_cumplimiento: 'Acción de Cumplimiento',
  denuncia_penal:         'Denuncia Penal',
  queja:                  'Queja/PQRS',
}

const URGENCY_COLOR: Record<string, string> = {
  baja:    'text-secondary',
  media:   'text-gold',
  alta:    'text-orange-400',
  critica: 'text-red-400',
}

const URGENCY_BADGE: Record<string, string> = {
  baja:    'border-border text-secondary',
  media:   'border-gold/30 text-gold',
  alta:    'border-orange-400/30 text-orange-400',
  critica: 'border-red-400/30 text-red-400',
}

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Clock; color: string }> = {
  draft:     { label: 'Borrador',   icon: FileText,      color: 'text-secondary' },
  ready:     { label: 'Listo',      icon: CheckCircle,   color: 'text-cyan' },
  submitted: { label: 'Enviado',    icon: Clock,         color: 'text-gold' },
  responded: { label: 'Respondido', icon: CheckCircle,   color: 'text-emerald-400' },
  escalated: { label: 'Escalado',   icon: AlertTriangle, color: 'text-red-400' },
  closed:    { label: 'Cerrado',    icon: XCircle,       color: 'text-tertiary' },
}

type SubmitVia = 'email' | 'portal' | 'manual'

const SUBMIT_OPTIONS: { via: SubmitVia; label: string; description: string }[] = [
  {
    via: 'email',
    label: 'Correo electrónico',
    description: 'Enviar el documento al email oficial de la entidad',
  },
  {
    via: 'portal',
    label: 'Portal web',
    description: 'Radicarlo en el portal de atención al ciudadano de la entidad',
  },
  {
    via: 'manual',
    label: 'Manual / presencial',
    description: 'Imprimir y radicar físicamente en la entidad',
  },
]

// ── Types ────────────────────────────────────────────────────────────────────

interface TargetEntity {
  name:           string
  type:           string
  address:        string
  email:          string
  phone:          string
  contact_person: string
}

interface LegalDocument {
  id:                    string
  citizen_id:            string
  legal_type:            string
  status:                string
  urgency:               string
  situation_description: string
  evidence_description:  string | null
  location:              string | null
  evidence_urls:         string[]
  rights_affected:       string[]
  target_entity:         TargetEntity
  response_deadline_days: number
  legal_basis:           string[]
  alternative_remedies:  string[]
  next_steps:            string[]
  legal_orientation:     string
  ai_audit_id:           string | null
  document_draft:        string
  submitted_at:          string | null
  submitted_via:         string | null
  entity_response:       string | null
  entity_responded_at:   string | null
  response_deadline_at:  string | null
  created_at:            string
  updated_at:            string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit', month: 'long', year: 'numeric',
  }).format(new Date(iso))
}

function isEditable(status: string): boolean {
  return status === 'draft' || status === 'ready'
}

function isPostResponse(status: string): boolean {
  return status === 'responded' || status === 'escalated' || status === 'closed'
}

// ── Section wrapper ──────────────────────────────────────────────────────────

function Section({ label, icon: Icon, children }: {
  label: string
  icon: typeof FileText
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <Icon size={14} className="text-gold" strokeWidth={1.5} />
        <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary">{label}</h2>
      </div>
      {children}
    </section>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function LegalDocumentDetailPage() {
  const params   = useParams()
  const router   = useRouter()
  const id       = params.id as string

  const [doc,        setDoc]        = useState<LegalDocument | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [notFound,   setNotFound]   = useState(false)

  // Edit state
  const [draft,      setDraft]      = useState('')
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)

  // Copy state
  const [copied,     setCopied]     = useState(false)

  // Submit state
  const [submitVia,  setSubmitVia]  = useState<SubmitVia>('email')
  const [submitting, setSubmitting] = useState(false)
  const [submitDone, setSubmitDone] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // ── Fetch on mount ─────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const token = localStorage.getItem('access_token')
        const res = await fetch(`${API}/legal/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (res.status === 401) {
          router.push('/auth/login')
          return
        }
        if (res.status === 404) {
          setNotFound(true)
          return
        }
        if (!res.ok) throw new Error('Error cargando documento')

        const data = (await res.json()) as LegalDocument
        setDoc(data)
        setDraft(data.document_draft)
      } catch {
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, router])

  // ── Actions ────────────────────────────────────────────────────────────────

  async function handleSaveDraft() {
    if (!doc) return
    setSaving(true)
    setSaved(false)
    try {
      const token = localStorage.getItem('access_token')
      const res = await fetch(`${API}/legal/${id}`, {
        method:  'PUT',
        headers: {
          Authorization:  `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ document_draft: draft }),
      })
      if (!res.ok) throw new Error()
      setDoc((prev) => prev ? { ...prev, document_draft: draft } : prev)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      // silently ignore — UI stays consistent
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmit() {
    if (!doc) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const token = localStorage.getItem('access_token')
      const res = await fetch(`${API}/legal/${id}/submit`, {
        method:  'POST',
        headers: {
          Authorization:  `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ submitted_via: submitVia }),
      })
      if (!res.ok) throw new Error('No se pudo registrar el envío')
      const updated = (await res.json()) as LegalDocument
      setDoc(updated)
      setSubmitDone(true)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCopy() {
    const text = doc?.document_draft ?? draft
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  // ── Email helper ───────────────────────────────────────────────────────────

  function openEmailClient() {
    if (!doc) return
    const subject = encodeURIComponent(
      `${LEGAL_TYPE_LABELS[doc.legal_type] ?? doc.legal_type} — VÉRTICE OS`
    )
    const body = encodeURIComponent(draft.slice(0, 2000))
    window.open(
      `mailto:${doc.target_entity.email}?subject=${subject}&body=${body}`,
      '_blank',
    )
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t border-gold" />
      </div>
    )
  }

  // ── Not found ──────────────────────────────────────────────────────────────

  if (notFound || !doc) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 text-center px-6">
        <FileText size={48} className="text-border" strokeWidth={1} />
        <div>
          <h1 className="font-display text-xl font-700 text-primary mb-2">
            Documento no encontrado
          </h1>
          <p className="font-mono text-sm text-secondary">
            El documento legal que buscas no existe o no tienes acceso a él.
          </p>
        </div>
        <a href="/dashboard/legal" className="btn-ghost flex items-center gap-2">
          <ArrowLeft size={14} />
          Volver a mis documentos
        </a>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const statusCfg  = STATUS_CONFIG[doc.status] ?? STATUS_CONFIG['draft']!
  const StatusIcon = statusCfg.icon
  const editable   = isEditable(doc.status)
  const typeLabel  = LEGAL_TYPE_LABELS[doc.legal_type] ?? doc.legal_type

  return (
    <div className="min-h-screen">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-border bg-surface/70 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">

          {/* Breadcrumb */}
          <div className="flex min-w-0 items-center gap-2 flex-wrap">
            <a href="/dashboard" className="flex items-center gap-2 flex-shrink-0">
              <svg viewBox="0 0 24 24" className="h-4 w-4 flex-shrink-0" fill="none">
                <polygon points="12,2 22,21 2,21" stroke="#C8A84B" strokeWidth="1.5" fill="none" />
              </svg>
              <span className="font-display text-[10px] font-700 uppercase tracking-widest text-primary hidden sm:block">
                VÉRTICE OS
              </span>
            </a>
            <span className="text-tertiary flex-shrink-0">/</span>
            <a
              href="/dashboard/legal"
              className="font-mono text-[10px] uppercase tracking-[0.15em] text-secondary hover:text-primary transition-colors flex-shrink-0"
            >
              Documentos Legales
            </a>
            <span className="text-tertiary flex-shrink-0">/</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-gold truncate max-w-[160px]">
              {typeLabel}
            </span>
          </div>

          {/* Badges + actions */}
          <div className="flex flex-shrink-0 items-center gap-2">
            {/* Status badge */}
            <div className={`hidden sm:flex items-center gap-1 font-mono text-[10px] ${statusCfg.color}`}>
              <StatusIcon size={11} />
              <span>{statusCfg.label}</span>
            </div>

            {/* Urgency badge */}
            <span
              className={`hidden sm:block rounded border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider ${URGENCY_BADGE[doc.urgency] ?? ''}`}
            >
              {doc.urgency}
            </span>

            {/* Actions */}
            {editable && (
              <button
                onClick={() => {
                  const el = document.getElementById('section-documento')
                  el?.scrollIntoView({ behavior: 'smooth' })
                }}
                className="btn-ghost py-1.5 px-3 text-[10px] hidden sm:block"
              >
                Editar borrador
              </button>
            )}
            {editable && (
              <button
                onClick={() => {
                  const el = document.getElementById('section-enviar')
                  el?.scrollIntoView({ behavior: 'smooth' })
                }}
                className="btn-primary py-1.5 px-3 text-[10px]"
              >
                Enviar
              </button>
            )}
            <a href="/dashboard/legal" className="btn-ghost py-1.5 px-3 text-[10px] flex items-center gap-1">
              <ArrowLeft size={12} />
              <span className="hidden sm:block">Lista</span>
            </a>
          </div>
        </div>
      </header>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-5xl px-6 py-10 flex flex-col gap-10">

        {/* ── Page title ── */}
        <div>
          <span className="section-tag">Módulo legal</span>
          <h1 className="font-display text-2xl font-700 text-primary">{typeLabel}</h1>
          <p className="mt-1 font-mono text-[11px] text-tertiary">
            Creado el {formatDate(doc.created_at)}
            {doc.submitted_at ? ` · Enviado el ${formatDate(doc.submitted_at)}` : ''}
          </p>
        </div>

        {/* ── 1. Situación reportada ── */}
        <Section label="Situación reportada" icon={FileText}>
          <div className="border border-border bg-surface p-5">
            <p className="font-mono text-[13px] leading-relaxed text-secondary whitespace-pre-wrap">
              {doc.situation_description}
            </p>
          </div>

          {doc.evidence_description && (
            <div className="border border-border/50 bg-surface/40 p-5">
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-tertiary block mb-2">
                Evidencias descritas
              </span>
              <p className="font-mono text-[13px] leading-relaxed text-secondary whitespace-pre-wrap">
                {doc.evidence_description}
              </p>
            </div>
          )}

          {doc.location && (
            <div className="flex items-center gap-2 font-mono text-[12px] text-secondary">
              <MapPin size={12} className="flex-shrink-0 text-tertiary" />
              <span>{doc.location}</span>
            </div>
          )}
        </Section>

        {/* ── 2. Análisis IA ── */}
        <Section label="Análisis IA" icon={Scale}>
          {/* Type + urgency summary */}
          <div className="grid gap-px bg-border sm:grid-cols-3">
            <div className="bg-surface p-5">
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-tertiary block mb-2">
                Instrumento jurídico
              </span>
              <span className="font-display text-base font-600 text-gold">{typeLabel}</span>
            </div>
            <div className="bg-surface p-5">
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-tertiary block mb-2">
                Urgencia
              </span>
              <span className={`font-display text-base font-600 ${URGENCY_COLOR[doc.urgency] ?? 'text-gold'}`}>
                {doc.urgency.charAt(0).toUpperCase() + doc.urgency.slice(1)}
              </span>
            </div>
            <div className="bg-surface p-5">
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-tertiary block mb-2">
                Plazo de respuesta
              </span>
              <div className="flex items-center gap-2">
                <Clock size={13} className="text-cyan" />
                <span className="font-display text-base font-600 text-cyan">
                  {doc.response_deadline_days} días hábiles
                </span>
              </div>
            </div>
          </div>

          {/* Rights affected */}
          {doc.rights_affected.length > 0 && (
            <div>
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-tertiary block mb-3">
                Derechos afectados
              </span>
              <div className="flex flex-wrap gap-2">
                {doc.rights_affected.map((right) => (
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

          {/* Legal orientation */}
          <div className="border border-cyan/20 bg-surface p-5">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-cyan block mb-3">
              Orientación jurídica
            </span>
            <p className="font-mono text-[13px] leading-relaxed text-secondary">
              {doc.legal_orientation}
            </p>
          </div>

          {/* Legal basis */}
          {doc.legal_basis.length > 0 && (
            <div className="border border-border bg-surface p-5">
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-tertiary block mb-4">
                Fundamento legal
              </span>
              <ol className="flex flex-col gap-2.5">
                {doc.legal_basis.map((basis, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center border border-border font-mono text-[10px] text-tertiary">
                      {i + 1}
                    </span>
                    <span className="font-mono text-[12px] text-secondary">{basis}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Alternative remedies */}
          {doc.alternative_remedies.length > 0 && (
            <div className="border border-border bg-surface p-5">
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-tertiary block mb-4">
                Remedios alternativos
              </span>
              <ul className="flex flex-col gap-2.5">
                {doc.alternative_remedies.map((remedy, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-border" />
                    <span className="font-mono text-[12px] text-secondary">{remedy}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Next steps */}
          {doc.next_steps.length > 0 && (
            <div className="border border-border bg-surface p-5">
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-tertiary block mb-4">
                Próximos pasos
              </span>
              <ol className="flex flex-col gap-3">
                {doc.next_steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center border border-gold/30 font-mono text-[10px] text-gold">
                      {i + 1}
                    </span>
                    <span className="font-mono text-[13px] text-secondary">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </Section>

        {/* ── 3. Entidad destino ── */}
        <Section label="Entidad destinataria" icon={Building2}>
          <div className="border border-border bg-surface p-6">
            <div className="flex flex-col gap-5">
              {/* Entity name + type */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-xl font-700 text-primary">
                    {doc.target_entity.name}
                  </h3>
                  <span className="mt-1 inline-block border border-border px-2 py-0.5 font-mono text-[10px] text-secondary uppercase tracking-wider">
                    {doc.target_entity.type}
                  </span>
                </div>
                <button
                  onClick={openEmailClient}
                  className="btn-ghost flex items-center gap-2 text-[11px] py-2 px-4"
                >
                  <Mail size={13} />
                  Escribir email
                </button>
              </div>

              {/* Contact details */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-start gap-3">
                  <MapPin size={13} className="mt-0.5 flex-shrink-0 text-tertiary" />
                  <div>
                    <span className="font-mono text-[10px] text-tertiary block mb-0.5">Dirección</span>
                    <span className="font-mono text-[12px] text-secondary">{doc.target_entity.address}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <User size={13} className="mt-0.5 flex-shrink-0 text-tertiary" />
                  <div>
                    <span className="font-mono text-[10px] text-tertiary block mb-0.5">Persona de contacto</span>
                    <span className="font-mono text-[12px] text-secondary">{doc.target_entity.contact_person}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Mail size={13} className="mt-0.5 flex-shrink-0 text-tertiary" />
                  <div>
                    <span className="font-mono text-[10px] text-tertiary block mb-0.5">Email oficial</span>
                    <a
                      href={`mailto:${doc.target_entity.email}`}
                      className="font-mono text-[12px] text-cyan hover:underline"
                    >
                      {doc.target_entity.email}
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Phone size={13} className="mt-0.5 flex-shrink-0 text-tertiary" />
                  <div>
                    <span className="font-mono text-[10px] text-tertiary block mb-0.5">Teléfono</span>
                    <span className="font-mono text-[12px] text-secondary">{doc.target_entity.phone}</span>
                  </div>
                </div>
              </div>

              {/* Response deadline */}
              <div className="border-t border-border pt-4 flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-2">
                  <Clock size={13} className="text-gold" />
                  <span className="font-mono text-[11px] text-tertiary">Plazo legal:</span>
                  {doc.response_deadline_at ? (
                    <span className="font-mono text-[11px] text-gold">
                      {formatDate(doc.response_deadline_at)}
                    </span>
                  ) : (
                    <span className="font-mono text-[11px] text-gold">
                      {doc.response_deadline_days} días hábiles desde la radicación
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* ── 4. Documento generado ── */}
        <Section label="Documento generado" icon={FileText}>
          <div id="section-documento" className="flex flex-col gap-3">
            {/* Editable vs read-only */}
            {editable ? (
              <>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="font-mono text-[11px] text-tertiary">
                    Edita los campos marcados con{' '}
                    <span className="text-gold font-600">[___]</span>{' '}
                    antes de enviar el documento.
                  </p>
                  <span className="font-mono text-[10px] text-gold">Editable</span>
                </div>
                <textarea
                  rows={20}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="w-full resize-y bg-surface border border-border focus:border-gold/50 px-4 py-3 font-mono text-sm text-primary outline-none transition-colors placeholder:text-tertiary"
                />
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <button
                    onClick={handleCopy}
                    className="btn-ghost flex items-center gap-2 text-[11px] py-2 px-4"
                  >
                    {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    {copied ? 'Copiado' : 'Copiar al portapapeles'}
                  </button>
                  <button
                    onClick={handleSaveDraft}
                    disabled={saving}
                    className="btn-primary flex items-center gap-2 text-[11px] py-2 px-4 disabled:opacity-50"
                  >
                    {saved ? (
                      <>
                        <Check size={13} className="text-emerald-300" />
                        Guardado ✓
                      </>
                    ) : saving ? (
                      'Guardando…'
                    ) : (
                      'Guardar cambios'
                    )}
                  </button>
                </div>
              </>
            ) : (
              <>
                <pre className="overflow-x-auto whitespace-pre-wrap border border-border bg-surface p-5 font-mono text-[13px] leading-relaxed text-secondary">
                  {doc.document_draft}
                </pre>
                <button
                  onClick={handleCopy}
                  className="btn-ghost self-start flex items-center gap-2 text-[11px] py-2 px-4"
                >
                  {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  {copied ? 'Copiado' : 'Copiar al portapapeles'}
                </button>
              </>
            )}
          </div>
        </Section>

        {/* ── 5. Enviar documento (only if editable) ── */}
        {editable && (
          <Section label="Enviar documento" icon={Shield}>
            <div id="section-enviar" className="flex flex-col gap-4">
              {submitDone ? (
                <div className="flex flex-col items-center gap-4 py-10 text-center">
                  <CheckCircle size={40} className="text-gold" strokeWidth={1} />
                  <p className="font-display text-lg font-700 text-primary">
                    ¡Documento marcado como enviado!
                  </p>
                  <p className="font-mono text-sm text-secondary max-w-sm">
                    El documento quedó registrado en tu historial. Guarda el acuse de recibo
                    cuando lo presentes ante la entidad.
                  </p>
                </div>
              ) : (
                <>
                  <p className="font-mono text-[12px] text-secondary">
                    Selecciona cómo presentarás el documento ante{' '}
                    <span className="text-primary">{doc.target_entity.name}</span>:
                  </p>

                  {/* Submission method cards */}
                  <div className="grid gap-2 sm:grid-cols-3">
                    {SUBMIT_OPTIONS.map((opt) => (
                      <button
                        key={opt.via}
                        onClick={() => setSubmitVia(opt.via)}
                        className={[
                          'flex flex-col gap-1.5 border p-4 text-left transition-colors',
                          submitVia === opt.via
                            ? 'border-gold/50 bg-gold/5'
                            : 'border-border bg-surface hover:border-border-active',
                        ].join(' ')}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`font-mono text-[11px] font-600 ${submitVia === opt.via ? 'text-gold' : 'text-secondary'}`}>
                            {opt.label}
                          </span>
                          {submitVia === opt.via && (
                            <span className="h-2 w-2 rounded-full bg-gold" />
                          )}
                        </div>
                        <span className="font-mono text-[10px] text-tertiary leading-relaxed">
                          {opt.description}
                        </span>
                      </button>
                    ))}
                  </div>

                  {submitError && (
                    <div className="border border-red-500/30 bg-red-500/10 px-4 py-3 font-mono text-xs text-red-400">
                      {submitError}
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <a href="/dashboard/legal" className="btn-ghost text-[11px] py-2 px-4">
                      Cancelar
                    </a>
                    <button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="btn-primary flex items-center gap-2 text-[11px] py-2 px-5 disabled:opacity-50"
                    >
                      {submitting ? 'Registrando…' : 'Confirmar envío'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </Section>
        )}

        {/* ── 6. Estado y respuesta (if post-response) ── */}
        {isPostResponse(doc.status) && (
          <Section label="Estado y respuesta de la entidad" icon={CheckCircle}>
            <div className="border border-border bg-surface p-5">
              <div className="flex flex-wrap items-center gap-4 mb-4">
                <div className={`flex items-center gap-1.5 font-mono text-[11px] ${statusCfg.color}`}>
                  <StatusIcon size={13} />
                  {statusCfg.label}
                </div>
                {doc.entity_responded_at && (
                  <span className="font-mono text-[11px] text-tertiary">
                    Respondido el {formatDate(doc.entity_responded_at)}
                  </span>
                )}
              </div>

              {doc.entity_response ? (
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-tertiary block mb-3">
                    Respuesta de la entidad
                  </span>
                  <p className="font-mono text-[13px] leading-relaxed text-secondary whitespace-pre-wrap">
                    {doc.entity_response}
                  </p>
                </div>
              ) : (
                <p className="font-mono text-[12px] text-tertiary italic">
                  No se ha registrado respuesta de la entidad aún.
                </p>
              )}
            </div>
          </Section>
        )}

      </main>
    </div>
  )
}
