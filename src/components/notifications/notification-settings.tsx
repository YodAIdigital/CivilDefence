'use client'

import { useState } from 'react'
import { Bell, BellOff, Check, AlertTriangle, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNotifications } from '@/contexts/notification-context'

export function NotificationSettings() {
  const { permission, isSupported, isLoading, requestPermission, sendAlertNotification } =
    useNotifications()
  const [isRequesting, setIsRequesting] = useState(false)
  const [testSent, setTestSent] = useState(false)

  const handleRequestPermission = async () => {
    setIsRequesting(true)
    try {
      await requestPermission()
    } finally {
      setIsRequesting(false)
    }
  }

  const handleTestNotification = async () => {
    const success = await sendAlertNotification(
      'Test Notification',
      'This is a test notification from Civil Defence Expo. If you can see this, notifications are working correctly!',
      'info',
      'test-' + Date.now()
    )
    if (success) {
      setTestSent(true)
      setTimeout(() => setTestSent(false), 3000)
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-xl bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="material-icons animate-spin text-muted-foreground">sync</span>
          <span className="text-muted-foreground">Loading notification settings...</span>
        </div>
      </div>
    )
  }

  if (!isSupported) {
    return (
      <div className="rounded-xl bg-card p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <BellOff className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-semibold">Notifications Not Supported</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Your browser or device does not support push notifications. Try using a modern browser
              like Chrome, Firefox, or Safari.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Push Notifications
        </h2>
        {permission === 'granted' && (
          <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
            <Check className="h-4 w-4" />
            Enabled
          </span>
        )}
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Receive instant alerts for emergencies, community updates, and important notifications
        directly on your device, even when the app is closed.
      </p>

      {permission === 'granted' ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
            <div>
              <p className="font-medium text-green-800 dark:text-green-200">
                Notifications are enabled
              </p>
              <p className="text-sm text-green-700 dark:text-green-300">
                You will receive alerts for emergencies and community updates.
              </p>
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={handleTestNotification} disabled={testSent}>
            {testSent ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Test Sent!
              </>
            ) : (
              <>
                <Bell className="h-4 w-4 mr-2" />
                Send Test Notification
              </>
            )}
          </Button>
        </div>
      ) : permission === 'denied' ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-200">
                Notifications are blocked
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                You have previously blocked notifications. To enable them, you&apos;ll need to update
                your browser settings.
              </p>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            <p className="font-medium mb-2">To enable notifications:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Click the lock/info icon in your browser&apos;s address bar</li>
              <li>Find &quot;Notifications&quot; in the site settings</li>
              <li>Change the setting from &quot;Block&quot; to &quot;Allow&quot;</li>
              <li>Refresh this page</li>
            </ol>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <div>
              <p className="font-medium text-blue-800 dark:text-blue-200">
                Notifications are not yet enabled
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Enable notifications to receive important emergency alerts.
              </p>
            </div>
          </div>

          <Button onClick={handleRequestPermission} disabled={isRequesting}>
            {isRequesting ? (
              <>
                <span className="material-icons animate-spin text-sm mr-2">sync</span>
                Enabling...
              </>
            ) : (
              <>
                <Bell className="h-4 w-4 mr-2" />
                Enable Notifications
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
