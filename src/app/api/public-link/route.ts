import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Lazy initialization to avoid build-time errors
let supabaseAdmin: SupabaseClient | null = null

function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_KEY

    if (!url || !key) {
      throw new Error('Missing Supabase configuration: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY')
    }

    supabaseAdmin = createClient(url, key)
  }
  return supabaseAdmin
}

// Generate a unique 8-character code
function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Exclude confusing chars (I, O, 0, 1)
  let result = ''
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// GET - Fetch active public link for a community
export async function GET(request: NextRequest) {
  const communityId = request.nextUrl.searchParams.get('communityId')
  const code = request.nextUrl.searchParams.get('code')

  try {
    if (code) {
      // Fetch link by code (for join page)
      const { data, error } = await getSupabaseAdmin()
        .from('community_public_links')
        .select(`
          *,
          community:communities(id, name, description, location)
        `)
        .eq('code', code.toUpperCase())
        .eq('is_active', true)
        .single()

      if (error || !data) {
        return NextResponse.json(
          { error: 'Invalid or expired invite link' },
          { status: 404 }
        )
      }

      // Check if expired
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        return NextResponse.json(
          { error: 'This invite link has expired' },
          { status: 410 }
        )
      }

      // Check if max uses reached
      if (data.max_uses && data.uses_count >= data.max_uses) {
        return NextResponse.json(
          { error: 'This invite link has reached its maximum uses' },
          { status: 410 }
        )
      }

      return NextResponse.json({ link: data })
    }

    if (!communityId) {
      return NextResponse.json(
        { error: 'Community ID is required' },
        { status: 400 }
      )
    }

    // Fetch active link for community
    const { data, error } = await getSupabaseAdmin()
      .from('community_public_links')
      .select('*')
      .eq('community_id', communityId)
      .eq('is_active', true)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found, which is OK
      throw error
    }

    return NextResponse.json({ link: data || null })
  } catch (error) {
    console.error('Error fetching public link:', error)
    return NextResponse.json(
      { error: 'Failed to fetch public link' },
      { status: 500 }
    )
  }
}

// POST - Create or regenerate public link for a community
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { communityId, userId, role = 'member' } = body

    if (!communityId || !userId) {
      return NextResponse.json(
        { error: 'Community ID and User ID are required' },
        { status: 400 }
      )
    }

    // Verify user is admin of this community
    const { data: memberData, error: memberError } = await getSupabaseAdmin()
      .from('community_members')
      .select('role')
      .eq('community_id', communityId)
      .eq('user_id', userId)
      .single()

    if (memberError || !memberData || !['admin', 'super_admin'].includes(memberData.role)) {
      return NextResponse.json(
        { error: 'Only community admins can create invite links' },
        { status: 403 }
      )
    }

    // Deactivate any existing active links
    await getSupabaseAdmin()
      .from('community_public_links')
      .update({ is_active: false })
      .eq('community_id', communityId)
      .eq('is_active', true)

    // Generate unique code (retry if collision)
    let code = generateCode()
    let attempts = 0
    while (attempts < 5) {
      const { data: existing } = await getSupabaseAdmin()
        .from('community_public_links')
        .select('code')
        .eq('code', code)
        .single()

      if (!existing) break
      code = generateCode()
      attempts++
    }

    // Create new link
    const { data, error } = await getSupabaseAdmin()
      .from('community_public_links')
      .insert({
        community_id: communityId,
        created_by: userId,
        code,
        role,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ link: data })
  } catch (error) {
    console.error('Error creating public link:', error)
    return NextResponse.json(
      { error: 'Failed to create public link' },
      { status: 500 }
    )
  }
}

// PATCH - Increment uses count when someone joins
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { code } = body

    if (!code) {
      return NextResponse.json(
        { error: 'Code is required' },
        { status: 400 }
      )
    }

    // Try to increment via RPC first
    const { error: updateError } = await getSupabaseAdmin().rpc('increment_link_uses', { link_code: code.toUpperCase() })

    if (updateError) {
      // Fallback: manual increment
      const { data: linkData } = await getSupabaseAdmin()
        .from('community_public_links')
        .select('uses_count')
        .eq('code', code.toUpperCase())
        .single()

      if (linkData) {
        await getSupabaseAdmin()
          .from('community_public_links')
          .update({ uses_count: (linkData.uses_count || 0) + 1 })
          .eq('code', code.toUpperCase())
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating public link:', error)
    return NextResponse.json(
      { error: 'Failed to update public link' },
      { status: 500 }
    )
  }
}

// DELETE - Deactivate a public link
export async function DELETE(request: NextRequest) {
  const communityId = request.nextUrl.searchParams.get('communityId')
  const userId = request.nextUrl.searchParams.get('userId')

  if (!communityId || !userId) {
    return NextResponse.json(
      { error: 'Community ID and User ID are required' },
      { status: 400 }
    )
  }

  try {
    // Verify user is admin
    const { data: memberData, error: memberError } = await getSupabaseAdmin()
      .from('community_members')
      .select('role')
      .eq('community_id', communityId)
      .eq('user_id', userId)
      .single()

    if (memberError || !memberData || !['admin', 'super_admin'].includes(memberData.role)) {
      return NextResponse.json(
        { error: 'Only community admins can deactivate invite links' },
        { status: 403 }
      )
    }

    // Deactivate all active links for this community
    const { error } = await getSupabaseAdmin()
      .from('community_public_links')
      .update({ is_active: false })
      .eq('community_id', communityId)
      .eq('is_active', true)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deactivating public link:', error)
    return NextResponse.json(
      { error: 'Failed to deactivate public link' },
      { status: 500 }
    )
  }
}
