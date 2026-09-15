import type { ComponentProps } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'

import { VerticeIcon, type VerticeIconName } from '../VerticeIcon'
import { colors, interaction, radius, spacing, typography } from '../../theme/vertice'

export type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'citizen'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends Omit<ComponentProps<typeof Pressable>, 'style' | 'children'> {
  children: string
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: VerticeIconName
}

const SIZE_HEIGHT: Record<ButtonSize, number> = {
  sm: 40,
  md: interaction.buttonHeight,
  lg: interaction.buttonHeight + 8,
}

const SIZE_PADDING: Record<ButtonSize, number> = {
  sm: spacing.md,
  md: spacing.lg,
  lg: spacing.xl,
}

const VARIANT: Record<ButtonVariant, { container: object; textColor: string }> = {
  primary: {
    container: { backgroundColor: colors.navy, borderWidth: 1, borderColor: colors.navy },
    textColor: colors.white,
  },
  ghost: {
    container: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.inputBorder },
    textColor: colors.navy,
  },
  danger: {
    container: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.red },
    textColor: colors.red,
  },
  citizen: {
    container: { backgroundColor: colors.citizen, borderWidth: 1, borderColor: colors.citizen },
    textColor: colors.navy,
  },
}

/**
 * Canonical native button. Mirrors packages/ui/src/Button.tsx's variant
 * contract (primary/ghost/danger) using theme/vertice.ts tokens instead of
 * the web package's Tailwind classes, since packages/ui is DOM-only.
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  disabled,
  ...rest
}: ButtonProps) {
  const isDisabled = Boolean(disabled) || loading
  const { container, textColor } = VARIANT[variant]

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      {...rest}
      style={({ pressed }) => [
        styles.base,
        container,
        { minHeight: SIZE_HEIGHT[size], paddingHorizontal: SIZE_PADDING[size] },
        pressed && styles.pressed,
        isDisabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <View style={styles.content}>
          {icon ? <VerticeIcon name={icon} color={textColor} size={18} /> : null}
          <Text style={[styles.label, { color: textColor, fontFamily: typography.bodyExtraBoldFamily }]}>
            {children}
          </Text>
        </View>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  label: {
    ...typography.roles.button,
  },
  pressed: { opacity: interaction.pressedOpacity },
  disabled: { opacity: interaction.disabledOpacity },
})
