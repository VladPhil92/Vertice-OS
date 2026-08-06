export default function Loading() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        {/* Animated logo mark */}
        <div className="relative w-10 h-10">
          <div
            className="absolute inset-0 border-2 border-gold/30 rounded-full animate-spin"
            style={{ animationDuration: '2s' }}
          />
          <div
            className="absolute inset-[5px] border border-gold/60 rounded-full animate-spin"
            style={{ animationDuration: '1.4s', animationDirection: 'reverse' }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-gold rounded-full" />
          </div>
        </div>

        {/* Label */}
        <span className="font-mono text-xs tracking-widest text-tertiary uppercase animate-pulse">
          Cargando
        </span>
      </div>
    </div>
  )
}
