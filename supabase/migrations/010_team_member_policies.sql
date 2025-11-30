-- Migration: Update RLS policies to recognize team_member role
-- This must run AFTER 009_add_team_member_role.sql has been committed
-- Team members can do most things admins can, except manage other members' roles

-- Update map points visibility policy to include team_members
DROP POLICY IF EXISTS "Community admins can view all map points" ON community_map_points;

CREATE POLICY "Community admins and team members can view all map points"
    ON community_map_points
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM community_members
            WHERE community_members.community_id = community_map_points.community_id
            AND community_members.user_id = auth.uid()
            AND community_members.role IN ('admin', 'super_admin', 'team_member')
        )
    );

-- Team members can also modify map points (same as admins)
DROP POLICY IF EXISTS "Community admins can manage map points" ON community_map_points;

CREATE POLICY "Community admins and team members can manage map points"
    ON community_map_points
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM community_members
            WHERE community_members.community_id = community_map_points.community_id
            AND community_members.user_id = auth.uid()
            AND community_members.role IN ('admin', 'super_admin', 'team_member')
        )
    );
