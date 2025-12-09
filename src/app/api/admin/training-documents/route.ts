/**
 * Training Documents API
 * GET - List all training documents
 * POST - Upload a new training document
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

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

// File type mappings
const FILE_TYPE_MAP: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain': 'txt',
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
}

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

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

/**
 * GET /api/admin/training-documents
 * List all training documents
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifySuperAdmin(request)
    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized - Super admin access required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = getSupabaseAdmin()
      .from('training_documents')
      .select('*, profiles:uploaded_by(full_name, email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('[Training Documents API] Error fetching documents:', error)
      return NextResponse.json(
        { error: 'Failed to fetch documents' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      documents: data,
      total: count,
      limit,
      offset,
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
 * POST /api/admin/training-documents
 * Upload a new training document
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifySuperAdmin(request)
    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized - Super admin access required' },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const name = formData.get('name') as string | null
    const description = formData.get('description') as string | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds 50MB limit' },
        { status: 400 }
      )
    }

    // Validate file type
    const fileType = FILE_TYPE_MAP[file.type]
    if (!fileType) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}. Allowed: PDF, DOCX, TXT, JPEG, PNG, WebP` },
        { status: 400 }
      )
    }

    // Generate unique filename
    const timestamp = Date.now()
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const filePath = `${auth.userId}/${timestamp}_${sanitizedName}`

    // Upload to storage
    const { error: uploadError } = await getSupabaseAdmin().storage
      .from('training-documents')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('[Training Documents API] Upload error:', uploadError)
      return NextResponse.json(
        { error: 'Failed to upload file' },
        { status: 500 }
      )
    }

    // Create document record
    const { data: document, error: insertError } = await getSupabaseAdmin()
      .from('training_documents')
      .insert({
        name: name || file.name,
        description,
        file_url: `training-documents/${filePath}`,
        file_type: fileType,
        file_size: file.size,
        mime_type: file.type,
        status: 'pending',
        uploaded_by: auth.userId,
        metadata: {
          originalName: file.name,
        },
      })
      .select()
      .single()

    if (insertError) {
      console.error('[Training Documents API] Insert error:', insertError)
      // Try to clean up uploaded file
      await getSupabaseAdmin().storage.from('training-documents').remove([filePath])
      return NextResponse.json(
        { error: 'Failed to create document record' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      document,
      message: 'Document uploaded successfully. Processing will begin automatically.',
    })
  } catch (error) {
    console.error('[Training Documents API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
