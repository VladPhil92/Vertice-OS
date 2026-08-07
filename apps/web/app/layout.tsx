import type { Metadata, Viewport } from 'next';
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

// `axes` no puede combinarse con `weight` en next/font — se fija el peso 300
// del sistema de diseño y se omite el eje de optical sizing.
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  weight: ['300'],
  style: ['normal', 'italic'],
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
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#C8A84B',
};

// La CSP la fija middleware.ts. Ya no usa nonce: era incompatible con la
// generación estática de estas páginas (un nonce es por-request; el HTML
// estático se genera en build) y dejaba el sitio sin ejecutar JavaScript.
// Ver el comentario extenso en middleware.ts. Aquí no debe leerse headers():
// eso vuelve dinámico todo el árbol y rompe la generación estática.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      className={`${syne.variable} ${dmMono.variable} ${fraunces.variable}`}
    >
      <body className="bg-bg text-primary antialiased">{children}</body>
    </html>
  );
}
