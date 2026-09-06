'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, MapPin, Target } from 'lucide-react'
import { apiFetch } from '@/lib/api'

interface CreatedAction { id: string }

const CATEGORIES = [
  'Infraestructura',
  'Ambiente',
  'Educación',
  'Salud',
  'Seguridad',
  'Cultura',
  'Empleo',
  'Movilidad',
  'Bienestar animal',
  'Otro',
]

export default function NewCivicActionPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '',
    problem: '',
    objective: '',
    category: 'Infraestructura',
    neighborhood: '',
    beneficiaries_estimate: '',
    target_date: '',
  })

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const action = await apiFetch<CreatedAction>('/civic-actions', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          problem: form.problem,
          objective: form.objective,
          category: form.category,
          neighborhood: form.neighborhood || null,
          beneficiaries_estimate: form.beneficiaries_estimate ? Number(form.beneficiaries_estimate) : null,
          target_date: form.target_date || null,
        }),
      })
      router.push(`/dashboard/community/actions/${action.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible registrar la acción cívica.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      <Link href="/dashboard/community/actions" className="inline-flex items-center gap-2 text-xs font-extrabold text-[#607087] hover:text-[#0A2A66]"><ArrowLeft size={14} /> Volver a acciones</Link>

      <section className="mt-4 overflow-hidden rounded-[28px] border border-[#DCE5EF] bg-white shadow-[0_18px_55px_rgba(10,42,102,.07)]">
        <div className="h-1.5 bg-[linear-gradient(90deg,#F5B700_0_33%,#4A90E2_33%_66%,#D72638_66%)]" />
        <div className="p-5 sm:p-8">
          <div className="max-w-2xl">
            <div className="text-[10px] font-extrabold uppercase tracking-[.15em] text-[#246CB6]">Nueva acción cívica</div>
            <h1 className="mt-2 text-2xl font-extrabold tracking-[-.03em] text-[#0A2A66] sm:text-3xl">Empieza por el problema, no por la publicación.</h1>
            <p className="mt-3 text-sm font-medium leading-7 text-[#607087]">La acción quedará inicialmente como propuesta. Después podrás pasarla a preparación, ejecución, declarar un resultado y adjuntar evidencia.</p>
          </div>

          {error && <div className="mt-5 rounded-2xl border border-[#F1C8CE] bg-[#FCEBED] p-4 text-sm font-semibold text-[#A91D2E]">{error}</div>}

          <form onSubmit={submit} className="mt-7 space-y-5">
            <label className="block">
              <span className="text-xs font-extrabold text-[#0A2A66]">Título de la acción</span>
              <input required minLength={8} maxLength={180} value={form.title} onChange={(event) => update('title', event.target.value)} placeholder="Ej. Recuperar la iluminación del parque de Manga" className="mt-2 min-h-12 w-full rounded-xl border border-[#DCE5EF] bg-white px-4 text-sm text-[#0A2A66] outline-none focus:border-[#4A90E2]" />
            </label>

            <label className="block">
              <span className="text-xs font-extrabold text-[#0A2A66]">Problema que quieres resolver</span>
              <textarea required minLength={20} maxLength={4000} rows={5} value={form.problem} onChange={(event) => update('problem', event.target.value)} placeholder="Describe qué ocurre, a quién afecta y qué evidencia inicial existe." className="mt-2 w-full rounded-xl border border-[#DCE5EF] bg-white p-4 text-sm leading-6 text-[#0A2A66] outline-none focus:border-[#4A90E2]" />
            </label>

            <label className="block">
              <span className="text-xs font-extrabold text-[#0A2A66]">Objetivo verificable</span>
              <textarea required minLength={10} maxLength={2000} rows={4} value={form.objective} onChange={(event) => update('objective', event.target.value)} placeholder="Explica cuál sería un resultado observable para considerar que la gestión avanzó." className="mt-2 w-full rounded-xl border border-[#DCE5EF] bg-white p-4 text-sm leading-6 text-[#0A2A66] outline-none focus:border-[#4A90E2]" />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-extrabold text-[#0A2A66]">Categoría</span>
                <select value={form.category} onChange={(event) => update('category', event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-[#DCE5EF] bg-white px-4 text-sm text-[#0A2A66] outline-none focus:border-[#4A90E2]">
                  {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
                </select>
              </label>

              <label className="block">
                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#0A2A66]"><MapPin size={13} /> Barrio o territorio</span>
                <input value={form.neighborhood} onChange={(event) => update('neighborhood', event.target.value)} maxLength={120} placeholder="Ej. Manga" className="mt-2 min-h-12 w-full rounded-xl border border-[#DCE5EF] bg-white px-4 text-sm text-[#0A2A66] outline-none focus:border-[#4A90E2]" />
              </label>

              <label className="block">
                <span className="text-xs font-extrabold text-[#0A2A66]">Personas potencialmente beneficiadas</span>
                <input type="number" min={0} max={10000000} value={form.beneficiaries_estimate} onChange={(event) => update('beneficiaries_estimate', event.target.value)} placeholder="Estimación opcional" className="mt-2 min-h-12 w-full rounded-xl border border-[#DCE5EF] bg-white px-4 text-sm text-[#0A2A66] outline-none focus:border-[#4A90E2]" />
              </label>

              <label className="block">
                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#0A2A66]"><Target size={13} /> Fecha objetivo</span>
                <input type="date" value={form.target_date} onChange={(event) => update('target_date', event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-[#DCE5EF] bg-white px-4 text-sm text-[#0A2A66] outline-none focus:border-[#4A90E2]" />
              </label>
            </div>

            <div className="rounded-2xl bg-[#EDF3FA] p-4 text-[11px] font-semibold leading-6 text-[#526176]">
              El score no aumenta por seguidores o likes. La evidencia, los resultados, el cumplimiento, el impacto, la validación ciudadana verificada, la continuidad, la transparencia y la colaboración conforman la fórmula v1. La confianza de la evidencia se calcula aparte.
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Link href="/dashboard/community/actions" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#DCE5EF] px-5 text-xs font-extrabold text-[#607087]">Cancelar</Link>
              <button disabled={submitting} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#0A2A66] px-6 text-xs font-extrabold text-white disabled:opacity-60">
                {submitting && <Loader2 size={15} className="animate-spin" />} Registrar acción
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  )
}
