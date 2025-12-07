import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { DisasterType } from '@/data/guide-templates'
import { getPromptConfigByType, DEFAULT_PROMPTS } from '@/lib/ai-prompts'

const DISASTER_TYPES: DisasterType[] = [
  'fire',
  'flood',
  'strong_winds',
  'earthquake',
  'tsunami',
  'snow',
  'pandemic',
  'solar_storm',
  'invasion',
  'volcano',
  'tornado',
  'heat_wave'
]

interface RiskAnalysisRequest {
  location: string
  latitude?: number | null
  longitude?: number | null
  regionMapImage?: string | null // Base64 encoded map image with region overlay
}

interface RiskAnalysisResponse {
  risks: Array<{
    type: DisasterType
    severity: 'low' | 'medium' | 'high'
    description: string
    recommendedActions: string[]
  }>
  regionalInfo: string
}

export async function POST(request: NextRequest) {
  try {
    const body: RiskAnalysisRequest = await request.json()
    const { location, latitude, longitude, regionMapImage } = body

    console.log('[analyze-risks] Request received:')
    console.log('[analyze-risks] - Location:', location)
    console.log('[analyze-risks] - Coordinates:', latitude, longitude)
    console.log('[analyze-risks] - Has regionMapImage:', !!regionMapImage, regionMapImage ? `(${regionMapImage.length} chars)` : '')

    if (!location) {
      return NextResponse.json(
        { error: 'Location is required' },
        { status: 400 }
      )
    }

    // Check for API key
    const apiKey = process.env.GEMINI_API_KEY
    console.log('GEMINI_API_KEY loaded:', apiKey ? `${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}` : 'NOT SET')

    if (!apiKey) {
      console.error('GEMINI_API_KEY not configured')
      return NextResponse.json(
        { error: 'AI analysis is not configured. Please add your Gemini API key to continue.' },
        { status: 503 }
      )
    }

    // Get prompt configuration from AI settings
    const promptConfig = await getPromptConfigByType('region_analysis')
    const promptTemplate = promptConfig?.prompt_template || DEFAULT_PROMPTS.region_analysis.prompt_template
    const modelId = promptConfig?.model_id || DEFAULT_PROMPTS.region_analysis.model_id

    // Initialize Gemini with model from settings
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: modelId })

    // Interpolate the prompt template with location data
    // Support both old format {{regionName}} and new format {{location}}
    let prompt = promptTemplate
      .replace(/\{\{location\}\}/g, location)
      .replace(/\{\{regionName\}\}/g, location) // Support old template format
      .replace(/\{\{coordinates\}\}/g, latitude && longitude ? `Coordinates: ${latitude}, ${longitude}` : '')
      .replace(/\{\{disaster_types\}\}/g, DISASTER_TYPES.join(', '))

    // ALWAYS append JSON output instructions to ensure consistent response format
    // This is critical for parsing - custom prompts may not include the correct format
    prompt += `

CRITICAL OUTPUT FORMAT REQUIREMENT:
You MUST respond with valid JSON in this exact format. Do not include any text before or after the JSON:
{
  "regionalInfo": "A 2-3 sentence overview of the region's geographic and climate context",
  "risks": [
    {
      "type": "disaster_type_from_list",
      "severity": "high|medium|low",
      "description": "Brief explanation of why this risk exists in this region",
      "recommendedActions": ["Action 1", "Action 2", "Action 3"]
    }
  ]
}

Valid disaster types (use ONLY these exact values): ${DISASTER_TYPES.join(', ')}
Severity must be exactly one of: "low", "medium", "high"
Include 3-5 most relevant risks for this location, ordered by severity (high to low).
Return ONLY the JSON object, no markdown formatting, no code blocks, no explanations.`

    console.log('[analyze-risks] Model:', modelId)
    console.log('[analyze-risks] Using custom prompt:', !!promptConfig)
    console.log('[analyze-risks] Prompt length:', prompt.length)

    // Build content parts for multimodal request
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = []

    // If we have a region map image, add it first for visual context
    if (regionMapImage) {
      // Extract base64 data from data URL (format: data:image/png;base64,xxxxx)
      const base64Match = regionMapImage.match(/^data:([^;]+);base64,(.+)$/)
      if (base64Match) {
        const mimeType = base64Match[1] || 'image/png'
        const base64Data = base64Match[2] || ''
        console.log('[analyze-risks] Adding map image to request, mimeType:', mimeType, 'base64 length:', base64Data.length)

        // Add image context instruction - CRITICAL: emphasize visual analysis
        parts.push({
          text: `CRITICAL INSTRUCTION: The following image is a map showing the EXACT community region boundaries. You MUST analyze this image to determine the actual geographic location.

BEFORE reading any text prompts, examine this map image and identify:
1. What COUNTRY is shown? (look at place names, coastline shapes, terrain)
2. What SPECIFIC REGION within that country? (look for city names, road labels, geographic features)
3. What terrain features are visible? (mountains, rivers, coast, urban areas)
4. What is the shape and size of the highlighted community boundary?

The user-provided location text may be incomplete or ambiguous. The MAP IMAGE is the authoritative source for determining the actual location. Base your entire analysis on what you SEE in the map.

`
        })

        // Add the image
        parts.push({
          inlineData: {
            mimeType,
            data: base64Data,
          }
        })
      } else {
        console.log('[analyze-risks] Failed to parse regionMapImage data URL')
      }
    } else {
      console.log('[analyze-risks] No regionMapImage provided')
    }

    // Add the main prompt
    parts.push({ text: prompt })

    // Call Gemini API with multimodal content
    console.log('[analyze-risks] Calling Gemini API...')
    let result
    try {
      result = await model.generateContent(parts)
    } catch (apiError) {
      console.error('[analyze-risks] Gemini API call failed:', apiError)
      throw new Error(`Gemini API error: ${apiError instanceof Error ? apiError.message : 'Unknown error'}`)
    }

    const response = await result.response
    const text = response.text()
    console.log('[analyze-risks] Raw response length:', text.length)
    console.log('[analyze-risks] Raw response (first 500 chars):', text.substring(0, 500))

    // Parse the JSON response
    let analysisData: RiskAnalysisResponse
    try {
      // Extract JSON from response (in case there's extra text or markdown code blocks)
      // First try to find JSON object directly
      let jsonMatch = text.match(/\{[\s\S]*\}/)

      // If wrapped in markdown code blocks, extract from there
      if (!jsonMatch) {
        const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
        if (codeBlockMatch && codeBlockMatch[1]) {
          jsonMatch = codeBlockMatch[1].match(/\{[\s\S]*\}/)
        }
      }

      if (!jsonMatch) {
        console.error('[analyze-risks] No JSON found in response. Full response:', text)
        throw new Error('No JSON found in response')
      }

      console.log('[analyze-risks] Extracted JSON (first 300 chars):', jsonMatch[0].substring(0, 300))
      analysisData = JSON.parse(jsonMatch[0])
    } catch (parseError) {
      console.error('[analyze-risks] Failed to parse Gemini response:', text)
      console.error('[analyze-risks] Parse error:', parseError)
      throw new Error('Invalid response format from AI')
    }

    // Validate the response structure
    if (!analysisData.risks || !Array.isArray(analysisData.risks)) {
      throw new Error('Invalid response structure')
    }

    // Validate and filter risks
    const validRisks = analysisData.risks.filter(risk => {
      return (
        DISASTER_TYPES.includes(risk.type) &&
        ['low', 'medium', 'high'].includes(risk.severity) &&
        risk.description &&
        Array.isArray(risk.recommendedActions)
      )
    })

    if (validRisks.length === 0) {
      throw new Error('No valid risks identified')
    }

    const validatedResponse: RiskAnalysisResponse = {
      regionalInfo: analysisData.regionalInfo || `Analysis for ${location}`,
      risks: validRisks
    }

    return NextResponse.json(validatedResponse)

  } catch (error) {
    console.error('Error analyzing risks:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to analyze risks',
        details: 'Please try again or select risks manually'
      },
      { status: 500 }
    )
  }
}
