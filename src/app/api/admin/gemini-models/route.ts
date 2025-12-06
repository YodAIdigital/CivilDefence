import { NextResponse } from 'next/server'
import type { GeminiModelInfo } from '@/types/database'

// Fetch available Gemini models from Google API
// Note: Authorization is handled by the client-side page which checks for super_admin role
export async function GET() {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 })
    }

    // Fetch models from Google's API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to fetch Gemini models:', errorText)
      return NextResponse.json(
        { error: 'Failed to fetch models from Google API' },
        { status: response.status }
      )
    }

    const data = await response.json()

    // Parse and format the models
    const models: GeminiModelInfo[] = (data.models || [])
      .filter((model: { name?: string; supportedGenerationMethods?: string[] }) => {
        // Only include models that support generateContent
        return model.supportedGenerationMethods?.includes('generateContent')
      })
      .map((model: {
        name?: string
        displayName?: string
        description?: string
        supportedGenerationMethods?: string[]
        inputTokenLimit?: number
        outputTokenLimit?: number
      }) => ({
        name: model.name?.replace('models/', '') || '',
        displayName: model.displayName || model.name?.replace('models/', '') || '',
        description: model.description || '',
        supportedGenerationMethods: model.supportedGenerationMethods || [],
        inputTokenLimit: model.inputTokenLimit,
        outputTokenLimit: model.outputTokenLimit,
      }))
      .sort((a: GeminiModelInfo, b: GeminiModelInfo) => {
        // Sort by name, putting newer models first
        // Gemini 3 > Gemini 2 > Gemini 1.5 > Gemini 1.0
        const getVersion = (name: string) => {
          if (name.includes('gemini-3')) return 3
          if (name.includes('gemini-2')) return 2
          if (name.includes('gemini-1.5')) return 1.5
          if (name.includes('gemini-1.0') || name.includes('gemini-1')) return 1
          return 0
        }
        const versionDiff = getVersion(b.name) - getVersion(a.name)
        if (versionDiff !== 0) return versionDiff
        return a.displayName.localeCompare(b.displayName)
      })

    // Group models by capability
    const textModels = models.filter((m: GeminiModelInfo) =>
      m.supportedGenerationMethods.includes('generateContent') &&
      !m.name.includes('image')
    )

    const imageModels = models.filter((m: GeminiModelInfo) =>
      m.name.includes('image') ||
      m.supportedGenerationMethods.includes('generateImages')
    )

    return NextResponse.json({
      success: true,
      models: {
        all: models,
        text: textModels,
        image: imageModels,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching Gemini models:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
