import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { DisasterType } from '@/data/guide-templates'
import { guideTemplates } from '@/data/guide-templates'
import { getPromptConfigByType, DEFAULT_PROMPTS } from '@/lib/ai-prompts'

interface CustomizeGuidesRequest {
  location: string
  latitude?: number | null
  longitude?: number | null
  selectedRisks: DisasterType[]
  aiAnalysis?: any
  regionMapImage?: string | null // Base64 encoded map image with region overlay
}

export async function POST(request: NextRequest) {
  try {
    const body: CustomizeGuidesRequest = await request.json()
    const { location, latitude, longitude, selectedRisks, aiAnalysis, regionMapImage } = body

    console.log('[customize-guides] Request received:')
    console.log('[customize-guides] - Location:', location)
    console.log('[customize-guides] - Coordinates:', latitude, longitude)
    console.log('[customize-guides] - Selected risks:', selectedRisks)
    console.log('[customize-guides] - Has regionMapImage:', !!regionMapImage, regionMapImage ? `(${regionMapImage.length} chars)` : '')

    if (!location || !selectedRisks || selectedRisks.length === 0) {
      return NextResponse.json(
        { error: 'Location and selected risks are required' },
        { status: 400 }
      )
    }

    // Check for API key
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      console.error('GEMINI_API_KEY not configured')
      return NextResponse.json(
        { error: 'AI customization is not configured. Guides will use default templates.' },
        { status: 503 }
      )
    }

    // Get prompt configuration from AI settings
    const promptConfig = await getPromptConfigByType('plan_customization')
    const promptTemplate = promptConfig?.prompt_template || DEFAULT_PROMPTS.plan_customization.prompt_template
    const modelId = promptConfig?.model_id || DEFAULT_PROMPTS.plan_customization.model_id

    // Initialize Gemini with model from settings
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: modelId })

    console.log('[customize-guides] Model:', modelId)
    console.log('[customize-guides] Using custom prompt:', !!promptConfig)

    // Format the analysis result for the prompt
    const formatAnalysisResult = (analysis: any, riskType: string) => {
      if (!analysis) return ''

      const riskAnalysis = analysis?.risks?.find((r: any) => r.type === riskType)
      if (!riskAnalysis && !analysis.regionalInfo) return ''

      let result = 'Regional Analysis Result:\n'
      if (analysis.regionalInfo) {
        result += `Regional Overview: ${analysis.regionalInfo}\n`
      }
      if (riskAnalysis) {
        result += `\nRisk Assessment for ${riskType}:\n`
        result += `- Severity: ${riskAnalysis.severity}\n`
        result += `- Description: ${riskAnalysis.description}\n`
        result += `- Recommended Actions: ${riskAnalysis.recommendedActions?.join(', ') || 'N/A'}\n`
      }
      return result
    }

    // Process each selected risk
    const customizedGuides = await Promise.all(
      selectedRisks.map(async (riskType) => {
        const template = guideTemplates.find(t => t.type === riskType)
        if (!template) return null

        // Interpolate the prompt template with values
        let prompt = promptTemplate
          .replace(/\{\{communityName\}\}/g, location)
          .replace(/\{\{location\}\}/g, location)
          .replace(/\{\{planType\}\}/g, template.name)
          .replace(/\{\{existingContent\}\}/g, JSON.stringify(template, null, 2))
          .replace(/\{\{analysisResult\}\}/g, formatAnalysisResult(aiAnalysis, riskType))

        // Add coordinates if available
        if (latitude && longitude) {
          prompt = `Coordinates: ${latitude}, ${longitude}\n\n${prompt}`
        }

        // Append JSON output format requirements
        prompt += `

CRITICAL OUTPUT FORMAT REQUIREMENT:
Return ONLY a JSON object with this structure:
{
  "customNotes": "2-3 paragraphs about specific considerations for this location",
  "localResources": [
    {
      "name": "Resource name",
      "type": "shelter|hospital|supply_point|meeting_point",
      "address": "Address",
      "phone": "Phone number",
      "notes": "Additional info"
    }
  ],
  "additionalSupplies": ["Item 1", "Item 2"],
  "enhancedSections": {
    "before": [
      {
        "title": "Section title",
        "content": "Location-specific content",
        "icon": "icon_name"
      }
    ],
    "during": [],
    "after": []
  },
  "emergencyContacts": [
    {
      "name": "Service or Organization Name",
      "number": "Phone number or website",
      "description": "Brief description of what this contact is for"
    }
  ]
}

For emergencyContacts, ALWAYS include:
1. Local emergency services (111 for NZ, 000 for AU, 911 for US, etc.)
2. Local fire service non-emergency line (if available for the area)
3. Local police non-emergency line (if available for the area)
4. Relevant local council emergency line
5. Any disaster-specific hotlines (e.g., earthquake info, flood warnings, health hotlines)
6. Local civil defence or emergency management contact
Make these specific to ${location} - use real, verified phone numbers for the region whenever possible.

Provide real, researched information for ${location}. If you don't have specific information, make reasonable suggestions based on typical infrastructure for the area type.

JSON response:`

        try {
          // Build content parts for the request
          const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
            { text: prompt }
          ]

          // If we have a region map image, add it to the request for visual context
          if (regionMapImage) {
            // Extract base64 data from data URL (format: data:image/png;base64,xxxxx)
            const base64Match = regionMapImage.match(/^data:([^;]+);base64,(.+)$/)
            if (base64Match) {
              const mimeType = base64Match[1] || 'image/png'
              const base64Data = base64Match[2] || ''
              console.log('[customize-guides] Adding image to Gemini request, mimeType:', mimeType, 'base64 length:', base64Data.length)
              parts.unshift({
                inlineData: {
                  mimeType,
                  data: base64Data,
                }
              })
              // Add context about the image at the beginning of the prompt
              parts.unshift({
                text: 'The following image shows the community region boundaries on a map. Use this visual context to better understand the geographical area and provide more accurate location-specific recommendations.\n\n'
              })
            } else {
              console.log('[customize-guides] Failed to parse regionMapImage data URL')
            }
          } else {
            console.log('[customize-guides] No regionMapImage provided for', riskType)
          }

          const result = await model.generateContent(parts)
          const response = await result.response
          const text = response.text()

          // Parse the JSON response
          const jsonMatch = text.match(/\{[\s\S]*\}/)
          if (!jsonMatch) {
            console.error('No JSON found in Gemini response for', riskType)
            return {
              riskType,
              template,
              customization: null
            }
          }

          const customization = JSON.parse(jsonMatch[0])

          return {
            riskType,
            template,
            customization
          }
        } catch (err) {
          console.error(`Error customizing guide for ${riskType}:`, err)
          return {
            riskType,
            template,
            customization: null
          }
        }
      })
    )

    // Filter out null results
    const validCustomizations = customizedGuides.filter(Boolean)

    return NextResponse.json({
      customizedGuides: validCustomizations,
      location,
    })

  } catch (error) {
    console.error('Error customizing guides:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to customize guides',
        details: 'Please try again or use default templates'
      },
      { status: 500 }
    )
  }
}
