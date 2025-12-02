import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import type { CommunityAlertRule, AlertRuleTrigger } from '@/types/database'

// Type for the Supabase client with new tables
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClientWithRules = ReturnType<typeof createAdminClient> & { from: (table: string) => any }

// GET - Get a single rule with its trigger history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createAdminClient() as SupabaseClientWithRules
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId' },
        { status: 400 }
      )
    }

    // Fetch the rule
    const { data: rule, error: ruleError } = await supabase
      .from('community_alert_rules')
      .select('*')
      .eq('id', id)
      .single() as { data: CommunityAlertRule | null; error: Error | null }

    if (ruleError || !rule) {
      return NextResponse.json(
        { error: 'Rule not found' },
        { status: 404 }
      )
    }

    // Verify user is admin of the community
    const { data: membership } = await supabase
      .from('community_members')
      .select('role')
      .eq('community_id', rule.community_id)
      .eq('user_id', userId)
      .single()

    const { data: community } = await supabase
      .from('communities')
      .select('created_by')
      .eq('id', rule.community_id)
      .single()

    const isAdmin = membership?.role === 'admin' || membership?.role === 'super_admin'
    const isCreator = community?.created_by === userId

    if (!isAdmin && !isCreator) {
      return NextResponse.json(
        { error: 'Not authorized to view this rule' },
        { status: 403 }
      )
    }

    // Fetch recent trigger history
    const { data: triggers } = await supabase
      .from('alert_rule_triggers')
      .select('*')
      .eq('rule_id', id)
      .order('triggered_at', { ascending: false })
      .limit(20) as { data: AlertRuleTrigger[] | null }

    return NextResponse.json({ rule, triggers: triggers || [] })
  } catch (error) {
    console.error('Error in GET /api/alert-rules/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH - Update a rule
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createAdminClient() as SupabaseClientWithRules
    const { id } = await params
    const body = await request.json()

    const { userId, ...updates } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId' },
        { status: 400 }
      )
    }

    // Fetch the rule to get community_id
    const { data: existingRule, error: fetchError } = await supabase
      .from('community_alert_rules')
      .select('community_id')
      .eq('id', id)
      .single() as { data: { community_id: string } | null; error: Error | null }

    if (fetchError || !existingRule) {
      return NextResponse.json(
        { error: 'Rule not found' },
        { status: 404 }
      )
    }

    // Verify user is admin of the community
    const { data: membership } = await supabase
      .from('community_members')
      .select('role')
      .eq('community_id', existingRule.community_id)
      .eq('user_id', userId)
      .single()

    const { data: community } = await supabase
      .from('communities')
      .select('created_by')
      .eq('id', existingRule.community_id)
      .single()

    const isAdmin = membership?.role === 'admin' || membership?.role === 'super_admin'
    const isCreator = community?.created_by === userId

    if (!isAdmin && !isCreator) {
      return NextResponse.json(
        { error: 'Not authorized to update this rule' },
        { status: 403 }
      )
    }

    // Build update object with snake_case field names
    const updateData: Record<string, unknown> = {
      updated_by: userId,
    }

    if (updates.name !== undefined) updateData.name = updates.name
    if (updates.description !== undefined) updateData.description = updates.description
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive
    if (updates.alertTitle !== undefined) updateData.alert_title = updates.alertTitle
    if (updates.alertMessage !== undefined) updateData.alert_message = updates.alertMessage
    if (updates.alertLevel !== undefined) updateData.alert_level = updates.alertLevel
    if (updates.recipientGroup !== undefined) updateData.recipient_group = updates.recipientGroup
    if (updates.specificMemberIds !== undefined) updateData.specific_member_ids = updates.specificMemberIds
    if (updates.sendEmail !== undefined) updateData.send_email = updates.sendEmail
    if (updates.sendSms !== undefined) updateData.send_sms = updates.sendSms
    if (updates.sendAppNotification !== undefined) updateData.send_app_notification = updates.sendAppNotification

    // Update the rule
    const { data: rule, error } = await supabase
      .from('community_alert_rules')
      .update(updateData)
      .eq('id', id)
      .select()
      .single() as { data: CommunityAlertRule | null; error: Error | null }

    if (error) {
      console.error('Error updating rule:', error)
      return NextResponse.json(
        { error: 'Failed to update rule' },
        { status: 500 }
      )
    }

    return NextResponse.json({ rule })
  } catch (error) {
    console.error('Error in PATCH /api/alert-rules/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a rule
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createAdminClient() as SupabaseClientWithRules
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId' },
        { status: 400 }
      )
    }

    // Fetch the rule to get community_id
    const { data: existingRule, error: fetchError } = await supabase
      .from('community_alert_rules')
      .select('community_id')
      .eq('id', id)
      .single() as { data: { community_id: string } | null; error: Error | null }

    if (fetchError || !existingRule) {
      return NextResponse.json(
        { error: 'Rule not found' },
        { status: 404 }
      )
    }

    // Verify user is admin of the community
    const { data: membership } = await supabase
      .from('community_members')
      .select('role')
      .eq('community_id', existingRule.community_id)
      .eq('user_id', userId)
      .single()

    const { data: community } = await supabase
      .from('communities')
      .select('created_by')
      .eq('id', existingRule.community_id)
      .single()

    const isAdmin = membership?.role === 'admin' || membership?.role === 'super_admin'
    const isCreator = community?.created_by === userId

    if (!isAdmin && !isCreator) {
      return NextResponse.json(
        { error: 'Not authorized to delete this rule' },
        { status: 403 }
      )
    }

    // Delete the rule (cascade will handle trigger history)
    const { error } = await supabase
      .from('community_alert_rules')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting rule:', error)
      return NextResponse.json(
        { error: 'Failed to delete rule' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/alert-rules/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Regenerate webhook token
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createAdminClient() as SupabaseClientWithRules
    const { id } = await params
    const body = await request.json()

    const { userId, action } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId' },
        { status: 400 }
      )
    }

    // Fetch the rule to get community_id
    const { data: existingRule, error: fetchError } = await supabase
      .from('community_alert_rules')
      .select('community_id, trigger_type')
      .eq('id', id)
      .single() as { data: { community_id: string; trigger_type: string } | null; error: Error | null }

    if (fetchError || !existingRule) {
      return NextResponse.json(
        { error: 'Rule not found' },
        { status: 404 }
      )
    }

    // Verify user is admin of the community
    const { data: membership } = await supabase
      .from('community_members')
      .select('role')
      .eq('community_id', existingRule.community_id)
      .eq('user_id', userId)
      .single()

    const { data: community } = await supabase
      .from('communities')
      .select('created_by')
      .eq('id', existingRule.community_id)
      .single()

    const isAdmin = membership?.role === 'admin' || membership?.role === 'super_admin'
    const isCreator = community?.created_by === userId

    if (!isAdmin && !isCreator) {
      return NextResponse.json(
        { error: 'Not authorized to update this rule' },
        { status: 403 }
      )
    }

    if (action === 'regenerate-token') {
      if (existingRule.trigger_type !== 'webhook') {
        return NextResponse.json(
          { error: 'Can only regenerate token for webhook rules' },
          { status: 400 }
        )
      }

      // Generate a new UUID for the webhook token
      const newToken = crypto.randomUUID()

      const { data: rule, error } = await supabase
        .from('community_alert_rules')
        .update({
          webhook_token: newToken,
          updated_by: userId
        })
        .eq('id', id)
        .select()
        .single() as { data: CommunityAlertRule | null; error: Error | null }

      if (error) {
        console.error('Error regenerating token:', error)
        return NextResponse.json(
          { error: 'Failed to regenerate token' },
          { status: 500 }
        )
      }

      return NextResponse.json({ rule })
    }

    return NextResponse.json(
      { error: 'Unknown action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error in POST /api/alert-rules/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
