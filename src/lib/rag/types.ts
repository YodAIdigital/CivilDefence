/**
 * RAG (Retrieval-Augmented Generation) Types
 * Internal types for the RAG processing pipeline
 */

export interface ParsedDocument {
  text: string
  pages?: {
    pageNumber: number
    text: string
  }[]
  metadata?: {
    title?: string
    author?: string
    createdAt?: string
    pageCount?: number
    [key: string]: unknown
  }
}

export interface ChunkingOptions {
  chunkSize: number
  chunkOverlap: number
  minChunkSize: number
}

export interface DocumentChunkData {
  chunkIndex: number
  content: string
  contextualContent: string
  tokenCount: number
  metadata: {
    source: string
    pageNumber?: number
    section?: string
    heading?: string
    [key: string]: unknown
  }
}

export interface DocumentChunk {
  chunkIndex: number
  content: string
  contextualContent: string
  tokenCount: number
  metadata: {
    pageNumber?: number
    documentTitle?: string
    totalChunks?: number
    contextualSummary?: string
    [key: string]: unknown
  }
}

export interface ProcessingResult {
  success: boolean
  documentId: string
  chunkCount?: number
  totalTokens?: number
  error?: string
  processingTimeMs?: number
}

export interface EmbeddingResult {
  embedding: number[]
  tokenCount: number
}

export interface RetrievalOptions {
  limit?: number
  minScore?: number
  useReranking?: boolean
  topK?: number
  useHybridSearch?: boolean
  rrfK?: number
  semanticThreshold?: number
}

export interface RetrievedChunk {
  chunkId: string
  documentId: string
  content: string
  contextualContent: string
  metadata: Record<string, unknown>
  semanticRank?: number
  ftsRank?: number
  rrfScore: number
}

export interface RetrievalResponse {
  chunks: RetrievedChunk[]
  queryEmbedding: number[]
  latencyMs: number
}

// Result type for individual retrieval results
export interface RetrievalResult {
  chunkId: string
  documentId: string
  content: string
  contextualContent: string
  metadata: Record<string, unknown>
  score: number
  semanticRank?: number | null
  ftsRank?: number | null
}

export interface RerankResult {
  chunkId: string
  content: string
  relevanceScore: number
  originalIndex: number
}

// File type detection helpers
export const MIME_TO_FILE_TYPE: Record<string, 'pdf' | 'docx' | 'txt' | 'image'> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain': 'txt',
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
}

export function getFileTypeFromMime(mimeType: string): 'pdf' | 'docx' | 'txt' | 'image' | null {
  return MIME_TO_FILE_TYPE[mimeType] || null
}

export function isValidMimeType(mimeType: string): boolean {
  return mimeType in MIME_TO_FILE_TYPE
}
