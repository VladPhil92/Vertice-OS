import type { Metadata, Viewport } from 'next'
import { DM_Mono, Fraunces, Syne } from 'next/font/google'
import './globals.css'

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  weight: ['400', '600', '700', '800'],
})

const dmMono = DM_Mono({
  subsets: ['latin'],
  variable: '--font-dm-mono',
  weight: ['300', '400', '500'],
})

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  weight: ['300'],
  style: ['normal', 'italic'],
})

export const metadata: Metadata = {
  title: {
    default: 'VÉRTICE OS — Sistema Operativo Cívico',
    template: '%s | VÉRTICE OS',
  },
  description:
    'Plataforma cívica para reportar asuntos del territorio, crear propuestas, deliberar, participar en decisiones y seguir resultados desde una sola experiencia.',
  keywords: [
    'participación ciudadana',
    'Cartagena',
    'Colombia',
    'civic tech',
    'gobernanza',
    'reportes ciudadanos',
    'propuestas ciudadanas',
  ],
  authors: [{ name: 'CTG One Corporation' }],
  robots: 'index, follow',
  manifest: '/manifest.json',
  icons: {
    apple: '/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'VÉRTICE OS',
  },
  openGraph: {
    type: 'website',
    locale: 'es_CO',
    siteName: 'VÉRTICE OS',
    title: 'VÉRTICE OS — Participación cívica con trazabilidad',
    description:
      'De una señal del barrio a una acción organizada: reporta, propone, entiende, decide y sigue resultados.',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#C8A84B',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="es"
      className={`${syne.variable} ${dmMono.variable} ${fraunces.variable}`}
    >
      <body className="bg-bg text-primary antialiased">{children}</body>
    </html>
  )
}
