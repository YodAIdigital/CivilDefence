import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendEmail, getCommunityAlertEmail } from '@/lib/email'
import { sendSms, formatAlertSms } from '@/lib/sms'

type AlertLevel = 'info' | 'warning' | 'danger'
type RecipientGroup = 'admin' | 'team' | 'members' | 'specific'

interface AlertRequest {
  communityId: string
  senderId: string
  title: string
  message: string
  alertLevel: AlertLevel
  recipientGroup: RecipientGroup
  specificMemberIds?: string[]
  sendEmail: boolean
  sendSms: boolean
  sendAppAlert: boolean
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient()

    const body: AlertRequest = await request.json()
    const {
      communityId,
      senderId,
      title,
      message,
      alertLevel,
      recipientGroup,
      specificMemberIds,
      sendEmail: shouldSendEmail,
      sendSms: shouldSendSms,
      sendAppAlert,
    } = body

    // Validate required fields
    if (!communityId || !senderId || !title || !message || !alertLevel || !recipientGroup) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Verify sender is admin of the community
    console.log('=== COMMUNITY ALERT DEBUG ===')
    console.log('Checking membership for:', { communityId, senderId })
    console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'NOT SET')
    console.log('Service Key:', process.env.SUPABASE_SERVICE_KEY ? 'Set (length: ' + process.env.SUPABASE_SERVICE_KEY.length + ')' : 'NOT SET')

    // First check if user is the community creator (they have full access)
    const { data: community, error: communityError } = await supabase
      .from('communities')
      .select('created_by, name')
      .eq('id', communityId)
      .single()

    console.log('Community query result:', { data: community, error: communityError })

    if (communityError) {
      console.log('Community error details:', JSON.stringify(communityError, null, 2))
      return NextResponse.json(
        { error: `Failed to fetch community: ${communityError.message}` },
        { status: 500 }
      )
    }

    if (!community) {
      return NextResponse.json(
        { error: 'Community not found' },
        { status: 404 }
      )
    }

    const isCreator = community.created_by === senderId
    console.log('Is creator:', isCreator, '| community.created_by:', community.created_by, '| senderId:', senderId)

    // Check membership
    const { data: membership, error: membershipError } = await supabase
      .from('community_members')
      .select('user_id, role')
      .eq('community_id', communityId)
      .eq('user_id', senderId)
      .maybeSingle()

    console.log('Membership query result:', { data: membership, error: membershipError })

    if (membershipError) {
      console.log('Membership error details:', JSON.stringify(membershipError, null, 2))
    }

    const isMember = !!membership
    const isAdmin = isMember && (membership?.role === 'admin' || membership?.role === 'super_admin')

    console.log('Permission check:', { isCreator, isMember, isAdmin, memberRole: membership?.role })
    console.log('=== END DEBUG ===')

    if (!isMember && !isCreator) {
      return NextResponse.json(
        { error: `You are not authorized to send alerts. SenderId: ${senderId}, isCreator: ${isCreator}, isMember: ${isMember}` },
        { status: 403 }
      )
    }

    // Only admins or creators can send alerts
    if (!isAdmin && !isCreator) {
      return NextResponse.json(
        { error: 'Only community admins can send alerts' },
        { status: 403 }
      )
    }

    // Fetch sender profile
    const { data: senderProfile, error: senderError } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', senderId)
      .single()

    if (senderError || !senderProfile) {
      return NextResponse.json(
        { error: 'Sender profile not found' },
        { status: 404 }
      )
    }

    // Determine recipients based on group
    let recipientUserIds: string[] = []

    if (recipientGroup === 'specific' && specificMemberIds && specificMemberIds.length > 0) {
      recipientUserIds = specificMemberIds
    } else {
      // Build query based on recipient group
      let query = supabase
        .from('community_members')
        .select('user_id, role')
        .eq('community_id', communityId)

      if (recipientGroup === 'admin') {
        query = query.in('role', ['admin', 'super_admin'])
      } else if (recipientGroup === 'team') {
        query = query.in('role', ['admin', 'super_admin', 'team_member'])
      }
      // 'members' gets all members (no additional filter)

      const { data: members, error: membersError } = await query

      if (membersError) {
        return NextResponse.json(
          { error: 'Failed to fetch community members' },
          { status: 500 }
        )
      }

      recipientUserIds = members?.map(m => m.user_id) || []
    }

    if (recipientUserIds.length === 0) {
      return NextResponse.json(
        { error: 'No recipients found for the selected group' },
        { status: 400 }
      )
    }

    // Map alert level to database level
    const dbAlertLevel = alertLevel === 'danger' ? 'danger' : alertLevel

    let alertId: string | null = null
    let emailsSent = 0
    let smsSent = 0
    const emailErrors: string[] = []
    const smsErrors: string[] = []

    // Always create an alert record for history tracking
    const { data: alert, error: alertError } = await supabase
      .from('alerts')
      .insert({
        title,
        content: message,
        level: dbAlertLevel,
        community_id: communityId,
        author_id: senderId,
        is_public: false,
        is_active: sendAppAlert, // Only show in dashboard if sendAppAlert is true
        sent_via_email: shouldSendEmail,
        sent_via_sms: shouldSendSms,
        sent_via_app: sendAppAlert,
        recipient_count: recipientUserIds.length,
        recipient_group: recipientGroup,
      })
      .select('id')
      .single()

    if (alertError) {
      console.error('Failed to create alert:', alertError)
      return NextResponse.json(
        { error: 'Failed to create alert in database' },
        { status: 500 }
      )
    }

    alertId = alert.id

    // Create alert_recipients entries for targeted delivery
    const recipientEntries = recipientUserIds.map(userId => ({
      alert_id: alert.id,
      user_id: userId,
    }))

    // Try to insert alert recipients (table might not exist)
    try {
      const supabaseAny = supabase as unknown as {
        from: (table: string) => {
          insert: (data: unknown[]) => Promise<{ error: Error | null }>
        }
      }
      await supabaseAny
        .from('alert_recipients')
        .insert(recipientEntries)
    } catch {
      // Table might not exist yet - alert will still be visible via community_id
      console.log('alert_recipients table not available, using community-wide delivery')
    }

    // Fetch recipient profiles for email and SMS
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, full_name, phone')
      .in('id', recipientUserIds)

    if (profilesError) {
      console.error('Failed to fetch recipient profiles:', profilesError)
    }

    // Send emails if requested
    if (shouldSendEmail && profiles && profiles.length > 0) {
      const emailTemplate = getCommunityAlertEmail({
        communityName: community.name,
        senderName: senderProfile.full_name || senderProfile.email,
        alertLevel,
        title,
        message,
      })

      // Send emails to all recipients
      for (const profile of profiles) {
        if (profile.email) {
          try {
            const success = await sendEmail({
              to: profile.email,
              subject: emailTemplate.subject,
              html: emailTemplate.html,
            })

            if (success) {
              emailsSent++
            } else {
              emailErrors.push(profile.email)
            }
          } catch (err) {
            console.error(`Failed to send email to ${profile.email}:`, err)
            emailErrors.push(profile.email)
          }
        }
      }
    }

    // Send SMS if requested
    if (shouldSendSms && profiles && profiles.length > 0) {
      const smsMessage = formatAlertSms({
        communityName: community.name,
        alertLevel,
        title,
        message,
      })

      // Send SMS to all recipients with phone numbers
      for (const profile of profiles) {
        if (profile.phone) {
          try {
            const result = await sendSms({
              to: profile.phone,
              message: smsMessage,
            })

            if (result.success) {
              smsSent++
            } else {
              smsErrors.push(profile.phone)
            }
          } catch (err) {
            console.error(`Failed to send SMS to ${profile.phone}:`, err)
            smsErrors.push(profile.phone)
          }
        }
      }
    }

    // Update alert with actual sent counts
    if (alertId && (emailsSent > 0 || smsSent > 0)) {
      await supabase
        .from('alerts')
        .update({
          email_sent_count: emailsSent,
          sms_sent_count: smsSent,
        })
        .eq('id', alertId)
    }

    return NextResponse.json({
      success: true,
      alertId,
      recipientCount: recipientUserIds.length,
      emailsSent,
      smsSent,
      emailErrors: emailErrors.length > 0 ? emailErrors : undefined,
      smsErrors: smsErrors.length > 0 ? smsErrors : undefined,
    })
  } catch (error) {
    console.error('Error sending community alert:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Internal server error: ${errorMessage}` },
      { status: 500 }
    )
  }
}
