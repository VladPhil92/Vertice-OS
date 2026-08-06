// VÉRTICE OS — Service Worker
// Strategy: network-first for API, cache-first for static assets

const CACHE_NAME = 'vertice-os-v1'
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/offline',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET, cross-origin, and API calls (always network-first)
  if (request.method !== 'GET') return
  if (url.origin !== self.location.origin) return

  // API routes — network only (no stale data)
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return

  // Static assets (JS, CSS, fonts, images) — cache first
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|ico|woff2?)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((res) => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return res
        })
      })
    )
    return
  }

  // Navigation (HTML pages) — network first, offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/offline').then((cached) => cached ?? new Response('Sin conexión', { status: 503 }))
      )
    )
  }
})

// Push notification handler (for future push API integration)
self.addEventListener('push', (event) => {
  if (!event.data) return
  try {
    const data = event.data.json()
    event.waitUntil(
      self.registration.showNotification(data.title ?? 'VÉRTICE OS', {
        body: data.body ?? '',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        data: { href: data.href ?? '/dashboard' },
        tag: data.tag ?? 'vertice-notif',
        renotify: true,
      })
    )
  } catch {
    // ignore malformed push payload
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const href = event.notification.data?.href ?? '/dashboard'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(self.location.origin))
      if (existing) return existing.focus().then((c) => c.navigate(href))
      return self.clients.openWindow(href)
    })
  )
})
