const CACHE_VERSION = 6
const STATIC_CACHE_NAME = `civildefencepro-static-v${CACHE_VERSION}`
const DYNAMIC_CACHE_NAME = `civildefencepro-dynamic-v${CACHE_VERSION}`

// Static assets to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/icon.svg',
  '/icon-192.svg',
  '/icon-512.svg',
  '/manifest.json',
  '/dashboard',
  '/profile',
  '/checklist',
  '/contacts',
  '/community',
  '/guides'
]

// Routes that should work offline (app shell)
const APP_SHELL_ROUTES = [
  '/dashboard',
  '/profile',
  '/checklist',
  '/contacts',
  '/community',
  '/guides'
]

// Maximum items in dynamic cache
const MAX_DYNAMIC_CACHE_ITEMS = 50

// Limit the size of the dynamic cache
async function limitCacheSize(cacheName, maxItems) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  if (keys.length > maxItems) {
    const deleteCount = keys.length - maxItems
    for (let i = 0; i < deleteCount; i++) {
      await cache.delete(keys[i])
    }
  }
}

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker v' + CACHE_VERSION)
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets')
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Some static assets failed to cache:', err)
        return Promise.resolve()
      })
    })
  )
  self.skipWaiting()
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker v' + CACHE_VERSION)
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            return (
              cacheName.startsWith('civildefencepro-') &&
              cacheName !== STATIC_CACHE_NAME &&
              cacheName !== DYNAMIC_CACHE_NAME
            )
          })
          .map((cacheName) => {
            console.log('[SW] Deleting old cache:', cacheName)
            return caches.delete(cacheName)
          })
      )
    })
  )
  self.clients.claim()
})

// Determine caching strategy based on request type
function getCacheStrategy(request) {
  const url = new URL(request.url)

  // API calls - network only (data handled by IndexedDB)
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase')) {
    return 'network-only'
  }

  // Static assets (JS, CSS, images) - cache first
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image' ||
    request.destination === 'font' ||
    url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?)$/i)
  ) {
    return 'cache-first'
  }

  // Navigation requests (HTML pages) - stale-while-revalidate
  if (request.mode === 'navigate') {
    return 'stale-while-revalidate'
  }

  // Default - network first
  return 'network-first'
}

// Cache-first strategy
async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) {
    return cached
  }

  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME)
      cache.put(request, response.clone())
      limitCacheSize(DYNAMIC_CACHE_NAME, MAX_DYNAMIC_CACHE_ITEMS)
    }
    return response
  } catch (error) {
    console.log('[SW] Cache-first fetch failed:', error)
    if (request.destination === 'image') {
      return caches.match('/icon-192.svg')
    }
    throw error
  }
}

// Network-first strategy
async function networkFirst(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME)
      cache.put(request, response.clone())
    }
    return response
  } catch (error) {
    console.log('[SW] Network-first falling back to cache for:', request.url)
    const cached = await caches.match(request)
    if (cached) {
      return cached
    }
    throw error
  }
}

// Stale-while-revalidate strategy
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request)

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        const cache = caches.open(STATIC_CACHE_NAME)
        cache.then((c) => c.put(request, response.clone()))
      }
      return response
    })
    .catch((error) => {
      console.log('[SW] Background fetch failed:', error)
      return null
    })

  if (cached) {
    fetchPromise
    return cached
  }

  const response = await fetchPromise
  if (response) {
    return response
  }

  const appShellMatch = APP_SHELL_ROUTES.find((route) =>
    request.url.includes(route)
  )
  if (appShellMatch) {
    const fallback = await caches.match('/')
    if (fallback) {
      return fallback
    }
  }

  return new Response('Offline - No cached version available', {
    status: 503,
    headers: { 'Content-Type': 'text/plain' }
  })
}

// Fetch event handler
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return
  }

  if (!event.request.url.startsWith('http')) {
    return
  }

  const strategy = getCacheStrategy(event.request)

  if (strategy === 'network-only') {
    return
  }

  event.respondWith(
    (async () => {
      try {
        switch (strategy) {
          case 'cache-first':
            return await cacheFirst(event.request)
          case 'stale-while-revalidate':
            return await staleWhileRevalidate(event.request)
          case 'network-first':
          default:
            return await networkFirst(event.request)
        }
      } catch (error) {
        console.error('[SW] Fetch handler error:', error)

        if (event.request.mode === 'navigate') {
          const fallback = await caches.match('/')
          if (fallback) {
            return fallback
          }
        }

        return new Response('Offline', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' }
        })
      }
    })()
  )
})

// Background sync event - sync pending data when online
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag)

  if (event.tag === 'offline-sync') {
    event.waitUntil(
      (async () => {
        const allClients = await self.clients.matchAll()
        for (const client of allClients) {
          client.postMessage({
            type: 'SYNC_REQUIRED',
            timestamp: Date.now()
          })
        }
      })()
    )
  }
})

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  console.log('[SW] Periodic sync triggered:', event.tag)

  if (event.tag === 'data-sync') {
    event.waitUntil(
      (async () => {
        const allClients = await self.clients.matchAll()
        for (const client of allClients) {
          client.postMessage({
            type: 'PERIODIC_SYNC',
            timestamp: Date.now()
          })
        }
      })()
    )
  }
})

// Push notification event
self.addEventListener('push', (event) => {
  console.log('[SW] Push event received')
  console.log('[SW] Push data:', event.data ? 'present' : 'none')

  let notificationData = {
    title: 'CivilDefencePro Alert',
    body: 'You have a new notification',
    icon: '/icon-192.svg',
    badge: '/icon-192.svg',
    tag: 'default',
    requireInteraction: false,
    data: { url: '/dashboard' }
  }

  if (event.data) {
    try {
      const data = event.data.json()
      console.log('[SW] Parsed push data:', JSON.stringify(data))

      notificationData = {
        title: data.title || notificationData.title,
        body: data.body || data.message || notificationData.body,
        icon: data.icon || notificationData.icon,
        badge: data.badge || notificationData.badge,
        tag: data.tag || data.alertId || notificationData.tag,
        requireInteraction: data.requireInteraction || false,
        data: {
          url: data.data?.url || data.url || '/dashboard',
          alertId: data.data?.alertId || data.alertId,
          type: data.data?.type || data.type || 'alert',
          level: data.data?.level || data.level
        }
      }
    } catch (e) {
      console.log('[SW] Failed to parse push data as JSON, using text')
      notificationData.body = event.data.text()
    }
  }

  const options = {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    tag: notificationData.tag,
    data: notificationData.data,
    requireInteraction:
      notificationData.requireInteraction ||
      notificationData.data?.level === 'danger' ||
      notificationData.data?.level === 'critical'
  }

  if ('vibrate' in navigator) {
    options.vibrate = [200, 100, 200]
  }

  try {
    options.actions = [
      { action: 'view', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  } catch (e) {
    console.log('[SW] Notification actions not supported')
  }

  console.log('[SW] Showing notification:', notificationData.title)

  event.waitUntil(
    self.registration
      .showNotification(notificationData.title, options)
      .then(() => console.log('[SW] Notification shown successfully'))
      .catch((err) => console.error('[SW] Failed to show notification:', err))
  )
})

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event)

  event.notification.close()

  const action = event.action
  const notificationData = event.notification.data || {}

  if (action === 'dismiss') {
    return
  }

  const urlToOpen = notificationData.url || '/dashboard'

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin)) {
            client.focus()
            client.navigate(urlToOpen)
            return
          }
        }

        if (clients.openWindow) {
          return clients.openWindow(urlToOpen)
        }
      })
  )
})

// Notification close event
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed:', event)
})

// Message event - handle messages from the main app
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data)

  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data
    self.registration.showNotification(title, options)
  }

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }

  // Force cache update
  if (event.data && event.data.type === 'CACHE_UPDATE') {
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      cache.addAll(STATIC_ASSETS)
    })
  }

  // Clear all caches
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((names) => {
      names.forEach((name) => caches.delete(name))
    })
  }

  // Get cache status
  if (event.data && event.data.type === 'GET_CACHE_STATUS') {
    Promise.all([
      caches.open(STATIC_CACHE_NAME).then((c) => c.keys()),
      caches.open(DYNAMIC_CACHE_NAME).then((c) => c.keys())
    ]).then(([staticKeys, dynamicKeys]) => {
      event.source.postMessage({
        type: 'CACHE_STATUS',
        static: staticKeys.length,
        dynamic: dynamicKeys.length,
        version: CACHE_VERSION
      })
    })
  }
})
