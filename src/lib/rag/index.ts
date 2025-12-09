/**
 * RAG Knowledge Base
 * Main exports for the RAG system
 */

// Types
export type {
  ParsedDocument,
  DocumentChunk,
  ChunkingOptions,
  RetrievalResult,
  RetrievalOptions,
  ProcessingResult,
} from './types'

// Parsers
export { parsePdf, parseDocx, parseTxt, parseImage } from './parsers'

// Chunking
export { chunkDocument, chunkDocumentSimple } from './chunker'

// Embeddings
export {
  generateEmbedding,
  generateEmbeddings,
  formatEmbeddingForPg,
  parseEmbeddingFromPg,
} from './embeddings'

// Document Processing
export {
  processDocument,
  deleteDocument,
  reprocessDocument,
} from './processor'

// Retrieval
export {
  retrieve,
  hybridSearch,
  semanticSearch,
  formatRetrievalContext,
  getDocumentInfo,
  logQuery,
} from './retriever'

// Reranking
export {
  rerank,
  rerankWithFallback,
  isRerankingAvailable,
} from './reranker'
