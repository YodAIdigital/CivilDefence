/**
 * Embeddings Service
 * Uses Gemini text-embedding-004 for generating 768-dimensional embeddings
 */

import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

// Batch size for embedding requests
const BATCH_SIZE = 100

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' })

    const result = await model.embedContent(text)
    const embedding = result.embedding.values

    if (!embedding || embedding.length !== 768) {
      throw new Error(`Invalid embedding dimensions: expected 768, got ${embedding?.length || 0}`)
    }

    return embedding
  } catch (error) {
    console.error('[Embeddings] Error generating embedding:', error)
    throw new Error(
      `Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Generate embeddings for multiple texts in batches
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = []

  // Process in batches
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)

    // Process batch concurrently
    const batchEmbeddings = await Promise.all(
      batch.map(text => generateEmbedding(text))
    )

    embeddings.push(...batchEmbeddings)

    // Add a small delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < texts.length) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  return embeddings
}

/**
 * Format embedding for PostgreSQL vector type
 */
export function formatEmbeddingForPg(embedding: number[]): string {
  return `[${embedding.join(',')}]`
}

/**
 * Parse embedding from PostgreSQL vector type
 */
export function parseEmbeddingFromPg(pgVector: string): number[] {
  // Remove brackets and split by comma
  const values = pgVector.replace(/[\[\]]/g, '').split(',')
  return values.map(v => parseFloat(v.trim()))
}
