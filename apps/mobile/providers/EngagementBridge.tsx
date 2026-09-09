import { useEffect, useRef } from 'react'
import { router } from 'expo-router'
import * as Notifications from 'expo-notifications'
import { useAuth } from './AuthProvider'
import {
  configureNotificationPresentation,
  engagementTargetFromResponse,
  registerPushInstallation,
  type EngagementTarget,
} from '../lib/push-engagement'

function navigate(target: EngagementTarget): void {
  switch (target.kind) {
    case 'report':
      router.push({ pathname: '/report/[id]', params: { id: target.id } })
      return
    case 'notifications':
      router.push('/notifications' as never)
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

export function EngagementBridge() {
  const { user } = useAuth()
  const processedColdStart = useRef(false)

  useEffect(() => {
    void configureNotificationPresentation()
  }, [])

  useEffect(() => {
    if (!user) return
    void registerPushInstallation().catch(() => undefined)
  }, [user?.id])

  useEffect(() => {
    if (!user) return

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const target = engagementTargetFromResponse(response)
      if (target) navigate(target)
    })

    if (!processedColdStart.current) {
      processedColdStart.current = true
      void Notifications.getLastNotificationResponseAsync().then((response) => {
        const target = engagementTargetFromResponse(response)
        if (target) navigate(target)
      }).catch(() => undefined)
    }

    return () => subscription.remove()
  }, [user?.id])

  return null
}
