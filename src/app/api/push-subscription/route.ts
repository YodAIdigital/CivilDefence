import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

interface PushSubscriptionRequest {
  userId: string
  subscription: {
    endpoint: string
    keys: {
      p256dh: string
      auth: string
    }
  }
}

/**
 * POST /api/push-subscription
 * Save a user's push subscription to the database
 */
export async function POST(request: NextRequest) {
  try {
    const body: PushSubscriptionRequest = await request.json()
    const { userId, subscription } = body

    if (!userId || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Upsert the subscription (update if endpoint exists, insert if not)
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id: userId,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,endpoint',
        }
      )

    if (error) {
      console.error('[PushSubscription] Failed to save subscription:', error)
      return NextResponse.json(
        { error: 'Failed to save subscription' },
        { status: 500 }
      )
    }

    console.log('[PushSubscription] Saved subscription for user:', userId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[PushSubscription] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/push-subscription
 * Remove a user's push subscription
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const endpoint = searchParams.get('endpoint')

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Delete specific endpoint or all subscriptions for user
    let query = supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId)

    if (endpoint) {
      query = query.eq('endpoint', endpoint)
    }

    const { error } = await query

    if (error) {
      console.error('[PushSubscription] Failed to delete subscription:', error)
      return NextResponse.json(
        { error: 'Failed to delete subscription' },
        { status: 500 }
      )
    }

    console.log('[PushSubscription] Deleted subscription(s) for user:', userId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[PushSubscription] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
