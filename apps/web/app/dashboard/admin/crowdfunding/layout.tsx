import Link from 'next/link'
import type { ReactNode } from 'react'

export default function CrowdfundingAdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="border-b border-[#DCE5EF] bg-white/95 px-4 py-2.5 backdrop-blur sm:px-6 lg:px-8">
        <nav className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-2" aria-label="Operaciones administrativas de crowdfunding">
          <Link href="/dashboard/admin/crowdfunding" className="rounded-xl px-3 py-2 text-[10px] font-extrabold uppercase tracking-[.06em] text-[#607087] hover:bg-[#F7F9FC] hover:text-[#0A2A66]">Compliance y readiness</Link>
          <Link href="/dashboard/admin/crowdfunding/lifecycle" className="rounded-xl bg-[#EAF1FB] px-3 py-2 text-[10px] font-extrabold uppercase tracking-[.06em] text-[#0A2A66]">Ciclo de campañas</Link>
        </nav>
      </div>
      {children}
    </>
  )
}
