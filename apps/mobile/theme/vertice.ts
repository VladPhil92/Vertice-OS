import { Platform } from 'react-native'

import {
  colors as canonicalColors,
  iconography,
  interaction,
  moduleColors,
  radius,
  shadows,
  spacing,
  typography as canonicalTypography,
} from '../../../packages/design-tokens/src/index'

/**
 * Native adapter for the canonical VÉRTICE product language.
 *
 * Brand values live in packages/design-tokens. Native-only concerns such as
 * platform font fallback, bundled imagery and React Native elevation stay here.
 */
export const colors = {
  ...canonicalColors,
  ...moduleColors,
} as const

export const typography = {
  // Target families are shared with web. Until the native font binaries are
  // bundled, platform-safe fallbacks preserve layout without silently changing
  // the brand contract.
  displayFamily: Platform.select({ ios: 'Avenir Next', android: 'sans-serif', default: 'sans-serif' }),
  bodyFamily: Platform.select({ ios: 'System', android: 'sans-serif', default: 'sans-serif' }),
  brandDisplayFamily: canonicalTypography.display,
  brandBodyFamily: canonicalTypography.body,
  brandMonoFamily: canonicalTypography.mono,
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

export const imagery = {
  // Binary-identical copies of the canonical web brand assets.
  wordmark: require('../assets/brand/vertice-wordmark.webp'),
  symbol: require('../assets/brand/vertice-symbol.webp'),
  logo: require('../assets/brand/vertice-logo.png'),
} as const

export const elevation = {
  card: shadows.card,
} as const

export { iconography, interaction, radius, spacing }

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
