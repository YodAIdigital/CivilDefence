-- Civil Defence Expo - Add Meeting Point to Communities
-- Migration: 004_add_meeting_point
-- Created: 2024-11-30

-- ============================================================================
-- ADD MEETING POINT FIELDS TO COMMUNITIES TABLE
-- ============================================================================

-- Add meeting point fields to communities table
ALTER TABLE public.communities
ADD COLUMN IF NOT EXISTS meeting_point_name TEXT,
ADD COLUMN IF NOT EXISTS meeting_point_address TEXT,
ADD COLUMN IF NOT EXISTS meeting_point_lat DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS meeting_point_lng DECIMAL(11, 8);

-- Add index for geospatial queries on meeting points
CREATE INDEX IF NOT EXISTS idx_communities_meeting_point
ON public.communities(meeting_point_lat, meeting_point_lng)
WHERE meeting_point_lat IS NOT NULL AND meeting_point_lng IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.communities.meeting_point_name IS 'Name of the emergency meeting point for the community';
COMMENT ON COLUMN public.communities.meeting_point_address IS 'Address of the emergency meeting point';
COMMENT ON COLUMN public.communities.meeting_point_lat IS 'Latitude coordinate of the meeting point';
COMMENT ON COLUMN public.communities.meeting_point_lng IS 'Longitude coordinate of the meeting point';
