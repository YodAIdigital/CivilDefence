/**
 * Document Processing Pipeline
 * Orchestrates parsing, chunking, embedding, and storage
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { parsePdf, parseDocx, parseTxt, parseImage } from './parsers'
import { chunkDocument } from './chunker'
import { generateEmbedding, formatEmbeddingForPg } from './embeddings'
import type { DocumentFileType } from '@/types/database'
import type { ParsedDocument, DocumentChunk, ProcessingResult } from './types'

// Lazy-initialized Supabase admin client for server-side operations
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
 * Update document status in the database
 */
async function updateDocumentStatus(
  documentId: string,
  status: 'pending' | 'processing' | 'ready' | 'error',
  errorMessage?: string,
  chunkCount?: number,
  totalTokens?: number
): Promise<void> {
  const updateData: Record<string, unknown> = { status }

  if (errorMessage !== undefined) {
    updateData.error_message = errorMessage
  }
  if (chunkCount !== undefined) {
    updateData.chunk_count = chunkCount
  }
  if (totalTokens !== undefined) {
    updateData.total_tokens = totalTokens
  }

  const { error } = await getSupabaseAdmin()
    .from('training_documents')
    .update(updateData)
    .eq('id', documentId)

  if (error) {
    console.error('[Processor] Failed to update document status:', error)
  }
}

/**
 * Parse document based on file type
 */
async function parseDocument(
  buffer: ArrayBuffer,
  fileType: DocumentFileType,
  mimeType: string
): Promise<ParsedDocument> {
  switch (fileType) {
    case 'pdf':
      return parsePdf(buffer)
    case 'docx':
      return parseDocx(buffer)
    case 'txt':
      return parseTxt(buffer)
    case 'image':
      return parseImage(buffer, mimeType)
    default:
      throw new Error(`Unsupported file type: ${fileType}`)
  }
}

/**
 * Store chunks with embeddings in the database
 */
async function storeChunks(
  documentId: string,
  chunks: DocumentChunk[]
): Promise<void> {
  // Process chunks sequentially to avoid overwhelming the embedding API
  for (const chunk of chunks) {
    // Generate embedding for the contextual content
    const embedding = await generateEmbedding(chunk.contextualContent)

    // Insert chunk into database
    const { error } = await getSupabaseAdmin()
      .from('document_chunks')
      .insert({
        document_id: documentId,
        chunk_index: chunk.chunkIndex,
        content: chunk.content,
        contextual_content: chunk.contextualContent,
        embedding: formatEmbeddingForPg(embedding),
        token_count: chunk.tokenCount,
        metadata: chunk.metadata,
      })

    if (error) {
      throw new Error(`Failed to store chunk ${chunk.chunkIndex}: ${error.message}`)
    }

    // Small delay between embedding requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 50))
  }
}

/**
 * Process a document: parse, chunk, embed, and store
 */
export async function processDocument(documentId: string): Promise<ProcessingResult> {
  const startTime = Date.now()

  try {
    // Update status to processing
    await updateDocumentStatus(documentId, 'processing')

    // Fetch document metadata
    const { data: document, error: fetchError } = await getSupabaseAdmin()
      .from('training_documents')
      .select('*')
      .eq('id', documentId)
      .single()

    if (fetchError || !document) {
      throw new Error(`Document not found: ${fetchError?.message || 'Unknown error'}`)
    }

    // Download the file from storage
    const { data: fileData, error: downloadError } = await getSupabaseAdmin()
      .storage
      .from('training-documents')
      .download(document.file_url.replace('training-documents/', ''))

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message || 'Unknown error'}`)
    }

    // Convert blob to ArrayBuffer
    const buffer = await fileData.arrayBuffer()

    // Parse the document
    console.log(`[Processor] Parsing ${document.file_type} document: ${document.name}`)
    const parsedDocument = await parseDocument(
      buffer,
      document.file_type as DocumentFileType,
      document.mime_type
    )

    // Chunk the document with contextual enhancement
    console.log(`[Processor] Chunking document: ${document.name}`)
    const chunks = await chunkDocument(parsedDocument)

    // Calculate total tokens
    const totalTokens = chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0)

    // Store chunks with embeddings
    console.log(`[Processor] Storing ${chunks.length} chunks with embeddings`)
    await storeChunks(documentId, chunks)

    // Update document status to ready
    await updateDocumentStatus(documentId, 'ready', undefined, chunks.length, totalTokens)

    const processingTime = Date.now() - startTime
    console.log(`[Processor] Document processed in ${processingTime}ms: ${document.name}`)

    return {
      success: true,
      documentId,
      chunkCount: chunks.length,
      totalTokens,
      processingTimeMs: processingTime,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[Processor] Error processing document ${documentId}:`, error)

    // Update status to error
    await updateDocumentStatus(documentId, 'error', errorMessage)

    return {
      success: false,
      documentId,
      error: errorMessage,
      processingTimeMs: Date.now() - startTime,
    }
  }
}

/**
 * Delete a document and all its chunks
 */
export async function deleteDocument(documentId: string): Promise<void> {
  try {
    // Fetch document to get file URL
    const { data: document, error: fetchError } = await getSupabaseAdmin()
      .from('training_documents')
      .select('file_url')
      .eq('id', documentId)
      .single()

    if (fetchError) {
      throw new Error(`Document not found: ${fetchError.message}`)
    }

    // Delete from storage
    if (document?.file_url) {
      const filePath = document.file_url.replace('training-documents/', '')
      await getSupabaseAdmin().storage.from('training-documents').remove([filePath])
    }

    // Delete chunks (cascades from document deletion via FK)
    const { error: deleteError } = await getSupabaseAdmin()
      .from('training_documents')
      .delete()
      .eq('id', documentId)

    if (deleteError) {
      throw new Error(`Failed to delete document: ${deleteError.message}`)
    }
  } catch (error) {
    console.error(`[Processor] Error deleting document ${documentId}:`, error)
    throw error
  }
}

/**
 * Reprocess a document (delete chunks and process again)
 */
export async function reprocessDocument(documentId: string): Promise<ProcessingResult> {
  try {
    // Delete existing chunks
    const { error: deleteError } = await getSupabaseAdmin()
      .from('document_chunks')
      .delete()
      .eq('document_id', documentId)

    if (deleteError) {
      throw new Error(`Failed to delete existing chunks: ${deleteError.message}`)
    }

    // Process the document again
    return processDocument(documentId)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[Processor] Error reprocessing document ${documentId}:`, error)

    await updateDocumentStatus(documentId, 'error', errorMessage)

    return {
      success: false,
      documentId,
      error: errorMessage,
    }
  }
}
