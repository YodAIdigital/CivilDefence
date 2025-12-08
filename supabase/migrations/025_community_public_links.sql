-- Migration: Add community public invite links
-- Allows creating shareable links that anyone can use to join a community

-- Create community_public_links table
CREATE TABLE IF NOT EXISTS community_public_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    code VARCHAR(12) NOT NULL UNIQUE, -- Short, shareable code (e.g., "ABC123XYZ")
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'member', -- Role assigned to users who join via this link
    is_active BOOLEAN NOT NULL DEFAULT true,
    uses_count INTEGER NOT NULL DEFAULT 0, -- Track how many times link has been used
    max_uses INTEGER, -- Optional limit on number of uses (NULL = unlimited)
    expires_at TIMESTAMPTZ, -- Optional expiration (NULL = never expires)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_link_role CHECK (role IN ('member', 'team_member')),
    CONSTRAINT unique_active_community_link UNIQUE (community_id, is_active) -- One active link per community
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_community_public_links_community ON community_public_links(community_id);
CREATE INDEX IF NOT EXISTS idx_community_public_links_code ON community_public_links(code);
CREATE INDEX IF NOT EXISTS idx_community_public_links_active ON community_public_links(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE community_public_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Anyone can view active public links by code (for joining)
CREATE POLICY "Anyone can view active public links by code"
    ON community_public_links
    FOR SELECT
    USING (is_active = true);

-- Community admins can view all links for their communities
CREATE POLICY "Community admins can view all links"
    ON community_public_links
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM community_members
            WHERE community_members.community_id = community_public_links.community_id
            AND community_members.user_id = auth.uid()
            AND community_members.role IN ('admin', 'super_admin')
        )
    );

-- Community admins can create links
CREATE POLICY "Community admins can create links"
    ON community_public_links
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM community_members
            WHERE community_members.community_id = community_public_links.community_id
            AND community_members.user_id = auth.uid()
            AND community_members.role IN ('admin', 'super_admin')
        )
    );

-- Community admins can update links
CREATE POLICY "Community admins can update links"
    ON community_public_links
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM community_members
            WHERE community_members.community_id = community_public_links.community_id
            AND community_members.user_id = auth.uid()
            AND community_members.role IN ('admin', 'super_admin')
        )
    );

-- Community admins can delete links
CREATE POLICY "Community admins can delete links"
    ON community_public_links
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM community_members
            WHERE community_members.community_id = community_public_links.community_id
            AND community_members.user_id = auth.uid()
            AND community_members.role IN ('admin', 'super_admin')
        )
    );

-- Function to generate unique short code
CREATE OR REPLACE FUNCTION generate_unique_invite_code()
RETURNS VARCHAR(12) AS $$
DECLARE
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Exclude confusing chars (I, O, 0, 1)
    result VARCHAR(12) := '';
    i INTEGER;
BEGIN
    FOR i IN 1..8 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate code on insert if not provided
CREATE OR REPLACE FUNCTION set_invite_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.code IS NULL OR NEW.code = '' THEN
        NEW.code := generate_unique_invite_code();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_invite_code
    BEFORE INSERT ON community_public_links
    FOR EACH ROW
    EXECUTE FUNCTION set_invite_code();

-- Trigger to update updated_at
CREATE TRIGGER update_community_public_links_updated_at
    BEFORE UPDATE ON community_public_links
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE community_public_links IS 'Stores shareable public invite links for communities';
COMMENT ON COLUMN community_public_links.code IS 'Short unique code for the invite link (e.g., ABC123XY)';
COMMENT ON COLUMN community_public_links.uses_count IS 'Number of times this link has been used to join';
COMMENT ON COLUMN community_public_links.max_uses IS 'Maximum number of uses allowed (NULL = unlimited)';
