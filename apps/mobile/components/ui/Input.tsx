import { forwardRef } from 'react'
import type { ComponentProps } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'

import { colors, interaction, radius, spacing, typography } from '../../theme/vertice'

export interface InputProps extends Omit<ComponentProps<typeof TextInput>, 'style'> {
  label?: string
  error?: string
  hint?: string
}

/**
 * Canonical native text field. Mirrors packages/ui/src/Input.tsx's
 * label/error/hint contract using theme/vertice.ts tokens.
 */
export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, hint, ...rest },
  ref,
) {
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <TextInput
        ref={ref}
        placeholderTextColor={colors.placeholder}
        accessibilityInvalid={Boolean(error)}
        {...rest}
        style={[styles.input, error ? styles.inputError : null]}
      />

      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  )
})

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: {
    color: colors.textSecondary,
    fontFamily: typography.bodyExtraBoldFamily,
    ...typography.roles.label,
  },
  input: {
    minHeight: interaction.inputHeight,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
    fontFamily: typography.bodyFamily,
  },
  inputError: {
    borderColor: colors.errorBorder,
  },
  error: {
    color: colors.errorText,
    fontFamily: typography.bodySemiboldFamily,
    ...typography.roles.caption,
  },
  hint: {
    color: colors.textTertiary,
    fontFamily: typography.bodyFamily,
    ...typography.roles.caption,
  },
})
