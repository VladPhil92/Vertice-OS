'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUpRight, Menu, X } from 'lucide-react'
import Link from 'next/link'
import { BrandLogo } from '@/components/ui/BrandLogo'

const NAV_LINKS = [
  { label: 'Propósito', href: '#proposito' },
  { label: 'Cómo funciona', href: '#como-funciona' },
  { label: 'Qué puedes hacer', href: '#capacidades' },
  { label: 'IA cívica', href: '#ia' },
  { label: 'Visión', href: '#roadmap' },
] as const

const CTG_ONE_URL = 'https://ctgone.com'

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 18)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`fixed left-0 right-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'border-b border-[#e1e7ef] bg-white/95 shadow-[0_8px_30px_rgba(10,42,102,0.06)] backdrop-blur-xl'
          : 'bg-white/88 backdrop-blur-md'
      }`}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
        <Link href="/" className="flex items-center" aria-label="VÉRTICE — inicio">
          <BrandLogo compact className="origin-left scale-[0.92] sm:scale-100" />
        </Link>

        <ul className="hidden items-center gap-6 lg:flex xl:gap-8">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="text-[12px] font-semibold text-[#4b5870] transition-colors duration-200 hover:text-[#0a2a66]"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-3 md:flex">
          <a
            href={CTG_ONE_URL}
            className="inline-flex min-h-10 items-center gap-1.5 px-2 text-[11px] font-semibold text-[#607087] transition-colors hover:text-[#0a2a66]"
          >
            CTG One
            <ArrowUpRight size={13} aria-hidden="true" />
          </a>
          <Link href="/auth/login" className="btn-ghost !min-h-10 !px-4 !py-2 text-[11px]">
            Iniciar sesión
          </Link>
          <Link href="/auth/register" className="btn-citizen !min-h-10 !px-4 !py-2 text-[11px]">
            Entrar a la plataforma
          </Link>
        </div>

        <button
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#e1e7ef] bg-white text-[#0a2a66] md:hidden"
          onClick={() => setMenuOpen(!menuOpen)}
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
            className="border-t border-[#e1e7ef] bg-white md:hidden"
          >
            <div className="flex flex-col gap-4 px-6 py-6">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm font-semibold text-[#4b5870] hover:text-[#0a2a66]"
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <a
                href={CTG_ONE_URL}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#4b5870] hover:text-[#0a2a66]"
                onClick={() => setMenuOpen(false)}
              >
                CTG One
                <ArrowUpRight size={14} aria-hidden="true" />
              </a>
              <div className="grid gap-3 border-t border-[#e1e7ef] pt-5">
                <Link href="/auth/login" className="btn-ghost text-center" onClick={() => setMenuOpen(false)}>
                  Iniciar sesión
                </Link>
                <Link href="/auth/register" className="btn-citizen text-center" onClick={() => setMenuOpen(false)}>
                  Entrar a la plataforma
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
