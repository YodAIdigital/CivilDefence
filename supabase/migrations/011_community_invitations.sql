-- Migration: Add community invitations table
-- Allows inviting users to communities via email (even if they don't have an account yet)

-- Create community_invitations table
CREATE TABLE IF NOT EXISTS community_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'member',
    invited_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    token UUID NOT NULL DEFAULT gen_random_uuid(),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT valid_invitation_role CHECK (role IN ('member', 'team_member', 'admin')),
    CONSTRAINT valid_invitation_status CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
    CONSTRAINT unique_pending_invitation UNIQUE (community_id, email, status)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_community_invitations_community ON community_invitations(community_id);
CREATE INDEX IF NOT EXISTS idx_community_invitations_email ON community_invitations(email);
CREATE INDEX IF NOT EXISTS idx_community_invitations_token ON community_invitations(token);
CREATE INDEX IF NOT EXISTS idx_community_invitations_status ON community_invitations(status);

-- Enable RLS
ALTER TABLE community_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Community admins can view all invitations for their communities
CREATE POLICY "Community admins can view invitations"
    ON community_invitations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM community_members
            WHERE community_members.community_id = community_invitations.community_id
            AND community_members.user_id = auth.uid()
            AND community_members.role IN ('admin', 'super_admin')
        )
    );

-- Community admins can create invitations
CREATE POLICY "Community admins can create invitations"
    ON community_invitations
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM community_members
            WHERE community_members.community_id = community_invitations.community_id
            AND community_members.user_id = auth.uid()
            AND community_members.role IN ('admin', 'super_admin')
        )
    );

-- Community admins can update invitations (cancel them)
CREATE POLICY "Community admins can update invitations"
    ON community_invitations
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM community_members
            WHERE community_members.community_id = community_invitations.community_id
            AND community_members.user_id = auth.uid()
            AND community_members.role IN ('admin', 'super_admin')
        )
    );

-- Community admins can delete invitations
CREATE POLICY "Community admins can delete invitations"
    ON community_invitations
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM community_members
            WHERE community_members.community_id = community_invitations.community_id
            AND community_members.user_id = auth.uid()
            AND community_members.role IN ('admin', 'super_admin')
        )
    );

-- Anyone can view their own invitations by email (for accepting)
CREATE POLICY "Users can view their own invitations"
    ON community_invitations
    FOR SELECT
    USING (
        email = (SELECT email FROM profiles WHERE id = auth.uid())
        OR token IS NOT NULL -- Allow lookup by token for unauthenticated accept flow
    );

-- Comments
COMMENT ON TABLE community_invitations IS 'Stores pending invitations to join communities';
COMMENT ON COLUMN community_invitations.token IS 'Unique token for accepting invitation via email link';
COMMENT ON COLUMN community_invitations.status IS 'Invitation status: pending, accepted, expired, or cancelled';
