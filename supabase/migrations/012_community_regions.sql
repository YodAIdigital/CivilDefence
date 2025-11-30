-- Migration: Add community region polygon
-- Allows admins to draw a polygon outline defining the community's coverage area

-- Add region_polygon column to communities table
-- Stored as JSONB array of {lat, lng} coordinates forming a closed polygon
ALTER TABLE communities
ADD COLUMN IF NOT EXISTS region_polygon JSONB DEFAULT NULL;

-- Add region display settings
ALTER TABLE communities
ADD COLUMN IF NOT EXISTS region_color VARCHAR(7) DEFAULT '#3b82f6';

ALTER TABLE communities
ADD COLUMN IF NOT EXISTS region_opacity DECIMAL(3, 2) DEFAULT 0.2;

-- Comments for documentation
COMMENT ON COLUMN communities.region_polygon IS 'Array of {lat, lng} coordinates defining the community coverage area polygon';
COMMENT ON COLUMN communities.region_color IS 'Hex color code for the region overlay (default: blue)';
COMMENT ON COLUMN communities.region_opacity IS 'Opacity of the region fill (0.0 to 1.0, default: 0.2)';

-- Create index for communities with regions defined
CREATE INDEX IF NOT EXISTS idx_communities_has_region ON communities((region_polygon IS NOT NULL));
