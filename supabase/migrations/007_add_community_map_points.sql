-- Migration: Add community map points table for additional location references
-- This allows admins to add hospitals, emergency services, power centers, food distribution, etc.

-- Create community_map_points table
CREATE TABLE IF NOT EXISTS community_map_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,

    -- Point details
    name VARCHAR(255) NOT NULL,
    description TEXT,
    point_type VARCHAR(100) NOT NULL DEFAULT 'other', -- hospital, emergency_service, power, telecom, food_distribution, shelter, other
    icon VARCHAR(100) DEFAULT 'location_on',
    color VARCHAR(20) DEFAULT '#3b82f6',

    -- Location
    address TEXT,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,

    -- Contact information
    contact_name VARCHAR(255),
    contact_phone VARCHAR(50),
    contact_email VARCHAR(255),

    -- Display settings
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER DEFAULT 0,

    -- Audit fields
    created_by UUID NOT NULL REFERENCES profiles(id),
    updated_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_community_map_points_community_id ON community_map_points(community_id);
CREATE INDEX IF NOT EXISTS idx_community_map_points_is_active ON community_map_points(is_active);
CREATE INDEX IF NOT EXISTS idx_community_map_points_point_type ON community_map_points(point_type);

-- Enable RLS
ALTER TABLE community_map_points ENABLE ROW LEVEL SECURITY;

-- Policy: Community members can view active map points for their communities
CREATE POLICY "Community members can view active map points"
    ON community_map_points
    FOR SELECT
    USING (
        is_active = true
        AND EXISTS (
            SELECT 1 FROM community_members
            WHERE community_members.community_id = community_map_points.community_id
            AND community_members.user_id = auth.uid()
        )
    );

-- Policy: Community admins can view all map points (including inactive)
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

-- Policy: Community admins can insert map points
CREATE POLICY "Community admins can create map points"
    ON community_map_points
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM community_members
            WHERE community_members.community_id = community_map_points.community_id
            AND community_members.user_id = auth.uid()
            AND community_members.role IN ('admin', 'super_admin')
        )
    );

-- Policy: Community admins can update map points
CREATE POLICY "Community admins can update map points"
    ON community_map_points
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM community_members
            WHERE community_members.community_id = community_map_points.community_id
            AND community_members.user_id = auth.uid()
            AND community_members.role IN ('admin', 'super_admin')
        )
    );

-- Policy: Community admins can delete map points
CREATE POLICY "Community admins can delete map points"
    ON community_map_points
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM community_members
            WHERE community_members.community_id = community_map_points.community_id
            AND community_members.user_id = auth.uid()
            AND community_members.role IN ('admin', 'super_admin')
        )
    );

-- Super admins can do everything
CREATE POLICY "Super admins have full access to map points"
    ON community_map_points
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'super_admin'
        )
    );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_community_map_points_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER trigger_update_community_map_points_updated_at
    BEFORE UPDATE ON community_map_points
    FOR EACH ROW
    EXECUTE FUNCTION update_community_map_points_updated_at();

-- Add comment for documentation
COMMENT ON TABLE community_map_points IS 'Stores additional map reference points for communities such as hospitals, emergency services, power centers, etc.';
COMMENT ON COLUMN community_map_points.point_type IS 'Type of location: hospital, emergency_service, power, telecom, food_distribution, shelter, water, fuel, or other';
COMMENT ON COLUMN community_map_points.is_active IS 'Only active points are visible to regular community members';
