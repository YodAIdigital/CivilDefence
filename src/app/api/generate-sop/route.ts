import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getPromptConfigByType, DEFAULT_PROMPTS } from '@/lib/ai-prompts'
import { createAdminClient } from '@/lib/supabase/server'
import type { SOPTemplateTask, SOPTaskCategory } from '@/types/database'

interface GenerateSOPRequest {
  guideId: string
  guideName: string
  guideType: string
  sections: {
    before: Array<{ title: string; content: string }>
    during: Array<{ title: string; content: string }>
    after: Array<{ title: string; content: string }>
  }
  customNotes?: string
  communityId: string
}

function generateTaskId(): string {
  return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

function validateCategory(category: string): SOPTaskCategory {
  const validCategories: SOPTaskCategory[] = ['immediate', 'communication', 'safety', 'logistics', 'recovery', 'other']
  if (validCategories.includes(category as SOPTaskCategory)) {
    return category as SOPTaskCategory
  }
  return 'other'
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateSOPRequest = await request.json()
    const { guideId, guideName, guideType, sections, customNotes, communityId } = body

    console.log('[generate-sop] Request received:')
    console.log('[generate-sop] - Guide ID:', guideId)
    console.log('[generate-sop] - Guide Name:', guideName)
    console.log('[generate-sop] - Guide Type:', guideType)
    console.log('[generate-sop] - Community ID:', communityId)

    if (!guideId || !communityId || !guideName) {
      return NextResponse.json(
        { error: 'Guide ID, community ID, and guide name are required' },
        { status: 400 }
      )
    }

    // Check for API key
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      console.error('GEMINI_API_KEY not configured')
      return NextResponse.json(
        { error: 'AI generation is not configured.' },
        { status: 503 }
      )
    }

    // Fetch community data for location info
    const supabase = createAdminClient()
    const { data: community, error: communityError } = await supabase
      .from('communities')
      .select('name, location, meeting_point_address')
      .eq('id', communityId)
      .single()

    if (communityError) {
      console.error('[generate-sop] Error fetching community:', communityError)
    }

    const location = community?.location || community?.meeting_point_address || 'Unknown location'

    // Get prompt configuration from AI settings
    const promptConfig = await getPromptConfigByType('sop_generation')
    const promptTemplate = promptConfig?.prompt_template || DEFAULT_PROMPTS.sop_generation.prompt_template
    const modelId = promptConfig?.model_id || DEFAULT_PROMPTS.sop_generation.model_id

    // Initialize Gemini with model from settings
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: modelId })

    console.log('[generate-sop] Model:', modelId)
    console.log('[generate-sop] Using custom prompt:', !!promptConfig)

    // Format guide content for the prompt
    const formatGuideContent = () => {
      let content = ''

      if (sections.before && sections.before.length > 0) {
        content += 'BEFORE EMERGENCY:\n'
        sections.before.forEach((section, i) => {
          content += `${i + 1}. ${section.title}\n${section.content}\n\n`
        })
      }

      if (sections.during && sections.during.length > 0) {
        content += 'DURING EMERGENCY:\n'
        sections.during.forEach((section, i) => {
          content += `${i + 1}. ${section.title}\n${section.content}\n\n`
        })
      }

      if (sections.after && sections.after.length > 0) {
        content += 'AFTER EMERGENCY:\n'
        sections.after.forEach((section, i) => {
          content += `${i + 1}. ${section.title}\n${section.content}\n\n`
        })
      }

      return content || 'No specific response plan content available.'
    }

    // Interpolate the prompt template with values
    const prompt = promptTemplate
      .replace(/\{\{emergencyType\}\}/g, guideType || 'general emergency')
      .replace(/\{\{guideName\}\}/g, guideName)
      .replace(/\{\{guideType\}\}/g, guideType || 'general')
      .replace(/\{\{location\}\}/g, location)
      .replace(/\{\{guideContent\}\}/g, formatGuideContent())
      .replace(/\{\{customNotes\}\}/g, customNotes || 'None provided')

    console.log('[generate-sop] Sending request to Gemini...')

    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()

    console.log('[generate-sop] Response received, length:', text.length)

    // Parse the JSON response
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.error('[generate-sop] No JSON array found in response')
      console.error('[generate-sop] Raw response:', text.substring(0, 500))
      return NextResponse.json(
        { error: 'Failed to parse AI response. Please try again.' },
        { status: 500 }
      )
    }

    let tasks: SOPTemplateTask[]
    try {
      const rawTasks = JSON.parse(jsonMatch[0])

      // Validate and transform tasks
      tasks = rawTasks.map((task: Record<string, unknown>, index: number) => ({
        id: (task.id as string) || generateTaskId(),
        title: (task.title as string) || `Task ${index + 1}`,
        description: (task.description as string) || '',
        order: typeof task.order === 'number' ? task.order : index + 1,
        estimated_duration_minutes: typeof task.estimated_duration_minutes === 'number'
          ? task.estimated_duration_minutes
          : undefined,
        category: validateCategory((task.category as string) || 'other'),
      }))

      // Sort by order
      tasks.sort((a, b) => a.order - b.order)

      console.log('[generate-sop] Successfully parsed', tasks.length, 'tasks')
    } catch (parseError) {
      console.error('[generate-sop] JSON parse error:', parseError)
      console.error('[generate-sop] Attempted to parse:', jsonMatch[0].substring(0, 500))
      return NextResponse.json(
        { error: 'Failed to parse AI response. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      tasks,
      guideName,
      guideType,
    })

  } catch (error) {
    console.error('[generate-sop] Error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to generate SOP tasks',
        details: 'Please try again'
      },
      { status: 500 }
    )
  }
}
