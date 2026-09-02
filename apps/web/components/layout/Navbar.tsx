'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import Link from 'next/link'
import { BrandLogo } from '@/components/ui/BrandLogo'

const NAV_LINKS = [
  { label: 'Propósito', href: '#proposito' },
  { label: 'Cómo funciona', href: '#como-funciona' },
  { label: 'Qué puedes hacer', href: '#capacidades' },
  { label: 'IA cívica', href: '#ia' },
  { label: 'Visión', href: '#vision' },
] as const

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b transition-all duration-300 ${
        scrolled
          ? 'border-[#E1E7EF] bg-white/95 shadow-[0_8px_30px_rgba(10,42,102,0.07)] backdrop-blur-xl'
          : 'border-transparent bg-white/92 backdrop-blur-md'
      }`}
    >
      <nav className="mx-auto flex min-h-[78px] max-w-7xl items-center justify-between gap-6 px-5 sm:px-6">
        <Link href="/" className="shrink-0" aria-label="VÉRTICE — inicio">
          <BrandLogo compact priority className="origin-left scale-[0.9] sm:scale-100" />
        </Link>

        <ul className="hidden items-center gap-6 lg:flex xl:gap-8">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="text-[12px] font-bold text-[#43506A] transition-colors hover:text-[#0A2A66]"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden shrink-0 items-center gap-3 md:flex">
          <Link href="/auth/login" className="btn-ghost !min-h-10 !px-5 !py-2 text-[11px]">
            Ingresar
          </Link>
          <Link href="/auth/register" className="btn-citizen !min-h-10 !px-5 !py-2 text-[11px]">
            Crear cuenta
          </Link>
        </div>

        <button
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#DCE5EF] bg-white text-[#0A2A66] shadow-sm md:hidden"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label="Menú"
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-[#E1E7EF] bg-white md:hidden"
          >
            <div className="flex flex-col gap-4 px-6 py-6">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm font-bold text-[#43506A] hover:text-[#0A2A66]"
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <div className="grid gap-3 border-t border-[#E1E7EF] pt-5">
                <Link href="/auth/login" className="btn-ghost text-center" onClick={() => setMenuOpen(false)}>
                  Ingresar
                </Link>
                <Link href="/auth/register" className="btn-citizen text-center" onClick={() => setMenuOpen(false)}>
                  Crear cuenta
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
