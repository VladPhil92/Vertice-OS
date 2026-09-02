import Image from 'next/image'

type BrandLogoVariant = 'wordmark' | 'full' | 'symbol'

type BrandLogoProps = {
  className?: string
  compact?: boolean
  priority?: boolean
  variant?: BrandLogoVariant
}

const BRAND_ASSETS = {
  wordmark: {
    src: '/brand/vertice-wordmark.webp',
    alt: 'VÉRTICE',
    width: 1066,
    height: 238,
  },
  full: {
    src: '/brand/vertice-logo.png',
    alt: 'VÉRTICE — Diferentes en cada región, unidos en un solo país.',
    width: 1536,
    height: 1536,
  },
  symbol: {
    src: '/brand/vertice-symbol.webp',
    alt: 'Símbolo territorial de VÉRTICE',
    width: 777,
    height: 991,
  },
} as const

const WIDTH_CLASSES: Record<BrandLogoVariant, { compact: string; regular: string }> = {
  wordmark: {
    compact: 'w-[190px] sm:w-[205px]',
    regular: 'w-[230px] sm:w-[250px]',
  },
  full: {
    compact: 'w-[160px] sm:w-[180px]',
    regular: 'w-[190px] sm:w-[220px]',
  },
  symbol: {
    compact: 'w-12',
    regular: 'w-16',
  },
}

const SIZES: Record<BrandLogoVariant, { compact: string; regular: string }> = {
  wordmark: {
    compact: '(max-width: 640px) 190px, 205px',
    regular: '(max-width: 640px) 230px, 250px',
  },
  full: {
    compact: '(max-width: 640px) 160px, 180px',
    regular: '(max-width: 640px) 190px, 220px',
  },
  symbol: {
    compact: '48px',
    regular: '64px',
  },
}

export function BrandLogo({
  className = '',
  compact = false,
  priority = false,
  variant = 'wordmark',
}: BrandLogoProps) {
  const asset = BRAND_ASSETS[variant]
  const sizeKey = compact ? 'compact' : 'regular'

  return (
    <div className={`flex shrink-0 items-center overflow-visible ${className}`}>
      <Image
        src={asset.src}
        alt={asset.alt}
        width={asset.width}
        height={asset.height}
        priority={priority}
        quality={100}
        sizes={SIZES[variant][sizeKey]}
        className={`block h-auto max-w-none shrink-0 object-contain ${WIDTH_CLASSES[variant][sizeKey]}`}
      />
    </div>
  )
}
