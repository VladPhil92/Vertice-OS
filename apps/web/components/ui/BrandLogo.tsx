import Image from 'next/image'

type BrandLogoProps = {
  className?: string
  compact?: boolean
  priority?: boolean
}

export function BrandLogo({ className = '', compact = false, priority = false }: BrandLogoProps) {
  const widthClass = compact ? 'w-[190px] sm:w-[205px]' : 'w-[230px] sm:w-[250px]'

  return (
    <div className={`flex shrink-0 items-center overflow-visible py-1 ${className}`}>
      <Image
        src="/brand/vertice-logo.png"
        alt="VÉRTICE — Inteligencia ciudadana"
        width={480}
        height={134}
        priority={priority}
        quality={100}
        sizes={compact ? '(max-width: 640px) 190px, 205px' : '(max-width: 640px) 230px, 250px'}
        className={`block h-auto max-w-none shrink-0 object-contain object-left ${widthClass}`}
      />
    </div>
  )
}
