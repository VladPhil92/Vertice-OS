import { useEffect } from 'react'
import * as Notifications from 'expo-notifications'
import { useAuth } from '../providers/AuthProvider'
import {
  handleNotificationResponse,
  refreshPushRegistrationIfEnabled,
} from '../lib/push-notifications'

export function NotificationBridge() {
  const { user, loading } = useAuth()

  useEffect(() => {
    if (loading || !user) return

    let active = true
    void refreshPushRegistrationIfEnabled().catch(() => {
      // Existing opt-in is refreshed opportunistically. A transient provider,
      // network or EAS configuration problem must not block authenticated use.
    })

    void Notifications.getLastNotificationResponseAsync().then(async (response) => {
      if (!active || !response) return
      await handleNotificationResponse(response)
    }).catch(() => undefined)

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      void handleNotificationResponse(response)
    })

    return () => {
      active = false
      subscription.remove()
    }
  }, [loading, user?.id])

  return null
}
