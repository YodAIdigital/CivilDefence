import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { DisasterType } from '@/data/guide-templates'

const DISASTER_TYPES: DisasterType[] = [
  'fire',
  'flood',
  'strong_winds',
  'earthquake',
  'tsunami',
  'snow',
  'pandemic',
  'solar_storm',
  'invasion'
]

interface RiskAnalysisRequest {
  location: string
  latitude?: number | null
  longitude?: number | null
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
    const { location, latitude, longitude } = body

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

    // Initialize Gemini (using Gemini 2.0 Flash - stable model)
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    // Create detailed prompt
    const prompt = `You are an emergency preparedness expert analyzing regional disaster risks.

Location: ${location}
${latitude && longitude ? `Coordinates: ${latitude}, ${longitude}` : ''}

Analyze this specific region and provide a comprehensive risk assessment for emergency preparedness planning. Consider:

1. Geographic factors (elevation, proximity to water, geology, climate)
2. Historical disaster patterns in this specific area
3. Seasonal risks and weather patterns
4. Infrastructure and urban planning considerations
5. Regional vulnerabilities

For each relevant disaster type from this list: fire, flood, strong_winds, earthquake, tsunami, snow, pandemic, solar_storm, invasion

Provide your response in this exact JSON format:
{
  "regionalInfo": "A 2-3 sentence overview of the region's geographic and climate context",
  "risks": [
    {
      "type": "earthquake",
      "severity": "high",
      "description": "Brief explanation of why this risk exists in this region",
      "recommendedActions": ["Specific action 1", "Specific action 2", "Specific action 3"]
    }
  ]
}

Rules:
- Only include risks that are genuinely relevant to this specific location
- Severity must be: "low", "medium", or "high"
- Type must match exactly from the list provided
- Include 3-5 specific, actionable recommendations per risk
- Focus on realistic, location-specific threats
- Order risks by severity (high to low)
- Return ONLY the JSON, no additional text

JSON response:`

    // Call Gemini API
    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()

    // Parse the JSON response
    let analysisData: RiskAnalysisResponse
    try {
      // Extract JSON from response (in case there's extra text)
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }
      analysisData = JSON.parse(jsonMatch[0])
    } catch {
      console.error('Failed to parse Gemini response:', text)
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
