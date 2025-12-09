import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { sendEmail, getCommunityInvitationEmail } from '@/lib/email'

// Lazy-initialized admin supabase client for server-side operations
let supabaseAdmin: SupabaseClient | null = null

function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )
  }
  return supabaseAdmin
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { invitationId, communityId, email, role, invitedBy, token } = body

    if (!invitationId || !communityId || !email || !role || !invitedBy) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Fetch community details
    const { data: community, error: communityError } = await getSupabaseAdmin()
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

    // Fetch inviter details
    const { data: inviter, error: inviterError } = await getSupabaseAdmin()
      .from('profiles')
      .select('full_name, email')
      .eq('id', invitedBy)
      .single()

    if (inviterError || !inviter) {
      return NextResponse.json(
        { error: 'Inviter not found' },
        { status: 404 }
      )
    }

    // Build invite URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const inviteUrl = `${appUrl}/invite/${token}`

    // Calculate expiry date (7 days from now)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const expiresAtFormatted = expiresAt.toLocaleDateString('en-NZ', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    // Format role for display
    const roleLabels: Record<string, string> = {
      member: 'Member',
      team_member: 'Team Member',
      admin: 'Admin',
    }
    const roleLabel = roleLabels[role] || role

    // Generate email content
    const { subject, html } = getCommunityInvitationEmail({
      communityName: community.name,
      inviterName: inviter.full_name || inviter.email || 'A community admin',
      role: roleLabel,
      inviteUrl,
      expiresAt: expiresAtFormatted,
    })

    // Send the email
    const emailSent = await sendEmail({
      to: email,
      subject,
      html,
    })

    if (!emailSent) {
      return NextResponse.json(
        { error: 'Failed to send invitation email' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error sending invitation:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
