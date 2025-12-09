-- ============================================================================
-- RAG Storage Bucket Migration
-- Creates storage bucket for training documents with appropriate policies
-- ============================================================================

-- Create training-documents storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'training-documents',
    'training-documents',
    false,
    52428800, -- 50MB limit
    ARRAY[
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'image/jpeg',
        'image/png',
        'image/webp'
    ]
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 52428800,
    allowed_mime_types = ARRAY[
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'image/jpeg',
        'image/png',
        'image/webp'
    ];

-- ============================================================================
-- STORAGE POLICIES
-- ============================================================================

-- Super admins can upload training documents
CREATE POLICY "Super admins can upload training documents"
    ON storage.objects
    FOR INSERT
    WITH CHECK (
        bucket_id = 'training-documents'
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role = 'super_admin'
        )
    );

-- Super admins can update training documents
CREATE POLICY "Super admins can update training documents"
    ON storage.objects
    FOR UPDATE
    USING (
        bucket_id = 'training-documents'
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role = 'super_admin'
        )
    );

-- Super admins can delete training documents
CREATE POLICY "Super admins can delete training documents"
    ON storage.objects
    FOR DELETE
    USING (
        bucket_id = 'training-documents'
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role = 'super_admin'
        )
    );

-- Authenticated users can read training documents (for processing)
CREATE POLICY "Authenticated can read training documents"
    ON storage.objects
    FOR SELECT
    USING (
        bucket_id = 'training-documents'
        AND auth.role() = 'authenticated'
    );
