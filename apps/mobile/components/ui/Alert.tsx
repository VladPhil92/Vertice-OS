import { Pressable, StyleSheet, Text, View } from 'react-native'

import { VerticeIcon, type VerticeIconName } from '../VerticeIcon'
import { colors, interaction, radius, spacing, typography } from '../../theme/vertice'

export type AlertType = 'error' | 'success' | 'warning' | 'info'

export interface AlertAction {
  label: string
  onPress: () => void
  icon?: VerticeIconName
}

export interface AlertProps {
  type: AlertType
  message: string
  /** Optional heading shown above the message, for cards that need one. */
  title?: string
  /** Optional trailing action (e.g. "Reintentar") rendered below the message. */
  action?: AlertAction
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
 * package's ad-hoc Tailwind color names. `title` and `action` are native-only
 * additions covering the title+message and error+retry cards that recur
 * across mobile screens without a matching web equivalent to mirror.
 */
export function Alert({ type, message, title, action }: AlertProps) {
  const { background, border, text, icon } = CONFIG[type]

  return (
    <View
      accessibilityRole="alert"
      style={[styles.base, { backgroundColor: background, borderColor: border }]}
    >
      <VerticeIcon name={icon} color={text} size={18} />
      <View style={styles.body}>
        {title ? <Text style={[styles.title, { color: text }]}>{title}</Text> : null}
        <Text style={[styles.message, { color: text }]}>{message}</Text>
        {action ? (
          <Pressable
            accessibilityRole="button"
            onPress={action.onPress}
            style={({ pressed }) => [styles.action, { borderColor: border }, pressed && styles.pressed]}
          >
            {action.icon ? <VerticeIcon name={action.icon} color={colors.navy} size={16} /> : null}
            <Text style={styles.actionLabel}>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
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
  body: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    fontFamily: typography.bodyExtraBoldFamily,
    ...typography.roles.caption,
  },
  message: {
    fontFamily: typography.bodySemiboldFamily,
    ...typography.roles.caption,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    marginTop: spacing.xxs,
    minHeight: interaction.minimumTouchTarget,
    borderWidth: 1,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
  },
  actionLabel: {
    color: colors.navy,
    fontFamily: typography.bodyExtraBoldFamily,
    ...typography.roles.caption,
  },
  pressed: { opacity: interaction.pressedOpacity },
})
