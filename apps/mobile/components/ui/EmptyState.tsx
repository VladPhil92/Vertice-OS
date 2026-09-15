import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, interaction, spacing, typography } from '../../theme/vertice'

export interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: { label: string; onPress: () => void }
}

/**
 * Canonical native empty state. Mirrors packages/ui/src/EmptyState.tsx's
 * icon/title/description/action contract; `action` takes onPress instead of
 * href since native screens navigate imperatively (expo-router).
 */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}

      <Text style={styles.title}>{title}</Text>

      {description ? <Text style={styles.description}>{description}</Text> : null}

      {action ? (
        <Pressable
          accessibilityRole="button"
          onPress={action.onPress}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Text style={styles.actionLabel}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.hero,
    paddingHorizontal: spacing.xl,
  },
  icon: { alignItems: 'center', justifyContent: 'center' },
  title: {
    color: colors.textSecondary,
    fontFamily: typography.displaySemiboldFamily,
    ...typography.roles.subtitle,
    textAlign: 'center',
  },
  description: {
    color: colors.textTertiary,
    fontFamily: typography.bodyFamily,
    ...typography.roles.caption,
    textAlign: 'center',
    maxWidth: 320,
  },
  action: { marginTop: spacing.xs },
  actionLabel: {
    color: colors.citizenDark,
    fontFamily: typography.bodyExtraBoldFamily,
    ...typography.roles.label,
  },
  pressed: { opacity: interaction.pressedOpacity },
})
