import { useCallback, useEffect, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { VerticeBrand } from '../components/VerticeBrand'
import { VerticeIcon } from '../components/VerticeIcon'
import { apiFetch } from '../lib/api'
import { navigateFromNotificationData } from '../lib/push-notifications'
import { colors, elevation, interaction, radius, spacing, typography } from '../theme/vertice'

interface MobileNotification {
  id: string
  type: 'report_status' | 'proposal_stage' | 'vote_result' | 'reputation' | 'system'
  title: string
  body: string
  href?: string
  read: boolean
  createdAt: number
}

interface NotificationInboxResponse {
  notifications: MobileNotification[]
  unread: number
}

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<MobileNotification[]>([])
  const [unread, setUnread] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const response = await apiFetch<NotificationInboxResponse>('/notifications')
      setNotifications(response.notifications)
      setUnread(response.unread)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible cargar las notificaciones.')
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function refresh() {
    setRefreshing(true)
    try { await load() } finally { setRefreshing(false) }
  }

  async function openNotification(notification: MobileNotification) {
    if (!notification.read) {
      await apiFetch(`/notifications/${notification.id}/read`, { method: 'PUT' }).catch(() => undefined)
      setNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, read: true } : item))
      setUnread((count) => Math.max(0, count - 1))
    }
    navigateFromNotificationData({
      notification_id: notification.id,
      type: notification.type,
      href: notification.href,
    })
  }

  async function markAllRead() {
    await apiFetch('/notifications/read-all', { method: 'PUT' })
    setNotifications((items) => items.map((item) => ({ ...item, read: true })))
    setUnread(0)
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={colors.navy}
            colors={[colors.navy]}
          />
        )}
      >
        <View style={styles.brandRow}>
          <VerticeBrand variant="wordmark" width={120} />
          <View style={styles.sectionBadge}>
            <VerticeIcon name="notifications" color={colors.navy} size={16} />
            <Text style={styles.sectionBadgeText}>CENTRO CÍVICO</Text>
          </View>
        </View>

        <View style={styles.headerRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <VerticeIcon name="back" color={colors.navy} size={18} />
            <Text style={styles.backText}>Volver</Text>
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>ACTUALIZACIONES</Text>
            <Text style={styles.title}>Notificaciones</Text>
            <Text style={styles.subtitle}>{unread} sin leer</Text>
          </View>
          {unread > 0 ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void markAllRead()}
              style={({ pressed }) => [styles.readAllButton, pressed && styles.pressed]}
            >
              <Text style={styles.readAllText}>Leer todo</Text>
            </Pressable>
          ) : null}
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.list}>
          {notifications.map((notification) => (
            <Pressable
              accessibilityRole="button"
              key={notification.id}
              onPress={() => void openNotification(notification)}
              style={({ pressed }) => [
                styles.card,
                !notification.read && styles.unreadCard,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.cardTop}>
                <Text style={styles.type}>{notification.type.replace(/_/g, ' ')}</Text>
                {!notification.read ? <View accessibilityLabel="Sin leer" style={styles.dot} /> : null}
              </View>
              <Text style={styles.cardTitle}>{notification.title}</Text>
              <Text style={styles.body}>{notification.body}</Text>
              <Text style={styles.time}>{new Date(notification.createdAt).toLocaleString()}</Text>
            </Pressable>
          ))}
          {!error && notifications.length === 0 ? (
            <View style={styles.emptyCard}>
              <VerticeIcon name="notifications" color={colors.textTertiary} size={24} />
              <Text style={styles.empty}>No tienes notificaciones todavía.</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.hero, gap: spacing.lg },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radius.pill, backgroundColor: colors.infoBackground, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  sectionBadgeText: { color: colors.infoText, fontFamily: typography.bodyExtraBoldFamily, fontSize: 9, lineHeight: 13, fontWeight: '800', letterSpacing: 0.8 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  headerCopy: { flex: 1, gap: spacing.xxs },
  backButton: { minHeight: interaction.minimumTouchTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  backText: { color: colors.navy, ...typography.roles.caption },
  eyebrow: { color: colors.textTertiary, ...typography.roles.label },
  title: { color: colors.textPrimary, ...typography.roles.title },
  subtitle: { color: colors.textSecondary, ...typography.roles.caption },
  readAllButton: { minHeight: interaction.minimumTouchTarget, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderActive, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  readAllText: { color: colors.navy, ...typography.roles.caption },
  list: { gap: spacing.sm },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, gap: spacing.xs, borderWidth: 1, borderColor: colors.border, ...elevation.card },
  unreadCard: { borderColor: colors.infoBorder, backgroundColor: colors.infoBackground },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  type: { textTransform: 'uppercase', color: colors.textTertiary, fontFamily: typography.bodyExtraBoldFamily, fontSize: 10, lineHeight: 14, letterSpacing: 1.1, fontWeight: '800' },
  dot: { width: 8, height: 8, borderRadius: radius.pill, backgroundColor: colors.citizen },
  cardTitle: { color: colors.textPrimary, fontFamily: typography.displayBoldFamily, fontSize: 17, lineHeight: 22, fontWeight: '700' },
  body: { color: colors.textSecondary, ...typography.roles.body },
  time: { color: colors.textTertiary, fontFamily: typography.bodyFamily, fontSize: 11, lineHeight: 16 },
  errorCard: { borderWidth: 1, borderColor: colors.errorBorder, borderRadius: radius.md, backgroundColor: colors.errorBackground, padding: spacing.sm },
  error: { color: colors.errorText, ...typography.roles.caption },
  emptyCard: { minHeight: 140, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface },
  empty: { textAlign: 'center', color: colors.textTertiary, ...typography.roles.body },
  pressed: { opacity: interaction.pressedOpacity },
})
