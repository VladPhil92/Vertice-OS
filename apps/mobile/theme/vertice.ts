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
import { nativeFontFamilies } from './fonts'

/**
 * Native adapter for the canonical VÉRTICE product language.
 *
 * Brand values live in packages/design-tokens. Native-only concerns such as
 * concrete bundled font aliases, packaged imagery and React Native elevation
 * stay here.
 */
export const colors = {
  ...canonicalColors,
  ...moduleColors,
} as const

export const typography = {
  // Runtime-certified native aliases. Each exported family points to a real
  // bundled font binary. Screens select the appropriate alias while roles own
  // sizing/weight semantics, avoiding duplicate React Native style keys.
  displayFamily: nativeFontFamilies.displayExtraBold,
  displayRegularFamily: nativeFontFamilies.displayRegular,
  displaySemiboldFamily: nativeFontFamilies.displaySemibold,
  displayBoldFamily: nativeFontFamilies.displayBold,
  displayExtraBoldFamily: nativeFontFamilies.displayExtraBold,
  bodyFamily: nativeFontFamilies.bodyRegular,
  bodyMediumFamily: nativeFontFamilies.bodyMedium,
  bodySemiboldFamily: nativeFontFamilies.bodySemibold,
  bodyBoldFamily: nativeFontFamilies.bodyBold,
  bodyExtraBoldFamily: nativeFontFamilies.bodyExtraBold,
  monoFamily: nativeFontFamilies.monoRegular,
  monoMediumFamily: nativeFontFamilies.monoMedium,
  brandDisplayFamily: canonicalTypography.display,
  brandBodyFamily: canonicalTypography.body,
  brandMonoFamily: canonicalTypography.mono,
  roles: {
    hero: { fontSize: 34, lineHeight: 40, fontWeight: '800' as const, letterSpacing: -0.8 },
    title: { fontSize: 24, lineHeight: 30, fontWeight: '800' as const, letterSpacing: -0.45 },
    subtitle: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
    body: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const },
    label: { fontSize: 12, lineHeight: 17, fontWeight: '800' as const, letterSpacing: 0.8 },
    button: { fontSize: 15, lineHeight: 20, fontWeight: '800' as const },
    caption: { fontSize: 12, lineHeight: 18, fontWeight: '600' as const },
    mono: { fontSize: 12, lineHeight: 18, fontWeight: '400' as const },
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
