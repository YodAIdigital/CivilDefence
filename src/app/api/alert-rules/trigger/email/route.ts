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

// Email webhook payload structure (compatible with SendGrid, Mailgun, etc.)
interface EmailWebhookPayload {
  // Standard fields that most email services provide
  to?: string | string[]
  from?: string
  subject?: string
  text?: string
  html?: string
  // SendGrid-specific
  envelope?: {
    to?: string[]
    from?: string
  }
  // Alternative formats
  recipient?: string
  sender?: string
  body?: string
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient() as SupabaseClientWithRules

    // Parse incoming email data
    let payload: EmailWebhookPayload = {}
    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      payload = await request.json()
    } else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
      // Handle form data (common for email webhooks)
      const formData = await request.formData()
      payload = {
        to: formData.get('to') as string,
        from: formData.get('from') as string,
        subject: formData.get('subject') as string,
        text: formData.get('text') as string,
        html: formData.get('html') as string,
        recipient: formData.get('recipient') as string,
        sender: formData.get('sender') as string,
        body: formData.get('body-plain') as string || formData.get('body') as string,
      }
    }

    // Extract the recipient email address
    let recipientEmail: string | null = null

    // Try different fields where the recipient email might be
    if (payload.envelope?.to?.[0]) {
      recipientEmail = payload.envelope.to[0]
    } else if (Array.isArray(payload.to)) {
      recipientEmail = payload.to[0] ?? null
    } else if (typeof payload.to === 'string') {
      recipientEmail = payload.to
    } else if (payload.recipient) {
      recipientEmail = payload.recipient ?? null
    }

    if (!recipientEmail) {
      console.error('No recipient email found in payload:', payload)
      return NextResponse.json(
        { error: 'No recipient email found' },
        { status: 400 }
      )
    }

    // Clean up email address (remove any name portion like "Name <email@example.com>")
    const emailMatch = recipientEmail.match(/<([^>]+)>/)
    if (emailMatch && emailMatch[1]) {
      recipientEmail = emailMatch[1]
    }
    recipientEmail = recipientEmail.toLowerCase().trim()

    console.log('Email trigger received for:', recipientEmail)

    // Find the rule by trigger email
    // Note: Rules can have trigger_type 'webhook' or 'email' but all rules get both
    // a webhook URL and trigger email, so we just match by trigger_email
    const { data: rule, error: ruleError } = await supabase
      .from('community_alert_rules')
      .select(`
        *,
        communities:community_id (
          id,
          name
        )
      `)
      .eq('trigger_email', recipientEmail)
      .eq('is_active', true)
      .single()

    if (ruleError || !rule) {
      console.error('Rule not found for email:', recipientEmail, ruleError)
      return NextResponse.json(
        { error: 'No active rule found for this email address' },
        { status: 404 }
      )
    }

    const community = rule.communities as { id: string; name: string }

    // Use the email subject/body to potentially override the alert content
    // This allows for dynamic alerts based on the incoming email
    const emailSubject = payload.subject || ''
    const emailBody = payload.text || payload.body || payload.html || ''

    // Determine alert content
    // If the email subject starts with "[OVERRIDE]", use email content instead of rule defaults
    let alertTitle = rule.alert_title
    let alertMessage = rule.alert_message
    let alertLevel = rule.alert_level as AlertLevel

    if (emailSubject.startsWith('[OVERRIDE]')) {
      alertTitle = emailSubject.replace('[OVERRIDE]', '').trim()
      alertMessage = emailBody
    } else if (emailSubject.startsWith('[WARNING]')) {
      alertTitle = emailSubject.replace('[WARNING]', '').trim()
      alertMessage = emailBody
      alertLevel = 'warning'
    } else if (emailSubject.startsWith('[EMERGENCY]')) {
      alertTitle = emailSubject.replace('[EMERGENCY]', '').trim()
      alertMessage = emailBody
      alertLevel = 'danger'
    }

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
      await supabase.from('alert_rule_triggers').insert({
        rule_id: rule.id,
        trigger_source: 'email',
        trigger_payload: { from: payload.from, subject: payload.subject },
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
        author_id: rule.created_by,
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
        trigger_source: 'email',
        trigger_payload: { from: payload.from, subject: payload.subject },
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
      trigger_source: 'email',
      trigger_payload: {
        from: payload.from,
        subject: payload.subject,
        bodyLength: emailBody.length,
      },
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
    console.error('Error processing email trigger:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
