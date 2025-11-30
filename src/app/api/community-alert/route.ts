import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendEmail, getCommunityAlertEmail } from '@/lib/email'

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
    const { data: senderMembership, error: membershipError } = await supabase
      .from('community_members')
      .select('role')
      .eq('community_id', communityId)
      .eq('user_id', senderId)
      .single()

    if (membershipError || !senderMembership) {
      return NextResponse.json(
        { error: 'You are not a member of this community' },
        { status: 403 }
      )
    }

    if (senderMembership.role !== 'admin' && senderMembership.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Only community admins can send alerts' },
        { status: 403 }
      )
    }

    // Fetch community details
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
    const emailErrors: string[] = []

    // Create app alert if requested
    if (sendAppAlert) {
      const { data: alert, error: alertError } = await supabase
        .from('alerts')
        .insert({
          title,
          content: message,
          level: dbAlertLevel,
          community_id: communityId,
          author_id: senderId,
          is_public: false,
          is_active: true,
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
    }

    // Send emails if requested
    if (shouldSendEmail) {
      // Fetch recipient emails
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', recipientUserIds)

      if (profilesError) {
        console.error('Failed to fetch recipient profiles:', profilesError)
      } else if (profiles && profiles.length > 0) {
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
    }

    return NextResponse.json({
      success: true,
      alertId,
      recipientCount: recipientUserIds.length,
      emailsSent,
      emailErrors: emailErrors.length > 0 ? emailErrors : undefined,
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
