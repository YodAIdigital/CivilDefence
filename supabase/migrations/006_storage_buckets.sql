-- Civil Defence Expo - Storage Buckets Setup
-- Migration: 006_storage_buckets
-- Created: 2024-11-30

-- ============================================================================
-- CREATE STORAGE BUCKETS
-- ============================================================================

-- Create avatars bucket (public for reading, authenticated for uploading)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'avatars',
    'avatars',
    true,
    2097152, -- 2MB limit
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

-- ============================================================================
-- STORAGE POLICIES FOR AVATARS BUCKET
-- ============================================================================

-- Allow public read access to avatars
CREATE POLICY "Public can view avatars"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'avatars');

-- Allow authenticated users to upload their own avatars
CREATE POLICY "Users can upload own avatars"
    ON storage.objects
    FOR INSERT
    WITH CHECK (
        bucket_id = 'avatars'
        AND auth.role() = 'authenticated'
        AND (storage.foldername(name))[1] = 'avatars'
    );

-- Allow users to update their own avatars
CREATE POLICY "Users can update own avatars"
    ON storage.objects
    FOR UPDATE
    USING (
        bucket_id = 'avatars'
        AND auth.role() = 'authenticated'
    );

-- Allow users to delete their own avatars
CREATE POLICY "Users can delete own avatars"
    ON storage.objects
    FOR DELETE
    USING (
        bucket_id = 'avatars'
        AND auth.role() = 'authenticated'
    );
