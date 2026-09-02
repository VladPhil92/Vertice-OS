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
        bg: '#FFFFFF', surface: '#FFFFFF', 'surface-2': '#F5F7FA', border: '#E9EDF3', 'border-active': '#C9D3E1',
        gold: '#F5B700', 'gold-dim': 'rgba(245,183,0,0.12)', citizen: '#F5B700', 'citizen-dim': 'rgba(245,183,0,0.12)',
        azure: '#4A90E2', 'azure-dim': 'rgba(74,144,226,0.10)', red: '#D72638', 'red-dim': 'rgba(215,38,56,0.10)',
        navy: '#0A2A66', 'navy-light': '#16458D', emerald: '#2BA745', 'emerald-dim': 'rgba(43,167,69,0.10)',
        primary: '#0A2A66', secondary: '#4B5B73', tertiary: '#7D899A', cyan: '#4A90E2', 'cyan-dim': 'rgba(74,144,226,0.10)',
        module: { mobility: '#4A90E2', water: '#169C9C', security: '#D72638', health: '#2BA745', education: '#F5B700', services: '#6F4CC3', culture: '#D67B1D', economy: '#0A2A66' },
      },
      fontFamily: { display: ['var(--font-syne)', 'sans-serif'], mono: ['var(--font-dm-mono)', 'monospace'], serif: ['var(--font-fraunces)', 'serif'] },
      fontSize: { tag: ['10px', { letterSpacing: '0.3em' }], label: ['11px', { letterSpacing: '0.15em' }], micro: ['9px', { letterSpacing: '0.2em' }] },
      boxShadow: { civic: '0 18px 50px rgba(10,42,102,0.08)', 'civic-sm': '0 8px 26px rgba(10,42,102,0.07)' },
      animation: { 'fade-up': 'fadeUp 0.8s ease forwards', 'slow-pulse': 'slowPulse 8s ease-in-out infinite', blink: 'blink 2s ease-in-out infinite' },
      keyframes: {
        fadeUp: { from: { opacity: '0', transform: 'translateY(20px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slowPulse: { '0%, 100%': { opacity: '0.08', transform: 'scale(1)' }, '50%': { opacity: '0.15', transform: 'scale(1.03)' } },
        blink: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.3' } },
      },
      fontWeight: { '300': '300', '400': '400', '500': '500', '600': '600', '700': '700', '800': '800' },
    },
  },
  plugins: [],
};

export default config;
