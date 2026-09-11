import { colors, moduleColors, radius, spacing, typography } from './index'

export function cssVariables(): Record<string, string> {
  return {
    '--color-bg': colors.background,
    '--color-surface': colors.surface,
    '--color-surface-2': colors.surfaceAlt,
    '--color-border': colors.border,
    '--color-border-active': colors.borderActive,
    '--color-navy': colors.navy,
    '--color-navy-light': colors.navyLight,
    '--color-citizen': colors.citizen,
    '--color-red': colors.red,
    '--color-azure': colors.azure,
    '--color-emerald': colors.emerald,
    '--color-cyan': colors.cyan,
    '--color-text-primary': colors.textPrimary,
    '--color-text-secondary': colors.textSecondary,
    '--color-text-tertiary': colors.textTertiary,
    '--mod-mobility': moduleColors.mobility,
    '--mod-water': moduleColors.water,
    '--mod-security': moduleColors.security,
    '--mod-health': moduleColors.health,
    '--mod-education': moduleColors.education,
    '--mod-services': moduleColors.services,
    '--mod-culture': moduleColors.culture,
    '--mod-economy': moduleColors.economy,
    '--radius-md': `${radius.md}px`,
    '--space-lg': `${spacing.lg}px`,
    '--font-display-name': typography.display,
    '--font-body-name': typography.body,
  }
}
