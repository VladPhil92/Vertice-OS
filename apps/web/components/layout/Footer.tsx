import Link from 'next/link'
import { Github } from 'lucide-react'

const FOOTER_LINKS = {
  Explorar: [
    { label: 'Propósito', href: '#proposito' },
    { label: 'Cómo funciona', href: '#como-funciona' },
    { label: 'Qué puedes hacer', href: '#capacidades' },
    { label: 'IA cívica', href: '#ia' },
  ],
  Participar: [
    { label: 'Crear cuenta', href: '/auth/register' },
    { label: 'Ingresar', href: '/auth/login' },
    { label: 'Dirección de producto', href: '#roadmap' },
  ],
} as const

export function Footer() {
  return (
    <footer className="border-t border-border bg-bg pb-24">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-[1.4fr_0.8fr_0.8fr]">
          <div>
            <div className="mb-5 flex items-center gap-3">
              <svg viewBox="0 0 32 32" fill="none" className="h-8 w-8 flex-shrink-0">
                <polygon points="16,2 30,28 2,28" stroke="#C8A84B" strokeWidth="1.5" fill="none" />
                <polygon points="16,9 25,26 7,26" stroke="#C8A84B" strokeWidth="0.75" fill="none" opacity="0.4" />
              </svg>
              <div>
                <span className="block font-display text-sm font-700 uppercase tracking-widest text-primary">
                  VÉRTICE OS
                </span>
                <span className="font-mono text-[8px] uppercase tracking-[0.18em] text-tertiary">
                  Sistema operativo cívico
                </span>
              </div>
            </div>

            <p className="mb-6 max-w-lg font-mono text-[12px] leading-6 text-secondary">
              Una plataforma para convertir señales del territorio en participación organizada:
              reportar, proponer, entender, decidir y seguir resultados dentro de un mismo flujo.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 border border-border px-3 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-gold" />
                <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-tertiary">
                  Piloto de producto · Cartagena de Indias
                </span>
              </div>
              <a
                href="https://github.com/VladPhil92/Vertice-OS"
                className="flex h-8 w-8 items-center justify-center border border-border text-tertiary transition-colors hover:border-border-active hover:text-primary"
                aria-label="Repositorio de VÉRTICE OS en GitHub"
              >
                <Github size={14} />
              </a>
            </div>
          </div>

          {(Object.entries(FOOTER_LINKS) as [string, readonly { label: string; href: string }[]][]).map(
            ([category, links]) => (
              <div key={category}>
                <h4 className="mb-5 font-mono text-[10px] uppercase tracking-[0.3em] text-gold">
                  {category}
                </h4>
                <ul className="flex flex-col gap-3">
                  {links.map((link) => (
                    <li key={link.label}>
                      {link.href.startsWith('/') ? (
                        <Link
                          href={link.href}
                          className="font-mono text-[12px] text-secondary transition-colors duration-200 hover:text-primary"
                        >
                          {link.label}
                        </Link>
                      ) : (
                        <a
                          href={link.href}
                          className="font-mono text-[12px] text-secondary transition-colors duration-200 hover:text-primary"
                        >
                          {link.label}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ),
          )}
        </div>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <span className="font-mono text-[10px] text-tertiary">
            © {new Date().getFullYear()} CTG One Corporation · VÉRTICE OS
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-tertiary">
            Participación · Territorio · Gobernanza · Inteligencia cívica
          </span>
        </div>
      </div>
    </footer>
  )
}
