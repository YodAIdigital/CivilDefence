/**
 * RAG Search API
 * POST - Perform hybrid search on the knowledge base
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { retrieve, formatRetrievalContext, logQuery } from '@/lib/rag/retriever'
import { rerankWithFallback, isRerankingAvailable } from '@/lib/rag/reranker'

// Lazy-initialized Supabase admin client
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

/**
 * Verify the user is authenticated
 */
async function verifyAuth(request: NextRequest): Promise<{ userId: string } | null> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)
  const { data: { user }, error } = await getSupabaseAdmin().auth.getUser(token)

  if (error || !user) {
    return null
  }

  return { userId: user.id }
}

/**
 * POST /api/rag-search
 * Perform hybrid search on the knowledge base
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const auth = await verifyAuth(request)
    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { query, topK = 5, communityId, useReranking = true } = body

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      )
    }

    // Perform hybrid search
    let results = await retrieve(query, {
      topK: useReranking && isRerankingAvailable() ? topK * 2 : topK, // Get more for reranking
      useHybridSearch: true,
    })

    // Apply reranking if enabled and available
    if (useReranking && results.length > 0) {
      results = await rerankWithFallback(query, results, { topK })
    } else {
      results = results.slice(0, topK)
    }

    // Format context for AI consumption
    const context = formatRetrievalContext(results)

    // Log the query for analytics
    const latencyMs = Date.now() - startTime
    await logQuery(
      auth.userId,
      communityId || null,
      query,
      results.map(r => r.chunkId),
      results.map(r => r.score),
      'hybrid-search',
      undefined,
      latencyMs
    )

    return NextResponse.json({
      results,
      context,
      latencyMs,
      rerankingUsed: useReranking && isRerankingAvailable(),
    })
  } catch (error) {
    console.error('[RAG Search API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
