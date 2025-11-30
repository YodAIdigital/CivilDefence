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

interface NotificationProviderProps {
  children: ReactNode
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

        // Check if banner was dismissed
        const dismissed = localStorage.getItem(PERMISSION_BANNER_DISMISSED_KEY)
        setBannerDismissed(dismissed === 'true' || currentPermission === 'granted')
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

  // Dismiss the permission banner
  const dismissPermissionBanner = useCallback(() => {
    setBannerDismissed(true)
    localStorage.setItem(PERMISSION_BANNER_DISMISSED_KEY, 'true')
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
