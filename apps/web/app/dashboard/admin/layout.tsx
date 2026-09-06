import Link from 'next/link'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav className="flex flex-wrap items-center gap-1 border-b border-border px-6 pt-4 lg:px-8">
        <Link
          href="/dashboard/admin"
          className="rounded-t border border-b-0 border-border bg-surface px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-secondary transition-colors hover:border-gold/40 hover:text-gold"
        >
          Moderación
        </Link>
        <Link
          href="/dashboard/admin/pilot"
          className="rounded-t border border-b-0 border-border bg-surface px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-secondary transition-colors hover:border-gold/40 hover:text-gold"
        >
          Control del piloto · Admin
        </Link>
      </nav>
      {children}
    </div>
  )
}
