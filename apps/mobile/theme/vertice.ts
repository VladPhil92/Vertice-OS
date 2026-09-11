import { Platform } from 'react-native'

/**
 * VÉRTICE visual contract for native clients.
 *
 * These values mirror apps/web/app/globals.css and the canonical auth surfaces.
 * Screens must consume semantic tokens from this module instead of inventing
 * product colors locally.
 */
export const colors = {
  background: '#F7F9FC',
  surface: '#FFFFFF',
  surfaceAlt: '#F0F4F9',
  border: '#E1E7EF',
  borderActive: '#C5D0DF',
  inputBorder: '#D6DFEA',

  navy: '#0A2A66',
  navyLight: '#163F86',
  citizen: '#F5B700',
  citizenDark: '#D98B00',
  red: '#D72638',
  azure: '#4A90E2',
  emerald: '#2BA745',
  cyan: '#178C8C',

  textPrimary: '#0A2A66',
  textSecondary: '#4B5870',
  textTertiary: '#7B8799',
  textMuted: '#9AA6B5',
  placeholder: '#A5AFBD',
  white: '#FFFFFF',

  errorBackground: '#FCEBED',
  errorBorder: '#F2BDC3',
  errorText: '#A11D2A',

  mobility: '#4A90E2',
  water: '#178C8C',
  security: '#D72638',
  health: '#2BA745',
  education: '#F5B700',
  services: '#6D5CC7',
  culture: '#E47727',
  economy: '#0A2A66',
} as const

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  hero: 40,
} as const

export const radius = {
  sm: 10,
  md: 12,
  lg: 16,
  xl: 22,
  xxl: 24,
  pill: 999,
} as const

export const typography = {
  // Canon shared with web: Montserrat for display, Inter for body, DM Mono for
  // machine/readout text. Native currently resolves to platform-safe fallbacks
  // until the font binaries are bundled by the release pipeline; the semantic
  // roles and target families remain centralized here so screens never diverge.
  displayFamily: Platform.select({ ios: 'Avenir Next', android: 'sans-serif', default: 'sans-serif' }),
  bodyFamily: Platform.select({ ios: 'System', android: 'sans-serif', default: 'sans-serif' }),
  brandDisplayFamily: 'Montserrat',
  brandBodyFamily: 'Inter',
  brandMonoFamily: 'DM Mono',
  monoFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  roles: {
    hero: { fontSize: 34, lineHeight: 40, fontWeight: '800' as const, letterSpacing: -0.8 },
    title: { fontSize: 24, lineHeight: 30, fontWeight: '800' as const, letterSpacing: -0.45 },
    subtitle: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
    body: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const },
    label: { fontSize: 12, lineHeight: 17, fontWeight: '800' as const, letterSpacing: 0.8 },
    button: { fontSize: 15, lineHeight: 20, fontWeight: '800' as const },
    caption: { fontSize: 12, lineHeight: 18, fontWeight: '600' as const },
  },
} as const

/**
 * Iconography standard across web/mobile. Web already uses Lucide. Native
 * screens must use the same visual grammar when adding vector icons: outline,
 * round caps/joins, no filled emoji/pictograms, 24px grid, 2px default stroke.
 */
export const iconography = {
  family: 'Lucide',
  grid: 24,
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  sizes: { compact: 16, standard: 20, navigation: 22, feature: 24 },
} as const

export const imagery = {
  // These files are binary-identical to the canonical web brand assets.
  wordmark: require('../assets/brand/vertice-wordmark.webp'),
  symbol: require('../assets/brand/vertice-symbol.webp'),
  logo: require('../assets/brand/vertice-logo.png'),
} as const

export const elevation = {
  card: {
    shadowColor: colors.navy,
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 3,
  },
} as const

export const interaction = {
  minimumTouchTarget: 44,
  buttonHeight: 52,
  inputHeight: 52,
  pressedOpacity: 0.86,
  disabledOpacity: 0.52,
} as const

export const verticeTheme = {
  colors,
  spacing,
  radius,
  typography,
  iconography,
  imagery,
  elevation,
  interaction,
} as const
