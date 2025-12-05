import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { DisasterType } from '@/data/guide-templates'
import { guideTemplates } from '@/data/guide-templates'

interface CustomizeGuidesRequest {
  location: string
  latitude?: number | null
  longitude?: number | null
  selectedRisks: DisasterType[]
  aiAnalysis?: any
}

export async function POST(request: NextRequest) {
  try {
    const body: CustomizeGuidesRequest = await request.json()
    const { location, latitude, longitude, selectedRisks, aiAnalysis } = body

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

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    // Process each selected risk
    const customizedGuides = await Promise.all(
      selectedRisks.map(async (riskType) => {
        const template = guideTemplates.find(t => t.type === riskType)
        if (!template) return null

        // Get risk-specific info from AI analysis if available
        const riskAnalysis = aiAnalysis?.risks?.find((r: any) => r.type === riskType)

        const prompt = `You are an emergency preparedness expert. Customize this emergency response guide for the specific location.

Location: ${location}
${latitude && longitude ? `Coordinates: ${latitude}, ${longitude}` : ''}
Disaster Type: ${template.name}

${riskAnalysis ? `Regional Risk Analysis:
Severity: ${riskAnalysis.severity}
Description: ${riskAnalysis.description}
Recommended Actions: ${riskAnalysis.recommendedActions.join(', ')}
` : ''}

Base Guide Template:
${JSON.stringify(template, null, 2)}

Please provide location-specific customizations for this guide. Focus on:
1. Local emergency services and contact numbers for ${location}
2. Specific geographical considerations (terrain, water bodies, infrastructure)
3. Local evacuation routes or shelter locations
4. Region-specific preparation steps
5. Local resources and community centers

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
  }
}

Provide real, researched information for ${location}. If you don't have specific information, make reasonable suggestions based on typical infrastructure for the area type.

JSON response:`

        try {
          const result = await model.generateContent(prompt)
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
