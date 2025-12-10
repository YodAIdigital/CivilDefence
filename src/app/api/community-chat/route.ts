import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'
import { getPromptConfigByType, DEFAULT_PROMPTS } from '@/lib/ai-prompts'
import { retrieve, formatRetrievalContext, logQuery } from '@/lib/rag/retriever'
import { rerankWithFallback, isRerankingAvailable } from '@/lib/rag/reranker'

interface ChatRequest {
  community_id: string
  message: string
}

interface HouseholdMemberData {
  name: string
  relationship: string
  disabilities?: string[]
}

interface MemberData {
  id: string
  full_name: string | null
  email: string
  role: string
  phone: string | null
  location: string | null
  address: string | null
  skills: string[]
  disabilities: string[]
  equipment: string[]
  has_backup_power: boolean
  has_backup_water: boolean
  has_food_supply: boolean
  household_members: HouseholdMemberData[]
  general_comments: string | null
}

interface GuideData {
  id: string
  name: string
  description: string | null
  guide_type: string
  risk_level: string | null
  sections: unknown
  supplies: unknown
  emergency_contacts: unknown
}

interface CommunityData {
  name: string
  location: string | null
  meeting_point_name: string | null
  meeting_point_address: string | null
  member_count: number
  members: MemberData[]
  guides: GuideData[]
  groups: { name: string; member_count: number }[]
  summary: {
    total_members: number
    total_households: number
    roles: { role: string; count: number }[]
    skills_summary: { skill: string; count: number }[]
    equipment_summary: { equipment: string; count: number }[]
    needs_assistance: number
    has_backup_power: number
    has_backup_water: number
    has_food_supply: number
  }
}

// Build community data summary for AI context
async function buildCommunityDataContext(
  supabaseUrl: string,
  supabaseServiceKey: string,
  communityId: string
): Promise<CommunityData | null> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Fetch community details
  const { data: community, error: communityError } = await supabase
    .from('communities')
    .select('name, location, meeting_point_name, meeting_point_address, member_count')
    .eq('id', communityId)
    .single()

  if (communityError || !community) {
    console.error('[community-chat] Failed to fetch community:', communityError)
    return null
  }

  // Fetch community members with their profiles including notification_preferences (extended data)
  const { data: members, error: membersError } = await supabase
    .from('community_members')
    .select(`
      id,
      role,
      user_id,
      profiles (
        id,
        full_name,
        email,
        phone,
        location,
        notification_preferences
      )
    `)
    .eq('community_id', communityId)

  if (membersError) {
    console.error('[community-chat] Failed to fetch members:', membersError)
    return null
  }

  // Fetch community guides
  const { data: guides, error: guidesError } = await supabase
    .from('community_guides')
    .select('id, name, description, guide_type, risk_level, sections, supplies, emergency_contacts')
    .eq('community_id', communityId)
    .eq('is_active', true)

  if (guidesError) {
    console.error('[community-chat] Failed to fetch guides:', guidesError)
  }

  // Fetch community groups
  const { data: groups, error: groupsError } = await supabase
    .from('community_groups')
    .select('name, member_count')
    .eq('community_id', communityId)
    .eq('is_active', true)

  if (groupsError) {
    console.error('[community-chat] Failed to fetch groups:', groupsError)
  }

  // Process member data - handle Supabase join response format
  // Extended profile data is stored in notification_preferences JSON field
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const processedMembers: MemberData[] = ((members || []) as any[]).map((m): MemberData => {
    // Supabase returns joined data as an object or array depending on the relationship
    const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles

    // Extended data is stored in notification_preferences JSON
    const extendedData = profile?.notification_preferences || {}

    return {
      id: profile?.id || m.user_id,
      full_name: profile?.full_name || null,
      email: profile?.email || '',
      role: m.role as string,
      phone: profile?.phone || extendedData.mobile_number || null,
      location: profile?.location || null,
      address: extendedData.address || null,
      skills: extendedData.skills || [],
      disabilities: extendedData.disabilities || [],
      equipment: extendedData.equipment || [],
      has_backup_power: extendedData.has_backup_power || false,
      has_backup_water: extendedData.has_backup_water || false,
      has_food_supply: extendedData.has_food_supply || false,
      household_members: (extendedData.household_members || []).map((hm: { name?: string; relationship?: string; disabilities?: string[] }) => ({
        name: hm.name || 'Unknown',
        relationship: hm.relationship || 'Unknown',
        disabilities: hm.disabilities || []
      })),
      general_comments: extendedData.general_comments || null
    }
  })

  // Calculate summary statistics
  const roleCounts: Record<string, number> = {}
  const skillCounts: Record<string, number> = {}
  const equipmentCounts: Record<string, number> = {}
  let needsAssistanceCount = 0
  let backupPowerCount = 0
  let backupWaterCount = 0
  let foodSupplyCount = 0
  let totalHouseholds = 0

  for (const member of processedMembers) {
    // Role counts
    roleCounts[member.role] = (roleCounts[member.role] || 0) + 1

    // Skills counts
    for (const skill of member.skills) {
      skillCounts[skill] = (skillCounts[skill] || 0) + 1
    }

    // Equipment counts
    for (const equip of member.equipment) {
      equipmentCounts[equip] = (equipmentCounts[equip] || 0) + 1
    }

    // Count members who need assistance (have disabilities or household members with disabilities)
    const householdDisabilities = member.household_members.flatMap(hm => hm.disabilities || [])
    if (member.disabilities.length > 0 || householdDisabilities.length > 0) {
      needsAssistanceCount++
    }

    // Preparedness counts
    if (member.has_backup_power) backupPowerCount++
    if (member.has_backup_water) backupWaterCount++
    if (member.has_food_supply) foodSupplyCount++

    // Household count (1 per member + their household members)
    totalHouseholds += 1 + member.household_members.length
  }

  // Process guides - use any to avoid complex typing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const processedGuides: GuideData[] = ((guides || []) as any[]).map(g => ({
    id: g.id as string,
    name: g.name as string,
    description: g.description as string | null,
    guide_type: g.guide_type as string,
    risk_level: g.risk_level as string | null,
    sections: g.sections,
    supplies: g.supplies,
    emergency_contacts: g.emergency_contacts
  }))

  // Process groups
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const processedGroups = ((groups || []) as any[]).map(g => ({
    name: g.name as string,
    member_count: g.member_count as number
  }))

  const communityData: CommunityData = {
    name: community.name as string,
    location: community.location as string | null,
    meeting_point_name: community.meeting_point_name as string | null,
    meeting_point_address: community.meeting_point_address as string | null,
    member_count: community.member_count as number,
    members: processedMembers,
    guides: processedGuides,
    groups: processedGroups,
    summary: {
      total_members: processedMembers.length,
      total_households: totalHouseholds,
      roles: Object.entries(roleCounts).map(([role, count]) => ({ role, count })),
      skills_summary: Object.entries(skillCounts).map(([skill, count]) => ({ skill, count })),
      equipment_summary: Object.entries(equipmentCounts).map(([equipment, count]) => ({ equipment, count })),
      needs_assistance: needsAssistanceCount,
      has_backup_power: backupPowerCount,
      has_backup_water: backupWaterCount,
      has_food_supply: foodSupplyCount
    }
  }

  return communityData
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json()
    const { community_id, message } = body

    if (!community_id || !message) {
      return NextResponse.json(
        { error: 'Community ID and message are required' },
        { status: 400 }
      )
    }

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
        { error: 'AI chat is not configured. Please add your Gemini API key.' },
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
        { error: 'Only admins and team members can use the AI chat feature' },
        { status: 403 }
      )
    }

    // Build community data context
    const communityData = await buildCommunityDataContext(supabaseUrl, supabaseServiceKey, community_id)
    if (!communityData) {
      return NextResponse.json(
        { error: 'Failed to load community data' },
        { status: 500 }
      )
    }

    // Retrieve relevant RAG context
    let ragContext = ''
    let ragResults: { chunkId: string; score: number }[] = []
    try {
      // Perform hybrid search on the knowledge base
      let results = await retrieve(message, {
        topK: isRerankingAvailable() ? 10 : 5, // Get more for reranking
        useHybridSearch: true,
      })

      // Apply reranking for better relevance
      if (results.length > 0) {
        results = await rerankWithFallback(message, results, { topK: 5 })
      }

      // Store results for logging
      ragResults = results.map(r => ({ chunkId: r.chunkId, score: r.score }))

      // Format context for the prompt
      if (results.length > 0) {
        ragContext = formatRetrievalContext(results)
        console.log('[community-chat] RAG context retrieved:', results.length, 'chunks')
      }
    } catch (ragError) {
      // Don't fail the request if RAG fails, just proceed without context
      console.error('[community-chat] RAG retrieval error (continuing without):', ragError)
    }

    // Get prompt configuration
    const promptConfig = await getPromptConfigByType('community_chat')
    const promptTemplate = promptConfig?.prompt_template || DEFAULT_PROMPTS.community_chat.prompt_template
    const modelId = promptConfig?.model_id || DEFAULT_PROMPTS.community_chat.model_id

    // Build the prompt with community data and RAG context
    const prompt = promptTemplate
      .replace(/\{\{communityName\}\}/g, communityData.name)
      .replace(/\{\{communityData\}\}/g, JSON.stringify(communityData, null, 2))
      .replace(/\{\{ragContext\}\}/g, ragContext)
      .replace(/\{\{userQuestion\}\}/g, message)

    console.log('[community-chat] Model:', modelId)
    console.log('[community-chat] Community:', communityData.name)
    console.log('[community-chat] User question:', message)
    console.log('[community-chat] Community data summary:', {
      total_members: communityData.summary.total_members,
      total_households: communityData.summary.total_households,
      roles: communityData.summary.roles,
      skills: communityData.summary.skills_summary,
      equipment: communityData.summary.equipment_summary,
      needs_assistance: communityData.summary.needs_assistance,
      guides: communityData.guides.length,
      groups: communityData.groups.length
    })
    console.log('[community-chat] RAG chunks used:', ragResults.length)

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: modelId })

    // Call Gemini API
    const result = await model.generateContent(prompt)
    const response = await result.response
    const aiResponse = response.text()

    // Store chat history (optional - for audit)
    try {
      await supabase
        .from('community_ai_chat_history')
        .insert({
          community_id,
          user_id: user.id,
          user_message: message,
          ai_response: aiResponse,
          model_used: modelId
        })
    } catch (historyError) {
      // Don't fail the request if history logging fails
      console.error('[community-chat] Failed to log chat history:', historyError)
    }

    // Log RAG query for analytics (if we used RAG)
    if (ragResults.length > 0) {
      try {
        await logQuery(
          user.id,
          community_id,
          message,
          ragResults.map(r => r.chunkId),
          ragResults.map(r => r.score),
          modelId,
          aiResponse
        )
      } catch (logError) {
        // Don't fail the request if logging fails
        console.error('[community-chat] Failed to log RAG query:', logError)
      }
    }

    return NextResponse.json({
      response: aiResponse,
      model_used: modelId,
      rag_chunks_used: ragResults.length
    })

  } catch (error) {
    console.error('[community-chat] Error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to process chat request',
        details: 'Please try again'
      },
      { status: 500 }
    )
  }
}
