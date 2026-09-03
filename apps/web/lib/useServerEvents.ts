'use client'

import { useEffect, useRef, useCallback } from 'react'
import { BASE_URL } from '@/lib/api'

export interface RealtimeEvent {
  channel: 'territorial' | 'governance' | 'system'
  type: string
  payload: Record<string, unknown>
  ts: number
}

type EventHandler = (event: RealtimeEvent) => void

export function useServerEvents(
  channels: ('territorial' | 'governance' | 'system')[],
  onEvent: EventHandler,
) {
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  const reconnectDelay = useRef(1000)
  const esRef = useRef<EventSource | null>(null)
  const unmounted = useRef(false)

  const connect = useCallback(() => {
    if (unmounted.current) return

    const url = `${BASE_URL}/events?channels=${channels.join(',')}`
    const es = new EventSource(url, { withCredentials: true })
    esRef.current = es

    es.onopen = () => {
      reconnectDelay.current = 1000
    }

    es.onmessage = (e) => {
      try {
        const event: RealtimeEvent = JSON.parse(e.data as string)
        onEventRef.current(event)
      } catch { /* ignore malformed messages */ }
    }

    es.onerror = () => {
      es.close()
      esRef.current = null
      if (!unmounted.current) {
        // Exponential backoff — máximo 30 s
        setTimeout(connect, reconnectDelay.current)
        reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30_000)
      }
    }
  }, [channels.join(',')])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    unmounted.current = false

    // Solo conectar si el browser soporta EventSource
    if (typeof EventSource === 'undefined') return

    connect()

    return () => {
      unmounted.current = true
      esRef.current?.close()
      esRef.current = null
    }
  }, [connect])
}
