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

const canonicalOrigin = new URL('https://vertice.ctgone.com')

export const metadata: Metadata = {
  metadataBase: canonicalOrigin,
  title: {
    default: 'VÉRTICE — Red Cívica de Gestión',
    template: '%s | VÉRTICE',
  },
  description:
    'Red cívica para convertir gestión social y comunitaria en acciones, evidencia, resultados y reputación verificable.',
  keywords: [
    'gestión comunitaria',
    'liderazgo social',
    'Cartagena',
    'Colombia',
    'reputación cívica',
    'evidencia verificable',
    'participación ciudadana',
    'control público',
    'iniciativas ciudadanas',
    'impacto comunitario',
  ],
  authors: [{ name: 'VÉRTICE' }, { name: 'CTG One' }],
  alternates: {
    canonical: '/',
  },
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
    url: '/',
    locale: 'es_CO',
    siteName: 'VÉRTICE',
    title: 'VÉRTICE — Red Cívica de Gestión',
    description:
      'Lo que haces pesa más que lo que publicas: gestión, evidencia, resultados y reputación cívica en un mismo lugar.',
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
