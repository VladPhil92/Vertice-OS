import Link from 'next/link'

export default function CrowdfundingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="border-b border-[#DCE5EF] bg-white/95 px-4 py-2.5 backdrop-blur sm:px-6 lg:px-8">
        <nav className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-2" aria-label="Navegación de crowdfunding">
          <Link href="/dashboard/crowdfunding" className="rounded-xl px-3 py-2 text-[10px] font-extrabold uppercase tracking-[.06em] text-[#607087] hover:bg-[#F7F9FC] hover:text-[#0A2A66]">Centro de recaudo</Link>
          <Link href="/dashboard/crowdfunding/manage" className="rounded-xl px-3 py-2 text-[10px] font-extrabold uppercase tracking-[.06em] text-[#607087] hover:bg-[#F7F9FC] hover:text-[#0A2A66]">Gestionar campañas</Link>
          <Link href="/dashboard/crowdfunding/readiness" className="rounded-xl bg-[#EAF1FB] px-3 py-2 text-[10px] font-extrabold uppercase tracking-[.06em] text-[#0A2A66]">Readiness</Link>
          <Link href="/dashboard/crowdfunding/new" className="rounded-xl bg-[#FFF8DF] px-3 py-2 text-[10px] font-extrabold uppercase tracking-[.06em] text-[#6C5B21]">Nueva campaña</Link>
        </nav>
      </div>
      {children}
    </>
  )
}