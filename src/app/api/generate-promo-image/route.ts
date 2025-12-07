import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getPromptConfigByType, DEFAULT_PROMPTS } from '@/lib/ai-prompts'
import { getSocialFunctionType } from '@/types/database'
import type { SocialStyleType } from '@/types/database'

interface GeneratePromoRequest {
  communityName: string
  location: string
  description?: string
  style?: SocialStyleType
  signupLink?: string
}

// Replace template variables in prompt
function interpolatePrompt(template: string, variables: Record<string, string>): string {
  let result = template
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value)
  }
  return result
}

export async function POST(request: NextRequest) {
  try {
    const body: GeneratePromoRequest = await request.json()
    const { communityName, location, description, style = 'community', signupLink } = body

    if (!communityName || !location) {
      return NextResponse.json(
        { error: 'Community name and location are required' },
        { status: 400 }
      )
    }

    // Check for Gemini API key
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      // Return a fallback response with suggested post text only
      return NextResponse.json({
        success: true,
        imageUrl: null,
        suggestedPost: generateFallbackPost(communityName, location, description, style, signupLink),
        message: 'API key not configured. Using template post.'
      })
    }

    // Get style-specific prompts
    const textFunctionType = getSocialFunctionType('social_post', style)
    const imageFunctionType = getSocialFunctionType('social_image', style)

    const textConfig = await getPromptConfigByType(textFunctionType)
    const imageConfig = await getPromptConfigByType(imageFunctionType)

    console.log('=== PROMO GENERATION DEBUG ===')
    console.log('Style selected:', style)
    console.log('Text function type:', textFunctionType)
    console.log('Image function type:', imageFunctionType)
    console.log('Text config loaded:', textConfig ? 'YES' : 'NO (using defaults)')
    console.log('Text model:', textConfig?.model_id || DEFAULT_PROMPTS[textFunctionType].model_id)
    console.log('Image config loaded:', imageConfig ? 'YES' : 'NO (using defaults)')
    console.log('Image model:', imageConfig?.model_id || DEFAULT_PROMPTS[imageFunctionType].model_id)

    // Initialize Gemini for text generation
    const genAI = new GoogleGenerativeAI(apiKey)

    // Generate post text using AI
    let suggestedPost: string
    try {
      const modelId = textConfig?.model_id || DEFAULT_PROMPTS[textFunctionType].model_id
      const promptTemplate = textConfig?.prompt_template || DEFAULT_PROMPTS[textFunctionType].prompt_template

      console.log('Text generation - Using model:', modelId)
      console.log('Text generation - Prompt template (first 200 chars):', promptTemplate.substring(0, 200))

      const textModel = genAI.getGenerativeModel({ model: modelId })
      const postPrompt = interpolatePrompt(promptTemplate, {
        communityName,
        location,
        description: description || '',
        signupLink: signupLink || 'https://civildefence.pro/community',
      })

      console.log('Text generation - Final prompt (first 300 chars):', postPrompt.substring(0, 300))

      const textResult = await textModel.generateContent(postPrompt)
      suggestedPost = textResult.response.text().trim()
      console.log('Text generation - SUCCESS, length:', suggestedPost.length)
    } catch (textError) {
      console.error('Text generation - FAILED:', textError)
      suggestedPost = generateFallbackPost(communityName, location, description, style, signupLink)
      console.log('Text generation - Using fallback template')
    }

    // Generate image using Gemini 3 Pro Image via REST API
    let imageUrl: string | null = null
    try {
      const imageModelId = imageConfig?.model_id || DEFAULT_PROMPTS[imageFunctionType].model_id
      const imagePromptTemplate = imageConfig?.prompt_template || DEFAULT_PROMPTS[imageFunctionType].prompt_template

      // The prompt template already includes style-specific instructions
      const imagePrompt = interpolatePrompt(imagePromptTemplate, {
        communityName,
        location,
      })

      console.log('Image generation - Model:', imageModelId)
      console.log('Image generation - Prompt:', imagePrompt.substring(0, 200) + '...')

      // Use Gemini Image API via REST API with proper config
      // Reference: https://ai.google.dev/gemini-api/docs/image-generation
      const imageResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${imageModelId}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: imagePrompt }]
            }],
            generationConfig: {
              responseModalities: ['TEXT', 'IMAGE'],
            },
          }),
        }
      )

      const responseText = await imageResponse.text()
      console.log('Image API response status:', imageResponse.status)

      if (imageResponse.ok) {
        const imageData = JSON.parse(responseText)
        console.log('Image API response structure:', JSON.stringify(Object.keys(imageData), null, 2))

        // Extract image from Gemini response
        if (imageData.candidates?.[0]?.content?.parts) {
          console.log('Found parts:', imageData.candidates[0].content.parts.length)
          for (const part of imageData.candidates[0].content.parts) {
            console.log('Part type:', part.text ? 'text' : part.inlineData ? 'inlineData' : 'unknown')
            if (part.inlineData?.data) {
              const mimeType = part.inlineData.mimeType || 'image/png'
              imageUrl = `data:${mimeType};base64,${part.inlineData.data}`
              console.log('Successfully extracted image, mimeType:', mimeType)
              break
            }
          }
        } else {
          console.log('No candidates/parts found in response')
        }
      } else {
        // Parse error for better logging
        try {
          const errorData = JSON.parse(responseText)
          if (errorData.error?.code === 429) {
            console.error('Gemini image API quota exceeded - image generation requires a paid API plan')
          } else {
            console.error('Gemini image API error:', imageResponse.status, errorData.error?.message || responseText)
          }
        } catch {
          console.error('Gemini image API error:', imageResponse.status, responseText)
        }
      }
    } catch (imageError) {
      console.error('Image generation error:', imageError)
      // Continue without image - text generation still works
    }

    return NextResponse.json({
      success: true,
      imageUrl,
      suggestedPost,
      message: imageUrl ? 'Content generated successfully!' : 'Post generated (image unavailable)'
    })
  } catch (error) {
    console.error('Error generating promo:', error)
    return NextResponse.json(
      { error: 'Failed to generate promotional content' },
      { status: 500 }
    )
  }
}

function generateFallbackPost(communityName: string, location: string, description?: string, style?: string, signupLink?: string): string {
  const intros: Record<string, string[]> = {
    modern: ['Ready to be prepared?', 'Your safety network awaits.', 'Join the movement.'],
    professional: ['Building resilient communities.', 'Safety through organization.', 'Professional emergency response.'],
    community: ['Neighbors helping neighbors!', 'Together we\'re stronger!', 'Join your local safety network!'],
    emergency: ['Are you prepared?', 'When emergencies strike...', 'Safety starts here.'],
  }

  const styleIntros = intros[style || 'community'] ?? intros.community
  const intro = styleIntros![Math.floor(Math.random() * styleIntros!.length)]

  const descText = description
    ? `\n\n${description}`
    : '\n\nWe\'re building a network of prepared neighbors ready to support each other during emergencies.'

  const benefits = [
    '✅ Real-time emergency alerts',
    '✅ Local disaster response plans',
    '✅ Connect with emergency coordinators',
    '✅ Community support network',
  ]

  // Shuffle benefits slightly
  if (Math.random() > 0.5) {
    [benefits[1], benefits[2]] = [benefits[2]!, benefits[1]!]
  }

  const link = signupLink || 'https://civildefence.pro/community'

  return `🛡️ ${intro}

Join ${communityName} - serving the ${location} area!${descText}

${benefits.join('\n')}

Be part of something that matters. Join us today!

🔗 Sign up now: ${link}

#EmergencyPreparedness #CommunityResilience #CivilDefence #DisasterReady #${location.replace(/[^a-zA-Z0-9]/g, '')}`
}
