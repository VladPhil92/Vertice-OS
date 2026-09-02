'use client'

import { useEffect } from 'react'

export function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    let reloading = false

    const handleControllerChange = () => {
      if (reloading) return
      reloading = true
      window.location.reload()
    }

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)

    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((registration) => {
        registration.update().catch(() => null)

        const activateWaitingWorker = () => {
          registration.waiting?.postMessage({ type: 'SKIP_WAITING' })
        }

        activateWaitingWorker()

        registration.addEventListener('updatefound', () => {
          const worker = registration.installing
          if (!worker) return

          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              worker.postMessage({ type: 'SKIP_WAITING' })
            }
          })
        })
      })
      .catch(() => null)

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
    }
  }, [])

  return null
}
