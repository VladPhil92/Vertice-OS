import type { Config } from 'tailwindcss'
import { colors, moduleColors } from '../../packages/design-tokens/src/index'

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
        bg: colors.background,
        surface: colors.surface,
        'surface-2': colors.surfaceAlt,
        border: colors.border,
        'border-active': colors.borderActive,
        gold: colors.citizen,
        'gold-dim': 'rgba(245,183,0,0.13)',
        citizen: colors.citizen,
        'citizen-dim': 'rgba(245,183,0,0.12)',
        azure: colors.azure,
        'azure-dim': 'rgba(74,144,226,0.10)',
        red: colors.red,
        'red-dim': 'rgba(215,38,56,0.10)',
        navy: colors.navy,
        'navy-light': colors.navyLight,
        emerald: colors.emerald,
        'emerald-dim': 'rgba(43,167,69,0.10)',
        primary: colors.textPrimary,
        secondary: colors.textSecondary,
        tertiary: colors.textTertiary,
        cyan: colors.cyan,
        'cyan-dim': 'rgba(23,140,140,0.10)',
        module: moduleColors,
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
