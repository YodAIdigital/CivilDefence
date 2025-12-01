import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendPushNotificationToMany, type PushSubscriptionData } from '@/lib/web-push'

interface EventNotificationRequest {
  eventId: string
  communityId: string
  eventTitle: string
  eventStartTime: string
  isOnline: boolean
  meetingLink?: string
  recipientUserIds: string[]
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient()

    const body: EventNotificationRequest = await request.json()
    const {
      eventId,
      communityId,
      eventTitle,
      eventStartTime,
      isOnline,
      meetingLink,
      recipientUserIds,
    } = body

    // Validate required fields
    if (!eventId || !communityId || !eventTitle || !recipientUserIds || recipientUserIds.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Fetch community name
    const { data: community, error: communityError } = await supabase
      .from('communities')
      .select('name')
      .eq('id', communityId)
      .single()

    if (communityError || !community) {
      return NextResponse.json(
        { error: 'Community not found' },
        { status: 404 }
      )
    }

    // Format the event time
    const eventDate = new Date(eventStartTime)
    const formattedDate = eventDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
    const formattedTime = eventDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })

    // Fetch push subscriptions for all recipients
    const { data: subscriptions, error: subsError } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth, user_id')
      .in('user_id', recipientUserIds)

    if (subsError) {
      console.error('Failed to fetch push subscriptions:', subsError)
      return NextResponse.json(
        { error: 'Failed to fetch push subscriptions' },
        { status: 500 }
      )
    }

    let pushSent = 0
    let pushFailed = 0
    const expiredSubscriptions: string[] = []

    if (subscriptions && subscriptions.length > 0) {
      console.log('Found', subscriptions.length, 'push subscriptions for event notification')

      const pushSubs: PushSubscriptionData[] = subscriptions.map(s => ({
        endpoint: s.endpoint,
        p256dh: s.p256dh,
        auth: s.auth,
      }))

      const notificationTitle = `📅 New Event: ${eventTitle}`
      const notificationBody = isOnline
        ? `${formattedDate} at ${formattedTime} (Online Event)\nFrom: ${community.name}`
        : `${formattedDate} at ${formattedTime}\nFrom: ${community.name}`

      const result = await sendPushNotificationToMany(pushSubs, {
        title: notificationTitle,
        body: notificationBody,
        tag: `event-${eventId}`,
        data: {
          type: 'event',
          eventId,
          communityId,
          url: `/community/${communityId}/events`,
          meetingLink: isOnline ? meetingLink : undefined,
        },
      })

      pushSent = result.sent
      pushFailed = result.failed
      expiredSubscriptions.push(...result.expiredEndpoints)

      console.log('Push notification results:', { pushSent, pushFailed, expired: expiredSubscriptions.length })

      // Clean up expired subscriptions
      if (expiredSubscriptions.length > 0) {
        console.log('Cleaning up', expiredSubscriptions.length, 'expired subscriptions')
        await supabase
          .from('push_subscriptions')
          .delete()
          .in('endpoint', expiredSubscriptions)
      }
    } else {
      console.log('No push subscriptions found for event notification recipients')
    }

    return NextResponse.json({
      success: true,
      pushSent,
      pushFailed,
      recipientCount: recipientUserIds.length,
    })
  } catch (error) {
    console.error('Error sending event notification:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Internal server error: ${errorMessage}` },
      { status: 500 }
    )
  }
}
