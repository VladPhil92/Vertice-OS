'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Sentry captura automáticamente via next.config.js
    console.error('[error-boundary]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-6">
      <div className="max-w-lg w-full">
        {/* Status line */}
        <div className="flex items-center gap-3 mb-8">
          <span className="font-mono text-xs tracking-widest text-tertiary uppercase">
            Sistema Operativo Cívico
          </span>
          <span className="h-px flex-1 bg-border" />
          <span className="font-mono text-xs text-[#C0392B]">ERROR</span>
        </div>

        {/* Error code */}
        <div className="font-mono text-[6rem] leading-none font-bold text-surface-2 select-none mb-2">
          500
        </div>

        <h1 className="font-display text-2xl font-bold text-primary mb-3">
          Error interno del sistema
        </h1>

        <p className="text-secondary text-sm leading-relaxed mb-8 max-w-sm">
          Ocurrió un error inesperado. El equipo técnico ha sido notificado
          automáticamente. Puedes intentar recargar o volver al inicio.
        </p>

        {/* Error digest for support */}
        {error.digest && (
          <div className="mb-8 px-4 py-3 bg-surface border border-border rounded-sm">
            <span className="font-mono text-xs text-tertiary">
              Código de referencia:{' '}
              <span className="text-secondary">{error.digest}</span>
            </span>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={reset}
            className="px-5 py-2.5 bg-gold text-bg font-mono text-xs tracking-wider uppercase font-medium hover:bg-gold/90 transition-colors"
          >
            Reintentar
          </button>
          <a
            href="/"
            className="px-5 py-2.5 border border-border text-secondary font-mono text-xs tracking-wider uppercase hover:text-primary hover:border-border-active transition-colors"
          >
            Inicio
          </a>
        </div>

        {/* Bottom accent */}
        <div className="mt-16 h-px w-full bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
      </div>
    </div>
  )
}
