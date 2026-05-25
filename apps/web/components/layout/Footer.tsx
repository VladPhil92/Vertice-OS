import { Github, Twitter } from 'lucide-react'

const FOOTER_LINKS = {
  Plataforma: [
    { label: 'Identidad Cívica', href: '#modulos' },
    { label: 'Motor Territorial', href: '#modulos' },
    { label: 'Gobernanza', href: '#modulos' },
    { label: 'Capa IA', href: '#ia' },
    { label: 'Blockchain', href: '#modulos' },
  ],
  Recursos: [
    { label: 'Documentación', href: '/docs' },
    { label: 'Hoja de Ruta', href: '#roadmap' },
    { label: 'API Pública', href: '/docs/api' },
    { label: 'Contratos', href: '/docs/contracts' },
  ],
  Legal: [
    { label: 'Términos de uso', href: '/legal/terms' },
    { label: 'Privacidad', href: '/legal/privacy' },
    { label: 'Tratamiento de datos', href: '/legal/data' },
  ],
} as const

export function Footer() {
  return (
    <footer className="border-t border-border bg-bg pb-24">
      {/* Main footer content */}
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-5">
          {/* Brand column */}
          <div className="lg:col-span-2">
            {/* Logo */}
            <div className="mb-5 flex items-center gap-3">
              <svg viewBox="0 0 32 32" fill="none" className="h-8 w-8 flex-shrink-0">
                <polygon
                  points="16,2 30,28 2,28"
                  stroke="#C8A84B"
                  strokeWidth="1.5"
                  fill="none"
                />
                <polygon
                  points="16,9 25,26 7,26"
                  stroke="#C8A84B"
                  strokeWidth="0.75"
                  fill="none"
                  opacity="0.4"
                />
              </svg>
              <span className="font-display text-sm font-700 uppercase tracking-widest text-primary">
                VÉRTICE OS
              </span>
            </div>

            <p className="mb-6 max-w-xs font-mono text-[12px] leading-relaxed text-secondary">
              Sistema Operativo Cívico para Cartagena de Indias. Infraestructura
              de participación ciudadana continua, transparente e impermeable
              a la captura política.
            </p>

            {/* City badge */}
            <div className="mb-6 inline-flex items-center gap-2 border border-border px-3 py-1.5">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: '#C8A84B', boxShadow: '0 0 6px #C8A84B' }}
              />
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary">
                Ciudad piloto: Cartagena de Indias
              </span>
            </div>

            {/* Social links */}
            <div className="flex items-center gap-3">
              <a
                href="https://github.com/VladPhil92/Vertice-OS"
                className="flex h-8 w-8 items-center justify-center border border-border text-tertiary transition-colors hover:border-border-active hover:text-primary"
                aria-label="GitHub"
              >
                <Github size={14} />
              </a>
              <a
                href="https://twitter.com/VerticeOS"
                className="flex h-8 w-8 items-center justify-center border border-border text-tertiary transition-colors hover:border-border-active hover:text-primary"
                aria-label="Twitter / X"
              >
                <Twitter size={14} />
              </a>
            </div>
          </div>

          {/* Link columns */}
          {(Object.entries(FOOTER_LINKS) as [string, readonly { label: string; href: string }[]][]).map(
            ([category, links]) => (
              <div key={category}>
                <h4 className="mb-5 font-mono text-[10px] uppercase tracking-[0.3em] text-gold">
                  {category}
                </h4>
                <ul className="flex flex-col gap-3">
                  {links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="font-mono text-[12px] text-secondary transition-colors duration-200 hover:text-primary"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ),
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <span className="font-mono text-[10px] text-tertiary">
            © {new Date().getFullYear()} CTG One Corporation · Todos los derechos reservados
          </span>
          <div className="flex items-center gap-4">
            <span className="font-mono text-[10px] text-tertiary">
              v0.1.0-alpha
            </span>
            <span className="font-mono text-[10px] text-tertiary">
              Polygon PoS Testnet
            </span>
            <div className="flex items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: '#4ECDC4', boxShadow: '0 0 6px #4ECDC4' }}
              />
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-tertiary">
                Red activa
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
