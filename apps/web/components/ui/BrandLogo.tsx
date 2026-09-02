type BrandLogoProps = {
  className?: string
  compact?: boolean
  priority?: boolean
}

export function BrandLogo({ className = '', compact = false }: BrandLogoProps) {
  return (
    <div className={`flex items-center ${className}`}>
      <img
        src="/brand/vertice-logo.png"
        alt="VÉRTICE — Inteligencia ciudadana"
        className={compact ? 'h-10 w-auto object-contain' : 'h-12 w-auto object-contain'}
      />
    </div>
  )
}
