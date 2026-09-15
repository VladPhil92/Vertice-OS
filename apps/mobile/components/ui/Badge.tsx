import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { colors, radius, spacing, typography } from '../../theme/vertice'

export type BadgeVariant = 'citizen' | 'cyan' | 'red' | 'default'

export interface BadgeProps {
  variant?: BadgeVariant
  children: ReactNode
}

const VARIANT: Record<BadgeVariant, { background: string; border: string; text: string }> = {
  citizen: { background: 'rgba(245,183,0,0.12)', border: 'rgba(245,183,0,0.4)', text: colors.citizenDark },
  cyan: { background: 'rgba(23,140,140,0.10)', border: 'rgba(23,140,140,0.4)', text: colors.cyan },
  red: { background: colors.errorBackground, border: colors.errorBorder, text: colors.errorText },
  default: { background: colors.surfaceAlt, border: colors.border, text: colors.textTertiary },
}

/** Canonical native badge. Mirrors packages/ui/src/Badge.tsx's variant contract. */
export function Badge({ variant = 'default', children }: BadgeProps) {
  const { background, border, text } = VARIANT[variant]

  return (
    <View style={[styles.base, { backgroundColor: background, borderColor: border }]}>
      <Text style={[styles.label, { color: text }]}>{children}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  label: {
    fontFamily: typography.monoMediumFamily,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
})
