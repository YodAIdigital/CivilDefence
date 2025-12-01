/**
 * Browser Push Notification Service
 * Handles notification permissions and sending local/push notifications
 */

export type NotificationPermissionStatus = 'granted' | 'denied' | 'default' | 'unsupported'

export interface NotificationOptions {
  title: string
  body: string
  icon?: string
  badge?: string
  tag?: string
  data?: Record<string, unknown>
  requireInteraction?: boolean
  silent?: boolean
  actions?: { action: string; title: string; icon?: string }[]
}

/**
 * Check if the browser supports notifications
 */
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

/**
 * Check if push notifications are supported (requires service worker)
 */
export function isPushSupported(): boolean {
  return typeof window !== 'undefined' && 'PushManager' in window && 'serviceWorker' in navigator
}

/**
 * Get current notification permission status
 */
export function getNotificationPermission(): NotificationPermissionStatus {
  if (!isNotificationSupported()) {
    return 'unsupported'
  }
  return Notification.permission as NotificationPermissionStatus
}

/**
 * Request notification permission from the user
 */
export async function requestNotificationPermission(): Promise<NotificationPermissionStatus> {
  if (!isNotificationSupported()) {
    return 'unsupported'
  }

  try {
    const permission = await Notification.requestPermission()
    return permission as NotificationPermissionStatus
  } catch (error) {
    console.error('Error requesting notification permission:', error)
    return 'denied'
  }
}

/**
 * Show a local notification (doesn't require push subscription)
 */
export async function showNotification(options: NotificationOptions): Promise<boolean> {
  const permission = getNotificationPermission()
  console.log('[Notifications] showNotification called, permission:', permission)

  if (permission !== 'granted') {
    console.warn('[Notifications] Permission not granted, cannot show notification')
    return false
  }

  try {
    // Try to use service worker for notification (works when app is in background)
    if ('serviceWorker' in navigator) {
      console.log('[Notifications] Using service worker for notification...')
      const registration = await navigator.serviceWorker.ready
      console.log('[Notifications] Service worker ready, showing notification:', options.title)

      // Build browser notification options (separate from our NotificationOptions interface)
      const browserOptions: globalThis.NotificationOptions = {
        body: options.body,
        icon: options.icon || '/icon-192.svg',
        badge: options.badge || '/icon-192.svg',
        requireInteraction: options.requireInteraction ?? false,
        silent: options.silent ?? false,
        // Note: actions only work on some platforms
      }
      if (options.tag) {
        browserOptions.tag = options.tag
      }
      if (options.data) {
        browserOptions.data = options.data
      }
      await registration.showNotification(options.title, browserOptions)
      console.log('[Notifications] Notification shown successfully via service worker')
      return true
    }

    // Fallback to basic Notification API
    console.log('[Notifications] Using fallback Notification API...')
    const fallbackOptions: globalThis.NotificationOptions = {
      body: options.body,
      icon: options.icon || '/icon-192.svg',
      silent: options.silent ?? false,
    }
    if (options.tag) {
      fallbackOptions.tag = options.tag
    }
    if (options.data) {
      fallbackOptions.data = options.data
    }
    new Notification(options.title, fallbackOptions)
    console.log('[Notifications] Notification shown successfully via fallback API')
    return true
  } catch (error) {
    console.error('[Notifications] Error showing notification:', error)
    return false
  }
}

/**
 * Show an alert notification with appropriate styling based on alert level
 */
export async function showAlertNotification(
  title: string,
  message: string,
  level: 'info' | 'warning' | 'danger' | 'critical',
  alertId?: string
): Promise<boolean> {
  const levelEmoji: Record<string, string> = {
    info: 'ℹ️',
    warning: '⚠️',
    danger: '🚨',
    critical: '🆘',
  }

  return showNotification({
    title: `${levelEmoji[level] || ''} ${title}`,
    body: message,
    tag: alertId ? `alert-${alertId}` : 'alert',
    requireInteraction: level === 'danger' || level === 'critical',
    data: {
      type: 'alert',
      alertId,
      level,
      url: '/dashboard',
    },
  })
}

/**
 * Register the service worker for push notifications
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('[Notifications] Service Worker not supported')
    return null
  }

  try {
    console.log('[Notifications] Attempting to register service worker...')
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    })

    console.log('[Notifications] Service worker registration returned:', registration.scope)

    // Wait for the service worker to be ready
    const ready = await navigator.serviceWorker.ready
    console.log('[Notifications] Service Worker is ready:', ready.scope)

    return registration
  } catch (error) {
    console.error('[Notifications] Service Worker registration failed:', error)
    // Try to provide more specific error info
    if (error instanceof Error) {
      console.error('[Notifications] Error message:', error.message)
      console.error('[Notifications] Error name:', error.name)
    }
    return null
  }
}

/**
 * Subscribe to push notifications (for server-sent push)
 * Note: This requires VAPID keys configured on the server
 */
export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!isPushSupported()) {
    console.warn('Push notifications not supported')
    return null
  }

  try {
    const registration = await navigator.serviceWorker.ready

    // Get the public VAPID key from environment
    const vapidPublicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY

    if (!vapidPublicKey || vapidPublicKey === 'your_vapid_public_key') {
      console.warn('VAPID public key not configured - using local notifications only')
      return null
    }

    // Convert VAPID key to Uint8Array
    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey)

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
    })

    console.log('Push subscription successful')
    return subscription
  } catch (error) {
    console.error('Push subscription failed:', error)
    return null
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  if (!isPushSupported()) {
    return false
  }

  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()

    if (subscription) {
      await subscription.unsubscribe()
      console.log('Push unsubscription successful')
      return true
    }

    return false
  } catch (error) {
    console.error('Push unsubscription failed:', error)
    return false
  }
}

/**
 * Get current push subscription
 */
export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) {
    return null
  }

  try {
    const registration = await navigator.serviceWorker.ready
    return await registration.pushManager.getSubscription()
  } catch (error) {
    console.error('Error getting push subscription:', error)
    return null
  }
}

/**
 * Helper to convert base64 VAPID key to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }

  return outputArray
}
