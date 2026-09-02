import Image from 'next/image'

type BrandLogoProps = {
  className?: string
  compact?: boolean
  priority?: boolean
}

export function BrandLogo({ className = '', compact = false, priority = false }: BrandLogoProps) {
  return (
    <div className={`flex items-center ${className}`}>
      <Image
        src="/brand/vertice-logo.png"
        alt="VÉRTICE — Inteligencia ciudadana"
        width={480}
        height={134}
        priority={priority}
        className={compact ? 'h-10 w-auto object-contain' : 'h-12 w-auto object-contain'}
      />
    </div>
  )
}
