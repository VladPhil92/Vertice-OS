// VÉRTICE OS — Service Worker
// Strategy: network-first navigation, network-owned versioned Next.js assets,
// cache-first only for stable public media and the offline fallback.

const CACHE_NAME = 'vertice-os-v2'
const STATIC_ASSETS = ['/offline']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== 'GET') return
  if (url.origin !== self.location.origin) return

  // API/auth requests are never cached by the service worker.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return

  // Next.js emits content-hashed JS/CSS/font assets. Let the browser and Vercel
  // own their immutable caching so a previous service worker cannot pin an old build.
  if (url.pathname.startsWith('/_next/')) return

  // Navigation stays network-first. Offline content is only a fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/offline').then((cached) => cached ?? new Response('Sin conexión', { status: 503 })),
      ),
    )
    return
  }

  // Stable public media may be cached. Revisions that need hard invalidation
  // should change their URL or CACHE_NAME.
  if (url.pathname.match(/\.(png|jpg|jpeg|svg|ico|webp|woff2?)$/)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
      }),
    )
  }
})

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
      }),
    )
  } catch {
    // Ignore malformed push payloads.
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const href = event.notification.data?.href ?? '/dashboard'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url.includes(self.location.origin))
      if (existing) return existing.focus().then((client) => client.navigate(href))
      return self.clients.openWindow(href)
    }),
  )
})
