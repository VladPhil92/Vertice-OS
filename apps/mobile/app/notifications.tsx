import { useCallback, useEffect, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { apiFetch } from '../lib/api'
import { navigateFromNotificationData } from '../lib/push-notifications'

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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
      >
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>Volver</Text>
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>ACTUALIZACIONES</Text>
            <Text style={styles.title}>Notificaciones</Text>
            <Text style={styles.subtitle}>{unread} sin leer</Text>
          </View>
          {unread > 0 ? (
            <Pressable onPress={() => void markAllRead()} style={styles.readAllButton}>
              <Text style={styles.readAllText}>Leer todo</Text>
            </Pressable>
          ) : null}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.list}>
          {notifications.map((notification) => (
            <Pressable
              key={notification.id}
              onPress={() => void openNotification(notification)}
              style={[styles.card, !notification.read && styles.unreadCard]}
            >
              <View style={styles.cardTop}>
                <Text style={styles.type}>{notification.type.replace(/_/g, ' ')}</Text>
                {!notification.read ? <View style={styles.dot} /> : null}
              </View>
              <Text style={styles.cardTitle}>{notification.title}</Text>
              <Text style={styles.body}>{notification.body}</Text>
              <Text style={styles.time}>{new Date(notification.createdAt).toLocaleString()}</Text>
            </Pressable>
          ))}
          {!error && notifications.length === 0 ? (
            <Text style={styles.empty}>No tienes notificaciones todavía.</Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F6F4EE' },
  content: { padding: 18, paddingBottom: 36, gap: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  headerCopy: { flex: 1, gap: 4 },
  backButton: { paddingHorizontal: 10, paddingVertical: 9, borderRadius: 12, backgroundColor: '#E7E4D8' },
  backText: { color: '#263228', fontWeight: '700', fontSize: 12 },
  eyebrow: { fontSize: 11, letterSpacing: 1.5, color: '#697068', fontWeight: '700' },
  title: { fontSize: 28, fontWeight: '700', color: '#11130F' },
  subtitle: { color: '#6D7168' },
  readAllButton: { paddingHorizontal: 10, paddingVertical: 9, borderRadius: 12, borderWidth: 1, borderColor: '#AEB7AF' },
  readAllText: { color: '#17382A', fontWeight: '700', fontSize: 12 },
  list: { gap: 10 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, gap: 8, borderWidth: 1, borderColor: '#ECE9E1' },
  unreadCard: { borderColor: '#8FA696', backgroundColor: '#F4F7F3' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  type: { textTransform: 'uppercase', fontSize: 10, letterSpacing: 1.1, color: '#667067', fontWeight: '700' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1C3D2E' },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#171A15' },
  body: { color: '#343931', lineHeight: 20 },
  time: { color: '#7B7E78', fontSize: 11 },
  error: { color: '#8A302A', backgroundColor: '#FBE9E7', borderRadius: 12, padding: 12 },
  empty: { textAlign: 'center', color: '#777B74', paddingVertical: 28 },
})
