'use client'

import { AuthProvider } from '@/contexts/auth-context'
import { CommunityProvider } from '@/contexts/community-context'
import { NotificationProvider } from '@/contexts/notification-context'
import { OfflineProvider } from '@/contexts/OfflineContext'
import { NotificationPermissionBanner } from '@/components/notifications/notification-permission-banner'
import { FloatingSyncStatus } from '@/components/offline/SyncStatusIndicator'
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
          <OfflineProvider>
            {children}
            <NotificationPermissionBanner />
            <FloatingSyncStatus />
          </OfflineProvider>
        </NotificationProvider>
      </CommunityProvider>
    </AuthProvider>
  )
}
