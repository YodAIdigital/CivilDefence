/**
 * Image Parser
 * Uses Gemini Vision API to extract text descriptions from images
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import type { ParsedDocument } from '../types'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function parseImage(buffer: ArrayBuffer, mimeType: string): Promise<ParsedDocument> {
  try {
    // Convert buffer to base64
    const base64Data = Buffer.from(buffer).toString('base64')

    // Use Gemini Vision to describe the image
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const prompt = `You are analyzing an image for a civil defence knowledge base. Please provide a detailed description of this image including:

1. Main subject/content of the image
2. Any text visible in the image (transcribe it exactly)
3. Key information relevant to emergency preparedness, civil defence, first aid, or community safety
4. Any diagrams, charts, or instructional content shown
5. Important details that would help someone understand this content without seeing the image

Format your response as clear, structured text that can be used as training data for an AI assistant helping with emergency preparedness.`

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: mimeType,
          data: base64Data,
        },
      },
      { text: prompt },
    ])

    const response = await result.response
    const text = response.text()

    if (!text || text.trim().length === 0) {
      throw new Error('No description generated from image')
    }

    return {
      text: text.trim(),
      pages: [
        {
          pageNumber: 1,
          text: text.trim(),
        },
      ],
      metadata: {
        title: 'Image Document',
        pageCount: 1,
        mimeType,
      },
    }
  } catch (error) {
    console.error('[Image Parser] Error parsing image:', error)
    throw new Error(
      `Failed to parse image: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}
