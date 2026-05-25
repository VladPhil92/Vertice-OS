import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg:             '#050508',
        surface:        '#0c0c14',
        'surface-2':    '#121220',
        border:         'rgba(255,255,255,0.06)',
        'border-active':'rgba(255,255,255,0.15)',
        // ── Sistema Cromático Institucional (Sistema 1) ──────────────────────
        gold:           '#C8A84B',           // Oro institucional VÉRTICE
        'gold-dim':     'rgba(200,168,75,0.15)',
        citizen:        '#FFB522',           // Amarillo Ciudadano — ACTIVA
        'citizen-dim':  'rgba(255,181,34,0.12)',
        azure:          '#1A7FBF',           // Azul Claro institucional
        'azure-dim':    'rgba(26,127,191,0.12)',
        red:            '#C0392B',           // Rojo Acción — MOVILIZA
        'red-dim':      'rgba(192,57,43,0.12)',
        navy:           '#1A2744',           // Azul Institucional oscuro
        'navy-light':   '#253565',
        emerald:        '#27AE60',           // Tendencia positiva / Salud
        'emerald-dim':  'rgba(39,174,96,0.12)',
        primary:        '#F0EDE8',
        secondary:      'rgba(240,237,232,0.45)',
        tertiary:       'rgba(240,237,232,0.22)',
        cyan:           '#4ECDC4',           // Agua / Transparencia
        'cyan-dim':     'rgba(78,205,196,0.12)',
        // ── Colores de módulos territoriales (Sistema 2) ─────────────────────
        module: {
          mobility:     '#1A7FBF',
          water:        '#4ECDC4',
          security:     '#C0392B',
          health:       '#27AE60',
          education:    '#FFB522',
          services:     '#8E44AD',
          culture:      '#E67E22',
          economy:      '#1A2744',
        },
      },
      fontFamily: {
        display: ['var(--font-syne)', 'sans-serif'],
        mono: ['var(--font-dm-mono)', 'monospace'],
        serif: ['var(--font-fraunces)', 'serif'],
      },
      fontSize: {
        tag:   ['10px', { letterSpacing: '0.3em'  }],
        label: ['11px', { letterSpacing: '0.15em' }],
        micro: ['9px',  { letterSpacing: '0.2em'  }],
      },
      animation: {
        'fade-up':   'fadeUp 0.8s ease forwards',
        'slow-pulse':'slowPulse 8s ease-in-out infinite',
        blink:       'blink 2s ease-in-out infinite',
        'scan-line': 'scanLine 3s linear infinite',
        'gauge-fill':'gaugeFill 1.2s ease forwards',
        'count-up':  'countUp 0.6s ease forwards',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        slowPulse: {
          '0%, 100%': { opacity: '0.08', transform: 'scale(1)' },
          '50%':      { opacity: '0.15', transform: 'scale(1.03)' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.3' },
        },
        scanLine: {
          '0%':   { top: '0' },
          '100%': { top: '100%' },
        },
        gaugeFill: {
          from: { strokeDashoffset: '251.2' },
        },
        countUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
      backgroundImage: {
        'grid-pattern': `
          linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)
        `,
      },
      backgroundSize: {
        grid: '60px 60px',
      },
    },
  },
  plugins: [],
};

export default config;
