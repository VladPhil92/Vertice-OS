import { Platform } from 'react-native'
import Constants from 'expo-constants'
import * as Notifications from 'expo-notifications'
import * as SecureStore from 'expo-secure-store'
import { router } from 'expo-router'
import { apiFetch } from './api'

const PUSH_ENABLED_KEY = 'vertice_push_enabled'
const PUSH_TOKEN_KEY = 'vertice_expo_push_token'
const CIVIC_CHANNEL_ID = 'civic-updates'

interface PushRegistrationResponse {
  ok: boolean
}

interface NotificationRouteData {
  notification_id?: unknown
  type?: unknown
  href?: unknown
}

export interface PushPreferenceState {
  enabled: boolean
  registeredToken: boolean
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
})

async function ensureAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync(CIVIC_CHANNEL_ID, {
    name: 'Actualizaciones cívicas',
    importance: Notifications.AndroidImportance.DEFAULT,
    enableVibrate: true,
    showBadge: true,
  })
}

function resolveProjectId(): string {
  const projectId = Constants.easConfig?.projectId
    ?? (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId

  if (!projectId) {
    throw Object.assign(new Error('El proyecto EAS todavía no está vinculado a este build.'), {
      code: 'PUSH_EAS_PROJECT_UNLINKED',
    })
  }
  return projectId
}

async function registerTokenWithApi(expoPushToken: string): Promise<void> {
  const platform = Platform.OS
  if (platform !== 'ios' && platform !== 'android') {
    throw Object.assign(new Error('Las notificaciones push solo están disponibles en iOS y Android.'), {
      code: 'PUSH_PLATFORM_UNSUPPORTED',
    })
  }

  await apiFetch<PushRegistrationResponse>('/notifications/devices', {
    method: 'POST',
    body: JSON.stringify({
      expo_push_token: expoPushToken,
      platform,
      app_version: Constants.expoConfig?.version ?? null,
    }),
  })
  await SecureStore.setItemAsync(PUSH_TOKEN_KEY, expoPushToken)
}

async function obtainAndRegisterExpoToken(): Promise<string> {
  await ensureAndroidNotificationChannel()
  const token = await Notifications.getExpoPushTokenAsync({ projectId: resolveProjectId() })
  await registerTokenWithApi(token.data)
  return token.data
}

export async function getPushPreferenceState(): Promise<PushPreferenceState> {
  const [enabled, token] = await Promise.all([
    SecureStore.getItemAsync(PUSH_ENABLED_KEY),
    SecureStore.getItemAsync(PUSH_TOKEN_KEY),
  ])
  return { enabled: enabled === 'true', registeredToken: Boolean(token) }
}

export async function enablePushNotifications(): Promise<void> {
  await ensureAndroidNotificationChannel()
  const current = await Notifications.getPermissionsAsync()
  let permission = current
  if (!current.granted) permission = await Notifications.requestPermissionsAsync()

  if (!permission.granted) {
    throw Object.assign(new Error('Debes permitir notificaciones para activar las actualizaciones cívicas.'), {
      code: 'PUSH_PERMISSION_DENIED',
    })
  }

  await obtainAndRegisterExpoToken()
  await SecureStore.setItemAsync(PUSH_ENABLED_KEY, 'true')
}

export async function refreshPushRegistrationIfEnabled(): Promise<void> {
  const enabled = await SecureStore.getItemAsync(PUSH_ENABLED_KEY)
  if (enabled !== 'true') return

  const permission = await Notifications.getPermissionsAsync()
  if (!permission.granted) return

  await obtainAndRegisterExpoToken()
}

export async function deactivatePushRegistration(options: { preservePreference?: boolean } = {}): Promise<void> {
  const token = await SecureStore.getItemAsync(PUSH_TOKEN_KEY)
  if (token) {
    try {
      await apiFetch('/notifications/devices', {
        method: 'DELETE',
        body: JSON.stringify({ expo_push_token: token }),
      })
    } finally {
      await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY)
    }
  }

  if (!options.preservePreference) {
    await SecureStore.deleteItemAsync(PUSH_ENABLED_KEY)
  }
}

function extractReportId(href: string): string | null {
  const match = href.match(/(?:report|reports)(?:\/|%2F)([0-9a-f]{8}-[0-9a-f-]{27,36})/i)
  return match?.[1] ?? null
}

export function navigateFromNotificationData(data: NotificationRouteData): void {
  const type = typeof data.type === 'string' ? data.type : 'system'
  const href = typeof data.href === 'string' ? data.href : ''

  if (type === 'report_status') {
    const reportId = extractReportId(href)
    if (reportId) {
      router.push({ pathname: '/report/[id]', params: { id: reportId } })
      return
    }
    router.push('/(tabs)/reports')
    return
  }

  if (type === 'proposal_stage' || type === 'vote_result') {
    router.push('/(tabs)/governance')
    return
  }

  if (type === 'reputation') {
    router.push('/(tabs)/profile')
    return
  }

  router.push('/notifications')
}

export async function handleNotificationResponse(response: Notifications.NotificationResponse): Promise<void> {
  const data = response.notification.request.content.data as NotificationRouteData
  navigateFromNotificationData(data)
  await Notifications.clearLastNotificationResponse()
}
