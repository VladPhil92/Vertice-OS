import Link from 'next/link'
import { Github, MapPin, ShieldCheck, Users } from 'lucide-react'
import { BrandLogo } from '@/components/ui/BrandLogo'

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
    <footer className="mt-8 bg-[#0A2A66] pb-16 text-white">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-[1.4fr_0.8fr_0.8fr]">
          <div>
            <div className="mb-6 inline-flex rounded-2xl bg-white px-4 py-3 shadow-sm">
              <BrandLogo compact />
            </div>

            <p className="mb-7 max-w-lg text-sm leading-7 text-white/74">
              VÉRTICE es inteligencia ciudadana aplicada al territorio: informa, conecta, organiza,
              facilita la participación y hace visible el seguimiento a lo público.
            </p>

            <div className="flex flex-wrap gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-2 text-[11px] font-semibold text-white/75">
                <MapPin size={14} className="text-[#F5B700]" />
                Cartagena de Indias · piloto
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-2 text-[11px] font-semibold text-white/75">
                <Users size={14} className="text-[#F5B700]" />
                La ciudadanía al centro
              </div>
              <a
                href="https://github.com/VladPhil92/Vertice-OS"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/70 transition hover:border-[#F5B700] hover:text-[#F5B700]"
                aria-label="Repositorio de VÉRTICE en GitHub"
              >
                <Github size={15} />
              </a>
            </div>
          </div>

          {(Object.entries(FOOTER_LINKS) as [string, readonly { label: string; href: string }[]][]).map(
            ([category, links]) => (
              <div key={category}>
                <h4 className="mb-5 text-xs font-extrabold uppercase tracking-[0.16em] text-[#F5B700]">
                  {category}
                </h4>
                <ul className="flex flex-col gap-3">
                  {links.map((link) => (
                    <li key={link.label}>
                      {link.href.startsWith('/') ? (
                        <Link href={link.href} className="text-sm text-white/70 transition hover:text-white">
                          {link.label}
                        </Link>
                      ) : (
                        <a href={link.href} className="text-sm text-white/70 transition hover:text-white">
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

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <span className="text-[11px] text-white/55">
            © {new Date().getFullYear()} VÉRTICE · Inteligencia ciudadana
          </span>
          <span className="flex items-center gap-2 text-[11px] font-semibold text-white/65">
            <ShieldCheck size={14} className="text-[#F5B700]" />
            Diferentes en cada región, unidos en un solo país.
          </span>
        </div>
      </div>
    </footer>
  )
}
