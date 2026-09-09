import { Platform } from 'react-native'
import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import * as SecureStore from 'expo-secure-store'
import { apiFetch } from './api'

const INSTALLATION_ID_KEY = 'vertice.mobile.installation-id.v1'
const PUSH_CHANNEL_ID = 'civic-updates'

export type PushRegistrationState =
  | 'registered'
  | 'permission_denied'
  | 'simulator'
  | 'configuration_missing'
  | 'unsupported'

export type EngagementTarget =
  | { kind: 'report'; id: string }
  | { kind: 'notifications' }
  | { kind: 'governance' }
  | { kind: 'actions' }
  | { kind: 'territory' }
  | { kind: 'dashboard' }

function projectId(): string | null {
  const expoExtra = Constants.expoConfig?.extra as { eas?: { projectId?: unknown } } | undefined
  const fromExpoConfig = expoExtra?.eas?.projectId
  if (typeof fromExpoConfig === 'string' && fromExpoConfig.trim()) return fromExpoConfig.trim()

  const fromEasConfig = Constants.easConfig?.projectId
  return typeof fromEasConfig === 'string' && fromEasConfig.trim()
    ? fromEasConfig.trim()
    : null
}

async function installationId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(INSTALLATION_ID_KEY)
  if (existing) return existing

  const entropy = `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
  const generated = `vertice_${Date.now().toString(36)}_${entropy}`.slice(0, 96)
  await SecureStore.setItemAsync(INSTALLATION_ID_KEY, generated)
  return generated
}

export async function getInstallationId(): Promise<string> {
  return installationId()
}

export async function configureNotificationPresentation(): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  })

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(PUSH_CHANNEL_ID, {
      name: 'Actualizaciones cívicas',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 200],
      sound: null,
      enableVibrate: true,
    })
  }
}

export async function registerPushInstallation(): Promise<PushRegistrationState> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return 'unsupported'
  if (!Device.isDevice) return 'simulator'

  await configureNotificationPresentation()

  const current = await Notifications.getPermissionsAsync()
  let status = current.status
  if (status !== Notifications.PermissionStatus.GRANTED) {
    const requested = await Notifications.requestPermissionsAsync()
    status = requested.status
  }
  if (status !== Notifications.PermissionStatus.GRANTED) return 'permission_denied'

  const easProjectId = projectId()
  if (!easProjectId) return 'configuration_missing'

  const token = await Notifications.getExpoPushTokenAsync({ projectId: easProjectId })
  const installId = await installationId()

  await apiFetch('/notifications/push-devices', {
    method: 'POST',
    body: JSON.stringify({
      installation_id: installId,
      expo_push_token: token.data,
      platform: Platform.OS,
    }),
  })

  return 'registered'
}

export async function revokeCurrentPushInstallation(): Promise<void> {
  const installId = await SecureStore.getItemAsync(INSTALLATION_ID_KEY)
  if (!installId) return
  try {
    await apiFetch(`/notifications/push-devices/${encodeURIComponent(installId)}`, {
      method: 'DELETE',
    })
  } catch {
    // Logout must continue even if the API/provider cannot revoke immediately.
    // Re-registering another account on the same installation atomically rebinds it server-side.
  }
}

function internalPath(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const path = value.trim()
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('://')) return null
  return path
}

export function engagementTargetFromHref(rawHref: unknown): EngagementTarget | null {
  const href = internalPath(rawHref)
  if (!href) return null

  const reportMatch = href.match(/^\/(?:report|reports|territorial\/reports)\/([0-9a-fA-F-]{36})(?:[/?#]|$)/)
  if (reportMatch?.[1]) return { kind: 'report', id: reportMatch[1] }

  if (href.startsWith('/notifications')) return { kind: 'notifications' }
  if (href.startsWith('/governance')) return { kind: 'governance' }
  if (href.startsWith('/civic-actions')) return { kind: 'actions' }
  if (href.startsWith('/territorial')) return { kind: 'territory' }
  if (href === '/' || href.startsWith('/dashboard')) return { kind: 'dashboard' }
  return null
}

export function engagementTargetFromResponse(
  response: Notifications.NotificationResponse | null | undefined,
): EngagementTarget | null {
  return engagementTargetFromHref(response?.notification.request.content.data?.href)
}
