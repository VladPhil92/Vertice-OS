'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Network, UserRound } from 'lucide-react'

const TABS = [
  { href: '/dashboard/community', label: 'Red cívica', icon: Network, exact: true },
  { href: '/dashboard/community/profile', label: 'Mi perfil público', icon: UserRound, exact: false },
] as const

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div>
      <div className="sticky top-[65px] z-30 border-b border-[#E1E7EF] bg-[#F7F9FC]/95 px-4 py-2 backdrop-blur lg:top-0 lg:px-8">
        <div className="mx-auto flex w-full max-w-7xl gap-2">
          {TABS.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname?.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={active
                  ? 'inline-flex min-h-9 items-center gap-2 rounded-full bg-[#0A2A66] px-3.5 py-2 text-[10px] font-extrabold text-white'
                  : 'inline-flex min-h-9 items-center gap-2 rounded-full border border-[#DCE5EF] bg-white px-3.5 py-2 text-[10px] font-extrabold text-[#607087]'}
              >
                <Icon size={13} /> {label}
              </Link>
            )
          })}
        </div>
      </div>
      {children}
    </div>
  )
}
