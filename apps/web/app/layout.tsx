import type { Metadata, Viewport } from 'next'
import { DM_Mono, Fraunces, Inter, Montserrat } from 'next/font/google'
import './globals.css'

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  weight: ['500', '600', '700', '800'],
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['400', '500', '600', '700'],
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
    default: 'VÉRTICE — Inteligencia Ciudadana',
    template: '%s | VÉRTICE',
  },
  description:
    'Plataforma ciudadana para informar, conectar, participar, vigilar y transformar el territorio con datos, deliberación y seguimiento.',
  keywords: [
    'participación ciudadana',
    'Cartagena',
    'Colombia',
    'inteligencia ciudadana',
    'control público',
    'gobernanza',
    'reportes ciudadanos',
    'propuestas ciudadanas',
  ],
  authors: [{ name: 'VÉRTICE' }],
  robots: 'index, follow',
  manifest: '/manifest.json',
  icons: {
    apple: '/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'VÉRTICE',
  },
  openGraph: {
    type: 'website',
    locale: 'es_CO',
    siteName: 'VÉRTICE',
    title: 'VÉRTICE — Inteligencia Ciudadana',
    description:
      'La ciudadanía es el vértice del cambio: reporta, propone, participa, vigila y sigue resultados.',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0A2A66',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="es"
      className={`${montserrat.variable} ${inter.variable} ${dmMono.variable} ${fraunces.variable}`}
    >
      <body className="bg-bg text-primary antialiased">{children}</body>
    </html>
  )
}
