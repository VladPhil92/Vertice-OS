'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Info,
  Loader2,
  ShieldCheck,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'

const LOCALITIES = [
  { id: 1, name: 'Histórica y del Caribe Norte' },
  { id: 2, name: 'De la Virgen y Turística' },
  { id: 3, name: 'Industrial y de la Bahía' },
  { id: 4, name: 'Bayunca' },
] as const

type LocalityId = 1 | 2 | 3 | 4

interface IdentityStatus {
  citizen_id: string
  did: string
  level: 0 | 1 | 2
  level_name: string
  can_vote: boolean
  can_propose: boolean
}

interface CivicIdentityAssuranceStatus {
  citizen_id: string
  assured: boolean
  status: 'assured' | 'required'
  governance_eligible: boolean
  verification_level: number
  provider: string | null
  provider_verified_at: string | null
  provider_expires_at: string | null
  requirements: {
    contact_verified: boolean
    provider_ingress_operational: boolean
    active_identity_proof: boolean
    provider_external_certified: boolean
  }
}

interface DIDDocument {
  '@context': string[]
  id: string
  controller?: string
  service?: Array<{
    id: string
    type: string
    serviceEndpoint: string
  }>
  created?: string
  updated?: string
  verificationLevel?: number
}

interface ProfileForm {
  neighborhood: string
  locality_id: LocalityId | ''
}

const INPUT_CLASS =
  'w-full bg-bg border border-border focus:border-gold/50 px-4 py-3 font-mono text-sm text-primary outline-none transition-colors placeholder:text-tertiary'
const LABEL_CLASS = 'font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary'

function truncateDid(did: string, maxLen = 40): string {
  if (did.length <= maxLen) return did
  return `${did.slice(0, 20)}…${did.slice(-16)}`
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('es-CO')
}

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

function VerificationStepper({ level }: { level: 0 | 1 | 2 }) {
  const steps = [
    { label: 'Registrado', threshold: 0 },
    { label: 'Documento reconocido', threshold: 1 },
    { label: 'Verificación básica completa', threshold: 2 },
  ]

  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-1">
      {steps.map((step, idx) => {
        const complete = level >= step.threshold
        const current = !complete && step.threshold === level + 1
        return (
          <div key={step.label} className="flex min-w-[150px] flex-1 items-center">
            <div className="flex flex-col items-center gap-2">
              <div
                className={[
                  'flex h-8 w-8 items-center justify-center font-mono text-[11px]',
                  complete
                    ? 'bg-gold text-bg'
                    : current
                      ? 'border border-gold text-gold'
                      : 'border border-border text-tertiary',
                ].join(' ')}
              >
                {complete ? <CheckCircle size={14} /> : idx}
              </div>
              <span
                className={[
                  'whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.12em]',
                  complete ? 'text-gold' : current ? 'text-primary' : 'text-tertiary',
                ].join(' ')}
              >
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div className={['mx-2 h-px flex-1', level > idx ? 'bg-gold' : 'bg-border'].join(' ')} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function ActiveStepCard({
  level,
  governanceEligible,
  onSuccess,
}: {
  level: 0 | 1 | 2
  governanceEligible: boolean
  onSuccess: () => Promise<void>
}) {
  const [cedula, setCedula] = useState('')
  const [emailToken, setEmailToken] = useState('')
  const [devToken, setDevToken] = useState<string | null>(null)
  const [emailSent, setEmailSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleCedulaSubmit(event: React.FormEvent) {
    event.preventDefault()
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
      setSuccess('Documento reconocido correctamente.')
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

  async function handleEmailConfirm(event: React.FormEvent) {
    event.preventDefault()
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
      setSuccess('Contacto verificado. Verificación básica completa.')
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
            <p className="font-display text-base font-bold text-primary">Verificación básica completa</p>
            <p className="mt-1 font-mono text-sm text-secondary">
              Tu cuenta ya no debe repetir cédula ni correo. Puedes proponer y usar las funciones de nivel verificado.
              {governanceEligible
                ? ' Tu identidad cívica también está asegurada para votación.'
                : ' La votación requiere además una prueba de identidad cívica asegurada y vigente.'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={['border border-border bg-surface p-6', loading ? 'opacity-50 cursor-wait' : ''].join(' ')}>
      {level === 0 && (
        <>
          <h3 className="mb-1 font-display text-base font-bold text-primary">Confirmar documento</h3>
          <p className="mb-4 font-mono text-sm text-secondary">
            Este paso solo aplica a cuentas que mantienen su documento directamente en VÉRTICE.
          </p>
          <div className="mb-5 flex items-start gap-2.5 border border-gold/20 bg-gold/5 px-4 py-3">
            <Info size={14} className="mt-0.5 shrink-0 text-gold" />
            <p className="font-mono text-xs text-secondary">
              Si ya completaste y aprobaste KYC en CTG One, no debes volver a entregar tu cédula aquí. Cierra sesión y entra de nuevo con CTG One para sincronizar la verificación.
            </p>
          </div>
          <form onSubmit={handleCedulaSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="cedula" className={LABEL_CLASS}>Número de cédula</label>
              <input
                id="cedula"
                type="text"
                inputMode="numeric"
                pattern="\d{10}"
                maxLength={10}
                required
                value={cedula}
                onChange={(event) => setCedula(event.target.value.replace(/\D/g, ''))}
                placeholder="0000000000"
                className={INPUT_CLASS}
                disabled={loading}
                autoComplete="off"
              />
              <span className="font-mono text-[10px] text-tertiary">{cedula.length}/10 dígitos</span>
            </div>
            {error && <InlineError message={error} />}
            {success && <InlineSuccess message={success} />}
            <div>
              <button
                type="submit"
                disabled={loading || cedula.length !== 10}
                className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? 'Verificando…' : 'Confirmar documento local'}
              </button>
            </div>
          </form>
        </>
      )}

      {level === 1 && (
        <>
          <h3 className="mb-1 font-display text-base font-bold text-primary">Verificar contacto</h3>
          <p className="mb-5 font-mono text-sm text-secondary">
            Confirma el correo registrado para completar la verificación básica.
          </p>
          <div className="flex flex-col gap-5">
            <button
              type="button"
              disabled={loading || emailSent}
              onClick={handleRequestEmailToken}
              className="btn-ghost self-start disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {emailSent ? 'Token enviado' : 'Enviar token al correo'}
            </button>
            {devToken && (
              <div className="border border-gold/20 bg-gold/5 px-4 py-3">
                <span className={`${LABEL_CLASS} mb-1 block`}>Token de desarrollo</span>
                <span className="font-mono text-sm text-gold break-all">{devToken}</span>
              </div>
            )}
            <form onSubmit={handleEmailConfirm} className="flex flex-col gap-3">
              <label htmlFor="email-token" className={LABEL_CLASS}>Token de verificación</label>
              <input
                id="email-token"
                type="text"
                value={emailToken}
                onChange={(event) => setEmailToken(event.target.value)}
                placeholder="Pega el token aquí"
                className={INPUT_CLASS}
                disabled={loading}
              />
              {error && <InlineError message={error} />}
              {success && <InlineSuccess message={success} />}
              <div>
                <button
                  type="submit"
                  disabled={loading || !emailToken.trim()}
                  className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
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

function AssuranceCard({ assurance }: { assurance: CivicIdentityAssuranceStatus | null }) {
  if (!assurance) {
    return (
      <div className="border border-border bg-surface p-6">
        <h3 className="font-display text-base font-bold text-primary">Identidad cívica asegurada</h3>
        <p className="mt-2 font-mono text-sm text-secondary">
          El estado de aseguramiento no está disponible en este momento. La plataforma no debe asumir elegibilidad para votar cuando esta comprobación falta.
        </p>
      </div>
    )
  }

  return (
    <div className={['border p-6', assurance.governance_eligible ? 'border-cyan/30 bg-cyan/5' : 'border-border bg-surface'].join(' ')}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-base font-bold text-primary">Identidad cívica asegurada</h3>
          <p className="mt-2 font-mono text-sm text-secondary">
            {assurance.governance_eligible
              ? 'Prueba activa y confiable. Tu identidad cumple el límite de aseguramiento usado por la gobernanza.'
              : 'La verificación básica y el inicio de sesión no sustituyen la prueba cívica exigida para el padrón de votación.'}
          </p>
        </div>
        <span className={assurance.governance_eligible ? 'text-cyan' : 'text-tertiary'}>
          {assurance.governance_eligible ? <CheckCircle size={20} /> : <ShieldCheck size={20} />}
        </span>
      </div>
      <dl className="mt-5 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className={LABEL_CLASS}>Proveedor</dt>
          <dd className="mt-1 font-mono text-xs text-secondary">{assurance.provider ?? 'Pendiente'}</dd>
        </div>
        <div>
          <dt className={LABEL_CLASS}>Verificada</dt>
          <dd className="mt-1 font-mono text-xs text-secondary">{formatDate(assurance.provider_verified_at)}</dd>
        </div>
      </dl>
    </div>
  )
}

function DIDDocCard({ doc, loading }: { doc: DIDDocument | null; loading: boolean }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="border border-border bg-surface">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center justify-between px-6 py-4 hover:bg-surface-2"
      >
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-secondary">Documento DID (W3C)</span>
        {expanded ? <ChevronUp size={14} className="text-tertiary" /> : <ChevronDown size={14} className="text-tertiary" />}
      </button>
      {expanded && (
        <div className="border-t border-border px-6 py-5">
          {loading && <Loader2 size={16} className="animate-spin text-gold" />}
          {!loading && !doc && <p className="font-mono text-xs text-tertiary">Documento no disponible.</p>}
          {!loading && doc && (
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] text-secondary">
              {JSON.stringify(doc, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

function ProfileCard() {
  const [form, setForm] = useState<ProfileForm>({ neighborhood: '', locality_id: '' })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSave(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)
    const body: { neighborhood?: string; locality_id?: number } = {}
    if (form.neighborhood.trim()) body.neighborhood = form.neighborhood.trim()
    if (form.locality_id !== '') body.locality_id = form.locality_id

    try {
      await apiFetch('/identity/profile', { method: 'PUT', body: JSON.stringify(body) })
      setSuccess('Perfil actualizado correctamente.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo conectar con el servidor.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border border-border bg-surface p-6">
      <h3 className="font-display text-base font-bold text-primary">Perfil territorial</h3>
      <p className="mb-5 mt-1 font-mono text-sm text-secondary">Asocia tu cuenta a tu barrio y localidad.</p>
      <form onSubmit={handleSave} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="neighborhood" className={LABEL_CLASS}>Barrio</label>
          <input
            id="neighborhood"
            type="text"
            maxLength={100}
            value={form.neighborhood}
            onChange={(event) => setForm((prev) => ({ ...prev, neighborhood: event.target.value }))}
            placeholder="Ej: Bocagrande, Manga, Getsemaní…"
            className={INPUT_CLASS}
            disabled={loading}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="locality" className={LABEL_CLASS}>Localidad</label>
          <select
            id="locality"
            value={form.locality_id}
            onChange={(event) => setForm((prev) => ({
              ...prev,
              locality_id: event.target.value === '' ? '' : (Number(event.target.value) as LocalityId),
            }))}
            className={INPUT_CLASS}
            disabled={loading}
          >
            <option value="">Selecciona una localidad</option>
            {LOCALITIES.map((locality) => (
              <option key={locality.id} value={locality.id}>{locality.id} — {locality.name}</option>
            ))}
          </select>
        </div>
        {error && <InlineError message={error} />}
        {success && <InlineSuccess message={success} />}
        <div>
          <button type="submit" disabled={loading} className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed">
            {loading ? 'Guardando…' : 'Guardar perfil'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default function IdentityPage() {
  const [status, setStatus] = useState<IdentityStatus | null>(null)
  const [assurance, setAssurance] = useState<CivicIdentityAssuranceStatus | null>(null)
  const [didDoc, setDidDoc] = useState<DIDDocument | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingDid, setLoadingDid] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)

  async function fetchIdentityState() {
    setLoading(true)
    setPageError(null)
    try {
      const [statusData, assuranceData] = await Promise.all([
        apiFetch<IdentityStatus>('/identity/status'),
        apiFetch<CivicIdentityAssuranceStatus>('/identity/assurance').catch(() => null),
      ])
      setStatus(statusData)
      setAssurance(assuranceData)
    } catch {
      setPageError('No se pudo cargar el estado de identidad.')
    } finally {
      setLoading(false)
    }
  }

  async function fetchDIDDoc() {
    setLoadingDid(true)
    try {
      setDidDoc(await apiFetch<DIDDocument>('/identity/me'))
    } catch {
      setDidDoc(null)
    } finally {
      setLoadingDid(false)
    }
  }

  useEffect(() => {
    void fetchIdentityState()
    void fetchDIDDoc()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleVerificationSuccess() {
    await Promise.all([fetchIdentityState(), fetchDIDDoc()])
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-surface/60 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <nav className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.15em]">
            <Link href="/" className="flex items-center gap-2 text-secondary hover:text-primary">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
                <polygon points="12,2 22,21 2,21" stroke="#C8A84B" strokeWidth="1.5" fill="none" />
              </svg>
              <span className="font-display text-xs font-bold tracking-widest text-primary">VÉRTICE OS</span>
            </Link>
            <span className="text-tertiary">/</span>
            <Link href="/dashboard" className="text-secondary hover:text-primary">Dashboard</Link>
            <span className="text-tertiary">/</span>
            <span className="text-gold">Identidad</span>
          </nav>
          <Link href="/auth/login" className="btn-ghost px-4 py-2 text-[10px]">Salir</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-8">
          <span className="section-tag">Identidad Cívica</span>
          <h1 className="font-display text-3xl font-bold text-primary">Tu identidad digital</h1>
          <p className="mt-2 font-mono text-sm text-secondary">
            La verificación básica puede reutilizar el KYC aprobado de CTG One. La elegibilidad de votación mantiene un límite de aseguramiento cívico independiente.
          </p>
          {status?.did && (
            <div className="mt-4 flex w-fit items-center gap-2 border border-border bg-surface px-4 py-2.5">
              <span className={LABEL_CLASS}>DID</span>
              <span className="font-mono text-xs text-gold" title={status.did}>{truncateDid(status.did)}</span>
            </div>
          )}
        </div>

        {pageError && <div className="mb-6"><InlineError message={pageError} /></div>}

        {loading && (
          <div className="flex items-center justify-center gap-3 border border-border bg-surface py-16">
            <Loader2 size={20} className="animate-spin text-gold" />
            <span className="font-mono text-xs text-tertiary">Cargando identidad…</span>
          </div>
        )}

        {!loading && status && (
          <div className="flex flex-col gap-8">
            <div className="grid gap-px bg-border sm:grid-cols-3">
              <div className="flex flex-col gap-3 bg-bg p-5">
                <span className={LABEL_CLASS}>Nivel básico</span>
                <span className="font-display text-2xl font-bold text-gold">{status.level}</span>
                <span className="font-mono text-[11px] text-secondary">{status.level_name}</span>
              </div>
              <div className="flex flex-col gap-3 bg-bg p-5">
                <span className={LABEL_CLASS}>Puede votar</span>
                <span className={['font-display text-2xl font-bold', assurance?.governance_eligible ? 'text-cyan' : 'text-tertiary'].join(' ')}>
                  {assurance?.governance_eligible ? 'Sí' : 'No'}
                </span>
                <span className="font-mono text-[11px] text-tertiary">
                  {assurance?.governance_eligible ? 'Identidad cívica asegurada' : 'Requiere aseguramiento cívico'}
                </span>
              </div>
              <div className="flex flex-col gap-3 bg-bg p-5">
                <span className={LABEL_CLASS}>Puede proponer</span>
                <span className={['font-display text-2xl font-bold', status.can_propose ? 'text-cyan' : 'text-tertiary'].join(' ')}>
                  {status.can_propose ? 'Sí' : 'No'}
                </span>
                <span className="font-mono text-[11px] text-tertiary">
                  {status.can_propose ? 'Nivel verificado' : 'Requiere nivel 1+'}
                </span>
              </div>
            </div>

            <div className="border border-border bg-surface p-6">
              <span className={`${LABEL_CLASS} mb-5 block`}>Progreso de verificación básica</span>
              <VerificationStepper level={status.level} />
            </div>

            <ActiveStepCard
              level={status.level}
              governanceEligible={Boolean(assurance?.governance_eligible)}
              onSuccess={handleVerificationSuccess}
            />

            <AssuranceCard assurance={assurance} />
            <DIDDocCard doc={didDoc} loading={loadingDid} />
            <ProfileCard />
          </div>
        )}
      </main>
    </div>
  )
}
