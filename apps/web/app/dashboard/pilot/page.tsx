'use client'

import { useEffect, useState } from 'react'
import { FlaskConical, Loader2, MessageSquareText, Send, ShieldCheck } from 'lucide-react'
import { apiFetch } from '@/lib/api'

type PilotStatus = {
  status: 'active'
  mode: 'closed_invite_only'
  cohort_size: number
  telemetry_retention_days: number
  observability_storage: 'redis_ephemeral'
  money_enabled: false
  governance_authority: 'consultative_only'
}

type FeedbackCategory = 'usability' | 'bug' | 'trust_safety' | 'performance' | 'idea' | 'other'
type PilotSurface = 'auth' | 'onboarding' | 'territory' | 'community' | 'reports' | 'governance' | 'workflows' | 'moderation' | 'account' | 'feedback'

const categories: Array<{ value: FeedbackCategory; label: string }> = [
  { value: 'usability', label: 'Usabilidad' },
  { value: 'bug', label: 'Error o falla' },
  { value: 'performance', label: 'Rendimiento' },
  { value: 'trust_safety', label: 'Seguridad o moderación' },
  { value: 'idea', label: 'Idea o mejora' },
  { value: 'other', label: 'Otro' },
]

const surfaces: Array<{ value: PilotSurface; label: string }> = [
  { value: 'onboarding', label: 'Ingreso y onboarding' },
  { value: 'territory', label: 'Territorio' },
  { value: 'community', label: 'Red cívica' },
  { value: 'reports', label: 'Reportes' },
  { value: 'governance', label: 'Consultas e iniciativas' },
  { value: 'workflows', label: 'Gestión social' },
  { value: 'moderation', label: 'Moderación' },
  { value: 'account', label: 'Cuenta' },
  { value: 'feedback', label: 'Esta pantalla' },
]

function platform(): 'web' | 'pwa' {
  if (typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches) return 'pwa'
  return 'web'
}

export default function PilotPage() {
  const [status, setStatus] = useState<PilotStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [sending, setSending] = useState(false)
  const [category, setCategory] = useState<FeedbackCategory>('usability')
  const [surface, setSurface] = useState<PilotSurface>('community')
  const [rating, setRating] = useState<number>(4)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false

    apiFetch<PilotStatus>('/pilot/status')
      .then(async (nextStatus) => {
        if (cancelled) return
        setStatus(nextStatus)

        const telemetryKey = 'vertice:pilot:session-started'
        if (!sessionStorage.getItem(telemetryKey)) {
          sessionStorage.setItem(telemetryKey, '1')
          await apiFetch('/pilot/telemetry', {
            method: 'POST',
            body: JSON.stringify({
              event: 'session_started',
              surface: 'feedback',
              outcome: 'success',
              platform: platform(),
            }),
          }).catch(() => {
            sessionStorage.removeItem(telemetryKey)
          })
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'El piloto no está disponible en este momento.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  async function submitFeedback() {
    if (!message.trim()) return
    setSending(true)
    setError(null)
    setSuccess(false)

    try {
      await apiFetch('/pilot/feedback', {
        method: 'POST',
        body: JSON.stringify({
          category,
          rating,
          surface,
          message: message.trim(),
        }),
      })
      setMessage('')
      setSuccess(true)
      await apiFetch('/pilot/telemetry', {
        method: 'POST',
        body: JSON.stringify({
          event: 'feedback_opened',
          surface: 'feedback',
          outcome: 'success',
          platform: platform(),
        }),
      }).catch(() => undefined)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible enviar el comentario.')
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
        <div className="h-72 animate-pulse rounded-3xl bg-white" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 lg:py-10" data-testid="closed-pilot-feedback">
      <div className="rounded-[28px] border border-[#DCE5EF] bg-white p-6 sm:p-8">
        <div className="flex items-start justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.15em] text-[#7B8799]">
              <FlaskConical size={15} /> Piloto cerrado
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-[-.035em] text-[#0A2A66]">Ayúdanos a probar VÉRTICE</h1>
            <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-[#607087]">
              Esta versión está limitada a una cohorte invitada. Tus observaciones se usan para detectar fallas y mejorar la experiencia antes de una apertura más amplia.
            </p>
          </div>
          {status && (
            <span className="hidden rounded-full bg-[#EAF7ED] px-3 py-1.5 text-[10px] font-black uppercase tracking-[.1em] text-[#217A35] sm:inline-flex">
              Piloto activo
            </span>
          )}
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-[#F0C7CB] bg-[#FFF7F8] p-4 text-sm font-semibold text-[#A51E2D]">{error}</div>
        )}

        {status && (
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-[#F7F9FC] p-4">
              <div className="text-[9px] font-black uppercase tracking-[.12em] text-[#7B8799]">Cohorte</div>
              <div className="mt-1 text-lg font-black text-[#0A2A66]">{status.cohort_size} invitados</div>
            </div>
            <div className="rounded-2xl bg-[#F7F9FC] p-4">
              <div className="text-[9px] font-black uppercase tracking-[.12em] text-[#7B8799]">Gobernanza</div>
              <div className="mt-1 text-lg font-black text-[#0A2A66]">Consultiva</div>
            </div>
            <div className="rounded-2xl bg-[#F7F9FC] p-4">
              <div className="text-[9px] font-black uppercase tracking-[.12em] text-[#7B8799]">Dinero real</div>
              <div className="mt-1 text-lg font-black text-[#0A2A66]">Deshabilitado</div>
            </div>
          </div>
        )}

        <div className="mt-7 border-t border-[#E1E7EF] pt-7">
          <div className="flex items-center gap-2">
            <MessageSquareText size={18} className="text-[#0A2A66]" />
            <h2 className="text-lg font-black text-[#0A2A66]">Cuéntanos qué ocurrió</h2>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-bold text-[#0A2A66]">
              Tipo de comentario
              <select value={category} onChange={(event) => setCategory(event.target.value as FeedbackCategory)} className="mt-2 min-h-11 w-full rounded-xl border border-[#DCE5EF] bg-white px-3 text-sm font-semibold outline-none focus:border-[#0A2A66]">
                {categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>

            <label className="text-xs font-bold text-[#0A2A66]">
              Área de VÉRTICE
              <select value={surface} onChange={(event) => setSurface(event.target.value as PilotSurface)} className="mt-2 min-h-11 w-full rounded-xl border border-[#DCE5EF] bg-white px-3 text-sm font-semibold outline-none focus:border-[#0A2A66]">
                {surfaces.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
          </div>

          <div className="mt-4">
            <div className="text-xs font-bold text-[#0A2A66]">¿Cómo fue tu experiencia?</div>
            <div className="mt-2 flex gap-2" role="radiogroup" aria-label="Calificación del piloto">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={rating === value}
                  onClick={() => setRating(value)}
                  className={[
                    'h-11 w-11 rounded-xl border text-sm font-black transition',
                    rating === value
                      ? 'border-[#0A2A66] bg-[#0A2A66] text-white'
                      : 'border-[#DCE5EF] bg-white text-[#607087] hover:border-[#0A2A66]',
                  ].join(' ')}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          <label className="mt-4 block text-xs font-bold text-[#0A2A66]">
            Describe lo que viste
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={500}
              rows={6}
              placeholder="Ej.: al abrir Red cívica el contenido tardó demasiado en aparecer…"
              className="mt-2 w-full rounded-xl border border-[#DCE5EF] px-3 py-3 text-sm font-medium leading-6 outline-none focus:border-[#0A2A66]"
            />
          </label>
          <div className="mt-1 text-right text-[10px] font-bold text-[#9AA5B4]">{message.length}/500</div>

          <div className="mt-4 rounded-2xl border border-[#DCE5EF] bg-[#F7F9FC] p-4">
            <div className="flex gap-3">
              <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[#2BA745]" />
              <p className="text-xs font-medium leading-5 text-[#607087]">
                No incluyas contraseñas, documentos, direcciones exactas ni datos bancarios. VÉRTICE redacta automáticamente patrones comunes de correo, teléfono y números sensibles antes de conservar el comentario.
              </p>
            </div>
          </div>

          {success && <div className="mt-4 rounded-2xl border border-[#BFE3C7] bg-[#F1FAF3] p-4 text-sm font-semibold text-[#217A35]">Comentario recibido. Gracias por ayudarnos a validar el piloto.</div>}

          <button
            type="button"
            disabled={sending || !status || !message.trim()}
            onClick={() => void submitFeedback()}
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0A2A66] px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {sending ? 'Enviando…' : 'Enviar comentario'}
          </button>
        </div>
      </div>
    </div>
  )
}
