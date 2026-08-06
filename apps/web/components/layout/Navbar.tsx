'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import Link from 'next/link'

const NAV_LINKS = [
  { label: 'Plataforma', href: '#modulos' },
  { label: 'Inteligencia IA', href: '#ia' },
  { label: 'Hoja de Ruta', href: '#roadmap' },
  { label: 'Documentación', href: '/docs' },
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
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'border-b border-border bg-bg/90 backdrop-blur-md' : ''
      }`}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
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
          <span className="font-display text-sm font-700 tracking-widest text-primary uppercase">
            VÉRTICE OS
          </span>
        </Link>

        {/* Desktop links */}
        <ul className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="font-mono text-[11px] uppercase tracking-[0.15em] text-secondary transition-colors duration-200 hover:text-primary"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link href="/auth/login" className="btn-ghost text-[11px]">
            Ingresar
          </Link>
          <Link href="/auth/register" className="btn-primary text-[11px]">
            Registrarme
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden text-secondary hover:text-primary transition-colors"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Menú"
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {/* Mobile drawer */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-border bg-surface"
          >
            <div className="flex flex-col gap-6 px-6 py-8">
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
              <div className="flex flex-col gap-3 pt-4 border-t border-border">
                <Link href="/auth/login" className="btn-ghost text-center">
                  Ingresar
                </Link>
                <Link href="/auth/register" className="btn-primary text-center">
                  Registrarme
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
