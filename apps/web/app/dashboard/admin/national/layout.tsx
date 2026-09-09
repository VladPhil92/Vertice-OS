import Link from 'next/link'

export default function NationalOperationsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav className="flex flex-wrap items-center gap-2 border-b border-border px-6 py-3 lg:px-8">
        <Link href="/dashboard/admin/national" className="rounded-lg border border-border bg-surface px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-secondary hover:border-gold/40 hover:text-gold">
          Control de lanzamiento
        </Link>
        <Link href="/dashboard/admin/national/activation" className="rounded-lg border border-border bg-surface px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-secondary hover:border-gold/40 hover:text-gold">
          Intereses ciudadanos
        </Link>
      </nav>
      {children}
    </div>
  )
}
