'use client'

import { useEffect, useState } from 'react'
import { FileText, Plus, Clock, CheckCircle, AlertTriangle, XCircle, ArrowUpRight } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

interface LegalDocumentSummary {
  id:           string
  legal_type:   string
  status:       string
  urgency:      string
  target_name:  string
  location:     string | null
  created_at:   string
  submitted_at: string | null
}

const LEGAL_TYPE_LABELS: Record<string, string> = {
  derecho_de_peticion:   'Derecho de Petición',
  tutela:                'Acción de Tutela',
  accion_popular:        'Acción Popular',
  accion_de_cumplimiento:'Acción de Cumplimiento',
  denuncia_penal:        'Denuncia Penal',
  queja:                 'Queja/PQRS',
}

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Clock; color: string }> = {
  draft:     { label: 'Borrador',   icon: FileText,     color: 'text-secondary' },
  ready:     { label: 'Listo',      icon: CheckCircle,  color: 'text-cyan' },
  submitted: { label: 'Enviado',    icon: Clock,        color: 'text-gold' },
  responded: { label: 'Respondido', icon: CheckCircle,  color: 'text-emerald-400' },
  escalated: { label: 'Escalado',   icon: AlertTriangle,color: 'text-red-400' },
  closed:    { label: 'Cerrado',    icon: XCircle,      color: 'text-tertiary' },
}

const URGENCY_COLOR: Record<string, string> = {
  baja:   'bg-surface text-secondary border border-border',
  media:  'bg-surface text-gold border border-gold/30',
  alta:   'bg-surface text-orange-400 border border-orange-400/30',
  critica:'bg-red/10 text-red-400 border border-red-400/30',
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso))
}

export default function LegalListPage() {
  const [docs, setDocs]       = useState<LegalDocumentSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const token = localStorage.getItem('access_token')
        const res = await fetch(`${API}/legal`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error('Error cargando documentos')
        const body = await res.json()
        setDocs(body.documents ?? [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div>
      <main className="mx-auto max-w-5xl px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <span className="section-tag">Módulo legal</span>
          <h1 className="font-display text-2xl font-700 text-primary">Mis documentos legales</h1>
          <p className="mt-1 font-mono text-sm text-secondary">
            Peticiones, tutelas y recursos generados por IA a partir de tus reportes.
          </p>
        </div>

        {/* Content */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin rounded-full h-8 w-8 border-t border-gold" />
          </div>
        )}

        {error && (
          <div className="rounded border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {!loading && !error && docs.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
            <FileText className="h-12 w-12 text-border" />
            <p className="font-display text-lg text-secondary">Aún no tienes documentos legales</p>
            <p className="font-mono text-xs text-tertiary">
              Describe una situación y la IA generará el recurso legal apropiado.
            </p>
            <a href="/dashboard/legal/new" className="btn-primary mt-4 flex items-center gap-2 text-xs py-2.5 px-6">
              <Plus className="h-3.5 w-3.5" />
              Crear primer documento
            </a>
          </div>
        )}

        {!loading && docs.length > 0 && (
          <div className="space-y-px bg-border">
            {docs.map((doc) => {
              const statusCfg = STATUS_CONFIG[doc.status] ?? STATUS_CONFIG['draft']!
              const StatusIcon = statusCfg.icon
              return (
                <a
                  key={doc.id}
                  href={`/dashboard/legal/${doc.id}`}
                  className="flex items-start justify-between gap-4 bg-surface p-5 transition-colors hover:bg-surface/80 group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="font-mono text-[10px] font-600 uppercase tracking-widest text-gold">
                        {LEGAL_TYPE_LABELS[doc.legal_type] ?? doc.legal_type}
                      </span>
                      <span className={`rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${URGENCY_COLOR[doc.urgency] ?? ''}`}>
                        {doc.urgency}
                      </span>
                    </div>

                    <p className="font-display text-sm font-600 text-primary truncate">
                      {doc.target_name}
                    </p>

                    {doc.location && (
                      <p className="mt-0.5 font-mono text-[11px] text-tertiary truncate">
                        {doc.location}
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-4">
                      <div className={`flex items-center gap-1 font-mono text-[10px] ${statusCfg.color}`}>
                        <StatusIcon className="h-3 w-3" />
                        {statusCfg.label}
                      </div>
                      <span className="font-mono text-[10px] text-tertiary">
                        Creado {formatDate(doc.created_at)}
                      </span>
                      {doc.submitted_at && (
                        <span className="font-mono text-[10px] text-secondary">
                          Enviado {formatDate(doc.submitted_at)}
                        </span>
                      )}
                    </div>
                  </div>

                  <ArrowUpRight className="h-4 w-4 flex-shrink-0 text-tertiary group-hover:text-gold transition-colors mt-1" />
                </a>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
