'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Bell, CheckCheck, ExternalLink, Filter, Loader2, RefreshCw } from 'lucide-react'
import { apiFetch } from '@/lib/api'

type Notification = {
  id: string
  type: string
  title: string
  body: string
  href?: string
  read: boolean
  createdAt: number
}

type FilterKey = 'all' | 'unread' | 'civic' | 'finance' | 'system'

const FINANCE_TYPES = new Set(['crowdfunding', 'crowdfunding_status', 'payout', 'payout_status', 'billing', 'payment', 'refund', 'risk'])
const CIVIC_TYPES = new Set(['report_status', 'proposal_stage', 'vote_result', 'reputation', 'workflow', 'validation'])

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp))
}

function categoryOf(type: string): Exclude<FilterKey, 'all' | 'unread'> {
  if (FINANCE_TYPES.has(type)) return 'finance'
  if (CIVIC_TYPES.has(type)) return 'civic'
  return 'system'
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    setError(null)
    try {
      const response = await apiFetch<{ notifications: Notification[]; unread: number }>('/notifications')
      setNotifications(response.notifications)
      setUnread(response.unread)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar las notificaciones.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const visible = useMemo(() => notifications.filter((notification) => {
    if (filter === 'all') return true
    if (filter === 'unread') return !notification.read
    return categoryOf(notification.type) === filter
  }), [filter, notifications])

  async function markOne(id: string) {
    await apiFetch(`/notifications/${id}/read`, { method: 'PUT' })
    setNotifications((items) => items.map((item) => item.id === id ? { ...item, read: true } : item))
    setUnread((value) => Math.max(0, value - 1))
  }

  async function markAll() {
    await apiFetch('/notifications/read-all', { method: 'PUT' })
    setNotifications((items) => items.map((item) => ({ ...item, read: true })))
    setUnread(0)
  }

  if (loading) return <div className="flex min-h-[55vh] items-center justify-center"><Loader2 className="animate-spin text-[#4A90E2]" /></div>

  return (
    <div data-testid="notification-operational-inbox" className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
      <section className="rounded-[28px] bg-[#0A2A66] p-6 text-white sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.14em] text-[#F5B700]"><Bell size={14} /> Bandeja operacional</div>
            <h1 className="mt-3 text-3xl font-extrabold tracking-[-.035em]">Notificaciones y siguientes pasos</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/70">Centraliza cambios de gestión, participación, crowdfunding, pagos y sistema sin mezclar las señales cívicas con las financieras.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[.06] px-5 py-3 text-center"><div className="text-[9px] font-extrabold uppercase tracking-[.1em] text-[#9DB6D8]">Sin leer</div><div className="mt-1 text-2xl font-extrabold">{unread}</div></div>
        </div>
      </section>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(['all', 'unread', 'civic', 'finance', 'system'] as const).map((key) => (
            <button key={key} onClick={() => setFilter(key)} className={filter === key ? 'rounded-full bg-[#0A2A66] px-3 py-2 text-[10px] font-extrabold text-white' : 'rounded-full border border-[#DCE5EF] bg-white px-3 py-2 text-[10px] font-extrabold text-[#607087]'}>
              {key === 'all' ? 'Todas' : key === 'unread' ? 'Sin leer' : key === 'civic' ? 'Cívicas' : key === 'finance' ? 'Financieras' : 'Sistema'}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {unread > 0 && <button onClick={() => void markAll()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#DCE5EF] bg-white px-4 text-[10px] font-extrabold text-[#0A2A66]"><CheckCheck size={13} /> Todo leído</button>}
          <button onClick={() => void load(true)} disabled={refreshing} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#DCE5EF] bg-white px-4 text-[10px] font-extrabold text-[#0A2A66] disabled:opacity-50"><RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> Actualizar</button>
        </div>
      </div>

      {error && <div className="mt-5 rounded-2xl border border-[#F0C7CB] bg-[#FFF7F8] p-4 text-sm font-semibold text-[#A51E2D]">{error}</div>}

      {!error && visible.length === 0 ? (
        <div className="mt-6 rounded-[24px] border border-dashed border-[#C9D6E5] bg-white p-10 text-center"><Filter size={25} className="mx-auto text-[#8AA0BB]" /><h2 className="mt-4 text-lg font-extrabold text-[#0A2A66]">No hay elementos en este filtro</h2><p className="mt-2 text-sm text-[#607087]">La bandeja mostrará aquí cambios que requieran seguimiento o contexto.</p></div>
      ) : (
        <div className="mt-6 space-y-3">
          {visible.map((notification) => {
            const category = categoryOf(notification.type)
            return (
              <article key={notification.id} className={`rounded-2xl border p-5 ${notification.read ? 'border-[#E1E7EF] bg-white' : 'border-[#BFD0E8] bg-[#F9FBFD]'}`}>
                <div className="flex gap-4">
                  <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${notification.read ? 'bg-[#C9D2DE]' : category === 'finance' ? 'bg-[#D39B00]' : category === 'civic' ? 'bg-[#4A90E2]' : 'bg-[#7B8799]'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-[9px] font-extrabold uppercase tracking-[.08em] text-[#7B8799]">{category === 'finance' ? 'Finanzas' : category === 'civic' ? 'Gestión cívica' : 'Sistema'} · {notification.type.replaceAll('_', ' ')}</span><span className="text-[10px] font-semibold text-[#9AA5B4]">{formatDate(notification.createdAt)}</span></div>
                    <h2 className="mt-2 text-sm font-extrabold text-[#0A2A66]">{notification.title}</h2>
                    <p className="mt-1 text-xs font-medium leading-5 text-[#607087]">{notification.body}</p>
                    <div className="mt-3 flex flex-wrap gap-3">
                      {!notification.read && <button onClick={() => void markOne(notification.id)} className="text-[10px] font-extrabold text-[#246CB6]">Marcar como leída</button>}
                      {notification.href && <Link href={notification.href} onClick={() => !notification.read && void markOne(notification.id)} className="inline-flex items-center gap-1 text-[10px] font-extrabold text-[#0A2A66]">Abrir <ExternalLink size={11} /></Link>}
                    </div>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
