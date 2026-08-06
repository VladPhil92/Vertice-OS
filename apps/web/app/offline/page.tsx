'use client'

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
        <span className="text-3xl">📡</span>
      </div>
      <h1 className="font-syne text-2xl font-bold text-primary">Sin conexión</h1>
      <p className="max-w-sm font-mono text-sm text-secondary">
        No hay conexión a internet. Algunas funciones de VÉRTICE OS requieren conexión.
        Intenta de nuevo cuando estés en línea.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="rounded border border-gold/40 bg-gold/10 px-6 py-2 font-mono text-sm text-gold transition hover:bg-gold/20"
      >
        Reintentar
      </button>
    </main>
  )
}
