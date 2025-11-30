'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  registerServiceWorker,
  showAlertNotification,
  type NotificationPermissionStatus,
} from '@/lib/notifications'

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

export function NotificationProvider({ children }: NotificationProviderProps) {
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

        // Check if banner was dismissed (and dismissal is still valid)
        // Also don't show if permission is already granted or denied
        const dismissed = currentPermission === 'granted' || currentPermission === 'denied' || isBannerDismissedValid()
        setBannerDismissed(dismissed)
      }

      setIsLoading(false)
    }

    initNotifications()
  }, [])

  // Request notification permission
  const requestPermission = useCallback(async (): Promise<NotificationPermissionStatus> => {
    if (!isSupported) {
      return 'unsupported'
    }

    const newPermission = await requestNotificationPermission()
    setPermission(newPermission)

    // If granted, dismiss the banner
    if (newPermission === 'granted') {
      setBannerDismissed(true)
      localStorage.setItem(PERMISSION_BANNER_DISMISSED_KEY, 'true')
    }

    return newPermission
  }, [isSupported])

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
