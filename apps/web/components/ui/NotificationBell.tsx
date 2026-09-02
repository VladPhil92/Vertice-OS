'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Bell, X, CheckCheck, ExternalLink } from 'lucide-react'
import { apiFetch } from '@/lib/api'

interface Notification {
  id: string
  type: string
  title: string
  body: string
  href?: string
  read: boolean
  createdAt: number
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60) return 'ahora'
  if (diff < 3600) return `${Math.floor(diff / 60)} min`
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`
  return `${Math.floor(diff / 86400)} d`
}

const TYPE_COLOR: Record<string, string> = {
  report_status: 'bg-cyan/20 text-cyan',
  proposal_stage: 'bg-gold/20 text-gold',
  vote_result: 'bg-navy/40 text-blue-300',
  reputation: 'bg-green-900/30 text-green-400',
  system: 'bg-surface text-secondary',
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifs, setNotifs] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)

  const fetchNotifs = useCallback(async () => {
    try {
      const res = await apiFetch<{ notifications: Notification[]; unread: number }>('/notifications')
      setNotifs(res.notifications)
      setUnread(res.unread)
    } catch {
      // silently fail — bell is non-critical
    }
  }, [])

  useEffect(() => {
    fetchNotifs()
    const interval = setInterval(fetchNotifs, 60_000)
    return () => clearInterval(interval)
  }, [fetchNotifs])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  async function handleMarkAll() {
    try {
      await apiFetch('/notifications/read-all', { method: 'PUT' })
      setNotifs(prev => prev.map(n => ({ ...n, read: true })))
      setUnread(0)
    } catch { /* noop */ }
  }

  async function handleMarkOne(id: string) {
    try {
      await apiFetch(`/notifications/${id}/read`, { method: 'PUT' })
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
      setUnread(prev => Math.max(0, prev - 1))
    } catch { /* noop */ }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => { setOpen(o => !o); if (!open) fetchNotifs() }}
        className="relative flex h-8 w-8 items-center justify-center rounded text-secondary transition hover:bg-surface hover:text-primary"
        aria-label="Notificaciones"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-gold text-[9px] font-bold text-bg">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded border border-border bg-surface shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="font-mono text-xs font-semibold uppercase tracking-widest text-secondary">
              Notificaciones
            </span>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  onClick={handleMarkAll}
                  className="flex items-center gap-1 font-mono text-[10px] text-gold transition hover:text-gold/70"
                  title="Marcar todas como leídas"
                >
                  <CheckCheck size={12} />
                  Todo leído
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-tertiary hover:text-primary">
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifs.length === 0 ? (
              <p className="px-4 py-8 text-center font-mono text-xs text-tertiary">
                Sin notificaciones
              </p>
            ) : (
              notifs.map(n => (
                <div
                  key={n.id}
                  className={[
                    'group flex gap-3 border-b border-border/50 px-4 py-3 transition',
                    n.read ? 'opacity-60' : 'bg-gold/[0.03]',
                  ].join(' ')}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <span className={`mt-0.5 rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider ${TYPE_COLOR[n.type] ?? TYPE_COLOR.system}`}>
                        {n.type.replace('_', ' ')}
                      </span>
                      <span className="flex-shrink-0 font-mono text-[10px] text-tertiary">
                        {timeAgo(n.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1.5 font-mono text-xs font-medium text-primary leading-snug">
                      {n.title}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-secondary leading-snug line-clamp-2">
                      {n.body}
                    </p>
                  </div>

                  <div className="flex flex-shrink-0 flex-col items-end gap-1.5 pt-0.5">
                    {!n.read && (
                      <button
                        onClick={() => handleMarkOne(n.id)}
                        className="h-2 w-2 rounded-full bg-gold"
                        title="Marcar como leída"
                      />
                    )}
                    {n.href && (
                      <a
                        href={n.href}
                        className="text-tertiary transition hover:text-gold"
                        title="Ver"
                        onClick={() => setOpen(false)}
                      >
                        <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
