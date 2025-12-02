import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendEmail, getCommunityAlertEmail } from '@/lib/email'
import { sendSms, formatAlertSms } from '@/lib/sms'
import { sendPushNotificationToMany, getAlertLevelEmoji, type PushSubscriptionData } from '@/lib/web-push'

type AlertLevel = 'info' | 'warning' | 'danger'
type RecipientGroup = 'admin' | 'team' | 'members' | 'specific'

// Type for the Supabase client with new tables
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClientWithRules = ReturnType<typeof createAdminClient> & { from: (table: string) => any }

interface WebhookPayload {
  // Optional overrides for the alert (if not provided, uses rule defaults)
  title?: string
  message?: string
  level?: AlertLevel
  // Optional metadata
  source?: string
  metadata?: Record<string, unknown>
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient() as SupabaseClientWithRules

    // Get the webhook token from the URL query parameter
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { error: 'Missing webhook token' },
        { status: 400 }
      )
    }

    // Parse the incoming payload (optional)
    let payload: WebhookPayload = {}
    try {
      const contentType = request.headers.get('content-type')
      if (contentType?.includes('application/json')) {
        payload = await request.json()
      }
    } catch {
      // Payload is optional, continue without it
    }

    // Find the rule by webhook token
    const { data: rule, error: ruleError } = await supabase
      .from('community_alert_rules')
      .select(`
        *,
        communities:community_id (
          id,
          name
        )
      `)
      .eq('webhook_token', token)
      .eq('trigger_type', 'webhook')
      .eq('is_active', true)
      .single()

    if (ruleError || !rule) {
      console.error('Rule not found:', ruleError)
      return NextResponse.json(
        { error: 'Invalid or inactive webhook token' },
        { status: 404 }
      )
    }

    const community = rule.communities as { id: string; name: string }

    // Determine alert content (use payload overrides or rule defaults)
    const alertTitle = payload.title || rule.alert_title
    const alertMessage = payload.message || rule.alert_message
    const alertLevel = (payload.level || rule.alert_level) as AlertLevel
    const recipientGroup = rule.recipient_group as RecipientGroup

    // Get recipients based on recipient group
    let recipientUserIds: string[] = []

    if (recipientGroup === 'specific' && rule.specific_member_ids && rule.specific_member_ids.length > 0) {
      recipientUserIds = rule.specific_member_ids
    } else {
      let members: { user_id: string }[] | null = null

      if (recipientGroup === 'admin') {
        const result = await supabase
          .from('community_members')
          .select('user_id')
          .eq('community_id', rule.community_id)
          .in('role', ['admin', 'super_admin'])
        members = result.data
      } else if (recipientGroup === 'team') {
        const result = await supabase
          .from('community_members')
          .select('user_id')
          .eq('community_id', rule.community_id)
          .in('role', ['admin', 'super_admin', 'team_member'])
        members = result.data
      } else {
        const result = await supabase
          .from('community_members')
          .select('user_id')
          .eq('community_id', rule.community_id)
        members = result.data
      }

      recipientUserIds = members?.map(m => m.user_id) || []
    }

    if (recipientUserIds.length === 0) {
      // Log the trigger attempt but note no recipients
      await supabase.from('alert_rule_triggers').insert({
        rule_id: rule.id,
        trigger_source: 'webhook',
        trigger_payload: payload,
        success: false,
        error_message: 'No recipients found for the specified group',
        recipient_count: 0,
      })

      return NextResponse.json(
        { error: 'No recipients found for the specified group' },
        { status: 400 }
      )
    }

    // Create the alert record
    const { data: alert, error: alertError } = await supabase
      .from('alerts')
      .insert({
        title: alertTitle,
        content: alertMessage,
        level: alertLevel,
        community_id: rule.community_id,
        author_id: rule.created_by, // Use rule creator as author
        is_public: false,
        is_active: rule.send_app_notification,
        sent_via_email: rule.send_email,
        sent_via_sms: rule.send_sms,
        sent_via_app: rule.send_app_notification,
        recipient_count: recipientUserIds.length,
        recipient_group: recipientGroup,
      })
      .select('id')
      .single()

    if (alertError) {
      console.error('Failed to create alert:', alertError)
      await supabase.from('alert_rule_triggers').insert({
        rule_id: rule.id,
        trigger_source: 'webhook',
        trigger_payload: payload,
        success: false,
        error_message: `Failed to create alert: ${alertError.message}`,
        recipient_count: 0,
      })

      return NextResponse.json(
        { error: 'Failed to create alert' },
        { status: 500 }
      )
    }

    // Create alert recipients
    const recipientEntries = recipientUserIds.map(userId => ({
      alert_id: alert.id,
      user_id: userId,
    }))

    await supabase.from('alert_recipients').insert(recipientEntries)

    // Fetch recipient profiles for notifications
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, full_name, phone')
      .in('id', recipientUserIds)

    let emailsSent = 0
    let smsSent = 0
    let pushSent = 0

    // Send emails if enabled
    if (rule.send_email && profiles && profiles.length > 0) {
      // Get rule creator's name for "sent by"
      const { data: creatorProfile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', rule.created_by)
        .single()

      const senderName = creatorProfile?.full_name || creatorProfile?.email || 'System'

      const emailTemplate = getCommunityAlertEmail({
        communityName: community.name,
        senderName,
        alertLevel,
        title: alertTitle,
        message: alertMessage,
      })

      for (const profile of profiles) {
        if (profile.email) {
          try {
            const success = await sendEmail({
              to: profile.email,
              subject: emailTemplate.subject,
              html: emailTemplate.html,
            })
            if (success) emailsSent++
          } catch (err) {
            console.error(`Failed to send email to ${profile.email}:`, err)
          }
        }
      }
    }

    // Send SMS if enabled
    if (rule.send_sms && profiles && profiles.length > 0) {
      const smsMessage = formatAlertSms({
        communityName: community.name,
        alertLevel,
        title: alertTitle,
        message: alertMessage,
      })

      for (const profile of profiles) {
        if (profile.phone) {
          try {
            const result = await sendSms({
              to: profile.phone,
              message: smsMessage,
            })
            if (result.success) smsSent++
          } catch (err) {
            console.error(`Failed to send SMS to ${profile.phone}:`, err)
          }
        }
      }
    }

    // Send push notifications if enabled
    if (rule.send_app_notification) {
      const { data: subscriptions } = await supabase
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .in('user_id', recipientUserIds)

      if (subscriptions && subscriptions.length > 0) {
        const pushSubs: PushSubscriptionData[] = subscriptions.map(s => ({
          endpoint: s.endpoint,
          p256dh: s.p256dh,
          auth: s.auth,
        }))

        const emoji = getAlertLevelEmoji(alertLevel)
        const result = await sendPushNotificationToMany(pushSubs, {
          title: `${emoji} ${alertTitle}`,
          body: alertMessage,
          tag: `alert-${alert.id}`,
          data: {
            type: 'alert',
            alertId: alert.id,
            communityId: rule.community_id,
            level: alertLevel,
            url: '/dashboard',
          },
          requireInteraction: alertLevel === 'danger',
        })

        pushSent = result.sent

        // Clean up expired subscriptions
        if (result.expiredEndpoints.length > 0) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .in('endpoint', result.expiredEndpoints)
        }
      }
    }

    // Update alert with delivery counts
    await supabase
      .from('alerts')
      .update({
        email_sent_count: emailsSent,
        sms_sent_count: smsSent,
        push_sent_count: pushSent,
      })
      .eq('id', alert.id)

    // Update rule with trigger count and timestamp
    await supabase
      .from('community_alert_rules')
      .update({
        trigger_count: rule.trigger_count + 1,
        last_triggered_at: new Date().toISOString(),
      })
      .eq('id', rule.id)

    // Log the successful trigger
    await supabase.from('alert_rule_triggers').insert({
      rule_id: rule.id,
      alert_id: alert.id,
      trigger_source: 'webhook',
      trigger_payload: payload,
      success: true,
      recipient_count: recipientUserIds.length,
      emails_sent: emailsSent,
      sms_sent: smsSent,
      push_sent: pushSent,
    })

    return NextResponse.json({
      success: true,
      alertId: alert.id,
      recipientCount: recipientUserIds.length,
      emailsSent,
      smsSent,
      pushSent,
    })
  } catch (error) {
    console.error('Error processing webhook trigger:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Also support GET for simple integrations (e.g., IoT devices)
export async function GET(request: NextRequest) {
  // Redirect to POST handler with empty payload
  return POST(request)
}
