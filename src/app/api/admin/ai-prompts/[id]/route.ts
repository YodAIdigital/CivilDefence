import { NextResponse } from 'next/server'
import {
  getPromptConfigById,
  updatePromptConfig,
  deletePromptConfig,
  resetPromptConfigToDefault,
} from '@/lib/ai-prompts'
import type { UpdateAIPromptConfig, AIFunctionType } from '@/types/database'

interface RouteContext {
  params: Promise<{ id: string }>
}

// GET - Fetch a specific AI prompt configuration
// Note: Authorization is handled by the client-side page which checks for super_admin role
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const config = await getPromptConfigById(id)

    if (!config) {
      return NextResponse.json({ error: 'Configuration not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      config,
    })
  } catch (error) {
    console.error('Error fetching AI prompt:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update an AI prompt configuration
export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = await request.json()

    const data: UpdateAIPromptConfig = {
      name: body.name,
      description: body.description,
      prompt_template: body.prompt_template,
      model_id: body.model_id,
      is_active: body.is_active,
      updated_by: body.updated_by || 'system',
    }

    const config = await updatePromptConfig(id, data)

    if (!config) {
      return NextResponse.json({ error: 'Configuration not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      config,
    })
  } catch (error) {
    console.error('Error updating AI prompt:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete an AI prompt configuration
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const success = await deletePromptConfig(id)

    if (!success) {
      return NextResponse.json({ error: 'Configuration not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error('Error deleting AI prompt:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH - Reset to default configuration
export async function PATCH(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params

    // Get the existing config to find its function type
    const existingConfig = await getPromptConfigById(id)

    if (!existingConfig) {
      return NextResponse.json({ error: 'Configuration not found' }, { status: 404 })
    }

    const config = await resetPromptConfigToDefault(
      existingConfig.function_type as AIFunctionType,
      'system'
    )

    if (!config) {
      return NextResponse.json({ error: 'Failed to reset configuration' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      config,
    })
  } catch (error) {
    console.error('Error resetting AI prompt:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
