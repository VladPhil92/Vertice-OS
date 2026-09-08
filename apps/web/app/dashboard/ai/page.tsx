'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Send, Bot, User, Loader, AlertCircle, Sparkles, RotateCcw, MapPin, ShieldCheck } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useDashboardRuntime } from '@/components/dashboard/DashboardIdentityProvider'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  agent?: string
  auditId?: string
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

const SUGGESTED = [
  { label: '¿Qué situaciones de mi territorio requieren atención?', icon: '🗺️', topic: 'territorial' },
  { label: 'Ayúdame a mejorar una propuesta ciudadana', icon: '📝', topic: 'governance' },
  { label: '¿Cómo preparo un derecho de petición?', icon: '⚖️', topic: 'legal' },
  { label: 'Explícame cómo se evalúa evidencia e impacto en VÉRTICE', icon: '📊', topic: 'reputation' },
]

const AGENT_LABEL: Record<string, string> = {
  territorial: 'Análisis territorial',
  governance: 'Gobernanza',
  legal: 'Asesoría legal',
  reputation: 'Impacto y reputación',
  policy: 'Política pública',
  router: 'IA Cívica',
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#F1DEA5] bg-[#FFF8DF]"><Bot size={14} className="text-[#9A7000]" /></div>}
      <div className={`flex max-w-[82%] flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
        {msg.agent && !isUser && <span className="text-[9px] font-extrabold uppercase tracking-[.1em] text-[#7B8799]">{AGENT_LABEL[msg.agent] ?? msg.agent}</span>}
        <div className={isUser ? 'rounded-2xl rounded-tr-md bg-[#0A2A66] px-4 py-3 text-sm leading-6 text-white' : msg.error ? 'rounded-2xl rounded-tl-md border border-[#F0C7CB] bg-[#FFF7F8] px-4 py-3 text-sm leading-6 text-[#A51E2D]' : 'rounded-2xl rounded-tl-md border border-[#DCE5EF] bg-white px-4 py-3 text-sm leading-6 text-[#30435E]'}>
          {msg.error && <AlertCircle size={13} className="mr-1 inline" />}
          <span className="whitespace-pre-wrap">{msg.content}</span>
        </div>
        {msg.auditId && !isUser && <span className="font-mono text-[8px] text-[#9AA5B4]">audit {msg.auditId.slice(0, 12)}…</span>}
      </div>
      {isUser && <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#DCE5EF] bg-white"><User size={14} className="text-[#607087]" /></div>}
    </div>
  )
}

export default function AIAssistantPage() {
  const searchParams = useSearchParams()
  const { profile, territory, identityVerified } = useDashboardRuntime()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [topic, setTopic] = useState<string | null>(searchParams.get('topic'))
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const initializedPrompt = useRef(false)

  useEffect(() => {
    const stored = localStorage.getItem(SESSION_STORAGE_KEY)
    if (stored) setSessionId(stored)
    const prompt = searchParams.get('prompt')
    if (prompt && !initializedPrompt.current) {
      initializedPrompt.current = true
      setInput(prompt.slice(0, 4000))
    }
  }, [searchParams])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const newConversation = useCallback(async () => {
    if (sessionId) {
      void apiFetch('/ai/session', { method: 'DELETE', body: JSON.stringify({ session_id: sessionId }) }).catch(() => null)
      localStorage.removeItem(SESSION_STORAGE_KEY)
    }
    setSessionId(null)
    setMessages([])
    setInput('')
    inputRef.current?.focus()
  }, [sessionId])

  const send = useCallback(async (text: string, nextTopic?: string) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return
    const effectiveTopic = nextTopic ?? topic ?? undefined
    if (nextTopic) setTopic(nextTopic)

    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', content: trimmed }])
    setInput('')
    setLoading(true)

    try {
      const res = await apiFetch<AIQueryResponse>('/ai/query', {
        method: 'POST',
        body: JSON.stringify({
          message: trimmed,
          ...(sessionId ? { session_id: sessionId } : {}),
          ...(profile?.neighborhood ? { neighborhood: profile.neighborhood } : {}),
          ...(effectiveTopic ? { topic: effectiveTopic } : {}),
        }),
      })
      if (res.session_id && res.session_id !== sessionId) {
        setSessionId(res.session_id)
        localStorage.setItem(SESSION_STORAGE_KEY, res.session_id)
      }
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: res.response, agent: res.agent_used, auditId: res.audit_id }])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No fue posible consultar la IA cívica.'
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: message.includes('AI service') ? 'El servicio de IA no está disponible en este momento.' : message, error: true }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }, [loading, profile?.neighborhood, sessionId, topic])

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void send(input)
    }
  }

  return (
    <div data-testid="contextual-civic-ai" className="flex h-[calc(100vh-3.5rem)] flex-col bg-[#F7F9FC] lg:h-screen">
      <header className="border-b border-[#E1E7EF] bg-white px-5 py-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF8DF] text-[#9A7000]"><Sparkles size={18} /></span>
          <div className="min-w-0 flex-1"><h1 className="text-sm font-extrabold text-[#0A2A66]">Copiloto cívico</h1><div className="mt-1 flex flex-wrap items-center gap-2 text-[9px] font-semibold uppercase tracking-[.08em] text-[#7B8799]"><span className="inline-flex items-center gap-1"><MapPin size={10} /> {territory}</span>{identityVerified && <span className="inline-flex items-center gap-1 text-[#238A3B]"><ShieldCheck size={10} /> contexto verificado</span>}{sessionId && <span>sesión activa</span>}{topic && <span>· {topic}</span>}</div></div>
          {messages.length > 0 && <button onClick={() => void newConversation()} disabled={loading} className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[#DCE5EF] px-3 text-[10px] font-extrabold text-[#607087] disabled:opacity-50"><RotateCcw size={12} /> Nueva</button>}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-5 py-6 sm:px-6">
        {messages.length === 0 ? (
          <div className="mx-auto flex min-h-full max-w-3xl flex-col items-center justify-center py-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0A2A66] text-[#F5B700]"><Sparkles size={27} /></div>
            <h2 className="mt-5 text-2xl font-extrabold text-[#0A2A66]">Pregunta con contexto de tu territorio</h2>
            <p className="mt-3 max-w-xl text-sm font-medium leading-6 text-[#607087]">La consulta usa tu barrio cuando está disponible y mantiene memoria de sesión. Para decisiones importantes, contrasta siempre la respuesta con fuentes y evidencia del expediente.</p>
            <div className="mt-7 grid w-full gap-3 sm:grid-cols-2">
              {SUGGESTED.map((suggestion) => <button key={suggestion.label} onClick={() => void send(suggestion.label, suggestion.topic)} className="flex items-start gap-3 rounded-2xl border border-[#DCE5EF] bg-white p-4 text-left transition hover:border-[#BFD0E8] hover:bg-[#F9FBFD]"><span className="text-lg">{suggestion.icon}</span><span className="text-xs font-semibold leading-5 text-[#43506A]">{suggestion.label}</span></button>)}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-5">
            {messages.map((message) => <MessageBubble key={message.id} msg={message} />)}
            {loading && <div className="flex items-center gap-3"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FFF8DF]"><Bot size={14} className="text-[#9A7000]" /></div><div className="inline-flex items-center gap-2 rounded-2xl border border-[#DCE5EF] bg-white px-4 py-3 text-xs font-semibold text-[#607087]"><Loader size={13} className="animate-spin" /> Analizando contexto…</div></div>}
            <div ref={bottomRef} />
          </div>
        )}
      </main>

      <footer className="border-t border-[#E1E7EF] bg-white px-5 py-4 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-end gap-3">
            <textarea ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={handleKeyDown} rows={1} disabled={loading} placeholder="Describe qué necesitas analizar…" className="min-h-12 flex-1 resize-none rounded-2xl border border-[#DCE5EF] bg-[#F9FBFD] px-4 py-3 text-sm font-medium text-[#0A2A66] outline-none placeholder:text-[#9AA5B4] focus:border-[#8EACD2] disabled:opacity-50" style={{ maxHeight: '140px', overflowY: 'auto' }} onInput={(event) => { const el = event.currentTarget; el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 140)}px` }} />
            <button onClick={() => void send(input)} disabled={loading || !input.trim()} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#0A2A66] text-white disabled:cursor-not-allowed disabled:opacity-40" aria-label="Enviar consulta">{loading ? <Loader size={16} className="animate-spin" /> : <Send size={16} />}</button>
          </div>
          <p className="mt-2 text-center text-[9px] font-semibold text-[#9AA5B4]">IA asistiva · trazabilidad por audit ID · no sustituye verificación humana ni asesoría profesional.</p>
        </div>
      </footer>
    </div>
  )
}
