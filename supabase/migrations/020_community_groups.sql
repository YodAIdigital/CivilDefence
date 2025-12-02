-- Community Groups Migration
-- Allows communities to create user groups for organizing members and targeted alerts

-- Create the community_groups table
CREATE TABLE IF NOT EXISTS community_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,

  -- Group identification
  name VARCHAR(100) NOT NULL,
  description TEXT,
  color VARCHAR(7) DEFAULT '#6b7280', -- Hex color for visual distinction
  icon VARCHAR(50) DEFAULT 'group', -- Material icon name

  -- Status
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,

  -- Tracking
  member_count INTEGER DEFAULT 0,

  -- Audit
  created_by UUID NOT NULL REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure unique group names within a community
  UNIQUE(community_id, name)
);

-- Create the community_group_members junction table
CREATE TABLE IF NOT EXISTS community_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Audit
  added_by UUID NOT NULL REFERENCES profiles(id),
  added_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure a user can only be in a group once
  UNIQUE(group_id, user_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_community_groups_community ON community_groups(community_id);
CREATE INDEX IF NOT EXISTS idx_community_groups_active ON community_groups(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_community_group_members_group ON community_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_community_group_members_user ON community_group_members(user_id);

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_community_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_community_groups_updated_at ON community_groups;
CREATE TRIGGER trigger_community_groups_updated_at
  BEFORE UPDATE ON community_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_community_groups_updated_at();

-- Create function to update member_count
CREATE OR REPLACE FUNCTION update_group_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE community_groups SET member_count = member_count + 1 WHERE id = NEW.group_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE community_groups SET member_count = member_count - 1 WHERE id = OLD.group_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_group_member_count ON community_group_members;
CREATE TRIGGER trigger_update_group_member_count
  AFTER INSERT OR DELETE ON community_group_members
  FOR EACH ROW
  EXECUTE FUNCTION update_group_member_count();

-- Enable RLS
ALTER TABLE community_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_group_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for community_groups

-- All community members can view groups in their communities
CREATE POLICY "Community members can view groups"
  ON community_groups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_members.community_id = community_groups.community_id
      AND community_members.user_id = auth.uid()
    )
  );

-- Admins and team members can create groups
CREATE POLICY "Community admins can create groups"
  ON community_groups FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_members.community_id = community_groups.community_id
      AND community_members.user_id = auth.uid()
      AND community_members.role IN ('admin', 'super_admin', 'team_member')
    )
  );

-- Admins and team members can update groups
CREATE POLICY "Community admins can update groups"
  ON community_groups FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_members.community_id = community_groups.community_id
      AND community_members.user_id = auth.uid()
      AND community_members.role IN ('admin', 'super_admin', 'team_member')
    )
  );

-- Only admins can delete groups
CREATE POLICY "Community admins can delete groups"
  ON community_groups FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_members.community_id = community_groups.community_id
      AND community_members.user_id = auth.uid()
      AND community_members.role IN ('admin', 'super_admin')
    )
  );

-- RLS Policies for community_group_members

-- All community members can view group memberships in their communities
CREATE POLICY "Community members can view group members"
  ON community_group_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM community_groups
      JOIN community_members ON community_members.community_id = community_groups.community_id
      WHERE community_groups.id = community_group_members.group_id
      AND community_members.user_id = auth.uid()
    )
  );

-- Admins and team members can add members to groups
CREATE POLICY "Community admins can add group members"
  ON community_group_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM community_groups
      JOIN community_members ON community_members.community_id = community_groups.community_id
      WHERE community_groups.id = community_group_members.group_id
      AND community_members.user_id = auth.uid()
      AND community_members.role IN ('admin', 'super_admin', 'team_member')
    )
  );

-- Admins and team members can remove members from groups
CREATE POLICY "Community admins can remove group members"
  ON community_group_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM community_groups
      JOIN community_members ON community_members.community_id = community_groups.community_id
      WHERE community_groups.id = community_group_members.group_id
      AND community_members.user_id = auth.uid()
      AND community_members.role IN ('admin', 'super_admin', 'team_member')
    )
  );

-- Add group_ids column to alerts table for targeting groups
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS target_group_ids UUID[] DEFAULT ARRAY[]::UUID[];

-- Add group_ids column to community_alert_rules table for targeting groups
ALTER TABLE community_alert_rules ADD COLUMN IF NOT EXISTS target_group_ids UUID[] DEFAULT ARRAY[]::UUID[];

-- Add comments for documentation
COMMENT ON TABLE community_groups IS 'Stores user groups within communities for organization and targeted alerts';
COMMENT ON TABLE community_group_members IS 'Junction table linking users to groups';
COMMENT ON COLUMN community_groups.color IS 'Hex color code for visual distinction in UI';
COMMENT ON COLUMN community_groups.icon IS 'Material icon name for visual display';
COMMENT ON COLUMN alerts.target_group_ids IS 'Array of group IDs to target with this alert';
COMMENT ON COLUMN community_alert_rules.target_group_ids IS 'Array of group IDs to target when rule triggers';
