import { brand, colors, iconography, moduleColors, radius, shadows, spacing, typography } from '../../packages/design-tokens/src/index'

export const theme = {
  brand,
  colors,
  moduleColors,
  typography,
  spacing,
  radius,
  shadows,
  iconography,
} as const

export type VerticeTheme = typeof theme
