'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Bot, User, Loader, AlertCircle, Sparkles, RotateCcw } from 'lucide-react'
import { apiFetch } from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  intent?: string
  agent?: string
  error?: boolean
}

interface AIQueryResponse {
  response: string
  intent: string
  agent_used: string
  confidence: number
  audit_id: string
  session_id: string
}

const SESSION_STORAGE_KEY = 'vertice:ai:session_id'

// ─── Suggested prompts ───────────────────────────────────────────────────────

const SUGGESTED = [
  { label: '¿Cómo presento un derecho de petición?', icon: '⚖️' },
  { label: '¿Qué propuestas están en debate actualmente?', icon: '🗳️' },
  { label: '¿Cuáles son los principales problemas territoriales?', icon: '🗺️' },
  { label: 'Ayúdame a redactar una propuesta ciudadana', icon: '📝' },
]

// ─── Agent label map ──────────────────────────────────────────────────────────

const AGENT_LABEL: Record<string, string> = {
  territorial:  'Análisis Territorial',
  governance:   'Gobernanza',
  legal:        'Asesoría Legal',
  reputation:   'Reputación',
  policy:       'Política Pública',
  router:       'IA Cívica',
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
          <Bot size={13} className="text-gold" />
        </div>
      )}

      <div className={`max-w-[78%] space-y-1 ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        {msg.agent && !isUser && (
          <span className="font-mono text-[9px] uppercase tracking-widest text-tertiary">
            {AGENT_LABEL[msg.agent] ?? msg.agent}
          </span>
        )}
        <div
          className={[
            'rounded px-4 py-3 font-mono text-[12px] leading-relaxed',
            isUser
              ? 'bg-gold/15 text-primary'
              : msg.error
                ? 'border border-red/30 bg-red/5 text-red-400'
                : 'border border-border bg-surface text-primary',
          ].join(' ')}
        >
          {msg.error && <AlertCircle size={12} className="mb-1.5 inline mr-1.5" />}
          <span className="whitespace-pre-wrap">{msg.content}</span>
        </div>
      </div>

      {isUser && (
        <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-border bg-surface">
          <User size={13} className="text-secondary" />
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  // Restore session from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(SESSION_STORAGE_KEY)
    if (stored) setSessionId(stored)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const newConversation = useCallback(async () => {
    if (sessionId) {
      apiFetch('/ai/session', { method: 'DELETE', body: JSON.stringify({ session_id: sessionId }) }).catch(() => null)
      localStorage.removeItem(SESSION_STORAGE_KEY)
    }
    setSessionId(null)
    setMessages([])
    setInput('')
    inputRef.current?.focus()
  }, [sessionId])

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await apiFetch<AIQueryResponse>('/ai/query', {
        method: 'POST',
        body: JSON.stringify({
          message: trimmed,
          ...(sessionId ? { session_id: sessionId } : {}),
        }),
      })

      // Persist new session_id from server
      if (res.session_id && res.session_id !== sessionId) {
        setSessionId(res.session_id)
        localStorage.setItem(SESSION_STORAGE_KEY, res.session_id)
      }

      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: res.response,
          intent: res.intent,
          agent: res.agent_used,
        },
      ])
    } catch (e) {
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: (e as Error).message.includes('AI service')
            ? 'El servicio de IA no está disponible en este momento. Por favor intenta más tarde.'
            : (e as Error).message,
          error: true,
        },
      ])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }, [sessionId, loading])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col lg:h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-6 py-4">
        <Sparkles size={16} className="text-gold" />
        <div className="flex-1">
          <h1 className="font-display text-[15px] font-semibold uppercase tracking-wide text-primary">
            Asistente Cívico
          </h1>
          <p className="font-mono text-[10px] uppercase tracking-widest text-tertiary">
            Multi-agente · Cartagena{sessionId ? ' · Sesión activa' : ''}
          </p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={newConversation}
            disabled={loading}
            className="flex items-center gap-1.5 rounded border border-border px-3 py-1.5 font-mono text-[10px] text-secondary transition hover:border-gold/30 hover:text-primary disabled:opacity-40"
            title="Nueva conversación"
          >
            <RotateCcw size={11} />
            Nueva
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-gold/20 bg-gold/5">
              <Sparkles size={28} className="text-gold" />
            </div>
            <h2 className="mb-2 font-display text-lg font-semibold text-primary">
              ¿En qué puedo ayudarte?
            </h2>
            <p className="mb-8 max-w-sm text-center font-mono text-[12px] text-secondary">
              Pregúntame sobre propuestas, reportes territoriales, derechos ciudadanos o
              cómo participar en la vida cívica de Cartagena.
            </p>
            <div className="grid w-full max-w-lg gap-2 sm:grid-cols-2">
              {SUGGESTED.map(({ label, icon }) => (
                <button
                  key={label}
                  onClick={() => send(label)}
                  className="flex items-start gap-3 rounded border border-border bg-surface px-4 py-3 text-left transition-colors hover:border-gold/30 hover:bg-gold/5"
                >
                  <span className="text-base">{icon}</span>
                  <span className="font-mono text-[11px] leading-relaxed text-secondary">
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-5">
            {messages.map(msg => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}

            {loading && (
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
                  <Bot size={13} className="text-gold" />
                </div>
                <div className="flex items-center gap-1.5 rounded border border-border bg-surface px-4 py-3">
                  <Loader size={12} className="animate-spin text-gold" />
                  <span className="font-mono text-[11px] text-tertiary">Procesando…</span>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border bg-bg px-6 py-4">
        <div className="mx-auto flex max-w-2xl items-end gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu pregunta… (Enter para enviar, Shift+Enter para nueva línea)"
            rows={1}
            disabled={loading}
            className="flex-1 resize-none rounded border border-border bg-surface px-4 py-3 font-mono text-[12px] text-primary placeholder-tertiary transition-colors focus:border-gold/50 focus:outline-none disabled:opacity-50"
            style={{ maxHeight: '120px', overflowY: 'auto' }}
            onInput={e => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = `${Math.min(el.scrollHeight, 120)}px`
            }}
          />
          <button
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded border border-gold/40 bg-gold/10 text-gold transition-colors hover:bg-gold/20 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Enviar"
          >
            {loading ? <Loader size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
        </div>
        <p className="mt-2 text-center font-mono text-[9px] uppercase tracking-widest text-tertiary">
          Las respuestas son generadas por IA · Verifica información importante
        </p>
      </div>
    </div>
  )
}
