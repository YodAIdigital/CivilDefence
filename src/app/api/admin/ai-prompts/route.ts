import { NextRequest, NextResponse } from 'next/server'
import {
  getAllPromptConfigs,
  createPromptConfig,
  initializeDefaults,
} from '@/lib/ai-prompts'
import type { CreateAIPromptConfig } from '@/types/database'

// GET - Fetch all AI prompt configurations
// Note: Authorization is handled by the client-side page which checks for super_admin role
export async function GET() {
  try {
    // Initialize defaults if needed and get all configs
    let configs = await getAllPromptConfigs()

    if (configs.length === 0) {
      // Use a placeholder user ID since this is just for tracking purposes
      configs = await initializeDefaults('system')
    }

    return NextResponse.json({
      success: true,
      configs,
    })
  } catch (error) {
    console.error('Error fetching AI prompts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create a new AI prompt configuration
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data: CreateAIPromptConfig = {
      function_type: body.function_type,
      name: body.name,
      description: body.description,
      prompt_template: body.prompt_template,
      model_id: body.model_id,
      is_active: body.is_active,
      created_by: body.created_by || 'system',
    }

    const config = await createPromptConfig(data)

    return NextResponse.json({
      success: true,
      config,
    })
  } catch (error) {
    console.error('Error creating AI prompt:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
