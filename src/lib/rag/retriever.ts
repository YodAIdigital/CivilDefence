/**
 * RAG Retriever
 * Implements hybrid search combining semantic and full-text search
 * with Reciprocal Rank Fusion (RRF) for improved relevance
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { generateEmbedding, formatEmbeddingForPg } from './embeddings'
import type { RetrievalResult, RetrievalOptions } from './types'

// Lazy-initialized Supabase admin client for server-side operations
let supabaseAdmin: SupabaseClient | null = null

function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_KEY

    if (!url || !key) {
      throw new Error('Missing Supabase configuration: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY')
    }

    supabaseAdmin = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }
  return supabaseAdmin
}

const DEFAULT_OPTIONS: RetrievalOptions = {
  topK: 10,
  useHybridSearch: true,
  rrfK: 60,
  semanticThreshold: 0.5,
}

/**
 * Perform hybrid search using the database function
 */
export async function hybridSearch(
  query: string,
  options: Partial<RetrievalOptions> = {}
): Promise<RetrievalResult[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  try {
    // Generate query embedding
    const queryEmbedding = await generateEmbedding(query)
    const embeddingStr = formatEmbeddingForPg(queryEmbedding)

    // Call the hybrid_search database function
    const { data, error } = await getSupabaseAdmin().rpc('hybrid_search', {
      query_embedding: embeddingStr,
      query_text: query,
      match_count: opts.topK,
      rrf_k: opts.rrfK,
    })

    if (error) {
      throw new Error(`Hybrid search failed: ${error.message}`)
    }

    if (!data || data.length === 0) {
      return []
    }

    // Map results to RetrievalResult format
    return data.map((row: {
      chunk_id: string
      document_id: string
      content: string
      contextual_content: string
      metadata: Record<string, unknown>
      semantic_rank: number | null
      fts_rank: number | null
      rrf_score: number
    }) => ({
      chunkId: row.chunk_id,
      documentId: row.document_id,
      content: row.content,
      contextualContent: row.contextual_content,
      metadata: row.metadata,
      score: row.rrf_score,
      semanticRank: row.semantic_rank,
      ftsRank: row.fts_rank,
    }))
  } catch (error) {
    console.error('[Retriever] Hybrid search error:', error)
    throw error
  }
}

/**
 * Perform semantic-only search
 */
export async function semanticSearch(
  query: string,
  options: Partial<RetrievalOptions> = {}
): Promise<RetrievalResult[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  try {
    // Generate query embedding
    const queryEmbedding = await generateEmbedding(query)
    const embeddingStr = formatEmbeddingForPg(queryEmbedding)

    // Call the semantic_search database function
    const { data, error } = await getSupabaseAdmin().rpc('semantic_search', {
      query_embedding: embeddingStr,
      match_count: opts.topK,
      match_threshold: opts.semanticThreshold,
    })

    if (error) {
      throw new Error(`Semantic search failed: ${error.message}`)
    }

    if (!data || data.length === 0) {
      return []
    }

    // Map results to RetrievalResult format
    return data.map((row: {
      chunk_id: string
      document_id: string
      content: string
      contextual_content: string
      metadata: Record<string, unknown>
      similarity: number
    }) => ({
      chunkId: row.chunk_id,
      documentId: row.document_id,
      content: row.content,
      contextualContent: row.contextual_content,
      metadata: row.metadata,
      score: row.similarity,
    }))
  } catch (error) {
    console.error('[Retriever] Semantic search error:', error)
    throw error
  }
}

/**
 * Main retrieval function - uses hybrid search by default
 */
export async function retrieve(
  query: string,
  options: Partial<RetrievalOptions> = {}
): Promise<RetrievalResult[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  if (opts.useHybridSearch) {
    return hybridSearch(query, opts)
  } else {
    return semanticSearch(query, opts)
  }
}

/**
 * Format retrieval results as context for the AI
 */
export function formatRetrievalContext(results: RetrievalResult[]): string {
  if (results.length === 0) {
    return ''
  }

  const contextParts = results.map((result, index) => {
    const sourceInfo = result.metadata?.documentTitle
      ? `Source: ${result.metadata.documentTitle}`
      : 'Source: Training Document'

    const pageInfo = result.metadata?.pageNumber
      ? ` (Page ${result.metadata.pageNumber})`
      : ''

    return `[Reference ${index + 1}] ${sourceInfo}${pageInfo}
${result.contextualContent}`
  })

  return `RELEVANT KNOWLEDGE BASE INFORMATION:

${contextParts.join('\n\n---\n\n')}

END OF KNOWLEDGE BASE INFORMATION`
}

/**
 * Get document information for retrieved chunks
 */
export async function getDocumentInfo(documentIds: string[]): Promise<Map<string, { name: string; description: string | null }>> {
  const uniqueIds = Array.from(new Set(documentIds))

  const { data, error } = await getSupabaseAdmin()
    .from('training_documents')
    .select('id, name, description')
    .in('id', uniqueIds)

  if (error) {
    console.error('[Retriever] Error fetching document info:', error)
    return new Map()
  }

  const infoMap = new Map<string, { name: string; description: string | null }>()
  for (const doc of data || []) {
    infoMap.set(doc.id, { name: doc.name, description: doc.description })
  }

  return infoMap
}

/**
 * Log a RAG query for analytics
 */
export async function logQuery(
  userId: string,
  communityId: string | null,
  queryText: string,
  chunkIds: string[],
  scores: number[],
  modelUsed: string,
  responseText?: string,
  latencyMs?: number
): Promise<void> {
  try {
    await getSupabaseAdmin().from('rag_query_log').insert({
      user_id: userId,
      community_id: communityId,
      query_text: queryText,
      retrieved_chunk_ids: chunkIds,
      retrieval_scores: scores,
      model_used: modelUsed,
      response_text: responseText,
      latency_ms: latencyMs,
    })
  } catch (error) {
    console.error('[Retriever] Error logging query:', error)
    // Don't throw - logging failure shouldn't break retrieval
  }
}
