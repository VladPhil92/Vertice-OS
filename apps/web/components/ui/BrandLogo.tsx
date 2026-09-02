import Image from 'next/image'

type BrandLogoProps = {
  className?: string
  compact?: boolean
  priority?: boolean
}

export function BrandLogo({ className = '', compact = false, priority = false }: BrandLogoProps) {
  return (
    <div className={`flex shrink-0 items-center overflow-visible py-1 ${className}`}>
      <Image
        src="/brand/vertice-logo.png"
        alt="VÉRTICE — Inteligencia ciudadana"
        width={480}
        height={134}
        priority={priority}
        quality={100}
        sizes={compact ? '180px' : '230px'}
        className={
          compact
            ? 'block h-auto w-[180px] max-w-full object-contain object-left'
            : 'block h-auto w-[230px] max-w-full object-contain object-left'
        }
      />
    </div>
  )
}
