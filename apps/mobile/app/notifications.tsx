import { useCallback, useEffect, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { apiFetch } from '../lib/api'
import { engagementTargetFromHref, type EngagementTarget } from '../lib/push-engagement'
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

interface NotificationListResponse {
interface NotificationInboxResponse {
  notifications: MobileNotification[]
  unread: number
}

function navigate(target: EngagementTarget): void {
  switch (target.kind) {
    case 'report':
      router.push({ pathname: '/report/[id]', params: { id: target.id } })
      return
    case 'notifications':
      return
    case 'governance':
      router.push('/(tabs)/governance' as never)
      return
    case 'actions':
      router.push('/(tabs)/actions' as never)
      return
    case 'territory':
      router.push('/(tabs)/reports' as never)
      return
    case 'dashboard':
      router.push('/(tabs)' as never)
  }
}

function relativeTime(timestamp: number): string {
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000))
  if (minutes < 1) return 'Ahora'
  if (minutes < 60) return `Hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Hace ${hours} h`
  return `Hace ${Math.floor(hours / 24)} d`
}

export default function NotificationsScreen() {
  const [items, setItems] = useState<MobileNotification[]>([])
export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<MobileNotification[]>([])
  const [unread, setUnread] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const response = await apiFetch<NotificationListResponse>('/notifications')
      setItems(response.notifications)
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

  async function openNotification(item: MobileNotification) {
    if (!item.read) {
      try {
        await apiFetch(`/notifications/${encodeURIComponent(item.id)}/read`, { method: 'PUT' })
        setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, read: true } : entry))
        setUnread((value) => Math.max(0, value - 1))
      } catch {
        // Navigation is still useful even if the read marker cannot be persisted immediately.
      }
    }

    const target = engagementTargetFromHref(item.href)
    if (target) navigate(target)
  }

  async function markAllRead() {
    try {
      await apiFetch('/notifications/read-all', { method: 'PUT' })
      setItems((current) => current.map((item) => ({ ...item, read: true })))
      setUnread(0)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible marcar las notificaciones.')
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
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
            <Text style={styles.backButtonText}>Volver</Text>
            <Text style={styles.backText}>Volver</Text>
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>ACTUALIZACIONES</Text>
            <Text style={styles.title}>Notificaciones</Text>
            <Text style={styles.subtitle}>{unread} sin leer · la bandeja canónica sigue disponible aunque falle el push remoto.</Text>
          </View>
        </View>

        {unread > 0 ? (
          <Pressable style={styles.markAllButton} onPress={() => void markAllRead()}>
            <Text style={styles.markAllButtonText}>Marcar todas como leídas</Text>
          </Pressable>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.list}>
          {items.map((item) => (
            <Pressable
              key={item.id}
              style={[styles.card, !item.read && styles.unreadCard]}
              onPress={() => void openNotification(item)}
            >
              <View style={styles.cardTop}>
                <Text style={styles.type}>{item.type.replace(/_/g, ' ')}</Text>
                <Text style={styles.time}>{relativeTime(item.createdAt)}</Text>
              </View>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
              {item.href ? <Text style={styles.linkHint}>Abrir actualización</Text> : null}
            </Pressable>
          ))}
          {!error && items.length === 0 ? <Text style={styles.empty}>No tienes notificaciones recientes.</Text> : null}
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
  content: { padding: 18, paddingBottom: 32, gap: 16 },
  headerRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  backButton: { paddingVertical: 8, paddingRight: 4 },
  backButtonText: { color: '#1C3D2E', fontWeight: '700' },
  headerCopy: { flex: 1, gap: 5 },
  eyebrow: { fontSize: 11, letterSpacing: 1.5, color: '#697068', fontWeight: '700' },
  title: { fontSize: 28, fontWeight: '700', color: '#11130F' },
  subtitle: { color: '#6D7168', lineHeight: 20 },
  markAllButton: { alignSelf: 'flex-start', backgroundColor: '#17382A', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  markAllButtonText: { color: '#FFFFFF', fontWeight: '700' },
  error: { color: '#8A302A', backgroundColor: '#FBE9E7', borderRadius: 12, padding: 12 },
  list: { gap: 10 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, gap: 7, borderWidth: 1, borderColor: '#ECE9DF' },
  unreadCard: { borderColor: '#17382A', backgroundColor: '#F0F4F0' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  type: { textTransform: 'uppercase', fontSize: 10, letterSpacing: 1.1, color: '#667067', fontWeight: '800' },
  time: { color: '#7A7E77', fontSize: 12 },
  cardTitle: { color: '#171A15', fontWeight: '700', fontSize: 16 },
  body: { color: '#42473F', lineHeight: 20 },
  linkHint: { color: '#1C3D2E', fontWeight: '700', fontSize: 12, marginTop: 3 },
  empty: { textAlign: 'center', color: '#777B74', paddingVertical: 36 },
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
