import { StyleSheet, Text, View } from 'react-native'

import { VerticeIcon, type VerticeIconName } from '../VerticeIcon'
import { colors, radius, spacing, typography } from '../../theme/vertice'

export type AlertType = 'error' | 'success' | 'warning' | 'info'

export interface AlertProps {
  type: AlertType
  message: string
}

const CONFIG: Record<AlertType, { background: string; border: string; text: string; icon: VerticeIconName }> = {
  error: { background: colors.errorBackground, border: colors.errorBorder, text: colors.errorText, icon: 'alertCircle' },
  success: { background: colors.successBackground, border: colors.successBorder, text: colors.successText, icon: 'checkCircle' },
  warning: { background: colors.warningBackground, border: colors.warningBorder, text: colors.warningText, icon: 'alertTriangle' },
  info: { background: colors.infoBackground, border: colors.infoBorder, text: colors.infoText, icon: 'info' },
}

/**
 * Canonical native banner. Mirrors packages/ui/src/Alert.tsx's type contract,
 * but sources colors from the real semantic banner tokens in
 * packages/design-tokens (info/success/warning/error) instead of the web
 * package's ad-hoc Tailwind color names.
 */
export function Alert({ type, message }: AlertProps) {
  const { background, border, text, icon } = CONFIG[type]

  return (
    <View
      accessibilityRole="alert"
      style={[styles.base, { backgroundColor: background, borderColor: border }]}
    >
      <VerticeIcon name={icon} color={text} size={18} />
      <Text style={[styles.message, { color: text }]}>{message}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  message: {
    flex: 1,
    fontFamily: typography.bodySemiboldFamily,
    ...typography.roles.caption,
  },
})
