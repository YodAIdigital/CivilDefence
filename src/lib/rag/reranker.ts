/**
 * Reranker Service
 * Uses Cohere Rerank API for improved relevance ranking
 */

import { CohereClient } from 'cohere-ai'
import type { RetrievalResult } from './types'

// Initialize Cohere client (optional - only if API key is provided)
const cohereApiKey = process.env.COHERE_API_KEY
let cohere: CohereClient | null = null

if (cohereApiKey) {
  cohere = new CohereClient({ token: cohereApiKey })
}

export interface RerankOptions {
  topK?: number
  model?: string
}

const DEFAULT_OPTIONS: RerankOptions = {
  topK: 5,
  model: 'rerank-english-v3.0',
}

/**
 * Check if reranking is available
 */
export function isRerankingAvailable(): boolean {
  return cohere !== null
}

/**
 * Rerank retrieval results using Cohere
 */
export async function rerank(
  query: string,
  results: RetrievalResult[],
  options: RerankOptions = {}
): Promise<RetrievalResult[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  // If no Cohere API key, return results as-is
  if (!cohere) {
    console.warn('[Reranker] Cohere API key not configured, skipping reranking')
    return results.slice(0, opts.topK)
  }

  // If no results, return empty
  if (results.length === 0) {
    return []
  }

  try {
    // Prepare documents for reranking
    const documents = results.map(r => r.contextualContent)

    // Call Cohere Rerank API
    const response = await cohere.rerank({
      model: opts.model || 'rerank-english-v3.0',
      query,
      documents,
      ...(opts.topK !== undefined && { topN: opts.topK }),
      returnDocuments: false,
    })

    // Reorder results based on reranking scores
    const rerankedResults: RetrievalResult[] = response.results.map(rerankResult => {
      const originalResult = results[rerankResult.index]
      if (!originalResult) {
        throw new Error(`Invalid index ${rerankResult.index} in rerank results`)
      }
      return {
        chunkId: originalResult.chunkId,
        documentId: originalResult.documentId,
        content: originalResult.content,
        contextualContent: originalResult.contextualContent,
        metadata: originalResult.metadata,
        score: rerankResult.relevanceScore,
        semanticRank: originalResult.semanticRank ?? null,
        ftsRank: originalResult.ftsRank ?? null,
      }
    })

    return rerankedResults
  } catch (error) {
    console.error('[Reranker] Error reranking results:', error)
    // Fall back to original results if reranking fails
    return results.slice(0, opts.topK)
  }
}

/**
 * Rerank with fallback - always returns results even if reranking fails
 */
export async function rerankWithFallback(
  query: string,
  results: RetrievalResult[],
  options: RerankOptions = {}
): Promise<RetrievalResult[]> {
  try {
    return await rerank(query, results, options)
  } catch (error) {
    console.error('[Reranker] Reranking failed, using original results:', error)
    return results.slice(0, options.topK || DEFAULT_OPTIONS.topK)
  }
}
