import { brand, colors, iconography, moduleColors, radius, shadows, spacing, typography } from '@vertice/design-tokens'

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
