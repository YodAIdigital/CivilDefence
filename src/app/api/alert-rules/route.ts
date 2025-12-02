import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import type { CommunityAlertRule } from '@/types/database'

// Type for the Supabase client with new tables
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClientWithRules = ReturnType<typeof createAdminClient> & { from: (table: string) => any }

// GET - List rules for a community
export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient() as SupabaseClientWithRules
    const { searchParams } = new URL(request.url)
    const communityId = searchParams.get('communityId')
    const userId = searchParams.get('userId')

    if (!communityId || !userId) {
      return NextResponse.json(
        { error: 'Missing communityId or userId' },
        { status: 400 }
      )
    }

    // Verify user is admin of the community
    const { data: membership } = await supabase
      .from('community_members')
      .select('role')
      .eq('community_id', communityId)
      .eq('user_id', userId)
      .single()

    const { data: community } = await supabase
      .from('communities')
      .select('created_by')
      .eq('id', communityId)
      .single()

    const isAdmin = membership?.role === 'admin' || membership?.role === 'super_admin'
    const isCreator = community?.created_by === userId

    if (!isAdmin && !isCreator) {
      return NextResponse.json(
        { error: 'Not authorized to view rules' },
        { status: 403 }
      )
    }

    // Fetch rules
    const { data: rules, error } = await supabase
      .from('community_alert_rules')
      .select('*')
      .eq('community_id', communityId)
      .order('created_at', { ascending: false }) as { data: CommunityAlertRule[] | null; error: Error | null }

    if (error) {
      console.error('Error fetching rules:', error)
      return NextResponse.json(
        { error: 'Failed to fetch rules' },
        { status: 500 }
      )
    }

    return NextResponse.json({ rules })
  } catch (error) {
    console.error('Error in GET /api/alert-rules:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create a new rule
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient() as SupabaseClientWithRules
    const body = await request.json()

    const {
      communityId,
      userId,
      name,
      description,
      triggerType,
      alertTitle,
      alertMessage,
      alertLevel = 'info',
      recipientGroup = 'members',
      specificMemberIds = [],
      sendEmail = true,
      sendSms = false,
      sendAppNotification = true,
    } = body

    if (!communityId || !userId || !name || !triggerType || !alertTitle || !alertMessage) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Verify user is admin of the community
    const { data: membership } = await supabase
      .from('community_members')
      .select('role')
      .eq('community_id', communityId)
      .eq('user_id', userId)
      .single()

    const { data: community } = await supabase
      .from('communities')
      .select('created_by, name')
      .eq('id', communityId)
      .single()

    const isAdmin = membership?.role === 'admin' || membership?.role === 'super_admin'
    const isCreator = community?.created_by === userId

    if (!isAdmin && !isCreator) {
      return NextResponse.json(
        { error: 'Not authorized to create rules' },
        { status: 403 }
      )
    }

    // Generate a trigger email if this is an email trigger
    let triggerEmail: string | null = null
    if (triggerType === 'email') {
      // Generate a unique email address for this rule
      // Format: alerts-{communityId-first8chars}-{random6chars}@yourdomain.com
      const randomPart = Math.random().toString(36).substring(2, 8)
      const communityPart = communityId.substring(0, 8)
      // This would need to be configured with your actual domain
      const domain = process.env.ALERT_EMAIL_DOMAIN || 'alerts.civildefence.app'
      triggerEmail = `alert-${communityPart}-${randomPart}@${domain}`
    }

    // Create the rule
    const { data: rule, error } = await supabase
      .from('community_alert_rules')
      .insert({
        community_id: communityId,
        name,
        description,
        trigger_type: triggerType,
        trigger_email: triggerEmail,
        alert_title: alertTitle,
        alert_message: alertMessage,
        alert_level: alertLevel,
        recipient_group: recipientGroup,
        specific_member_ids: specificMemberIds,
        send_email: sendEmail,
        send_sms: sendSms,
        send_app_notification: sendAppNotification,
        created_by: userId,
      })
      .select()
      .single() as { data: CommunityAlertRule | null; error: Error | null }

    if (error) {
      console.error('Error creating rule:', error)
      return NextResponse.json(
        { error: 'Failed to create rule' },
        { status: 500 }
      )
    }

    return NextResponse.json({ rule })
  } catch (error) {
    console.error('Error in POST /api/alert-rules:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
