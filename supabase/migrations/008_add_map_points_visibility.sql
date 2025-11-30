-- Migration: Add visibility column to community_map_points
-- This allows controlling who can see each map point

-- Add visibility column to community_map_points
ALTER TABLE community_map_points
ADD COLUMN IF NOT EXISTS visibility VARCHAR(50) DEFAULT 'members' NOT NULL;

-- Add constraint for valid visibility values
ALTER TABLE community_map_points
DROP CONSTRAINT IF EXISTS valid_visibility;

ALTER TABLE community_map_points
ADD CONSTRAINT valid_visibility CHECK (visibility IN ('admin_only', 'members', 'public'));

-- Add index for visibility filtering
CREATE INDEX IF NOT EXISTS idx_community_map_points_visibility ON community_map_points(visibility);

-- Update comment
COMMENT ON COLUMN community_map_points.visibility IS 'Who can see this point: admin_only (admins only), members (all community members), public (anyone)';
COMMENT ON COLUMN community_map_points.point_type IS 'Type of location: meeting_point, hospital, emergency_service, power, telecom, food_distribution, shelter, water, fuel, or other';

-- Drop existing SELECT policies and recreate with visibility support
DROP POLICY IF EXISTS "Community members can view active map points" ON community_map_points;
DROP POLICY IF EXISTS "Community admins can view all map points" ON community_map_points;
DROP POLICY IF EXISTS "Team members can view team map points" ON community_map_points;
DROP POLICY IF EXISTS "Community members can view member map points" ON community_map_points;
DROP POLICY IF EXISTS "Anyone can view public map points" ON community_map_points;

-- Recreate policies with visibility-aware logic
-- Admins can always see all points in their communities
CREATE POLICY "Community admins can view all map points"
    ON community_map_points
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM community_members
            WHERE community_members.community_id = community_map_points.community_id
            AND community_members.user_id = auth.uid()
            AND community_members.role IN ('admin', 'super_admin')
        )
    );

-- Regular members can see member-visible and public points
CREATE POLICY "Community members can view member map points"
    ON community_map_points
    FOR SELECT
    USING (
        is_active = true
        AND visibility IN ('members', 'public')
        AND EXISTS (
            SELECT 1 FROM community_members
            WHERE community_members.community_id = community_map_points.community_id
            AND community_members.user_id = auth.uid()
        )
    );

-- Public points can be seen by anyone if community is public
CREATE POLICY "Anyone can view public map points"
    ON community_map_points
    FOR SELECT
    USING (
        is_active = true
        AND visibility = 'public'
        AND EXISTS (
            SELECT 1 FROM communities
            WHERE communities.id = community_map_points.community_id
            AND communities.is_public = true
        )
    );
