'use client'

import { useState } from 'react'
import { Bell, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNotifications } from '@/contexts/notification-context'

export function NotificationPermissionBanner() {
  const { showPermissionBanner, requestPermission, dismissPermissionBanner, permission } =
    useNotifications()
  const [isRequesting, setIsRequesting] = useState(false)

  if (!showPermissionBanner) {
    return null
  }

  const handleEnable = async () => {
    setIsRequesting(true)
    try {
      await requestPermission()
    } finally {
      setIsRequesting(false)
    }
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-card border border-border rounded-xl shadow-lg p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">Enable Notifications</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Get instant alerts for emergencies and important community updates, even when the app
              is closed.
            </p>
            <div className="flex items-center gap-2 mt-3">
              <Button size="sm" onClick={handleEnable} disabled={isRequesting}>
                {isRequesting ? (
                  <>
                    <span className="material-icons animate-spin text-sm mr-1">sync</span>
                    Enabling...
                  </>
                ) : (
                  'Enable Notifications'
                )}
              </Button>
              <Button size="sm" variant="ghost" onClick={dismissPermissionBanner}>
                Not Now
              </Button>
            </div>
            {permission === 'denied' && (
              <p className="text-xs text-destructive mt-2">
                Notifications are blocked. Please enable them in your browser settings.
              </p>
            )}
          </div>
          <button
            onClick={dismissPermissionBanner}
            className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
