'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Command, FileText, GitBranch, HandCoins, Loader2, MapPin, Search, UserRound, X } from 'lucide-react'
import { apiFetch } from '@/lib/api'

type SearchItem = {
  id: string
  title: string
  detail: string
  href: string
  kind: 'territorio' | 'iniciativa' | 'expediente' | 'campaña' | 'perfil'
}

type CommunityActivity = {
  id: string
  type: 'report' | 'proposal'
  title: string
  summary: string
  neighborhood: string | null
  href: string
  actor: { id: string | null; display_name: string; public_profile: boolean }
}

type CivicCase = { id: string; stage: string; report: { id: string; title: string; neighborhood: string | null } }
type Campaign = { id: string; title: string; summary: string; neighborhood: string | null; status: string }

async function optional<T>(path: string, options?: { public?: boolean }): Promise<T | null> {
  try { return await apiFetch<T>(path, options) } catch { return null }
}

const KIND_ICON = {
  territorio: MapPin,
  iniciativa: FileText,
  expediente: GitBranch,
  campaña: HandCoins,
  perfil: UserRound,
}

export function DashboardGlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<SearchItem[]>([])
  const loaded = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const loadIndex = useCallback(async () => {
    if (loaded.current) return
    setLoading(true)
    const [community, workflows, campaigns] = await Promise.all([
      optional<{ data: CommunityActivity[] }>('/community/feed?limit=40', { public: true }),
      optional<{ data: CivicCase[] }>('/workflows/cases?limit=25'),
      optional<{ campaigns: Campaign[] }>('/crowdfunding/me/campaigns'),
    ])

    const next: SearchItem[] = []
    const profileIds = new Set<string>()
    for (const activity of community?.data ?? []) {
      next.push({
        id: `activity:${activity.type}:${activity.id}`,
        title: activity.title,
        detail: `${activity.type === 'report' ? 'Reporte territorial' : 'Iniciativa'}${activity.neighborhood ? ` · ${activity.neighborhood}` : ''}`,
        href: activity.href,
        kind: activity.type === 'report' ? 'territorio' : 'iniciativa',
      })
      if (activity.actor.id && activity.actor.public_profile && !profileIds.has(activity.actor.id)) {
        profileIds.add(activity.actor.id)
        next.push({ id: `profile:${activity.actor.id}`, title: activity.actor.display_name, detail: 'Perfil cívico público', href: `/dashboard/community/profiles/${activity.actor.id}`, kind: 'perfil' })
      }
    }
    for (const civicCase of workflows?.data ?? []) {
      next.push({ id: `case:${civicCase.id}`, title: civicCase.report.title, detail: `Expediente · ${civicCase.stage.replaceAll('_', ' ')}${civicCase.report.neighborhood ? ` · ${civicCase.report.neighborhood}` : ''}`, href: `/dashboard/reports/${civicCase.report.id}`, kind: 'expediente' })
    }
    for (const campaign of campaigns?.campaigns ?? []) {
      next.push({ id: `campaign:${campaign.id}`, title: campaign.title, detail: `Campaña · ${campaign.status}${campaign.neighborhood ? ` · ${campaign.neighborhood}` : ''}`, href: '/dashboard/crowdfunding', kind: 'campaña' })
    }
    setItems(next)
    loaded.current = true
    setLoading(false)
  }, [])

  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen((value) => !value)
      }
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [])

  useEffect(() => {
    if (!open) return
    void loadIndex()
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [loadIndex, open])

  const results = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('es')
    if (!normalized) return items.slice(0, 12)
    return items.filter((item) => `${item.title} ${item.detail} ${item.kind}`.toLocaleLowerCase('es').includes(normalized)).slice(0, 20)
  }, [items, query])

  return (
    <>
      <section className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
        <button data-testid="dashboard-global-search-trigger" type="button" onClick={() => setOpen(true)} className="flex min-h-11 w-full items-center gap-3 rounded-2xl border border-[#DCE5EF] bg-white px-4 text-left shadow-[0_8px_25px_rgba(10,42,102,.04)] transition hover:border-[#BFD0E8]">
          <Search size={15} className="text-[#4A90E2]" />
          <span className="flex-1 text-xs font-semibold text-[#7B8799]">Buscar gestiones, iniciativas, campañas, expedientes o perfiles…</span>
          <span className="hidden rounded-lg border border-[#DCE5EF] bg-[#F7F9FC] px-2 py-1 font-mono text-[9px] font-bold text-[#7B8799] sm:block">Ctrl K</span>
        </button>
      </section>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center bg-[#0A2A66]/35 px-4 pt-[12vh] backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Búsqueda global VÉRTICE">
          <button className="absolute inset-0" onClick={() => setOpen(false)} aria-label="Cerrar búsqueda" />
          <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-[24px] border border-[#DCE5EF] bg-white shadow-[0_28px_80px_rgba(10,42,102,.22)]">
            <div className="flex items-center gap-3 border-b border-[#E1E7EF] px-5 py-4">
              <Command size={17} className="text-[#4A90E2]" />
              <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Escribe para buscar…" className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#0A2A66] outline-none placeholder:text-[#9AA5B4]" />
              <button onClick={() => setOpen(false)} className="text-[#7B8799]" aria-label="Cerrar"><X size={17} /></button>
            </div>
            <div className="max-h-[55vh] overflow-y-auto p-3">
              {loading ? <div className="flex items-center justify-center gap-2 py-12 text-xs font-semibold text-[#607087]"><Loader2 size={16} className="animate-spin" /> Preparando índice…</div> : results.length === 0 ? <div className="py-12 text-center text-sm font-semibold text-[#607087]">No encontramos coincidencias.</div> : results.map((item) => {
                const Icon = KIND_ICON[item.kind]
                return <Link key={item.id} href={item.href} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-2xl px-3 py-3 transition hover:bg-[#F7F9FC]"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EAF1FB] text-[#0A2A66]"><Icon size={15} /></span><span className="min-w-0"><span className="block truncate text-xs font-extrabold text-[#0A2A66]">{item.title}</span><span className="mt-0.5 block truncate text-[10px] font-semibold text-[#7B8799]">{item.detail}</span></span></Link>
              })}
            </div>
            <div className="border-t border-[#E1E7EF] bg-[#F7F9FC] px-5 py-3 text-[9px] font-semibold text-[#7B8799]">Índice operativo: actividad pública + tus expedientes + tus campañas. La búsqueda no altera ranking ni visibilidad.</div>
          </div>
        </div>
      )}
    </>
  )
}
