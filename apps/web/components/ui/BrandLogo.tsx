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
        quality={100}
        sizes={compact ? '180px' : '220px'}
        className={compact ? 'h-11 w-auto object-contain' : 'h-14 w-auto object-contain'}
      />
    </div>
  )
}
