'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
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
    <header className={`fixed left-0 right-0 top-0 z-50 transition-all duration-300 ${
      scrolled ? 'border-b border-border bg-white/95 shadow-civic-sm backdrop-blur-xl' : 'bg-white/90 backdrop-blur-md'
    }`}>
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 md:px-6">
        <Link href="/" className="flex items-center gap-3" aria-label="VÉRTICE">
          <Image
            src="/vertice-logo-official.webp"
            alt="VÉRTICE — Diferentes en cada región, unidos en un solo país"
            width={120}
            height={138}
            className="h-14 w-auto object-contain object-left"
            priority
          />
          <div className="hidden border-l border-border pl-3 sm:block">
            <span className="block text-[10px] font-700 uppercase tracking-[0.18em] text-primary">Inteligencia ciudadana</span>
            <span className="mt-1 block text-[8px] uppercase tracking-[0.12em] text-tertiary">Cartagena · Colombia</span>
          </div>
        </Link>

        <ul className="hidden items-center gap-6 lg:flex xl:gap-8">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a href={link.href} className="text-[10px] font-700 uppercase tracking-[0.12em] text-secondary transition-colors hover:text-primary">
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-3 md:flex">
          <Link href="/auth/login" className="btn-ghost !px-5">Ingresar</Link>
          <Link href="/auth/register" className="btn-primary !bg-[#F5B700] !text-[#0A2A66] !px-5">Participar</Link>
        </div>

        <button className="text-primary md:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menú" aria-expanded={menuOpen}>
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      <div className="h-1 w-full bg-[linear-gradient(90deg,#F5B700_0_33%,#0A2A66_33%_66%,#D72638_66%)]" />

      <AnimatePresence>
        {menuOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="border-b border-border bg-white md:hidden">
            <div className="flex flex-col gap-5 px-6 py-7">
              {NAV_LINKS.map((link) => (
                <a key={link.href} href={link.href} className="text-[11px] font-700 uppercase tracking-[0.12em] text-secondary"
                  onClick={() => setMenuOpen(false)}>{link.label}</a>
              ))}
              <div className="flex flex-col gap-3 border-t border-border pt-5">
                <Link href="/auth/login" className="btn-ghost" onClick={() => setMenuOpen(false)}>Ingresar</Link>
                <Link href="/auth/register" className="btn-primary !bg-[#F5B700] !text-[#0A2A66]" onClick={() => setMenuOpen(false)}>Participar</Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
