/**
 * Training Document Detail API
 * GET - Get document details
 * PATCH - Update document metadata
 * DELETE - Delete a document
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { deleteDocument } from '@/lib/rag/processor'

// Lazy-initialize Supabase admin client
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
 * Verify the user is a super admin
 */
async function verifySuperAdmin(request: NextRequest): Promise<{ userId: string } | null> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  const supabase = getSupabaseAdmin()
  const token = authHeader.substring(7)
  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    return null
  }

  // Check if user is super_admin
  const { data: profile } = await supabase
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
 * GET /api/admin/training-documents/[id]
 * Get document details with chunks
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifySuperAdmin(request)
    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized - Super admin access required' },
        { status: 401 }
      )
    }

    const { id } = await params
    const supabase = getSupabaseAdmin()

    // Get document with uploader info
    const { data: document, error: docError } = await supabase
      .from('training_documents')
      .select('*, profiles:uploaded_by(full_name, email)')
      .eq('id', id)
      .single()

    if (docError || !document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    // Get chunk summary (not full content for efficiency)
    const { data: chunks, error: chunksError } = await supabase
      .from('document_chunks')
      .select('id, chunk_index, token_count, metadata')
      .eq('document_id', id)
      .order('chunk_index', { ascending: true })

    if (chunksError) {
      console.error('[Training Documents API] Error fetching chunks:', chunksError)
    }

    return NextResponse.json({
      document,
      chunks: chunks || [],
    })
  } catch (error) {
    console.error('[Training Documents API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin/training-documents/[id]
 * Update document metadata
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifySuperAdmin(request)
    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized - Super admin access required' },
        { status: 401 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { name, description } = body

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()
    const { data: document, error } = await supabase
      .from('training_documents')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[Training Documents API] Update error:', error)
      return NextResponse.json(
        { error: 'Failed to update document' },
        { status: 500 }
      )
    }

    return NextResponse.json({ document })
  } catch (error) {
    console.error('[Training Documents API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/training-documents/[id]
 * Delete a document and all its chunks
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifySuperAdmin(request)
    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized - Super admin access required' },
        { status: 401 }
      )
    }

    const { id } = await params
    const supabase = getSupabaseAdmin()

    // Check document exists
    const { data: document, error: fetchError } = await supabase
      .from('training_documents')
      .select('id, name')
      .eq('id', id)
      .single()

    if (fetchError || !document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    // Delete document (processor handles storage cleanup and cascade)
    await deleteDocument(id)

    return NextResponse.json({
      message: `Document "${document.name}" deleted successfully`,
    })
  } catch (error) {
    console.error('[Training Documents API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
