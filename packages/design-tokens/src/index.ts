export const colors = {
  background: '#F7F9FC',
  surface: '#FFFFFF',
  surfaceAlt: '#F0F4F9',
  border: '#E1E7EF',
  borderActive: '#C5D0DF',
  navy: '#0A2A66',
  navyLight: '#163F86',
  citizen: '#F5B700',
  red: '#D72638',
  azure: '#4A90E2',
  emerald: '#2BA745',
  cyan: '#178C8C',
  textPrimary: '#0A2A66',
  textSecondary: '#4B5870',
  textTertiary: '#7B8799',
  white: '#FFFFFF',
  black: '#111827',
} as const

export const moduleColors = {
  mobility: '#4A90E2',
  water: '#178C8C',
  security: '#D72638',
  health: '#2BA745',
  education: '#F5B700',
  services: '#6D5CC7',
  culture: '#E47727',
  economy: '#0A2A66',
} as const

export const typography = {
  display: 'Montserrat',
  body: 'Inter',
  mono: 'DM Mono',
  serif: 'Fraunces',
  weights: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const

export const radius = {
  sm: 10,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const

export const shadows = {
  soft: {
    shadowColor: '#0A2A66',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
} as const

export const iconography = {
  family: 'Lucide',
  strokeWidth: 2,
  sizes: { sm: 16, md: 20, lg: 24, xl: 28 },
  guidance: 'Outlined, rounded, consistent 2px stroke. Avoid filled emoji-style icons for primary navigation.',
} as const

export const brand = {
  name: 'VÉRTICE',
  tagline: 'Red Cívica de Gestión',
  accentGradient: ['#F5B700', '#0A2A66', '#D72638'],
} as const

export type VerticeColors = typeof colors
