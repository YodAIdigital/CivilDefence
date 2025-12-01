const CACHE_NAME = 'civildefencepro-cache-v4'
const OFFLINE_URL = '/offline.html'

const STATIC_ASSETS = [
  '/',
  '/icon.svg',
  '/icon-192.svg',
  '/icon-512.svg',
  '/manifest.json'
]

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS)
    })
  )
  self.skipWaiting()
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      )
    })
  )
  self.clients.claim()
})

// Fetch event - network first, fall back to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and browser extensions
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
    return
  }

  // Skip API calls - let them fail naturally
  if (event.request.url.includes('/api/') || event.request.url.includes('supabase')) {
    return
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone the response before caching
        const responseClone = response.clone()
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone)
        })
        return response
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse
          }
          // For navigation requests, return the cached home page
          if (event.request.mode === 'navigate') {
            return caches.match('/')
          }
          return new Response('Offline', { status: 503 })
        })
      })
  )
})

// Push notification event - handle incoming push messages from server
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

  // Try to parse the push data
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
      // If not JSON, use text content
      notificationData.body = event.data.text()
    }
  }

  const options = {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    tag: notificationData.tag,
    data: notificationData.data,
    requireInteraction: notificationData.requireInteraction || notificationData.data?.level === 'danger' || notificationData.data?.level === 'critical',
    vibrate: [200, 100, 200], // Vibration pattern for mobile
    actions: [
      { action: 'view', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  }

  console.log('[SW] Showing notification:', notificationData.title, options)

  event.waitUntil(
    self.registration.showNotification(notificationData.title, options)
      .then(() => console.log('[SW] Notification shown successfully'))
      .catch((err) => console.error('[SW] Failed to show notification:', err))
  )
})

// Notification click event - handle user interaction with notification
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event)

  event.notification.close()

  const action = event.action
  const notificationData = event.notification.data || {}

  // If user clicked dismiss, just close
  if (action === 'dismiss') {
    return
  }

  // Default action or 'view' action - open/focus the app
  const urlToOpen = notificationData.url || '/dashboard'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there's already a window open
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin)) {
          // Focus the existing window and navigate to the alert
          client.focus()
          client.navigate(urlToOpen)
          return
        }
      }

      // No window open - open a new one
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
})
