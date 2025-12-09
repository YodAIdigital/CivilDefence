import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendPushNotification, type PushSubscriptionData } from '@/lib/web-push'

/**
 * POST /api/push-test
 * Send a test push notification to verify the server-side push pipeline
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Get user's push subscriptions
    const { data: subscriptions, error: subsError } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', userId)

    if (subsError) {
      console.error('[PushTest] Error fetching subscriptions:', subsError)
      return NextResponse.json(
        { error: 'Failed to fetch push subscriptions' },
        { status: 500 }
      )
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json(
        { error: 'No push subscriptions found for this user. Please register for push notifications first.' },
        { status: 404 }
      )
    }

    // Send test notification to all user's subscriptions
    let sent = 0
    let failed = 0
    const errors: string[] = []

    for (const sub of subscriptions) {
      const pushSub: PushSubscriptionData = {
        endpoint: sub.endpoint,
        p256dh: sub.p256dh,
        auth: sub.auth,
      }

      const result = await sendPushNotification(pushSub, {
        title: '🔔 Server Push Test',
        body: 'This notification was sent from the server. If you see this, server-side push notifications are working!',
        tag: 'server-test-' + Date.now(),
        data: {
          type: 'test',
          url: '/profile',
        },
      })

      if (result.success) {
        sent++
      } else {
        failed++
        if (result.error) {
          errors.push(result.error)
        }

        // If subscription expired, remove it
        if (result.error === 'subscription_expired') {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', sub.endpoint)
        }
      }
    }

    if (sent === 0 && failed > 0) {
      return NextResponse.json(
        {
          error: `Failed to send push notification: ${errors.join(', ')}`,
          sent: 0,
          failed,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      sent,
      failed,
      message: `Sent ${sent} notification(s)${failed > 0 ? `, ${failed} failed` : ''}`,
    })
  } catch (error) {
    console.error('[PushTest] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
