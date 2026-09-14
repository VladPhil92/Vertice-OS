'use client'

import { useEffect, useState } from 'react'
import { X, Zap } from 'lucide-react'

export interface ToastMessage {
  id: string
  text: string
  color: string
}

interface LiveToastProps {
  messages: ToastMessage[]
  onDismiss: (id: string) => void
}

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90E2] focus-visible:ring-offset-2'

export function LiveToast({ messages, onDismiss }: LiveToastProps) {
  if (messages.length === 0) return null

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 items-end"
      aria-label="Actualizaciones en tiempo real"
      aria-live="polite"
      aria-relevant="additions text"
    >
      {messages.map(msg => (
        <div
          key={msg.id}
          aria-atomic="true"
          className="flex items-center gap-3 border bg-surface px-4 py-3 shadow-xl animate-fade-up"
          style={{ borderColor: `${msg.color}30`, minWidth: 220, maxWidth: 320 }}
        >
          <Zap size={11} aria-hidden="true" style={{ color: msg.color, flexShrink: 0 }} />
          <span className="flex-1 font-mono text-[11px] text-secondary leading-snug">
            {msg.text}
          </span>
          <button
            onClick={() => onDismiss(msg.id)}
            className={`text-tertiary transition-colors hover:text-primary flex-shrink-0 ${FOCUS_RING}`}
            aria-label={`Cerrar actualización: ${msg.text}`}
          >
            <X size={11} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  )
}

export function useToasts() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  function addToast(text: string, color: string) {
    const id = `${Date.now()}-${Math.random()}`
    setToasts(prev => [...prev.slice(-4), { id, text, color }])
  }

  function dismiss(id: string) {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  useEffect(() => {
    if (toasts.length === 0) return
    const timer = setTimeout(() => {
      setToasts(prev => prev.slice(1))
    }, 5000)
    return () => clearTimeout(timer)
  }, [toasts])

  return { toasts, addToast, dismiss }
}
