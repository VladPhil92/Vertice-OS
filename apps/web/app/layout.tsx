import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { Syne, DM_Mono, Fraunces } from 'next/font/google';
import './globals.css';

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  weight: ['400', '600', '700', '800'],
});

const dmMono = DM_Mono({
  subsets: ['latin'],
  variable: '--font-dm-mono',
  weight: ['300', '400', '500'],
});

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  weight: ['300'],
  style: ['normal', 'italic'],
  axes: ['opsz'],
});

export const metadata: Metadata = {
  title: {
    default: 'VÉRTICE OS — Sistema Operativo Cívico',
    template: '%s | VÉRTICE OS',
  },
  description:
    'Infraestructura cívica de próxima generación para Cartagena de Indias y Colombia. Participación continua, gobernanza transparente, inteligencia territorial.',
  keywords: [
    'democracia',
    'participación ciudadana',
    'Cartagena',
    'Colombia',
    'civic tech',
    'gobernanza',
  ],
  authors: [{ name: 'CTG One Corporation' }],
  robots: 'index, follow',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'VÉRTICE OS',
  },
  openGraph: {
    type: 'website',
    locale: 'es_CO',
    siteName: 'VÉRTICE OS',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#C8A84B',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Nonce generated per-request by middleware.ts — Next.js uses html[nonce] to
  // stamp all its own generated <script> tags, enabling the nonce-based CSP
  const nonce = headers().get('x-nonce') ?? ''

  return (
    <html
      lang="es"
      nonce={nonce}
      className={`${syne.variable} ${dmMono.variable} ${fraunces.variable}`}
    >
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="bg-bg text-primary antialiased">{children}</body>
    </html>
  );
}
