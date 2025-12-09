/**
 * Process Training Document API
 * POST - Trigger document processing
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { processDocument, reprocessDocument } from '@/lib/rag/processor'

// Lazy-initialized Supabase admin client
let supabaseAdmin: SupabaseClient | null = null

function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )
  }
  return supabaseAdmin
}

/**
 * Verify the user is a super admin
 */
async function verifySuperAdmin(request: NextRequest): Promise<{ userId: string } | null> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)
  const { data: { user }, error } = await getSupabaseAdmin().auth.getUser(token)

  if (error || !user) {
    return null
  }

  // Check if user is super_admin
  const { data: profile } = await getSupabaseAdmin()
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin') {
    return null
  }

  return { userId: user.id }
}

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/admin/training-documents/[id]/process
 * Trigger document processing
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifySuperAdmin(request)
    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized - Super admin access required' },
        { status: 401 }
      )
    }

    const { id } = await params

    // Check document exists and get current status
    const { data: document, error: fetchError } = await getSupabaseAdmin()
      .from('training_documents')
      .select('id, name, status')
      .eq('id', id)
      .single()

    if (fetchError || !document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    // Don't process if already processing
    if (document.status === 'processing') {
      return NextResponse.json(
        { error: 'Document is already being processed' },
        { status: 400 }
      )
    }

    // Check if this is a reprocess (already has chunks)
    const { count: chunkCount } = await getSupabaseAdmin()
      .from('document_chunks')
      .select('*', { count: 'exact', head: true })
      .eq('document_id', id)

    // Process in background (don't await)
    const processPromise = chunkCount && chunkCount > 0
      ? reprocessDocument(id)
      : processDocument(id)

    // Log but don't await
    processPromise
      .then(result => {
        console.log(`[Process API] Document ${id} processing completed:`, result)
      })
      .catch(error => {
        console.error(`[Process API] Document ${id} processing failed:`, error)
      })

    return NextResponse.json({
      message: `Processing started for "${document.name}"`,
      documentId: id,
      isReprocess: (chunkCount || 0) > 0,
    })
  } catch (error) {
    console.error('[Process API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
