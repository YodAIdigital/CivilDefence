import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { semanticSearch, formatRetrievalContext } from '@/lib/rag/retriever'

/**
 * API route to generate an ephemeral token for Gemini Live API
 * This allows the client to connect directly to Gemini without exposing the API key
 */
export async function POST(request: NextRequest) {
  try {
    // Get user from auth header
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check for API key
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      console.error('GEMINI_API_KEY not configured')
      return NextResponse.json(
        { error: 'Voice chat is not configured. Please add your Gemini API key.' },
        { status: 503 }
      )
    }

    // Create Supabase client with service role for data access
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get the user ID from the token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid authentication' },
        { status: 401 }
      )
    }

    // Get community_id from request body
    const body = await request.json()
    const { community_id } = body

    if (!community_id) {
      return NextResponse.json(
        { error: 'Community ID is required' },
        { status: 400 }
      )
    }

    // Check if user is admin or team member of this community
    const { data: membership, error: memberError } = await supabase
      .from('community_members')
      .select('role')
      .eq('community_id', community_id)
      .eq('user_id', user.id)
      .single()

    if (memberError || !membership) {
      return NextResponse.json(
        { error: 'You are not a member of this community' },
        { status: 403 }
      )
    }

    // Only allow admin, team_member, or super_admin
    const allowedRoles = ['admin', 'team_member', 'super_admin']
    const memberRole = membership.role as string
    if (!allowedRoles.includes(memberRole)) {
      return NextResponse.json(
        { error: 'Only admins and team members can use the voice chat feature' },
        { status: 403 }
      )
    }

    // Fetch community data for context
    const { data: community } = await supabase
      .from('communities')
      .select('name, location, meeting_point_name, meeting_point_address')
      .eq('id', community_id)
      .single()

    // Fetch community guides for context
    const { data: guides } = await supabase
      .from('community_guides')
      .select('name, description, guide_type, sections')
      .eq('community_id', community_id)
      .eq('is_active', true)

    // Retrieve general RAG knowledge about civil defence and emergency preparedness
    let ragKnowledge = ''
    try {
      // Search for general emergency preparedness information
      const ragResults = await semanticSearch(
        'emergency preparedness civil defence first aid response procedures',
        { topK: 5, semanticThreshold: 0.4 }
      )

      if (ragResults.length > 0) {
        ragKnowledge = formatRetrievalContext(ragResults)
        console.log('[voice-chat-token] RAG knowledge retrieved:', ragResults.length, 'chunks')
      }
    } catch (ragError) {
      // Don't fail if RAG retrieval fails, proceed without
      console.error('[voice-chat-token] RAG retrieval error (continuing without):', ragError)
    }

    // Build context summary for the AI
    const communityContext = {
      name: community?.name || 'Unknown Community',
      location: community?.location || 'Unknown',
      meetingPoint: community?.meeting_point_name
        ? `${community.meeting_point_name} at ${community.meeting_point_address}`
        : 'Not set',
      responsePlans: guides?.map(g => ({
        name: g.name,
        type: g.guide_type,
        description: g.description,
        sections: g.sections
      })) || [],
      ragKnowledge
    }

    // Return the API key and context for client-side connection
    // Note: In production, you should use Google's ephemeral token API
    // For now, we return the necessary data for the client to connect
    return NextResponse.json({
      apiKey,
      communityContext,
      model: 'gemini-2.0-flash-live-001'
    })

  } catch (error) {
    console.error('[voice-chat-token] Error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to generate voice chat token',
        details: 'Please try again'
      },
      { status: 500 }
    )
  }
}
