-- Migration: Add community guides table for fully customizable emergency guides
-- This allows admins to create custom guides or customize templates for their community

-- Create community_guides table
CREATE TABLE IF NOT EXISTS community_guides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,

    -- Guide metadata
    name VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(100) DEFAULT 'menu_book',
    color VARCHAR(100) DEFAULT 'from-blue-500 to-cyan-600',

    -- Guide type (can be from template or 'custom')
    guide_type VARCHAR(50) NOT NULL DEFAULT 'custom',
    template_id VARCHAR(100), -- Reference to original template if based on one

    -- Guide content (fully editable JSON structure)
    sections JSONB NOT NULL DEFAULT '{
        "before": [],
        "during": [],
        "after": []
    }'::jsonb,
    supplies JSONB NOT NULL DEFAULT '[]'::jsonb,
    emergency_contacts JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Additional customizations
    custom_notes TEXT,
    local_resources JSONB DEFAULT '[]'::jsonb, -- Local shelters, meeting points, etc.

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT false, -- Only active guides are shown to members
    display_order INTEGER DEFAULT 0,

    -- Audit fields
    created_by UUID NOT NULL REFERENCES profiles(id),
    updated_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_community_guides_community_id ON community_guides(community_id);
CREATE INDEX IF NOT EXISTS idx_community_guides_is_active ON community_guides(is_active);
CREATE INDEX IF NOT EXISTS idx_community_guides_guide_type ON community_guides(guide_type);

-- Enable RLS
ALTER TABLE community_guides ENABLE ROW LEVEL SECURITY;

-- Policy: Community members can view active guides for their communities
CREATE POLICY "Community members can view active guides"
    ON community_guides
    FOR SELECT
    USING (
        is_active = true
        AND EXISTS (
            SELECT 1 FROM community_members
            WHERE community_members.community_id = community_guides.community_id
            AND community_members.user_id = auth.uid()
        )
    );

-- Policy: Community admins can view all guides (including inactive)
CREATE POLICY "Community admins can view all guides"
    ON community_guides
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM community_members
            WHERE community_members.community_id = community_guides.community_id
            AND community_members.user_id = auth.uid()
            AND community_members.role IN ('admin', 'super_admin')
        )
    );

-- Policy: Community admins can insert guides
CREATE POLICY "Community admins can create guides"
    ON community_guides
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM community_members
            WHERE community_members.community_id = community_guides.community_id
            AND community_members.user_id = auth.uid()
            AND community_members.role IN ('admin', 'super_admin')
        )
    );

-- Policy: Community admins can update guides
CREATE POLICY "Community admins can update guides"
    ON community_guides
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM community_members
            WHERE community_members.community_id = community_guides.community_id
            AND community_members.user_id = auth.uid()
            AND community_members.role IN ('admin', 'super_admin')
        )
    );

-- Policy: Community admins can delete guides
CREATE POLICY "Community admins can delete guides"
    ON community_guides
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM community_members
            WHERE community_members.community_id = community_guides.community_id
            AND community_members.user_id = auth.uid()
            AND community_members.role IN ('admin', 'super_admin')
        )
    );

-- Super admins can do everything
CREATE POLICY "Super admins have full access to guides"
    ON community_guides
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'super_admin'
        )
    );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_community_guides_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER trigger_update_community_guides_updated_at
    BEFORE UPDATE ON community_guides
    FOR EACH ROW
    EXECUTE FUNCTION update_community_guides_updated_at();

-- Add comment for documentation
COMMENT ON TABLE community_guides IS 'Stores fully customizable emergency guides for each community. Admins can create custom guides or customize templates.';
COMMENT ON COLUMN community_guides.guide_type IS 'Type of guide: fire, flood, earthquake, tsunami, etc. or "custom" for user-created guides';
COMMENT ON COLUMN community_guides.template_id IS 'Reference to original template ID if this guide was created from a template';
COMMENT ON COLUMN community_guides.is_active IS 'Only active guides are visible to regular community members';
