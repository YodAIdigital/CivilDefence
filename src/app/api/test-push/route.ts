import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendPushNotification, type PushSubscriptionData } from '@/lib/web-push'

/**
 * POST /api/test-push
 * Send a test push notification to a specific user
 * Used for debugging push notification issues
 */
export async function POST(request: NextRequest) {
  console.log('[TestPush] Test push notification requested')

  try {
    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Fetch all push subscriptions for this user
    console.log('[TestPush] Fetching subscriptions for user:', userId)
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId)

    if (error) {
      console.error('[TestPush] Database error:', error)
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      )
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('[TestPush] No subscriptions found for user')
      return NextResponse.json({
        success: false,
        message: 'No push subscriptions found for this user',
        subscriptionCount: 0,
      })
    }

    console.log('[TestPush] Found', subscriptions.length, 'subscription(s)')

    // Log subscription details (without sensitive data)
    subscriptions.forEach((sub, i) => {
      console.log(`[TestPush] Subscription ${i + 1}:`, {
        id: sub.id,
        endpoint: sub.endpoint.substring(0, 80) + '...',
        hasP256dh: !!sub.p256dh,
        hasAuth: !!sub.auth,
        created: sub.created_at,
        updated: sub.updated_at,
      })
    })

    // Send test notification to all subscriptions
    const results = []
    for (const sub of subscriptions) {
      const pushSub: PushSubscriptionData = {
        endpoint: sub.endpoint,
        p256dh: sub.p256dh,
        auth: sub.auth,
      }

      console.log('[TestPush] Sending to endpoint:', sub.endpoint.substring(0, 50) + '...')

      const result = await sendPushNotification(pushSub, {
        title: '🧪 Test Notification',
        body: `This is a test push notification sent at ${new Date().toLocaleTimeString()}`,
        tag: 'test-notification',
        data: {
          type: 'test',
          url: '/dashboard',
        },
      })

      results.push({
        subscriptionId: sub.id,
        endpoint: sub.endpoint.substring(0, 50) + '...',
        success: result.success,
        error: result.error,
      })

      console.log('[TestPush] Result:', result)
    }

    return NextResponse.json({
      success: true,
      subscriptionCount: subscriptions.length,
      results,
    })
  } catch (error) {
    console.error('[TestPush] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/test-push?userId=xxx
 * Check push subscription status for a user
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')

  if (!userId) {
    return NextResponse.json(
      { error: 'Missing userId query parameter' },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, created_at, updated_at')
    .eq('user_id', userId)

  if (error) {
    return NextResponse.json(
      { error: `Database error: ${error.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({
    userId,
    subscriptionCount: subscriptions?.length || 0,
    subscriptions: subscriptions?.map(s => ({
      id: s.id,
      endpoint: s.endpoint.substring(0, 80) + '...',
      created: s.created_at,
      updated: s.updated_at,
    })) || [],
  })
}
