-- ============================================================================
-- RAG Knowledge Base Migration
-- Adds vector storage for training documents with hybrid search capability
-- ============================================================================

-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- TABLES
-- ============================================================================

-- Training documents table - stores uploaded document metadata
CREATE TABLE IF NOT EXISTS training_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'docx', 'txt', 'image')),
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'processing', 'ready', 'error')),
    error_message TEXT,
    uploaded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    chunk_count INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for training_documents
CREATE INDEX IF NOT EXISTS idx_training_documents_status ON training_documents(status);
CREATE INDEX IF NOT EXISTS idx_training_documents_uploaded_by ON training_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_training_documents_file_type ON training_documents(file_type);
CREATE INDEX IF NOT EXISTS idx_training_documents_created ON training_documents(created_at DESC);

-- Document chunks table - stores processed chunks with embeddings
CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES training_documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    contextual_content TEXT NOT NULL,
    embedding vector(768) NOT NULL,
    token_count INTEGER NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(document_id, chunk_index)
);

-- Indexes for document_chunks
CREATE INDEX IF NOT EXISTS idx_document_chunks_document ON document_chunks(document_id);

-- Vector similarity index using HNSW for fast approximate nearest neighbor search
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding ON document_chunks
    USING hnsw (embedding vector_cosine_ops);

-- Full-text search column and index for BM25-like keyword search
ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS content_tsvector tsvector
    GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;
CREATE INDEX IF NOT EXISTS idx_document_chunks_fts ON document_chunks USING gin(content_tsvector);

-- RAG query log for analytics and debugging
CREATE TABLE IF NOT EXISTS rag_query_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    community_id UUID REFERENCES communities(id) ON DELETE SET NULL,
    query_text TEXT NOT NULL,
    retrieved_chunk_ids UUID[] NOT NULL DEFAULT '{}',
    retrieval_scores FLOAT[] NOT NULL DEFAULT '{}',
    model_used TEXT NOT NULL,
    response_text TEXT,
    latency_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rag_query_log_user ON rag_query_log(user_id);
CREATE INDEX IF NOT EXISTS idx_rag_query_log_community ON rag_query_log(community_id);
CREATE INDEX IF NOT EXISTS idx_rag_query_log_created ON rag_query_log(created_at DESC);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Hybrid search function combining semantic and full-text search with Reciprocal Rank Fusion
CREATE OR REPLACE FUNCTION hybrid_search(
    query_embedding vector(768),
    query_text TEXT,
    match_count INTEGER DEFAULT 10,
    rrf_k INTEGER DEFAULT 60
)
RETURNS TABLE (
    chunk_id UUID,
    document_id UUID,
    content TEXT,
    contextual_content TEXT,
    metadata JSONB,
    semantic_rank INTEGER,
    fts_rank INTEGER,
    rrf_score FLOAT
)
LANGUAGE sql
STABLE
AS $$
WITH semantic AS (
    SELECT
        dc.id,
        dc.document_id,
        dc.content,
        dc.contextual_content,
        dc.metadata,
        ROW_NUMBER() OVER (ORDER BY dc.embedding <=> query_embedding) AS rank
    FROM document_chunks dc
    INNER JOIN training_documents td ON td.id = dc.document_id
    WHERE td.status = 'ready'
    ORDER BY dc.embedding <=> query_embedding
    LIMIT match_count * 2
),
fulltext AS (
    SELECT
        dc.id,
        dc.document_id,
        dc.content,
        dc.contextual_content,
        dc.metadata,
        ROW_NUMBER() OVER (ORDER BY ts_rank_cd(dc.content_tsvector, websearch_to_tsquery('english', query_text)) DESC) AS rank
    FROM document_chunks dc
    INNER JOIN training_documents td ON td.id = dc.document_id
    WHERE td.status = 'ready'
      AND dc.content_tsvector @@ websearch_to_tsquery('english', query_text)
    ORDER BY ts_rank_cd(dc.content_tsvector, websearch_to_tsquery('english', query_text)) DESC
    LIMIT match_count * 2
)
SELECT
    COALESCE(s.id, f.id) AS chunk_id,
    COALESCE(s.document_id, f.document_id) AS document_id,
    COALESCE(s.content, f.content) AS content,
    COALESCE(s.contextual_content, f.contextual_content) AS contextual_content,
    COALESCE(s.metadata, f.metadata) AS metadata,
    s.rank::INTEGER AS semantic_rank,
    f.rank::INTEGER AS fts_rank,
    (COALESCE(1.0 / (rrf_k + s.rank), 0.0) + COALESCE(1.0 / (rrf_k + f.rank), 0.0)) AS rrf_score
FROM semantic s
FULL OUTER JOIN fulltext f ON s.id = f.id
ORDER BY rrf_score DESC
LIMIT match_count;
$$;

-- Semantic-only search function (for when query doesn't have good keywords)
CREATE OR REPLACE FUNCTION semantic_search(
    query_embedding vector(768),
    match_count INTEGER DEFAULT 10,
    match_threshold FLOAT DEFAULT 0.5
)
RETURNS TABLE (
    chunk_id UUID,
    document_id UUID,
    content TEXT,
    contextual_content TEXT,
    metadata JSONB,
    similarity FLOAT
)
LANGUAGE sql
STABLE
AS $$
SELECT
    dc.id AS chunk_id,
    dc.document_id,
    dc.content,
    dc.contextual_content,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) AS similarity
FROM document_chunks dc
INNER JOIN training_documents td ON td.id = dc.document_id
WHERE td.status = 'ready'
  AND 1 - (dc.embedding <=> query_embedding) > match_threshold
ORDER BY dc.embedding <=> query_embedding
LIMIT match_count;
$$;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update trigger for training_documents
CREATE TRIGGER update_training_documents_updated_at
    BEFORE UPDATE ON training_documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE training_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_query_log ENABLE ROW LEVEL SECURITY;

-- Super admins can manage training documents (full access)
CREATE POLICY "Super admins can manage training documents"
    ON training_documents
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role = 'super_admin'
        )
    );

-- All authenticated users can read ready training documents
CREATE POLICY "Authenticated users can read ready training documents"
    ON training_documents
    FOR SELECT
    USING (status = 'ready' AND auth.role() = 'authenticated');

-- Super admins can manage document chunks
CREATE POLICY "Super admins can manage chunks"
    ON document_chunks
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role = 'super_admin'
        )
    );

-- Users can read chunks of ready documents
CREATE POLICY "Users can read chunks of ready documents"
    ON document_chunks
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM training_documents td
            WHERE td.id = document_chunks.document_id
            AND td.status = 'ready'
            AND auth.role() = 'authenticated'
        )
    );

-- Users can view their own query logs
CREATE POLICY "Users can view own query logs"
    ON rag_query_log
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert query logs
CREATE POLICY "Users can insert query logs"
    ON rag_query_log
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Super admins can view all query logs
CREATE POLICY "Super admins can view all query logs"
    ON rag_query_log
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role = 'super_admin'
        )
    );
