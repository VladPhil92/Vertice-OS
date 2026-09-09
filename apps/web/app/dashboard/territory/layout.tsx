import Link from 'next/link'

export default function TerritoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav className="border-b border-border bg-card/40">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3">
          <Link href="/dashboard/territory" className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:border-primary/40">
            Mi territorio
          </Link>
          <Link href="/dashboard/territory/activate" className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:border-primary/40">
            Activar comunidad
          </Link>
          <Link href="/cities" className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:border-primary/40">
            Explorar Colombia
          </Link>
        </div>
      </nav>
      {children}
    </div>
  )
}
