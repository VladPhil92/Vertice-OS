type PublicSectionHeaderProps = {
  eyebrow: string
  title: string
  description?: string
  align?: 'left' | 'center'
  inverse?: boolean
}

export function PublicSectionHeader({
  eyebrow,
  title,
  description,
  align = 'left',
  inverse = false,
}: PublicSectionHeaderProps) {
  const centered = align === 'center'

  return (
    <div className={`${centered ? 'mx-auto text-center' : ''} max-w-3xl`}>
      <div
        className={`mb-4 inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.16em] ${
          inverse ? 'text-[#F5B700]' : 'text-[#0A2A66]'
        }`}
      >
        <span className="h-0.5 w-7 rounded-full bg-[#F5B700]" />
        {eyebrow}
      </div>
      <h2
        className={`font-display text-3xl font-extrabold tracking-[-0.045em] sm:text-4xl lg:text-[2.8rem] ${
          inverse ? 'text-white' : 'text-[#0A2A66]'
        }`}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={`mt-4 text-sm font-medium leading-7 sm:text-[15px] ${
            inverse ? 'text-white/70' : 'text-[#607087]'
          }`}
        >
          {description}
        </p>
      ) : null}
    </div>
  )
}
