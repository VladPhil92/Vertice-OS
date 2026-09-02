'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import Link from 'next/link'

const NAV_LINKS = [
  { label: 'Propósito', href: '#proposito' },
  { label: 'Cómo funciona', href: '#como-funciona' },
  { label: 'Qué puedes hacer', href: '#capacidades' },
  { label: 'IA cívica', href: '#ia' },
  { label: 'Visión', href: '#roadmap' },
] as const

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`fixed left-0 right-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? 'border-b border-border bg-bg/92 backdrop-blur-xl' : 'bg-bg/40 backdrop-blur-sm'
      }`}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="group flex items-center gap-3">
          <div className="relative h-8 w-8">
            <svg viewBox="0 0 32 32" fill="none" className="h-full w-full">
              <polygon
                points="16,2 30,28 2,28"
                stroke="#C8A84B"
                strokeWidth="1.5"
                fill="none"
                className="transition-all duration-300 group-hover:fill-gold/10"
              />
              <polygon
                points="16,9 25,26 7,26"
                stroke="#C8A84B"
                strokeWidth="0.75"
                fill="none"
                opacity="0.4"
              />
            </svg>
          </div>
          <div>
            <span className="block font-display text-sm font-700 uppercase tracking-widest text-primary">
              VÉRTICE OS
            </span>
            <span className="hidden font-mono text-[8px] uppercase tracking-[0.18em] text-tertiary sm:block">
              Infraestructura cívica
            </span>
          </div>
        </Link>

        <ul className="hidden items-center gap-6 lg:flex xl:gap-8">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="font-mono text-[10px] uppercase tracking-[0.14em] text-secondary transition-colors duration-200 hover:text-primary"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-3 md:flex">
          <Link href="/auth/login" className="btn-ghost !px-5 text-[10px]">
            Ingresar
          </Link>
          <Link href="/auth/register" className="btn-primary !px-5 text-[10px]">
            Crear cuenta
          </Link>
        </div>

        <button
          className="text-secondary transition-colors hover:text-primary md:hidden"
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
            className="border-t border-border bg-surface md:hidden"
          >
            <div className="flex flex-col gap-5 px-6 py-7">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="font-mono text-[11px] uppercase tracking-[0.15em] text-secondary hover:text-primary"
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <div className="flex flex-col gap-3 border-t border-border pt-5">
                <Link href="/auth/login" className="btn-ghost text-center" onClick={() => setMenuOpen(false)}>
                  Ingresar
                </Link>
                <Link href="/auth/register" className="btn-primary text-center" onClick={() => setMenuOpen(false)}>
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
