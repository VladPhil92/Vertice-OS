'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Filter, GitBranch, Loader2, Search } from 'lucide-react'
import { apiFetch } from '@/lib/api'

type CivicCase = {
  id: string
  stage: string
  updated_at: string
  report: { id: string; title: string; neighborhood: string | null; category: string }
}

type StageGroup = 'all' | 'start' | 'decision' | 'control'

const NEXT_ACTION: Record<string, string> = {
  reported: 'Analizar el caso y definir ruta',
  analysis: 'Convertir análisis en una propuesta o actuación',
  proposal_drafting: 'Completar borrador de propuesta',
  proposal: 'Preparar deliberación',
  deliberation: 'Revisar debate y siguiente etapa',
  voting: 'Dar seguimiento a la decisión',
  decision: 'Documentar resultado o abrir control',
  control_drafting: 'Completar actuación de control público',
  control: 'Dar seguimiento a respuesta y resultado',
}

function stageGroup(stage: string): Exclude<StageGroup, 'all'> {
  if (['reported', 'analysis', 'proposal_drafting', 'proposal'].includes(stage)) return 'start'
  if (['deliberation', 'voting', 'decision'].includes(stage)) return 'decision'
  return 'control'
}

function ageLabel(iso: string) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000))
  return days === 0 ? 'actualizado hoy' : days === 1 ? 'hace 1 día' : `hace ${days} días`
}

export function WorkflowTriageBoard() {
  const [cases, setCases] = useState<CivicCase[]>([])
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<StageGroup>('all')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const response = await apiFetch<{ data: CivicCase[] }>('/workflows/cases?limit=25')
      setCases(response.data)
    } catch {
      setCases([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('es')
    return cases.filter((item) => {
      if (group !== 'all' && stageGroup(item.stage) !== group) return false
      if (!normalized) return true
      return `${item.report.title} ${item.report.neighborhood ?? ''} ${item.report.category} ${item.stage}`.toLocaleLowerCase('es').includes(normalized)
    }).sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()).slice(0, 8)
  }, [cases, group, query])

  if (loading) return <section className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 lg:px-8"><div className="flex h-24 items-center justify-center rounded-2xl border border-[#DCE5EF] bg-white"><Loader2 size={17} className="animate-spin text-[#4A90E2]" /></div></section>
  if (cases.length === 0) return null

  return (
    <section data-testid="workflow-triage-board" className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 lg:px-8">
      <div className="rounded-[24px] border border-[#DCE5EF] bg-white p-5 shadow-[0_12px_35px_rgba(10,42,102,.04)] sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div><div className="flex items-center gap-2 text-[9px] font-extrabold uppercase tracking-[.14em] text-[#246CB6]"><GitBranch size={13} /> Triage de expedientes</div><h2 className="mt-2 text-lg font-extrabold text-[#0A2A66]">Encuentra el siguiente paso antes de recorrer toda la ruta</h2></div>
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row lg:max-w-2xl">
            <label className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#DCE5EF] bg-[#F9FBFD] px-3"><Search size={13} className="text-[#8AA0BB]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar expediente, barrio o categoría" className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-[#0A2A66] outline-none placeholder:text-[#9AA5B4]" /></label>
            <div className="flex items-center gap-1 rounded-xl border border-[#DCE5EF] bg-[#F9FBFD] p-1"><Filter size={12} className="ml-2 text-[#8AA0BB]" />{(['all', 'start', 'decision', 'control'] as const).map((value) => <button key={value} onClick={() => setGroup(value)} className={group === value ? 'rounded-lg bg-[#0A2A66] px-2.5 py-2 text-[9px] font-extrabold text-white' : 'rounded-lg px-2.5 py-2 text-[9px] font-extrabold text-[#607087]'}>{value === 'all' ? 'Todos' : value === 'start' ? 'Inicio' : value === 'decision' ? 'Decisión' : 'Control'}</button>)}</div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {visible.map((item) => (
            <Link key={item.id} href={`/dashboard/reports/${item.report.id}`} className="group rounded-2xl border border-[#E1E7EF] bg-[#F9FBFD] p-4 transition hover:border-[#BFD0E8] hover:bg-white">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="truncate text-xs font-extrabold text-[#0A2A66]">{item.report.title}</div><div className="mt-1 text-[9px] font-semibold uppercase tracking-[.05em] text-[#7B8799]">{item.report.neighborhood ?? 'Sin barrio'} · {item.stage.replaceAll('_', ' ')} · {ageLabel(item.updated_at)}</div></div><ArrowRight size={14} className="shrink-0 text-[#8AA0BB] transition group-hover:translate-x-0.5" /></div>
              <div className="mt-3 rounded-xl bg-white px-3 py-2 text-[10px] font-semibold text-[#43506A]"><span className="font-extrabold text-[#246CB6]">Siguiente:</span> {NEXT_ACTION[item.stage] ?? 'Revisar estado y definir próximo paso'}</div>
            </Link>
          ))}
        </div>
        {visible.length === 0 && <div className="mt-5 rounded-2xl bg-[#F7F9FC] p-6 text-center text-xs font-semibold text-[#607087]">No hay expedientes que coincidan con estos filtros.</div>}
      </div>
    </section>
  )
}
