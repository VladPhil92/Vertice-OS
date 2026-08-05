import Link from 'next/link'

export const metadata = {
  title: 'Página no encontrada',
}

export default function NotFound() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-6">
      <div className="max-w-lg w-full">
        {/* Status line */}
        <div className="flex items-center gap-3 mb-8">
          <span className="font-mono text-xs tracking-widest text-tertiary uppercase">
            Sistema Operativo Cívico
          </span>
          <span className="h-px flex-1 bg-border" />
          <span className="font-mono text-xs text-gold">404</span>
        </div>

        {/* Large 404 */}
        <div className="font-mono text-[6rem] leading-none font-bold text-surface-2 select-none mb-2">
          404
        </div>

        <h1 className="font-display text-2xl font-bold text-primary mb-3">
          Ruta no encontrada
        </h1>

        <p className="text-secondary text-sm leading-relaxed mb-8 max-w-sm">
          La página que buscas no existe en este sistema. Puede que haya sido
          movida, eliminada o que la dirección sea incorrecta.
        </p>

        {/* Navigation suggestions */}
        <div className="mb-8 border border-border">
          <div className="px-4 py-2 border-b border-border">
            <span className="font-mono text-xs text-tertiary uppercase tracking-wider">
              Destinos disponibles
            </span>
          </div>
          <div className="divide-y divide-border">
            {[
              { href: '/dashboard', label: 'Panel ciudadano', desc: 'Tu espacio de participación' },
              { href: '/dashboard/reports', label: 'Reportes territoriales', desc: 'Problemas y soluciones en tu barrio' },
              { href: '/dashboard/governance', label: 'Gobernanza', desc: 'Propuestas activas de tu localidad' },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center justify-between px-4 py-3 hover:bg-surface transition-colors group"
              >
                <div>
                  <div className="font-mono text-sm text-primary group-hover:text-gold transition-colors">
                    {link.label}
                  </div>
                  <div className="font-mono text-xs text-tertiary mt-0.5">
                    {link.desc}
                  </div>
                </div>
                <span className="text-tertiary group-hover:text-gold transition-colors text-lg">→</span>
              </Link>
            ))}
          </div>
        </div>

        <Link
          href="/"
          className="inline-block px-5 py-2.5 bg-gold text-bg font-mono text-xs tracking-wider uppercase font-medium hover:bg-gold/90 transition-colors"
        >
          Volver al inicio
        </Link>

        <div className="mt-16 h-px w-full bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
      </div>
    </div>
  )
}
