import type { Config } from 'tailwindcss'

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
        bg: '#F7F9FC',
        surface: '#FFFFFF',
        'surface-2': '#F0F4F9',
        border: '#E1E7EF',
        'border-active': '#C5D0DF',
        gold: '#F5B700',
        'gold-dim': 'rgba(245,183,0,0.13)',
        citizen: '#F5B700',
        'citizen-dim': 'rgba(245,183,0,0.12)',
        azure: '#4A90E2',
        'azure-dim': 'rgba(74,144,226,0.10)',
        red: '#D72638',
        'red-dim': 'rgba(215,38,56,0.10)',
        navy: '#0A2A66',
        'navy-light': '#163F86',
        emerald: '#2BA745',
        'emerald-dim': 'rgba(43,167,69,0.10)',
        primary: '#0A2A66',
        secondary: '#4B5870',
        tertiary: '#7B8799',
        cyan: '#178C8C',
        'cyan-dim': 'rgba(23,140,140,0.10)',
        module: {
          mobility: '#4A90E2',
          water: '#178C8C',
          security: '#D72638',
          health: '#2BA745',
          education: '#F5B700',
          services: '#6D5CC7',
          culture: '#E47727',
          economy: '#0A2A66',
        },
      },
      fontFamily: {
        display: ['var(--font-montserrat)', 'sans-serif'],
        body: ['var(--font-inter)', 'sans-serif'],
        mono: ['var(--font-dm-mono)', 'monospace'],
        serif: ['var(--font-fraunces)', 'serif'],
      },
      fontSize: {
        tag: ['10px', { letterSpacing: '0.3em' }],
        label: ['11px', { letterSpacing: '0.15em' }],
        micro: ['9px', { letterSpacing: '0.2em' }],
      },
      animation: {
        'fade-up': 'fadeUp 0.8s ease forwards',
        'slow-pulse': 'slowPulse 8s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slowPulse: {
          '0%, 100%': { opacity: '0.08', transform: 'scale(1)' },
          '50%': { opacity: '0.15', transform: 'scale(1.03)' },
        },
      },
      fontWeight: {
        '300': '300',
        '400': '400',
        '500': '500',
        '600': '600',
        '700': '700',
        '800': '800',
      },
    },
  },
  plugins: [],
}

export default config
