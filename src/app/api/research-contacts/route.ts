import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getPromptConfigByType, DEFAULT_PROMPTS } from '@/lib/ai-prompts'
import type { EmergencyContactCategory } from '@/types/database'

interface ResearchContactsRequest {
  location: string
  regionMapImage?: string | null
  aiAnalysis?: {
    regionalInfo?: string
  } | null
}

interface ResearchedContact {
  name: string
  phone: string
  description: string
  icon: string
  category: EmergencyContactCategory
  isImportant: boolean // AI determines if this should be auto-added
}

interface ResearchContactsResponse {
  contacts: ResearchedContact[]
  regionIdentified: string
}

export async function POST(request: NextRequest) {
  try {
    const body: ResearchContactsRequest = await request.json()
    const { location, regionMapImage, aiAnalysis } = body

    console.log('[research-contacts] Request received:')
    console.log('[research-contacts] - Location:', location)
    console.log('[research-contacts] - Has regionMapImage:', !!regionMapImage)
    console.log('[research-contacts] - Has aiAnalysis:', !!aiAnalysis)

    if (!location) {
      return NextResponse.json(
        { error: 'Location is required' },
        { status: 400 }
      )
    }

    // Check for API key
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      console.error('[research-contacts] GEMINI_API_KEY not configured')
      return NextResponse.json(
        { error: 'AI research is not configured' },
        { status: 503 }
      )
    }

    // Get prompt configuration
    const promptConfig = await getPromptConfigByType('emergency_contact_localization')
    const modelId = promptConfig?.model_id || DEFAULT_PROMPTS.emergency_contact_localization.model_id

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: modelId })

    // Extract region info from AI analysis if available
    const regionInfo = aiAnalysis?.regionalInfo || ''

    // Create an enhanced prompt for researching local contacts
    const prompt = `You are a local services researcher. Your task is to find relevant local emergency and utility contacts for a community in this region.

LOCATION: ${location}
${regionInfo ? `REGION INFO: ${regionInfo}` : ''}

Research and provide LOCAL contacts for this specific region. Focus on:

1. **Local Council/City Hall** - The governing body for this area (IMPORTANT)
2. **Regional Council** - If applicable (e.g., Environment Canterbury for Canterbury region)
3. **Local Power Company** - The electricity provider for this area (IMPORTANT)
4. **Local Water Supply** - Water utility provider if different from council
5. **Local Police Station** - Non-emergency police contact for the area
6. **Local Fire Station** - Non-emergency fire service contact
7. **Medical Centre/Clinic** - Nearest medical facility
8. **Pharmacy** - Nearest pharmacy (if known)
9. **Community Leader/Civil Defence** - Local emergency management contact
10. **Veterinary Clinic** - Nearest vet clinic (useful for rural areas)

IMPORTANT GUIDELINES:
- Only include contacts you are confident are correct for this SPECIFIC region
- Use New Zealand phone number formats (e.g., 03 xxx xxxx for South Island landlines)
- Mark contacts as "isImportant: true" if they are essential local services (council, power company, police station)
- If you're not sure about a specific phone number, mark the contact but note it needs verification
- Do NOT include national emergency numbers (111, Healthline etc.) - those are already included by default

Return a JSON object with this exact structure:
{
  "regionIdentified": "The specific region/area you identified (e.g., Timaru District, Canterbury)",
  "contacts": [
    {
      "name": "Timaru District Council",
      "phone": "03 687 7200",
      "description": "Local council services and civil defence",
      "icon": "account_balance",
      "category": "local",
      "isImportant": true
    }
  ]
}

Valid categories: "emergency", "health", "utilities", "local", "government", "community"
Valid icons: "account_balance" (council), "bolt" (power), "water_drop" (water), "local_police" (police), "local_fire_department" (fire), "local_hospital" (medical), "medication" (pharmacy), "groups" (community), "pets" (vet), "call" (general)

Return ONLY the JSON, no markdown formatting or code blocks.`

    console.log('[research-contacts] Calling Gemini API with model:', modelId)

    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()

    console.log('[research-contacts] Raw response length:', text.length)
    console.log('[research-contacts] Raw response (first 500 chars):', text.substring(0, 500))

    // Parse JSON response
    let researchData: ResearchContactsResponse
    try {
      // Extract JSON from response
      let jsonMatch = text.match(/\{[\s\S]*\}/)

      if (!jsonMatch) {
        const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
        if (codeBlockMatch && codeBlockMatch[1]) {
          jsonMatch = codeBlockMatch[1].match(/\{[\s\S]*\}/)
        }
      }

      if (!jsonMatch) {
        console.error('[research-contacts] No JSON found in response')
        throw new Error('No JSON found in response')
      }

      researchData = JSON.parse(jsonMatch[0])
    } catch (parseError) {
      console.error('[research-contacts] Failed to parse response:', parseError)
      return NextResponse.json(
        { error: 'Failed to parse AI response' },
        { status: 500 }
      )
    }

    // Validate contacts
    const validContacts = (researchData.contacts || []).filter(contact =>
      contact.name &&
      contact.phone &&
      contact.category
    ).map(contact => ({
      ...contact,
      icon: contact.icon || 'call',
      description: contact.description || '',
      isImportant: contact.isImportant ?? false,
    }))

    console.log('[research-contacts] Found', validContacts.length, 'valid contacts')
    console.log('[research-contacts] Important contacts:', validContacts.filter(c => c.isImportant).length)

    return NextResponse.json({
      regionIdentified: researchData.regionIdentified || location,
      contacts: validContacts,
    })

  } catch (error) {
    console.error('[research-contacts] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to research contacts' },
      { status: 500 }
    )
  }
}
