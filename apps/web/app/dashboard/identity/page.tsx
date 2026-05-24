'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle, ChevronDown, ChevronUp, Loader2, ShieldCheck } from 'lucide-react'
import { apiFetch } from '@/lib/api'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LOCALITIES = [
  { id: 1, name: 'Histórica y del Caribe Norte' },
  { id: 2, name: 'De la Virgen y Turística' },
  { id: 3, name: 'Industrial y de la Bahía' },
  { id: 4, name: 'Bayunca' },
] as const

type LocalityId = 1 | 2 | 3 | 4

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IdentityStatus {
  citizen_id: string
  did: string
  level: 0 | 1 | 2
  level_name: string
  can_vote: boolean
  can_propose: boolean
}

interface VerificationMethod {
  id: string
  type: string
  controller: string
  publicKeyMultibase?: string
}

interface ServiceEndpoint {
  id: string
  type: string
  serviceEndpoint: string
}

interface DIDDocument {
  '@context': string[]
  id: string
  verificationMethod?: VerificationMethod[]
  authentication?: string[]
  service?: ServiceEndpoint[]
  created?: string
  updated?: string
}

interface ProfileForm {
  neighborhood: string
  locality_id: LocalityId | ''
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateDid(did: string, maxLen = 40): string {
  if (did.length <= maxLen) return did
  return `${did.slice(0, 20)}…${did.slice(-16)}`
}

function formatDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC')
}

const INPUT_CLASS =
  'w-full bg-bg border border-border focus:border-gold/50 px-4 py-3 font-mono text-sm text-primary outline-none transition-colors placeholder:text-tertiary'

const LABEL_CLASS = 'font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary'

// ---------------------------------------------------------------------------
// Stepper component
// ---------------------------------------------------------------------------

interface StepperProps {
  level: 0 | 1 | 2
}

function VerificationStepper({ level }: StepperProps) {
  const steps = [
    { label: 'Registrado',         threshold: 0 },
    { label: 'Cédula confirmada',  threshold: 1 },
    { label: 'Identidad completa', threshold: 2 },
  ]

  return (
    <div className="flex items-center gap-0">
      {steps.map((step, idx) => {
        const isComplete = level >= step.threshold && (step.threshold === 0 || level >= step.threshold)
        const isCurrent  = (idx === 1 && level === 0) || (idx === 2 && level === 1)
        const isFuture   = !isComplete && !isCurrent

        return (
          <div key={step.label} className="flex flex-1 items-center">
            {/* Step circle + label */}
            <div className="flex flex-col items-center gap-2">
              <div
                className={[
                  'flex h-8 w-8 items-center justify-center text-[11px] font-mono transition-all',
                  isComplete
                    ? 'bg-gold text-bg'
                    : isCurrent
                    ? 'border border-gold text-gold bg-transparent'
                    : 'border border-border text-tertiary bg-transparent',
                ].join(' ')}
              >
                {isComplete ? (
                  <CheckCircle size={14} strokeWidth={2} />
                ) : (
                  <span>{idx}</span>
                )}
              </div>
              <span
                className={[
                  'font-mono text-[10px] uppercase tracking-[0.12em] whitespace-nowrap',
                  isComplete ? 'text-gold' : isCurrent ? 'text-primary' : 'text-tertiary',
                ].join(' ')}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line (not after last step) */}
            {idx < steps.length - 1 && (
              <div
                className={[
                  'h-px flex-1 mx-2 transition-colors',
                  level > idx ? 'bg-gold' : 'bg-border',
                ].join(' ')}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Active verification card
// ---------------------------------------------------------------------------

interface ActiveStepCardProps {
  level: 0 | 1 | 2
  onSuccess: () => Promise<void>
}

function ActiveStepCard({ level, onSuccess }: ActiveStepCardProps) {
  const [cedula,        setCedula]        = useState('')
  const [emailToken,    setEmailToken]    = useState('')
  const [devToken,      setDevToken]      = useState<string | null>(null)
  const [loading,       setLoading]       = useState(false)
  const [success,       setSuccess]       = useState<string | null>(null)
  const [error,         setError]         = useState<string | null>(null)
  const [emailSent,     setEmailSent]     = useState(false)

  async function handleCedulaSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!/^\d{10}$/.test(cedula)) {
      setError('La cédula debe tener exactamente 10 dígitos numéricos.')
      return
    }

    setLoading(true)
    try {
      await apiFetch('/identity/verify/cedula', {
        method: 'POST',
        body: JSON.stringify({ cedula }),
      })
      setSuccess('Cédula verificada correctamente.')
      await onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo conectar con el servidor.')
    } finally {
      setLoading(false)
    }
  }

  async function handleRequestEmailToken() {
    setError(null)
    setSuccess(null)
    setLoading(true)
    try {
      const data = await apiFetch<{ message?: string; token?: string }>('/identity/verify/email', {
        method: 'POST',
      })
      setEmailSent(true)
      setSuccess(data.message ?? 'Token enviado a tu correo.')
      if (data.token) setDevToken(data.token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo conectar con el servidor.')
    } finally {
      setLoading(false)
    }
  }

  async function handleEmailConfirm(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!emailToken.trim()) {
      setError('Ingresa el token de verificación.')
      return
    }

    setLoading(true)
    try {
      await apiFetch('/identity/verify/email/confirm', {
        method: 'POST',
        body: JSON.stringify({ token: emailToken.trim() }),
      })
      setSuccess('Email verificado. Identidad completa.')
      await onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo conectar con el servidor.')
    } finally {
      setLoading(false)
    }
  }

  if (level === 2) {
    return (
      <div className="border border-cyan/30 bg-cyan/5 px-6 py-6">
        <div className="flex items-start gap-4">
          <ShieldCheck size={20} strokeWidth={1.5} className="mt-0.5 shrink-0 text-cyan" />
          <div>
            <p className="font-display text-base font-bold text-primary">
              Identidad completamente verificada
            </p>
            <p className="mt-1 font-mono text-sm text-secondary">
              Puedes votar y proponer iniciativas ciudadanas.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={['border border-border bg-surface p-6 transition-opacity', loading ? 'opacity-50 cursor-wait' : ''].join(' ')}>
      {level === 0 && (
        <>
          <h3 className="mb-1 font-display text-base font-bold text-primary">
            Confirmar cédula
          </h3>
          <p className="mb-5 font-mono text-sm text-secondary">
            Ingresa tu número de cédula colombiana de 10 dígitos para verificar tu identidad.
          </p>

          <form onSubmit={handleCedulaSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="cedula" className={LABEL_CLASS}>
                Número de cédula <span className="text-gold">*</span>
              </label>
              <input
                id="cedula"
                type="text"
                inputMode="numeric"
                pattern="\d{10}"
                maxLength={10}
                required
                value={cedula}
                onChange={(e) => setCedula(e.target.value.replace(/\D/g, ''))}
                placeholder="0000000000"
                className={INPUT_CLASS}
                disabled={loading}
              />
              <span className="font-mono text-[10px] text-tertiary">
                {cedula.length}/10 dígitos
              </span>
            </div>

            {error && <InlineError message={error} />}
            {success && <InlineSuccess message={success} />}

            <div>
              <button
                type="submit"
                disabled={loading || cedula.length !== 10}
                className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
              >
                {loading ? 'Verificando…' : 'Confirmar cédula'}
              </button>
            </div>
          </form>
        </>
      )}

      {level === 1 && (
        <>
          <h3 className="mb-1 font-display text-base font-bold text-primary">
            Verificar email
          </h3>
          <p className="mb-5 font-mono text-sm text-secondary">
            Solicita un token de verificación y conférmalo para completar tu identidad.
          </p>

          <div className="flex flex-col gap-6">
            {/* Step a: Request token */}
            <div className="flex flex-col gap-3">
              <span className={LABEL_CLASS}>Paso 1 — Solicitar token</span>
              <button
                type="button"
                disabled={loading || emailSent}
                onClick={handleRequestEmailToken}
                className="btn-ghost self-start disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
              >
                {emailSent ? 'Token enviado' : 'Enviar token al correo'}
              </button>

              {devToken && (
                <div className="border border-gold/20 bg-gold/5 px-4 py-3">
                  <span className={`${LABEL_CLASS} mb-1 block`}>Token de desarrollo</span>
                  <span className="font-mono text-sm text-gold break-all">{devToken}</span>
                </div>
              )}
            </div>

            {/* Step b: Confirm token */}
            <form onSubmit={handleEmailConfirm} className="flex flex-col gap-3">
              <span className={LABEL_CLASS}>Paso 2 — Ingresar token</span>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email-token" className="sr-only">Token de verificación</label>
                <input
                  id="email-token"
                  type="text"
                  value={emailToken}
                  onChange={(e) => setEmailToken(e.target.value)}
                  placeholder="Pega el token aquí"
                  className={INPUT_CLASS}
                  disabled={loading}
                />
              </div>

              {error && <InlineError message={error} />}
              {success && <InlineSuccess message={success} />}

              <div>
                <button
                  type="submit"
                  disabled={loading || !emailToken.trim()}
                  className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {loading ? 'Confirmando…' : 'Confirmar token'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// DID Document card
// ---------------------------------------------------------------------------

interface DIDDocCardProps {
  doc: DIDDocument | null
  loading: boolean
}

function DIDDocCard({ doc, loading }: DIDDocCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border border-border bg-surface">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-6 py-4 transition-colors hover:bg-surface-2"
      >
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-secondary">
          Documento DID (W3C)
        </span>
        {expanded ? (
          <ChevronUp size={14} className="text-tertiary" />
        ) : (
          <ChevronDown size={14} className="text-tertiary" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-border px-6 py-5">
          {loading && (
            <div className="flex items-center gap-3 text-tertiary">
              <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />
              <span className="font-mono text-[11px]">Cargando documento…</span>
            </div>
          )}

          {!loading && !doc && (
            <p className="font-mono text-[11px] text-tertiary">
              Documento no disponible. Completa la verificación de cédula.
            </p>
          )}

          {!loading && doc && (
            <div className="flex flex-col gap-4">
              {/* DID ID */}
              <div>
                <span className={`${LABEL_CLASS} mb-1 block`}>id</span>
                <span className="font-mono text-sm text-gold break-all">{doc.id}</span>
              </div>

              {/* Context */}
              <div>
                <span className={`${LABEL_CLASS} mb-1 block`}>@context</span>
                <div className="flex flex-col gap-0.5">
                  {doc['@context'].map((ctx, i) => (
                    <span key={i} className="font-mono text-xs text-secondary break-all">
                      {ctx}
                    </span>
                  ))}
                </div>
              </div>

              {/* Verification methods */}
              {doc.verificationMethod && doc.verificationMethod.length > 0 && (
                <div>
                  <span className={`${LABEL_CLASS} mb-2 block`}>verificationMethod</span>
                  <div className="flex flex-col gap-3">
                    {doc.verificationMethod.map((vm) => (
                      <div key={vm.id} className="border border-border/50 px-4 py-3">
                        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                          <dt className="font-mono text-[10px] text-tertiary">id</dt>
                          <dd className="font-mono text-xs text-secondary break-all">{vm.id}</dd>

                          <dt className="font-mono text-[10px] text-tertiary">type</dt>
                          <dd className="font-mono text-xs text-cyan">{vm.type}</dd>

                          <dt className="font-mono text-[10px] text-tertiary">controller</dt>
                          <dd className="font-mono text-xs text-secondary break-all">{vm.controller}</dd>

                          {vm.publicKeyMultibase && (
                            <>
                              <dt className="font-mono text-[10px] text-tertiary">publicKey</dt>
                              <dd className="font-mono text-xs text-secondary break-all">
                                {vm.publicKeyMultibase.slice(0, 24)}…
                              </dd>
                            </>
                          )}
                        </dl>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Services */}
              {doc.service && doc.service.length > 0 && (
                <div>
                  <span className={`${LABEL_CLASS} mb-2 block`}>service</span>
                  <div className="flex flex-col gap-3">
                    {doc.service.map((svc) => (
                      <div key={svc.id} className="border border-border/50 px-4 py-3">
                        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                          <dt className="font-mono text-[10px] text-tertiary">id</dt>
                          <dd className="font-mono text-xs text-secondary break-all">{svc.id}</dd>

                          <dt className="font-mono text-[10px] text-tertiary">type</dt>
                          <dd className="font-mono text-xs text-cyan">{svc.type}</dd>

                          <dt className="font-mono text-[10px] text-tertiary">endpoint</dt>
                          <dd className="font-mono text-xs text-secondary break-all">{svc.serviceEndpoint}</dd>
                        </dl>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Dates */}
              {(doc.created ?? doc.updated) && (
                <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
                  {doc.created && (
                    <div>
                      <span className={`${LABEL_CLASS} mb-1 block`}>created</span>
                      <span className="font-mono text-xs text-tertiary">{formatDate(doc.created)}</span>
                    </div>
                  )}
                  {doc.updated && (
                    <div>
                      <span className={`${LABEL_CLASS} mb-1 block`}>updated</span>
                      <span className="font-mono text-xs text-tertiary">{formatDate(doc.updated)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Profile card
// ---------------------------------------------------------------------------

function ProfileCard() {
  const [form, setForm]       = useState<ProfileForm>({ neighborhood: '', locality_id: '' })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError]     = useState<string | null>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    const body: { neighborhood?: string; locality_id?: number } = {}
    if (form.neighborhood.trim()) body.neighborhood = form.neighborhood.trim()
    if (form.locality_id !== '')  body.locality_id  = form.locality_id

    try {
      await apiFetch('/identity/profile', {
        method: 'PUT',
        body: JSON.stringify(body),
      })
      setSuccess('Perfil actualizado correctamente.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo conectar con el servidor.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={['border border-border bg-surface p-6 transition-opacity', loading ? 'opacity-50 cursor-wait' : ''].join(' ')}>
      <h3 className="mb-1 font-display text-base font-bold text-primary">
        Perfil territorial
      </h3>
      <p className="mb-5 font-mono text-sm text-secondary">
        Asocia tu cuenta a tu barrio y localidad en Cartagena de Indias.
      </p>

      <form onSubmit={handleSave} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="neighborhood" className={LABEL_CLASS}>
            Barrio
          </label>
          <input
            id="neighborhood"
            type="text"
            maxLength={100}
            value={form.neighborhood}
            onChange={(e) => setForm((prev) => ({ ...prev, neighborhood: e.target.value }))}
            placeholder="Ej: Bocagrande, Manga, Getsemaní…"
            className={INPUT_CLASS}
            disabled={loading}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="locality" className={LABEL_CLASS}>
            Localidad
          </label>
          <select
            id="locality"
            value={form.locality_id}
            onChange={(e) => setForm((prev) => ({
              ...prev,
              locality_id: e.target.value === '' ? '' : (Number(e.target.value) as LocalityId),
            }))}
            className={INPUT_CLASS}
            disabled={loading}
          >
            <option value="">Selecciona una localidad</option>
            {LOCALITIES.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.id} — {loc.name}
              </option>
            ))}
          </select>
        </div>

        {error && <InlineError message={error} />}
        {success && <InlineSuccess message={success} />}

        <div>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
          >
            {loading ? 'Guardando…' : 'Guardar perfil'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inline feedback helpers
// ---------------------------------------------------------------------------

function InlineError({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5 border border-red/30 bg-red/5 px-4 py-3">
      <AlertCircle size={13} className="mt-0.5 shrink-0 text-red" />
      <span className="font-mono text-xs text-red">{message}</span>
    </div>
  )
}

function InlineSuccess({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5 border border-cyan/30 bg-cyan/5 px-4 py-3">
      <CheckCircle size={13} className="mt-0.5 shrink-0 text-cyan" />
      <span className="font-mono text-xs text-cyan">{message}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function IdentityPage() {
  const router = useRouter()

  const [status,     setStatus]     = useState<IdentityStatus | null>(null)
  const [didDoc,     setDidDoc]      = useState<DIDDocument | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [loadingDid,    setLoadingDid]    = useState(true)
  const [pageError,  setPageError]  = useState<string | null>(null)

  async function fetchStatus() {
    setLoadingStatus(true)
    try {
      const data = await apiFetch<IdentityStatus>('/identity/status')
      setStatus(data)
    } catch {
      setPageError('No se pudo cargar el estado de identidad.')
    } finally {
      setLoadingStatus(false)
    }
  }

  async function fetchDIDDoc() {
    setLoadingDid(true)
    try {
      const data = await apiFetch<DIDDocument>('/identity/me')
      setDidDoc(data)
    } catch {
      // Non-critical: DID doc may not exist yet at level 0
    } finally {
      setLoadingDid(false)
    }
  }

  useEffect(() => {
    void fetchStatus()
    void fetchDIDDoc()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleVerificationSuccess() {
    await Promise.all([fetchStatus(), fetchDIDDoc()])
  }

  return (
    <div className="min-h-screen">
      {/* ------------------------------------------------------------------ */}
      {/* Top bar                                                             */}
      {/* ------------------------------------------------------------------ */}
      <header className="border-b border-border bg-surface/60 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <nav className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.15em]">
            <a href="/" className="flex items-center gap-2 text-secondary hover:text-primary transition-colors">
              <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none">
                <polygon points="12,2 22,21 2,21" stroke="#C8A84B" strokeWidth="1.5" fill="none" />
              </svg>
              <span className="font-display text-xs font-bold tracking-widest text-primary">VÉRTICE OS</span>
            </a>
            <span className="text-tertiary">/</span>
            <a href="/dashboard" className="text-secondary hover:text-primary transition-colors">Dashboard</a>
            <span className="text-tertiary">/</span>
            <span className="text-gold">Identidad</span>
          </nav>

          <div className="flex items-center gap-3">
            <span className="status-dot" />
            <a href="/auth/login" className="btn-ghost py-2 px-4 text-[10px]">
              Salir
            </a>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Main                                                                */}
      {/* ------------------------------------------------------------------ */}
      <main className="mx-auto max-w-3xl px-6 py-10">

        {/* Page header */}
        <div className="mb-8">
          <span className="section-tag">Identidad Cívica</span>
          <h1 className="font-display text-3xl font-bold text-primary">Tu Identidad Digital</h1>
          <p className="mt-2 font-mono text-sm text-secondary">
            Gestiona tu identidad descentralizada (DID) y el nivel de verificación
            que te permite participar en la gobernanza de Cartagena.
          </p>

          {/* DID string */}
          {status?.did && (
            <div className="mt-4 flex items-center gap-2 border border-border bg-surface px-4 py-2.5 w-fit">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary shrink-0">DID</span>
              <span className="font-mono text-xs text-gold" title={status.did}>
                {truncateDid(status.did)}
              </span>
            </div>
          )}
        </div>

        {/* Page-level error */}
        {pageError && (
          <div className="mb-6">
            <InlineError message={pageError} />
          </div>
        )}

        {/* Loading skeleton */}
        {loadingStatus && (
          <div className="mb-8 flex flex-col items-center justify-center gap-4 border border-border bg-surface py-16">
            <Loader2 size={22} strokeWidth={1} className="animate-spin text-gold" />
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-tertiary">
              Cargando identidad…
            </p>
          </div>
        )}

        {/* Content (rendered once status is loaded) */}
        {!loadingStatus && status && (
          <div className="flex flex-col gap-8">

            {/* ── Section 1: Capabilities ─────────────────────────────── */}
            <div className="grid gap-px bg-border sm:grid-cols-3">
              <div className="flex flex-col gap-3 bg-bg p-5">
                <span className={`font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary`}>Nivel</span>
                <span className={`font-display text-2xl font-bold ${status.level === 2 ? 'text-gold' : status.level === 1 ? 'text-cyan' : 'text-secondary'}`}>
                  {status.level}
                </span>
                <span className="font-mono text-[11px] text-secondary">{status.level_name}</span>
              </div>
              <div className="flex flex-col gap-3 bg-bg p-5">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary">Puede votar</span>
                <span className={`font-display text-2xl font-bold ${status.can_vote ? 'text-cyan' : 'text-tertiary'}`}>
                  {status.can_vote ? 'Sí' : 'No'}
                </span>
                <span className="font-mono text-[11px] text-tertiary">
                  {status.can_vote ? 'Habilitado' : 'Requiere nivel 2'}
                </span>
              </div>
              <div className="flex flex-col gap-3 bg-bg p-5">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary">Puede proponer</span>
                <span className={`font-display text-2xl font-bold ${status.can_propose ? 'text-cyan' : 'text-tertiary'}`}>
                  {status.can_propose ? 'Sí' : 'No'}
                </span>
                <span className="font-mono text-[11px] text-tertiary">
                  {status.can_propose ? 'Habilitado' : 'Requiere nivel 1+'}
                </span>
              </div>
            </div>

            {/* ── Section 2: Stepper ──────────────────────────────────── */}
            <div className="border border-border bg-surface p-6">
              <span className={`${LABEL_CLASS} mb-5 block`}>Progreso de verificación</span>
              <VerificationStepper level={status.level} />
            </div>

            {/* ── Section 3: Active action card ───────────────────────── */}
            <ActiveStepCard
              level={status.level}
              onSuccess={handleVerificationSuccess}
            />

            {/* ── Section 4: DID Document ─────────────────────────────── */}
            <DIDDocCard doc={didDoc} loading={loadingDid} />

            {/* ── Section 5: Profile ──────────────────────────────────── */}
            <ProfileCard />

          </div>
        )}
      </main>
    </div>
  )
}
