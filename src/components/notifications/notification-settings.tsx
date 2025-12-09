'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell, BellOff, Check, AlertTriangle, Info, RefreshCw, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNotifications } from '@/contexts/notification-context'
import { useAuth } from '@/contexts/auth-context'

type SubscriptionStatus = 'checking' | 'active' | 'inactive' | 'error'

export function NotificationSettings() {
  const { user } = useAuth()
  const { permission, isSupported, isLoading, requestPermission, sendAlertNotification } =
    useNotifications()
  const [isRequesting, setIsRequesting] = useState(false)
  const [isRegisteringPush, setIsRegisteringPush] = useState(false)
  const [isUnsubscribing, setIsUnsubscribing] = useState(false)
  const [pushError, setPushError] = useState<string | null>(null)
  const [pushSuccess, setPushSuccess] = useState<string | null>(null)
  const [testSent, setTestSent] = useState(false)
  const [serverTestSent, setServerTestSent] = useState(false)
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>('checking')

  // Check push subscription status
  const checkSubscription = useCallback(async () => {
    if (!isSupported || permission !== 'granted') {
      setSubscriptionStatus('inactive')
      return
    }

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      setSubscriptionStatus(subscription ? 'active' : 'inactive')
    } catch {
      setSubscriptionStatus('error')
    }
  }, [isSupported, permission])

  useEffect(() => {
    if (!isLoading) {
      checkSubscription()
    }
  }, [isLoading, checkSubscription])

  // Register push subscription manually
  const handleRegisterPush = async () => {
    if (!user?.id) {
      setPushError('You must be logged in to register for push notifications')
      return
    }

    setIsRegisteringPush(true)
    setPushError(null)

    try {
      const registration = await navigator.serviceWorker.ready

      // Get existing subscription or create new one
      let subscription = await registration.pushManager.getSubscription()

      if (!subscription) {
        const vapidPublicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY

        if (!vapidPublicKey || vapidPublicKey === 'your_vapid_public_key') {
          setPushError('Push notifications are not configured on this server')
          return
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
      }

      // Get subscription keys
      const subscriptionJson = subscription.toJSON()

      if (!subscriptionJson.endpoint || !subscriptionJson.keys?.p256dh || !subscriptionJson.keys?.auth) {
        setPushError('Invalid subscription data received from browser')
        return
      }

      // Save to server
      const response = await fetch('/api/push-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
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
        const errorData = await response.json().catch(() => ({}))
        setPushError(errorData.error || 'Failed to save subscription to server')
        return
      }

      // Success - recheck status
      setSubscriptionStatus('active')
      setPushSuccess('Push subscription registered successfully!')
      setTimeout(() => setPushSuccess(null), 3000)
    } catch (error) {
      console.error('Error registering push subscription:', error)
      setPushError(error instanceof Error ? error.message : 'Failed to register push subscription')
    } finally {
      setIsRegisteringPush(false)
    }
  }

  // Unsubscribe from push notifications
  const handleUnsubscribe = async () => {
    if (!user?.id) return

    setIsUnsubscribing(true)
    setPushError(null)

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        // Unsubscribe from browser
        await subscription.unsubscribe()

        // Remove from server
        await fetch(`/api/push-subscription?userId=${user.id}&endpoint=${encodeURIComponent(subscription.endpoint)}`, {
          method: 'DELETE',
        })
      }

      setSubscriptionStatus('inactive')
      setPushSuccess('Successfully unsubscribed from push notifications')
      setTimeout(() => setPushSuccess(null), 3000)
    } catch (error) {
      console.error('Error unsubscribing:', error)
      setPushError(error instanceof Error ? error.message : 'Failed to unsubscribe')
    } finally {
      setIsUnsubscribing(false)
    }
  }

  // Send a server-side push test (to verify full pipeline)
  const handleServerPushTest = async () => {
    if (!user?.id) return

    setServerTestSent(true)
    setPushError(null)

    try {
      const response = await fetch('/api/push-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        setPushError(data.error || 'Failed to send server push test')
        setServerTestSent(false)
        return
      }

      setTimeout(() => setServerTestSent(false), 3000)
    } catch (error) {
      console.error('Error sending server push test:', error)
      setPushError(error instanceof Error ? error.message : 'Failed to send test')
      setServerTestSent(false)
    }
  }

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
                Browser notifications are enabled
              </p>
              <p className="text-sm text-green-700 dark:text-green-300">
                You will receive alerts for emergencies and community updates.
              </p>
            </div>
          </div>

          {/* Push Subscription Status */}
          <div className="p-3 bg-muted/50 border border-border rounded-lg space-y-2">
            <p className="text-sm font-medium flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              Push Subscription Status
            </p>
            <div className="text-sm text-muted-foreground">
              {subscriptionStatus === 'checking' && (
                <span className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Checking subscription...
                </span>
              )}
              {subscriptionStatus === 'active' && (
                <div className="space-y-3">
                  <span className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <Check className="h-4 w-4" />
                    Push subscription active - server alerts will be received
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleServerPushTest}
                      disabled={serverTestSent}
                    >
                      {serverTestSent ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Server Test Sent!
                        </>
                      ) : (
                        <>
                          <Smartphone className="h-4 w-4 mr-2" />
                          Test Server Push
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleUnsubscribe}
                      disabled={isUnsubscribing}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                    >
                      {isUnsubscribing ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Unsubscribing...
                        </>
                      ) : (
                        <>
                          <BellOff className="h-4 w-4 mr-2" />
                          Unsubscribe
                        </>
                      )}
                    </Button>
                  </div>
                  {pushSuccess && (
                    <p className="text-xs text-green-600 dark:text-green-400">{pushSuccess}</p>
                  )}
                  {pushError && (
                    <p className="text-xs text-red-600 dark:text-red-400">{pushError}</p>
                  )}
                </div>
              )}
              {subscriptionStatus === 'inactive' && (
                <div className="space-y-2">
                  <span className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-4 w-4" />
                    No push subscription - only local notifications work
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRegisterPush}
                    disabled={isRegisteringPush}
                    className="mt-2"
                  >
                    {isRegisteringPush ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Registering...
                      </>
                    ) : (
                      <>
                        <Smartphone className="h-4 w-4 mr-2" />
                        Register for Server Push
                      </>
                    )}
                  </Button>
                  {pushError && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">{pushError}</p>
                  )}
                </div>
              )}
              {subscriptionStatus === 'error' && (
                <span className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-4 w-4" />
                  Error checking subscription status
                </span>
              )}
            </div>
          </div>

          {/* OS/Browser Settings Help */}
          <div className="text-xs text-muted-foreground p-3 bg-muted/30 rounded-lg space-y-1">
            <p className="font-medium">If notifications aren&apos;t appearing:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Check that Do Not Disturb/Focus mode is off on your device</li>
              <li>Ensure notifications are enabled in your system settings</li>
              <li>On mobile: check the app/browser notification settings</li>
              <li>Some browsers block notifications when the tab is inactive</li>
            </ul>
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
