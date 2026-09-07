/* eslint-disable @next/next/no-img-element */
'use client'

import { BadgeCheck, UserRound } from 'lucide-react'

const SIZE_CLASS = {
  xs: 'h-8 w-8 text-[9px]',
  sm: 'h-10 w-10 text-[10px]',
  md: 'h-12 w-12 text-xs',
  lg: 'h-16 w-16 text-sm',
  xl: 'h-24 w-24 text-xl',
} as const

const BADGE_CLASS = {
  xs: '-bottom-0.5 -right-0.5 h-3.5 w-3.5',
  sm: '-bottom-0.5 -right-0.5 h-4 w-4',
  md: '-bottom-0.5 -right-0.5 h-[18px] w-[18px]',
  lg: '-bottom-1 -right-1 h-5 w-5',
  xl: '-bottom-1 -right-1 h-6 w-6',
} as const

export type CivicAvatarSize = keyof typeof SIZE_CLASS

interface CivicAvatarProps {
  src?: string | null
  name?: string | null
  identityVerified?: boolean
  size?: CivicAvatarSize
  className?: string
}

function initials(name?: string | null): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join('')
}

export function CivicAvatar({
  src,
  name,
  identityVerified = false,
  size = 'md',
  className = '',
}: CivicAvatarProps) {
  const fallback = initials(name)
  return (
    <div className={`relative shrink-0 ${className}`}>
      <div
        className={`flex items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[#EDF3FA] font-extrabold text-[#0A2A66] shadow-[0_6px_22px_rgba(10,42,102,.12)] ${SIZE_CLASS[size]}`}
        aria-label={name ? `Foto de perfil de ${name}` : 'Foto de perfil'}
      >
        {src ? (
          <img
            src={src}
            alt={name ? `Foto de perfil de ${name}` : 'Foto de perfil'}
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : fallback ? (
          <span aria-hidden="true">{fallback}</span>
        ) : (
          <UserRound className="h-[52%] w-[52%] text-[#6C84A8]" aria-hidden="true" />
        )}
      </div>
      {identityVerified && (
        <span
          title="Identidad verificada"
          aria-label="Identidad verificada"
          className={`absolute flex items-center justify-center rounded-full border-2 border-white bg-[#0A2A66] text-white shadow-sm ${BADGE_CLASS[size]}`}
        >
          <BadgeCheck className="h-[76%] w-[76%]" strokeWidth={2.6} />
        </span>
      )}
    </div>
  )
}
