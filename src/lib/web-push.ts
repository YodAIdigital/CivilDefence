/**
 * Server-side Web Push Notifications
 * Handles sending push notifications to subscribed users
 */

import webpush from 'web-push'

// Configure web-push with VAPID keys
const vapidPublicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY
const vapidPrivateKey = process.env.WEB_PUSH_PRIVATE_KEY
const vapidEmail = process.env.WEB_PUSH_EMAIL || 'mailto:alert@civildefence.pro'

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    vapidEmail.startsWith('mailto:') ? vapidEmail : `mailto:${vapidEmail}`,
    vapidPublicKey,
    vapidPrivateKey
  )
}

export interface PushSubscriptionData {
  endpoint: string
  p256dh: string
  auth: string
}

export interface PushNotificationPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  tag?: string
  data?: Record<string, unknown>
  requireInteraction?: boolean
}

/**
 * Send a push notification to a single subscription
 */
export async function sendPushNotification(
  subscription: PushSubscriptionData,
  payload: PushNotificationPayload
): Promise<{ success: boolean; error?: string }> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn('[WebPush] VAPID keys not configured')
    return { success: false, error: 'VAPID keys not configured' }
  }

  try {
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    }

    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/icon-192.svg',
      badge: payload.badge || '/icon-192.svg',
      tag: payload.tag,
      data: payload.data,
      requireInteraction: payload.requireInteraction ?? false,
    })

    await webpush.sendNotification(pushSubscription, notificationPayload)
    console.log('[WebPush] Notification sent successfully to:', subscription.endpoint.substring(0, 50) + '...')
    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[WebPush] Failed to send notification:', errorMessage)

    // Check if subscription is expired/invalid (410 Gone or 404 Not Found)
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const statusCode = (error as { statusCode: number }).statusCode
      if (statusCode === 410 || statusCode === 404) {
        return { success: false, error: 'subscription_expired' }
      }
    }

    return { success: false, error: errorMessage }
  }
}

/**
 * Send push notifications to multiple subscriptions
 * Returns count of successful sends and list of expired endpoints
 */
export async function sendPushNotificationToMany(
  subscriptions: PushSubscriptionData[],
  payload: PushNotificationPayload
): Promise<{ sent: number; failed: number; expiredEndpoints: string[] }> {
  let sent = 0
  let failed = 0
  const expiredEndpoints: string[] = []

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      const result = await sendPushNotification(sub, payload)
      if (result.success) {
        sent++
      } else {
        failed++
        if (result.error === 'subscription_expired') {
          expiredEndpoints.push(sub.endpoint)
        }
      }
      return result
    })
  )

  console.log(`[WebPush] Batch send complete: ${sent} sent, ${failed} failed, ${expiredEndpoints.length} expired`)
  return { sent, failed, expiredEndpoints }
}

/**
 * Get the level emoji for alert notifications
 */
export function getAlertLevelEmoji(level: string): string {
  const emojis: Record<string, string> = {
    info: 'ℹ️',
    warning: '⚠️',
    danger: '🚨',
    critical: '🆘',
  }
  return emojis[level] || ''
}
