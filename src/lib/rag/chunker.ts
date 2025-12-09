/**
 * Contextual Chunking
 * Implements Anthropic's Contextual Retrieval method for improved chunk relevance
 *
 * Key features:
 * - 800 token chunks with 400 token overlap
 * - Prepends contextual summary to each chunk
 * - Preserves document structure and metadata
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import type { ParsedDocument, DocumentChunk, ChunkingOptions } from './types'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

const DEFAULT_OPTIONS: ChunkingOptions = {
  chunkSize: 800,      // tokens (approximately 3200 characters)
  chunkOverlap: 400,   // tokens (approximately 1600 characters)
  minChunkSize: 100,   // minimum tokens per chunk
}

// Approximate tokens from character count (roughly 4 chars per token)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

// Approximate character count from tokens
function tokensToChars(tokens: number): number {
  return tokens * 4
}

/**
 * Split text into overlapping chunks
 */
function splitIntoChunks(text: string, options: ChunkingOptions): string[] {
  const chunks: string[] = []
  const chunkSizeChars = tokensToChars(options.chunkSize)
  const overlapChars = tokensToChars(options.chunkOverlap)
  const minChunkChars = tokensToChars(options.minChunkSize)

  // Split by paragraphs first to maintain natural boundaries
  const paragraphs = text.split(/\n\n+/)

  let currentChunk = ''

  for (const paragraph of paragraphs) {
    const trimmedParagraph = paragraph.trim()
    if (!trimmedParagraph) continue

    // If adding this paragraph would exceed chunk size
    if (currentChunk.length + trimmedParagraph.length > chunkSizeChars && currentChunk.length > 0) {
      // Save current chunk
      chunks.push(currentChunk.trim())

      // Start new chunk with overlap from the end of the previous chunk
      const overlapStart = Math.max(0, currentChunk.length - overlapChars)
      currentChunk = currentChunk.slice(overlapStart).trim()

      // Add separator if there's overlap content
      if (currentChunk.length > 0) {
        currentChunk += '\n\n'
      }
    }

    // Add paragraph to current chunk
    currentChunk += (currentChunk.length > 0 && !currentChunk.endsWith('\n\n') ? '\n\n' : '') + trimmedParagraph
  }

  // Add the last chunk if it meets minimum size
  if (currentChunk.trim().length >= minChunkChars) {
    chunks.push(currentChunk.trim())
  } else if (chunks.length > 0 && currentChunk.trim().length > 0) {
    // Append to the last chunk if too small
    chunks[chunks.length - 1] += '\n\n' + currentChunk.trim()
  } else if (currentChunk.trim().length > 0) {
    // If it's the only content, add it anyway
    chunks.push(currentChunk.trim())
  }

  return chunks
}

/**
 * Generate contextual summary for a chunk using Gemini
 * This implements Anthropic's Contextual Retrieval approach
 */
async function generateChunkContext(
  chunk: string,
  documentTitle: string | undefined,
  documentSummary: string,
  chunkIndex: number,
  totalChunks: number
): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const prompt = `You are preparing document chunks for a civil defence knowledge base retrieval system. Given a chunk of text from a document, provide a brief 1-2 sentence contextual summary that situates this chunk within the broader document.

Document title: ${documentTitle || 'Untitled'}
Document overview: ${documentSummary}
Chunk position: ${chunkIndex + 1} of ${totalChunks}

Chunk content:
${chunk}

Provide ONLY the contextual summary (1-2 sentences) that explains what this chunk covers and its relevance to the document. Do not include any other text or formatting.`

    const result = await model.generateContent(prompt)
    const response = await result.response
    return response.text().trim()
  } catch (error) {
    console.error('[Chunker] Error generating context:', error)
    // Fallback to a basic context
    return `From ${documentTitle || 'document'}, section ${chunkIndex + 1} of ${totalChunks}.`
  }
}

/**
 * Generate a document summary for contextual chunking
 */
async function generateDocumentSummary(text: string, title: string | undefined): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    // Use first 4000 characters for summary
    const sampleText = text.slice(0, 4000)

    const prompt = `Summarize the main topics and purpose of this document in 2-3 sentences. This summary will be used to provide context for individual chunks during retrieval.

Document title: ${title || 'Untitled'}
Document content (excerpt):
${sampleText}

Provide ONLY the summary (2-3 sentences). Do not include any other text or formatting.`

    const result = await model.generateContent(prompt)
    const response = await result.response
    return response.text().trim()
  } catch (error) {
    console.error('[Chunker] Error generating document summary:', error)
    return title ? `Document about ${title}` : 'Document content'
  }
}

/**
 * Process a parsed document into contextual chunks
 */
export async function chunkDocument(
  document: ParsedDocument,
  options: Partial<ChunkingOptions> = {}
): Promise<DocumentChunk[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  // Get document summary first
  const documentSummary = await generateDocumentSummary(
    document.text,
    document.metadata?.title
  )

  // Split into raw chunks
  const rawChunks = splitIntoChunks(document.text, opts)

  if (rawChunks.length === 0) {
    throw new Error('No chunks generated from document')
  }

  // Process each chunk with contextual information
  const chunks: DocumentChunk[] = []

  for (let i = 0; i < rawChunks.length; i++) {
    const content = rawChunks[i]!

    // Generate contextual summary for this chunk
    const contextualSummary = await generateChunkContext(
      content,
      document.metadata?.title,
      documentSummary,
      i,
      rawChunks.length
    )

    // Prepend context to content (Anthropic's Contextual Retrieval method)
    const contextualContent = `${contextualSummary}\n\n${content}`

    // Determine page number from content position if available
    let pageNumber: number | undefined
    if (document.pages && document.pages.length > 0) {
      // Find which page this chunk likely belongs to
      let charPosition = 0
      for (let j = 0; j < i; j++) {
        charPosition += rawChunks[j]?.length || 0
      }

      let accumulatedLength = 0
      for (const page of document.pages) {
        accumulatedLength += page.text.length
        if (accumulatedLength >= charPosition) {
          pageNumber = page.pageNumber
          break
        }
      }
    }

    chunks.push({
      chunkIndex: i,
      content,
      contextualContent,
      tokenCount: estimateTokens(contextualContent),
      metadata: {
        ...(pageNumber !== undefined && { pageNumber }),
        ...(document.metadata?.title && { documentTitle: document.metadata.title }),
        totalChunks: rawChunks.length,
        contextualSummary,
      },
    })
  }

  return chunks
}

/**
 * Simple chunking without contextual enhancement (faster, for large documents)
 */
export function chunkDocumentSimple(
  document: ParsedDocument,
  options: Partial<ChunkingOptions> = {}
): DocumentChunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const rawChunks = splitIntoChunks(document.text, opts)

  return rawChunks.map((content, index) => ({
    chunkIndex: index,
    content,
    contextualContent: content, // No contextual enhancement
    tokenCount: estimateTokens(content),
    metadata: {
      ...(document.metadata?.title && { documentTitle: document.metadata.title }),
      totalChunks: rawChunks.length,
    },
  }))
}
