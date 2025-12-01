'use client'

import { AuthProvider } from '@/contexts/auth-context'
import { CommunityProvider } from '@/contexts/community-context'
import { NotificationProvider } from '@/contexts/notification-context'
import { NotificationPermissionBanner } from '@/components/notifications/notification-permission-banner'
import { type ReactNode, useEffect } from 'react'

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  useEffect(() => {
    // Register service worker for PWA
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .catch(() => {
          // Service worker registration failed - app will work without offline support
        })
    }
  }, [])

  // Always wrap children in providers to ensure context is available during hydration
  return (
    <AuthProvider>
      <CommunityProvider>
        <NotificationProvider>
          {children}
          <NotificationPermissionBanner />
        </NotificationProvider>
      </CommunityProvider>
    </AuthProvider>
  )
}
