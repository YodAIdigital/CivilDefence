'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import {
  isNotificationSupported,
  isPushSupported,
  getNotificationPermission,
  requestNotificationPermission,
  registerServiceWorker,
  showAlertNotification,
  type NotificationPermissionStatus,
} from '@/lib/notifications'
import { useAuth } from '@/contexts/auth-context'

interface NotificationContextValue {
  // Permission state
  permission: NotificationPermissionStatus
  isSupported: boolean
  isLoading: boolean

  // Actions
  requestPermission: () => Promise<NotificationPermissionStatus>
  sendAlertNotification: (
    title: string,
    message: string,
    level: 'info' | 'warning' | 'danger' | 'critical',
    alertId?: string
  ) => Promise<boolean>

  // UI helpers
  showPermissionBanner: boolean
  dismissPermissionBanner: () => void
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined)

const PERMISSION_BANNER_DISMISSED_KEY = 'cde_notification_banner_dismissed'
// How long to wait before showing the banner again (7 days in milliseconds)
const BANNER_DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000

interface NotificationProviderProps {
  children: ReactNode
}

// Helper to check if banner was dismissed and if dismissal is still valid
function isBannerDismissedValid(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const dismissedAt = localStorage.getItem(PERMISSION_BANNER_DISMISSED_KEY)
    if (!dismissedAt) return false

    // If it's the old format (just 'true'), treat as permanently dismissed
    if (dismissedAt === 'true') return true

    // Check if the dismissal has expired
    const dismissedTime = parseInt(dismissedAt, 10)
    if (isNaN(dismissedTime)) return false

    const now = Date.now()
    return (now - dismissedTime) < BANNER_DISMISS_DURATION
  } catch {
    return false
  }
}

// Helper to save push subscription to server
async function savePushSubscription(userId: string): Promise<boolean> {
  if (!isPushSupported()) {
    console.log('[NotificationContext] Push not supported, skipping subscription save')
    return false
  }

  try {
    const registration = await navigator.serviceWorker.ready
    let subscription = await registration.pushManager.getSubscription()

    // If no subscription exists, create one
    if (!subscription) {
      const vapidPublicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY
      if (!vapidPublicKey || vapidPublicKey === 'your_vapid_public_key') {
        console.warn('[NotificationContext] VAPID key not configured')
        return false
      }

      // Convert VAPID key to Uint8Array
      const padding = '='.repeat((4 - (vapidPublicKey.length % 4)) % 4)
      const base64 = (vapidPublicKey + padding).replace(/-/g, '+').replace(/_/g, '/')
      const rawData = window.atob(base64)
      const applicationServerKey = new Uint8Array(rawData.length)
      for (let i = 0; i < rawData.length; ++i) {
        applicationServerKey[i] = rawData.charCodeAt(i)
      }

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      })
      console.log('[NotificationContext] Created new push subscription')
    }

    // Get subscription keys
    const subscriptionJson = subscription.toJSON()
    if (!subscriptionJson.endpoint || !subscriptionJson.keys?.p256dh || !subscriptionJson.keys?.auth) {
      console.error('[NotificationContext] Invalid subscription data')
      return false
    }

    // Save to server
    const response = await fetch('/api/push-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        subscription: {
          endpoint: subscriptionJson.endpoint,
          keys: {
            p256dh: subscriptionJson.keys.p256dh,
            auth: subscriptionJson.keys.auth,
          },
        },
      }),
    })

    if (!response.ok) {
      console.error('[NotificationContext] Failed to save subscription to server')
      return false
    }

    console.log('[NotificationContext] Push subscription saved successfully')
    return true
  } catch (error) {
    console.error('[NotificationContext] Error saving push subscription:', error)
    return false
  }
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const { user } = useAuth()
  const [permission, setPermission] = useState<NotificationPermissionStatus>('default')
  const [isSupported, setIsSupported] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [bannerDismissed, setBannerDismissed] = useState(true) // Start as dismissed until we check

  // Initialize notification state
  useEffect(() => {
    const initNotifications = async () => {
      // Check if notifications are supported
      const supported = isNotificationSupported()
      setIsSupported(supported)

      if (supported) {
        // Get current permission
        const currentPermission = getNotificationPermission()
        setPermission(currentPermission)

        // Register service worker
        await registerServiceWorker()

        // If permission already granted and user is logged in, ensure subscription is saved
        if (currentPermission === 'granted' && user?.id) {
          await savePushSubscription(user.id)
        }

        // Check if banner was dismissed (and dismissal is still valid)
        // Also don't show if permission is already granted or denied
        const dismissed = currentPermission === 'granted' || currentPermission === 'denied' || isBannerDismissedValid()
        setBannerDismissed(dismissed)
      }

      setIsLoading(false)
    }

    initNotifications()
  }, [user?.id])

  // Request notification permission
  const requestPermission = useCallback(async (): Promise<NotificationPermissionStatus> => {
    if (!isSupported) {
      return 'unsupported'
    }

    const newPermission = await requestNotificationPermission()
    setPermission(newPermission)

    // If granted, dismiss the banner and save push subscription
    if (newPermission === 'granted') {
      setBannerDismissed(true)
      localStorage.setItem(PERMISSION_BANNER_DISMISSED_KEY, 'true')

      // Save push subscription if user is logged in
      if (user?.id) {
        await savePushSubscription(user.id)
      }
    }

    return newPermission
  }, [isSupported, user?.id])

  // Send an alert notification
  const sendAlertNotification = useCallback(
    async (
      title: string,
      message: string,
      level: 'info' | 'warning' | 'danger' | 'critical',
      alertId?: string
    ): Promise<boolean> => {
      if (permission !== 'granted') {
        return false
      }

      return showAlertNotification(title, message, level, alertId)
    },
    [permission]
  )

  // Dismiss the permission banner (stores timestamp for timed re-display)
  const dismissPermissionBanner = useCallback(() => {
    setBannerDismissed(true)
    // Store timestamp so we can show again after BANNER_DISMISS_DURATION
    localStorage.setItem(PERMISSION_BANNER_DISMISSED_KEY, Date.now().toString())
  }, [])

  // Show banner if: supported, not granted, and not dismissed
  const showPermissionBanner =
    isSupported && permission === 'default' && !bannerDismissed && !isLoading

  const value: NotificationContextValue = {
    permission,
    isSupported,
    isLoading,
    requestPermission,
    sendAlertNotification,
    showPermissionBanner,
    dismissPermissionBanner,
  }

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}
