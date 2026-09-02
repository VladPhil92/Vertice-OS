import Link from 'next/link'
import { Github, MapPin, ShieldCheck, Users } from 'lucide-react'
import { BrandLogo } from '@/components/ui/BrandLogo'

const FOOTER_LINKS = {
  Plataforma: [
    { label: 'Propósito', href: '#proposito' },
    { label: 'Cómo funciona', href: '#como-funciona' },
    { label: 'Qué puedes hacer', href: '#capacidades' },
    { label: 'IA cívica', href: '#ia' },
  ],
  Participa: [
    { label: 'Crear cuenta', href: '/auth/register' },
    { label: 'Ingresar', href: '/auth/login' },
    { label: 'Visión', href: '#vision' },
  ],
} as const

export function Footer() {
  return (
    <footer className="overflow-hidden bg-[#0A2A66] text-white">
      <div className="grid h-1.5 grid-cols-3">
        <span className="bg-[#F5B700]" />
        <span className="bg-[#4A90E2]" />
        <span className="bg-[#D72638]" />
      </div>

      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.4fr_0.8fr_0.8fr]">
          <div>
            <div className="mb-5 inline-flex rounded-2xl bg-white px-4 py-3 shadow-sm">
              <BrandLogo compact />
            </div>

            <p className="mb-6 max-w-lg text-sm leading-7 text-white/[.74]">
              VÉRTICE organiza información territorial, participación y seguimiento dentro de una experiencia
              digital común para ciudadanos y comunidades.
            </p>

            <div className="flex flex-wrap gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-2 text-[11px] font-semibold text-white/75">
                <MapPin size={14} className="text-[#F5B700]" />
                Cartagena de Indias · piloto
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-2 text-[11px] font-semibold text-white/75">
                <Users size={14} className="text-[#F5B700]" />
                Ciudadanía al centro
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
                <ul className="flex list-none flex-col gap-3 p-0">
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
